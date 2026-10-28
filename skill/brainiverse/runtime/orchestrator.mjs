// Orchestration Engine: missions, the task graph, scheduling, limits, and result handling.
//
// Task lifecycle:
//   pending -> running -> submitted -> done
//                 |           |
//                 |           +-> (revise) -> pending       bounded by max_iterations
//                 +-> (fail/timeout) -> pending (retry) | failed
//   any open state -> cancelled; tasks whose dependencies failed or were cancelled -> blocked
//
// "done" is reached only through accept(): an agent's output is a proposal until the Leader
// (or a review) accepts it against the acceptance criteria.
import * as teams from "./teams.mjs";
import * as tools from "./tools.mjs";
import { BrainiverseError, checkSlug, nextId, slugify } from "./store.mjs";

export const DEFAULT_LIMITS = {
  max_concurrent: 4,
  max_invocations: 40,
  max_tasks: 60,
  max_retries: 1,
  default_timeout_s: 900,
  max_iterations: 3,
  max_delegation_depth: 2,
  max_meeting_participants: 5,
  token_budget: 0, // 0 = no budget enforced
};

export const OPEN = ["pending", "running", "submitted"];
export const TERMINAL = ["done", "failed", "cancelled", "blocked"];
export const RESULT_STATUSES = ["complete", "partial", "blocked", "failed"];
const RESULT_LIST_FIELDS = ["evidence", "assumptions", "recommendations", "blockers", "next_steps",
  "deliverables", "actions", "memory_suggestions"];

export const now = () => Date.now() / 1000;

// -- missions -----------------------------------------------------------------

export function newMission(goal, team, { id, title, success = [], constraints = [], assumptions = [], resources = [], limits = {} } = {}) {
  if (!goal || !goal.trim()) throw new BrainiverseError("a mission needs a goal");
  teams.validateTeam(team);
  const merged = { ...DEFAULT_LIMITS };
  for (const [key, value] of Object.entries(limits)) {
    if (!(key in DEFAULT_LIMITS)) throw new BrainiverseError(`unknown limit ${key}; known: ${Object.keys(DEFAULT_LIMITS).join(", ")}`);
    if (!Number.isInteger(value) || value < 0) throw new BrainiverseError(`limit ${key} must be a non-negative integer`);
    merged[key] = value;
  }
  return {
    schema_version: 1,
    id: checkSlug(id || slugify(title || goal).slice(0, 40).replace(/-+$/, ""), "mission id"),
    title: title || goal.trim().slice(0, 80),
    goal: goal.trim(),
    status: "active",
    created: now(),
    success_criteria: [...success],
    constraints: [...constraints],
    assumptions: [...assumptions],
    resources: [...resources],
    team,
    team_ref: team.id,
    limits: merged,
    tasks: {},
    invocations: {},
    meetings: {},
    approvals: {},
    skills: { gaps: {}, candidates: {} },
    reviews: [],
    decisions: [],
    memory: [],
    usage: { tokens: 0 },
    final_report: null,
  };
}

export function requireActive(state) {
  if (state.status !== "active") throw new BrainiverseError(`mission is ${state.status}; resume it first`);
}

// -- tasks ----------------------------------------------------------------------

function depthOf(state, parent) {
  let depth = 0;
  const seen = new Set();
  while (parent && !seen.has(parent)) {
    seen.add(parent);
    depth += 1;
    parent = state.tasks[parent]?.parent;
  }
  return depth;
}

