// Evaluation Engine: evidence-backed reviews and mission metrics.
import * as orchestrator from "./orchestrator.mjs";
import { BrainiverseError } from "./store.mjs";

export const VERDICTS = ["pass", "pass_with_issues", "fail"];

/** A review must cite evidence. A pass without evidence is refused, as is reviewing nothing. */
export function addReview(state, target, verdict, evidence = [], issues = [], reviewer = "leader") {
  if (!VERDICTS.includes(verdict)) throw new BrainiverseError(`verdict must be one of ${VERDICTS.join(", ")}`);
  if (!evidence.some((e) => e && e.trim())) throw new BrainiverseError("a review needs evidence: what was checked and how");
  if (verdict === "fail" && !issues.length) throw new BrainiverseError("a failing review must list the issues");
  if (target !== "mission") {
    const task = orchestrator.getTask(state, target);
    if (!["submitted", "done"].includes(task.status)) {
      throw new BrainiverseError(`${target} is ${task.status}; there is nothing to review yet`);
    }
  }
  const review = { target, verdict, evidence: [...evidence], issues: [...issues], reviewer, at: orchestrator.now() };
  state.reviews.push(review);
  return review;
}

const round = (n, digits) => Math.round(n * 10 ** digits) / 10 ** digits;

export function metrics(state) {
  const tasks = Object.values(state.tasks);
  const invocations = Object.values(state.invocations);
  const latencies = invocations.filter((i) => i.finished).map((i) => i.finished - i.started).sort((a, b) => a - b);
  const byAgent = {};
  for (const i of invocations) byAgent[i.agent] = (byAgent[i.agent] || 0) + 1;
  const enabled = state.team.agents.filter((a) => a.enabled && a.id !== state.team.leader).map((a) => a.id);
  const deliverables = tasks.filter((t) => t.kind === "task");
  const firstTime = deliverables.filter((t) => t.status === "done" && t.iterations === 0 && t.attempts === 1);
  // Invocations whose output was never used: failed, timed out, cancelled, or superseded by a revision.
  const unused = invocations.filter((i) => ["failed", "timed_out", "cancelled"].includes(i.status)).length +
    tasks.reduce((n, t) => n + t.iterations, 0);
  return {
    tasks_total: tasks.length,
    tasks_done: tasks.filter((t) => t.status === "done").length,
    tasks_failed: tasks.filter((t) => t.status === "failed").length,
    completion_rate: deliverables.length ? round(deliverables.filter((t) => t.status === "done").length / deliverables.length, 3) : null,
    first_pass_acceptance: deliverables.length ? round(firstTime.length / deliverables.length, 3) : null,
    invocations: invocations.length,
    invocations_by_agent: byAgent,
    unused_invocations: unused,
    retries: tasks.reduce((n, t) => n + Math.max(t.attempts - 1, 0), 0),
    revisions: tasks.reduce((n, t) => n + t.iterations, 0),
    idle_team_members: enabled.filter((a) => !(a in byAgent)),
    latency_s: {
      median: latencies.length ? round(latencies[Math.floor(latencies.length / 2)], 1) : null,
      max: latencies.length ? round(latencies.at(-1), 1) : null,
    },
    tokens: state.usage.tokens,
    reviews: Object.fromEntries(VERDICTS.map((v) => [v, state.reviews.filter((r) => r.verdict === v).length])),
    results_with_sources: tasks.filter((t) => t.result && t.result.evidence?.length).length,
    results_total: tasks.filter((t) => t.result).length,
  };
}