function createsCycle(state, taskId, dependsOn) {
  const stack = [...dependsOn];
  const seen = new Set();
  while (stack.length) {
    const current = stack.pop();
    if (current === taskId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    stack.push(...(state.tasks[current]?.depends_on || []));
  }
  return false;
}

export function addTask(state, {
  objective, agent, inputs = [], expected_output = "", constraints = [], depends_on = [], acceptance = [],
  context = "", needs = [], timeout_s, max_retries, parent = null, kind = "task", meeting = null,
}) {
  requireActive(state);
  if (!objective || !objective.trim()) throw new BrainiverseError("a task needs an objective");
  const limits = state.limits;
  if (Object.keys(state.tasks).length >= limits.max_tasks) {
    throw new BrainiverseError(`task limit reached (${limits.max_tasks}); raise limits.max_tasks to continue`);
  }
  const profile = teams.findAgent(state.team, agent);
  if (!profile.enabled) throw new BrainiverseError(`${profile.name} is disabled`);
  for (const dep of depends_on) if (!(dep in state.tasks)) throw new BrainiverseError(`unknown dependency ${dep}`);
  const unknown = tools.unknownCapabilities(needs);
  if (unknown.length) throw new BrainiverseError(`unknown capabilities ${unknown}`);
  if (parent) {
    if (!(parent in state.tasks)) throw new BrainiverseError(`unknown parent task ${parent}`);
    const depth = depthOf(state, parent);
    if (depth > limits.max_delegation_depth) {
      throw new BrainiverseError(`delegation depth ${depth} exceeds max_delegation_depth (${limits.max_delegation_depth})`);
    }
  }
  const taskId = nextId("T", state.tasks);
  if (createsCycle(state, taskId, depends_on)) throw new BrainiverseError("dependency cycle");
  const task = {
    id: taskId,
    kind,
    objective: objective.trim(),
    agent,
    inputs: [...inputs],
    expected_output,
    constraints: [...constraints],
    depends_on: [...depends_on],
    acceptance: [...acceptance],
    context,
    needs: [...needs],
    timeout_s: timeout_s ?? Math.min(limits.default_timeout_s, profile.limits?.timeout_s ?? limits.default_timeout_s),
    max_retries: max_retries ?? Math.min(limits.max_retries, profile.limits?.max_retries ?? limits.max_retries),
    parent,
    meeting,
    status: "pending",
    attempts: 0,
    iterations: 0,
    feedback: [],
    errors: [],
    approval: null,
    invocations: [],
    result: null,
    acceptance_evidence: "",
    created: now(),
    started: null,
    finished: null,
  };
  state.tasks[taskId] = task;
  propagateBlocks(state);
  return task;
}

export function getTask(state, taskId) {
  if (!(taskId in state.tasks)) throw new BrainiverseError(`no task ${taskId}`);
  return state.tasks[taskId];
}

/** Pending tasks whose dependencies can never finish become blocked. */
function propagateBlocks(state) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const task of Object.values(state.tasks)) {
      if (task.status !== "pending") continue;
      const bad = task.depends_on.filter((d) => ["failed", "cancelled", "blocked"].includes(state.tasks[d].status));
      if (bad.length) {
        task.status = "blocked";
        task.errors.push(`blocked: dependency ${bad.join(", ")} did not complete`);
        changed = true;
      }
    }
  }
}

export const runningCount = (state) => Object.values(state.tasks).filter((t) => t.status === "running").length;

/**
 * Pending tasks whose dependencies are all done, limited by free concurrency slots.
 * Everything returned can run in parallel: none depends on another.
 */
export function readyTasks(state) {
  propagateBlocks(state);
  const free = state.limits.max_concurrent - runningCount(state);
  const ready = Object.values(state.tasks).filter((t) =>
    t.status === "pending" && t.depends_on.every((d) => state.tasks[d].status === "done"));
  return ready.slice(0, Math.max(free, 0));
}

function checkPermissions(state, task, profile) {
  for (const capability of task.needs) {
    if (!profile.capabilities.includes(capability)) {
      throw new BrainiverseError(`${profile.name} lacks ${capability}; grant it (\`agent grant\`) or reassign the task`);
    }
    if (tools.isGated(capability)) {
      const approval = state.approvals[task.approval || ""];
      const ok = approval && approval.status === "approved" && approval.capability === capability &&
        [null, undefined, profile.id].includes(approval.agent) && [null, undefined, task.id].includes(approval.task);
      if (!ok) {
        throw new BrainiverseError(`task needs ${capability}, which requires a human approval: ` +
          `\`brainiverse approval request --capability ${capability} --agent ${profile.id} --task ${task.id} --detail ...\`, ` +
          "then `task attach-approval`");
      }
    }
  }
}

/** Record a real invocation and mark the task running. Call right before invoking the agent. */
export function startTask(state, taskId, at = now()) {
  requireActive(state);
  const task = getTask(state, taskId);
  if (task.status !== "pending") throw new BrainiverseError(`${taskId} is ${task.status}, not pending`);
  if (task.depends_on.some((d) => state.tasks[d].status !== "done")) {
    throw new BrainiverseError(`${taskId} is waiting on dependencies ${task.depends_on.join(", ")}`);
  }
  const limits = state.limits;
  if (runningCount(state) >= limits.max_concurrent) {
    throw new BrainiverseError(`concurrency limit (${limits.max_concurrent}) reached; wait for a running task`);
  }
  if (Object.keys(state.invocations).length >= limits.max_invocations) {
    throw new BrainiverseError(`invocation budget exhausted (${limits.max_invocations}); raise limits.max_invocations ` +
      "with the human's agreement");
  }
  if (limits.token_budget && state.usage.tokens >= limits.token_budget) {
    throw new BrainiverseError(`token budget exhausted (${state.usage.tokens}/${limits.token_budget})`);
  }
  const profile = teams.findAgent(state.team, task.agent);
  if (!profile.enabled) throw new BrainiverseError(`${profile.name} is disabled`);
  const agentCalls = Object.values(state.invocations).filter((i) => i.agent === profile.id).length;
  if (agentCalls >= (profile.limits?.max_invocations ?? Infinity)) {
    throw new BrainiverseError(`${profile.name} reached its invocation limit`);
  }
  checkPermissions(state, task, profile);
  if (task.approval) state.approvals[task.approval].status = "consumed";
  const invocationId = nextId("I", state.invocations);
  state.invocations[invocationId] = {
    id: invocationId, task: taskId, agent: profile.id, status: "running", started: at, finished: null, tokens: 0,
  };
  task.status = "running";
  task.attempts += 1;
  task.started = at;
  task.invocations.push(invocationId);
  return state.invocations[invocationId];
}

/** Check an agent result against the communication protocol. */
export function validateResult(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) throw new BrainiverseError("result must be a JSON object");
  if (!RESULT_STATUSES.includes(result.status)) {
    throw new BrainiverseError(`result.status must be one of ${RESULT_STATUSES.join(", ")}`);
  }
  if (!result.findings || (Array.isArray(result.findings) && !result.findings.length)) {
    throw new BrainiverseError("result.findings is required (the deliverable or what was found)");
  }
  for (const field of RESULT_LIST_FIELDS) {
    result[field] ??= [];
    if (!Array.isArray(result[field])) throw new BrainiverseError(`result.${field} must be a list`);
  }
  result.uncertainty ??= "";
  for (const action of result.actions) {
    // An action claimed as done must carry proof from the execution layer.
    if (!action || typeof action !== "object" || !("action" in action)) {
      throw new BrainiverseError("each result.actions item needs an 'action' field");
    }
    if (action.verified && !action.evidence) {
      throw new BrainiverseError(`action ${JSON.stringify(action.action)} is marked verified but has no evidence`);
    }
  }
  return result;
}

export function submit(state, taskId, result, { tokens = 0, at = now() } = {}) {
  const task = getTask(state, taskId);
  if (task.status !== "running") {
    throw new BrainiverseError(`${taskId} is ${task.status}; only a running task accepts a submission`);
  }
  validateResult(result);
  Object.assign(state.invocations[task.invocations.at(-1)], { status: "submitted", finished: at, tokens });
  state.usage.tokens += tokens;
  task.result = result;
  task.status = "submitted";
  task.finished = at;
  return task;
}

export function accept(state, taskId, evidence = "") {
  const task = getTask(state, taskId);
  if (task.status !== "submitted") throw new BrainiverseError(`${taskId} is ${task.status}; only submitted work can be accepted`);
  if (task.acceptance.length && !evidence.trim()) {
    throw new BrainiverseError(`${taskId} has acceptance criteria; say how each was verified (--evidence)`);
  }
  task.status = "done";
  task.acceptance_evidence = evidence;
  return task;
}

export function revise(state, taskId, feedback) {
  const task = getTask(state, taskId);
  if (!["submitted", "done"].includes(task.status)) {
    throw new BrainiverseError(`${taskId} is ${task.status}; only submitted or done work can be revised`);
  }
  if (!feedback || !feedback.trim()) throw new BrainiverseError("say what needs to change");
  if (task.iterations >= state.limits.max_iterations) {
    throw new BrainiverseError(`${taskId} hit max_iterations (${state.limits.max_iterations}); ` +
      "escalate to the human instead of looping");
  }
  task.iterations += 1;
  task.feedback.push(feedback);
  task.status = "pending";
  return task;
}

export function fail(state, taskId, error, { at = now(), invocationStatus = "failed" } = {}) {
  const task = getTask(state, taskId);
  if (!["running", "submitted"].includes(task.status)) {
    throw new BrainiverseError(`${taskId} is ${task.status}; only running or submitted tasks can fail`);
  }
  const last = state.invocations[task.invocations.at(-1)];
  if (last && last.status === "running") Object.assign(last, { status: invocationStatus, finished: at });
  task.errors.push(error);
  if (task.attempts <= task.max_retries) {
    task.status = "pending"; // retry
  } else {
    task.status = "failed";
    task.finished = at;
    propagateBlocks(state);
  }
  return task;
}

export function cancel(state, taskId, reason = "cancelled by the human") {
  const task = getTask(state, taskId);
  if (TERMINAL.includes(task.status)) throw new BrainiverseError(`${taskId} is already ${task.status}`);
  const last = state.invocations[task.invocations.at(-1)];
  if (last && last.status === "running") Object.assign(last, { status: "cancelled", finished: now() });
  task.status = "cancelled";
  task.errors.push(reason);
  propagateBlocks(state);
  return task;
}

export function sweepTimeouts(state, at = now()) {
  const timedOut = [];
  for (const task of Object.values(state.tasks)) {
    if (task.status === "running" && task.timeout_s && at - task.started > task.timeout_s) {
      fail(state, task.id, `timed out after ${task.timeout_s}s`, { at, invocationStatus: "timed_out" });
      timedOut.push(task.id);
    }
  }
  return timedOut;
}

export function reassign(state, taskId, agent) {
  const task = getTask(state, taskId);
  if (task.status !== "pending") throw new BrainiverseError(`only pending tasks can be reassigned; ${taskId} is ${task.status}`);
  const profile = teams.findAgent(state.team, agent);
  if (!profile.enabled) throw new BrainiverseError(`${profile.name} is disabled`);
  task.agent = agent;
  return task;
}

export function progress(state) {
  const counts = Object.fromEntries([...OPEN, ...TERMINAL].map((s) => [s, 0]));
  for (const task of Object.values(state.tasks)) counts[task.status] += 1;
  return {
    mission: state.id,
    status: state.status,
    tasks: counts,
    ready: readyTasks(structuredClone(state)).map((t) => t.id),
    awaiting_review: Object.values(state.tasks).filter((t) => t.status === "submitted").map((t) => t.id),
    pending_approvals: Object.values(state.approvals).filter((a) => a.status === "pending").map((a) => a.id),
    open_questions: Object.values(state.meetings).flatMap((m) =>
      m.questions.filter((q) => !q.answer).map((q) => ({ meeting: m.id, question: q.text }))),
    invocations: `${Object.keys(state.invocations).length}/${state.limits.max_invocations}`,
    tokens: state.usage.tokens,
  };
}
