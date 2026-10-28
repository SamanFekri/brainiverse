// Command-line integration layer. The Leader (the main Claude Code session) drives everything
// through these commands; subagents may only read their brief and submit their result.
import fs from "node:fs";
import * as audit from "./audit.mjs";
import * as briefs from "./briefs.mjs";
import * as evaluation from "./evaluation.mjs";
import * as meetings from "./meetings.mjs";
import * as memory from "./memory.mjs";
import * as orchestrator from "./orchestrator.mjs";
import * as permissions from "./permissions.mjs";
import * as registry from "./registry.mjs";
import * as skills from "./skills.mjs";
import * as teams from "./teams.mjs";
import * as tools from "./tools.mjs";
import { HelpRequested, parse } from "./args.mjs";
import { BrainiverseError, Workspace, readJson, writeJson } from "./store.mjs";

// [command, subcommand] pairs a subagent may run. Everything else is Leader-only.
const AGENT_ALLOWED = new Set([
  "task brief", "task submit", "task show", "task list", "status", "meeting show", "chat show",
  "skill local", "skill scan", "archetypes", "memory list",
]);

const splitCsv = (value) => (value || "").split(",").map((v) => v.trim()).filter(Boolean);

function readPayload(args) {
  let raw = (args.file ? fs.readFileSync(args.file, "utf8") : fs.readFileSync(0, "utf8")).trim();
  if (raw.startsWith("```")) raw = raw.replace(/^```[a-z]*\n?/, "").replace(/```$/, "");
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new BrainiverseError(`result is not valid JSON: ${err.message}`);
  }
}

function parseLimits(items = []) {
  const limits = {};
  for (const item of items) {
    const [k, v] = item.split("=");
    if (!/^\d+$/.test(v || "")) throw new BrainiverseError(`limit ${k} must be a non-negative integer`);
    limits[k] = Number(v);
  }
  return limits;
}

// -- team loading: a saved team, or the active mission's snapshot ("@mission") ------------

const loadTeam = (ws, ref, mission) => (ref === "@mission" ? ws.readMission(mission).team : teams.load(ws, ref));

function storeTeam(ws, ref, team, mission) {
  if (ref === "@mission") {
    ws.mission(mission, (state) => { state.team = teams.validateTeam(team); });
    return team;
  }
  return teams.save(ws, team);
}

const loadAgent = (ws, a) => (a.team ? teams.findAgent(loadTeam(ws, a.team, a.mission), a.agent_id) : registry.load(ws, a.agent_id));

function storeAgent(ws, a, profile) {
  if (a.team) storeTeam(ws, a.team, teams.replaceAgent(loadTeam(ws, a.team, a.mission), profile), a.mission);
  else registry.save(ws, profile);
  return profile;
}

function addToTeamOrLibrary(ws, a, profile) {
  if (a.team) storeTeam(ws, a.team, teams.addAgent(loadTeam(ws, a.team, a.mission), profile), a.mission);
  else registry.save(ws, profile);
  return profile;
}

// -- handlers ---------------------------------------------------------------------

const handlers = {};

handlers.init = (ws, a) => {
  if (a.theme && !(a.theme in registry.themes())) throw new BrainiverseError(`unknown theme ${a.theme}`);
  if (a.terminology) registry.terminology(a.terminology);
  return { workspace: ws.root, config: ws.init({ theme: a.theme, terminology: a.terminology }) };
};

handlers.config = (ws, a) => {
  if (a.key === undefined) return ws.config();
  if (a.value === undefined) return { [a.key]: ws.config()[a.key] };
  if (!["theme", "terminology", "host"].includes(a.key)) throw new BrainiverseError("settable keys: theme, terminology, host");
  if (a.key === "theme" && !(a.value in registry.themes())) throw new BrainiverseError(`unknown theme ${a.value}`);
  if (a.key === "terminology") registry.terminology(a.value);
  if (a.key === "host" && !(a.value in tools.TOOL_ADAPTERS)) throw new BrainiverseError(`unknown host ${a.value}`);
  return ws.setConfig({ [a.key]: a.value });
};

handlers.archetypes = () => Object.fromEntries(Object.entries(registry.archetypes())
  .map(([k, v]) => [k, { title: v.title, purpose: v.purpose, capabilities: v.capabilities }]));

handlers.themes = (ws) => {
  const config = ws.config();
  return {
    active: config.theme, terminology: registry.terminology(config.terminology),
    themes: Object.fromEntries(Object.entries(registry.themes()).map(([k, v]) => [k, {
      description: v.description, names: Object.fromEntries(Object.entries(v.identities).map(([arch, i]) => [arch, i.name])),
    }])),
  };
};

handlers.capabilities = (ws) => Object.fromEntries(Object.entries(tools.CAPABILITIES).map(([c, info]) => [c, {
  ...info, approval_per_use: tools.isGated(c), host_tools: tools.hostTools([c], ws.config().host),
}]));

handlers.agent = (ws, a, sub) => {
  if (sub === "list") {
    if (a.team) {
      return loadTeam(ws, a.team, a.mission).agents.map((p) => ({ id: p.id, name: p.name, archetype: p.archetype, enabled: p.enabled }));
    }
    return registry.listAgents(ws).map((p) => ({ id: p.id, name: p.name, archetype: p.archetype }));
  }
  if (sub === "new") {
    let profile = registry.makeAgent(a.archetype, { id: a.id, theme: ws.config().theme, name: a.name });
    if (a.set) profile = registry.edit(profile, { sets: a.set });
    return addToTeamOrLibrary(ws, a, profile);
  }
  if (sub === "import") {
    const [profile, stripped] = registry.sanitizeImport(readJson(a.path));
    addToTeamOrLibrary(ws, a, profile);
    return { imported: profile.id, stripped_gated_capabilities: stripped,
      note: stripped.length ? "Gated capabilities are never imported; grant them with an approval." : "" };
  }
  const profile = loadAgent(ws, a);
  switch (sub) {
    case "show": return { ...profile, host_tools: tools.hostTools(profile.capabilities, ws.config().host) };
    case "edit": return storeAgent(ws, a, registry.edit(profile, { sets: a.set || [], adds: a.add || [], removes: a.remove || [] }));
    case "rename": return storeAgent(ws, a, registry.rename(profile, {
      name: a.name, personality: a.personality, communication_style: a.style, avatar: a.avatar }));
    case "enable":
    case "disable": return storeAgent(ws, a, registry.validateAgent({ ...profile, enabled: sub === "enable" }));
    case "duplicate": return addToTeamOrLibrary(ws, a, registry.duplicate(profile, a.new_id, a.name));
    case "delete":
      if (a.team) storeTeam(ws, a.team, teams.removeAgent(loadTeam(ws, a.team, a.mission), profile.id), a.mission);
      else ws.deleteRecord("agents", profile.id);
      return { deleted: profile.id };
    case "export": {
      const out = a.out || `${profile.id}.agent.json`;
      writeJson(out, profile);
      return { exported: out };
    }
    case "grant": {
      if (!tools.isGated(a.capability)) return storeAgent(ws, a, registry.grant(profile, a.capability));
      const updated = ws.mission(a.mission, (state) => {
        const approval = permissions.getApproval(state, a.approval, "capability");
        const granted = registry.grant(profile, a.capability, approval);
        permissions.consume(approval);
        audit.log(ws, state.id, "capability_granted", { agent: profile.id, capability: a.capability, approval: approval.id });
        return granted;
      });
      return storeAgent(ws, a, updated);
    }
    case "revoke": return storeAgent(ws, a, registry.revoke(profile, a.capability));
    case "test": {
      const model = tools.hostModel(profile.model, ws.config().host);
      return {
        note: "Run this prompt with the Agent tool to test the agent in isolation; nothing is recorded.",
        agent_call: {
          subagent_type: "general-purpose", description: `Test ${profile.name}`, ...(model ? { model } : {}),
          prompt: `You are ${profile.name}, a ${registry.archetypes()[profile.archetype].title}. ` +
            `Personality: ${profile.personality}. Responsibilities: ${profile.responsibilities.join("; ")}. ${profile.instructions}\n\n` +
            `Test task: ${a.task}\n\nUse only these tools: ${tools.hostTools(profile.capabilities).join(", ") || "none"}. ` +
            "Answer with the result-protocol fields: status, findings, evidence, assumptions, uncertainty, recommendations.",
        },
      };
    }
  }
  throw new BrainiverseError(`unknown agent command ${sub}`);
};

handlers.team = (ws, a, sub) => {
  const theme = ws.config().theme;
  if (sub === "templates") {
    return teams.templateIds().map((id) => {
      const t = teams.loadTemplate(id);
      return { id, name: t.name, description: t.description };
    });
  }
  if (sub === "list") {
    return ws.listRecords("teams").map((t) => ({ id: t.id, name: t.name, agents: t.agents.length, status: t.status || "approved" }));
  }
  if (sub === "propose") {
    const proposal = teams.proposeTeam(a.mission_text, { theme, maxAgents: a.max, teamId: a.id });
    const { team, reasons, ...rest } = proposal;
    team.status = "draft";
    teams.save(ws, team);
    return {
      ...rest, team_id: team.id,
      roster: team.agents.map((p) => ({ id: p.id, name: p.name, archetype: p.archetype, why: reasons[p.id], capabilities: p.capabilities })),
    };
  }
  if (sub === "from-template") {
    const team = teams.teamFromTemplate(a.template, { teamId: a.id, theme });
    team.status = "draft";
    return teams.save(ws, team);
  }
  if (sub === "import") {
    const [team, stripped] = teams.sanitizeImport(readJson(a.path));
    teams.save(ws, team);
    return { imported: team.id, stripped_gated_capabilities: stripped };
  }
  const team = loadTeam(ws, a.team_ref, a.mission);
  switch (sub) {
    case "show": return { ...team, warnings: teams.redundancyWarnings(team) };
    case "approve": return storeTeam(ws, a.team_ref, { ...team, status: "approved" }, a.mission).status;
    case "add": {
      const profile = a.from_library ? registry.load(ws, a.from_library) : registry.makeAgent(a.archetype, {
        id: a.id, theme, name: a.name, description: a.description, expertise: a.expertise ? splitCsv(a.expertise) : undefined,
      });
      const updated = teams.addAgent(team, profile);
      storeTeam(ws, a.team_ref, updated, a.mission);
      return { added: profile.id, warnings: teams.redundancyWarnings(updated) };
    }
    case "remove":
      storeTeam(ws, a.team_ref, teams.removeAgent(team, a.agent_id), a.mission);
      return { removed: a.agent_id };
    case "leader": return storeTeam(ws, a.team_ref, teams.setLeader(team, a.agent_id), a.mission).leader;
    case "rename": return storeTeam(ws, a.team_ref, { ...team, name: a.name }, a.mission).name;
    case "save": {
      const saved = teams.save(ws, { ...team, id: a.as || team.id, status: "approved" });
      return { saved: saved.id };
    }
    case "export": {
      const out = a.out || `${team.id}.team.json`;
      writeJson(out, team);
      return { exported: out };
    }
    case "delete":
      ws.deleteRecord("teams", team.id);
      return { deleted: team.id };
  }
  throw new BrainiverseError(`unknown team command ${sub}`);
};

handlers.mission = (ws, a, sub) => {
  switch (sub) {
    case "new": {
      const team = teams.load(ws, a.team);
      const state = orchestrator.newMission(a.goal, team, {
        id: a.id, title: a.title, success: a.success || [], constraints: a.constraint || [],
        assumptions: a.assumption || [], resources: a.resource || [], limits: parseLimits(a.limit),
      });
      ws.createMission(state);
      ws.setConfig({ active_mission: state.id });
      audit.log(ws, state.id, "mission_created", { goal: state.goal, team: team.id });
      return { mission: state.id, team: team.id, limits: state.limits };
    }
    case "list": {
      const active = ws.config().active_mission;
      return ws.listMissions().map((m) => ({ id: m.id, title: m.title, status: m.status, active: m.id === active }));
    }
    case "use":
      ws.resolveMission(a.mission_id);
      return ws.setConfig({ active_mission: a.mission_id }).active_mission;
    case "show": {
      const s = ws.readMission(a.mission);
      const keys = ["id", "title", "goal", "status", "success_criteria", "constraints", "assumptions", "resources", "limits", "decisions", "usage"];
      return Object.fromEntries(keys.map((k) => [k, s[k]]));
    }
    case "pause":
    case "resume":
    case "close": {
      const target = { pause: "paused", resume: "active", close: "closed" }[sub];
      return ws.mission(a.mission, (state) => {
        if (sub === "close") {
          const open = Object.values(state.tasks).filter((t) => ["running", "submitted"].includes(t.status)).map((t) => t.id);
          if (open.length && !a.force) throw new BrainiverseError(`tasks still open: ${open.join(", ")}; finish them or pass --force`);
        }
        state.status = target;
        audit.log(ws, state.id, `mission_${target}`);
        return { mission: state.id, status: target };
      });
    }
    case "update":
      return ws.mission(a.mission, (state) => {
        for (const [field, values] of [["success_criteria", a.success], ["constraints", a.constraint],
          ["assumptions", a.assumption], ["resources", a.resource]]) state[field].push(...(values || []));
        for (const [k, v] of Object.entries(parseLimits(a.limit))) {
          if (!(k in orchestrator.DEFAULT_LIMITS)) throw new BrainiverseError(`unknown limit ${k}`);
          state.limits[k] = v;
        }
        if (a.limit) audit.log(ws, state.id, "limits_changed", { limits: a.limit });
        const { success_criteria, constraints, assumptions, resources, limits } = state;
        return { success_criteria, constraints, assumptions, resources, limits };
      });
    case "finalize":
      return ws.mission(a.mission, (state) => {
        state.final_report = fs.readFileSync(a.file, "utf8");
        audit.log(ws, state.id, "final_report_saved");
        return { saved: true };
      });
    case "report": return report(ws.readMission(a.mission));
    case "log": return audit.read(ws, ws.resolveMission(a.mission), a.limit);
  }
  throw new BrainiverseError(`unknown mission command ${sub}`);
};

export function report(state) {
  const names = Object.fromEntries(state.team.agents.map((p) => [p.id, p.name]));
  const tasks = Object.values(state.tasks);
  const lines = [`# Mission report: ${state.title}`, "", `**Goal:** ${state.goal}`, `**Status:** ${state.status}`, ""];
  if (state.success_criteria.length) lines.push("## Success criteria", ...state.success_criteria.map((c) => `- ${c}`), "");
  lines.push("## Deliverables (accepted work)");
  for (const t of tasks.filter((t) => t.status === "done" && t.kind === "task")) {
    const f = t.result.findings;
    const text = typeof f === "string" ? f : f.map(String).join("; ");
    lines.push(`- **${t.id}** (${names[t.agent]}): ${t.objective}\n  ${text.slice(0, 600)}`);
    for (const d of t.result.deliverables || []) lines.push(`  - file: ${d.path} — ${d.description || ""}`);
  }
  lines.push("");
  const unfinished = tasks.filter((t) => t.status !== "done");
  if (unfinished.length) {
    lines.push("## Outstanding or unsuccessful work",
      ...unfinished.map((t) => `- ${t.id} [${t.status}] ${t.objective}${t.errors.length ? ` — ${t.errors.at(-1)}` : ""}`), "");
  }
  if (state.decisions.length) {
    lines.push("## Decisions", ...state.decisions.map((d) => `- ${d.id}: ${d.text}${d.approved_by_human ? " (approved by human)" : ""}`), "");
  }
  const assumptions = [...state.assumptions];
  for (const t of tasks) if (t.status === "done" && t.result) assumptions.push(...(t.result.assumptions || []).map((x) => `${x} (${t.id})`));
  if (assumptions.length) lines.push("## Assumptions", ...assumptions.map((x) => `- ${x}`), "");
  const issues = state.reviews.flatMap((r) => r.issues.map((i) => `${r.target}: ${i}`));
  const openQ = Object.values(state.meetings).flatMap((m) => m.questions.filter((q) => !q.answer).map((q) => `${m.id}: ${q.text}`));
  if (issues.length || openQ.length) lines.push("## Unresolved issues and questions", ...[...issues, ...openQ].map((x) => `- ${x}`), "");
  if (state.reviews.length) {
    lines.push("## Reviews", ...state.reviews.map((r) =>
      `- ${r.target} by ${names[r.reviewer] || r.reviewer}: **${r.verdict}** — ${r.evidence.join("; ").slice(0, 300)}`), "");
  }
  const integrated = Object.values(state.skills.candidates).filter((c) => c.status === "integrated");
  if (integrated.length) lines.push("## Skills integrated", ...integrated.map((c) => `- ${c.name} → ${names[c.agent]} (${c.installed_path})`), "");
  const m = evaluation.metrics(state);
  lines.push("## Metrics", `- Tasks done: ${m.tasks_done}/${m.tasks_total}, failed: ${m.tasks_failed}`,
    `- Agent invocations: ${m.invocations} (unused: ${m.unused_invocations}, retries: ${m.retries}, revisions: ${m.revisions})`,
    `- Idle team members: ${m.idle_team_members.map((x) => names[x] || x).join(", ") || "none"}`);
  if (state.final_report) lines.push("", "## Leader's synthesis", state.final_report);
  return lines.join("\n");
}

const startPayload = (ws, state, task, invocation) => ({
  task: task.id, invocation: invocation.id, agent: task.agent, agent_call: briefs.agentCall(ws, state, task),
});

handlers.task = (ws, a, sub) => {
  const acting = permissions.actingAgent();
  if (sub === "list") {
    let rows = Object.values(ws.readMission(a.mission).tasks);
    if (a.status) rows = rows.filter((t) => t.status === a.status);
    return rows.map((t) => ({ id: t.id, agent: t.agent, status: t.status, objective: t.objective.slice(0, 90), depends_on: t.depends_on, kind: t.kind }));
  }
  if (sub === "show") return orchestrator.getTask(ws.readMission(a.mission), a.task_id);
  if (sub === "brief") {
    const state = ws.readMission(a.mission);
    const task = orchestrator.getTask(state, a.task_id);
    if (acting && acting !== task.agent) throw new BrainiverseError(`this brief belongs to ${task.agent}, not ${acting}`);
    return briefs.build(ws, state, task);
  }
  return ws.mission(a.mission, (state) => {
    switch (sub) {
      case "ready": return orchestrator.readyTasks(state).map((t) => ({ id: t.id, agent: t.agent, objective: t.objective }));
      case "add": {
        const task = orchestrator.addTask(state, {
          objective: a.objective, agent: a.agent, inputs: a.input || [], expected_output: a.expect || "",
          constraints: a.constraint || [], depends_on: splitCsv(a.after), acceptance: a.accept || [], context: a.context || "",
          needs: splitCsv(a.needs), timeout_s: a.timeout, max_retries: a.retries, parent: a.parent || null,
        });
        audit.log(ws, state.id, "task_added", { task: task.id, agent: task.agent, objective: task.objective });
        return { task: task.id, status: task.status };
      }
      case "start": {
        const ids = a.task_id === "ready" ? orchestrator.readyTasks(state).map((t) => t.id) : [a.task_id];
        if (!ids.length) throw new BrainiverseError("no task is ready to start");
        const started = ids.map((id) => {
          const invocation = orchestrator.startTask(state, id);
          audit.log(ws, state.id, "task_started", { task: id, invocation: invocation.id, agent: invocation.agent });
          return startPayload(ws, state, state.tasks[id], invocation);
        });
        return { started, next: "Invoke every agent_call with the Agent tool. Calls for different tasks are independent: " +
          "send them in one message to run them in parallel." };
      }
      case "submit": {
        const task = orchestrator.getTask(state, a.task_id);
        if (acting && acting !== task.agent) throw new BrainiverseError(`${acting} cannot submit ${task.agent}'s task`);
        const result = readPayload(a);
        orchestrator.submit(state, a.task_id, result, { tokens: a.tokens || 0 });
        if (task.kind === "meeting") meetings.recordContribution(state, task);
        audit.log(ws, state.id, "task_submitted", { task: task.id, result_status: result.status }, acting || "leader");
        return { task: task.id, status: task.status, submitted_by: acting || "leader" };
      }
      case "accept": {
        const task = orchestrator.accept(state, a.task_id, a.evidence || "");
        audit.log(ws, state.id, "task_accepted", { task: task.id, evidence: a.evidence || "" });
        return { task: task.id, status: task.status };
      }
      case "revise": {
        const task = orchestrator.revise(state, a.task_id, a.feedback);
        audit.log(ws, state.id, "task_revision", { task: task.id, feedback: a.feedback });
        return { task: task.id, status: task.status, iteration: task.iterations };
      }
      case "fail": {
        const task = orchestrator.fail(state, a.task_id, a.error);
        audit.log(ws, state.id, "task_failed", { task: task.id, error: a.error, now: task.status });
        return { task: task.id, status: task.status, attempts: task.attempts, retrying: task.status === "pending" };
      }
      case "cancel": {
        const task = orchestrator.cancel(state, a.task_id, a.reason || "cancelled by the human");
        audit.log(ws, state.id, "task_cancelled", { task: task.id });
        return { task: task.id, status: "cancelled", blocked: Object.values(state.tasks).filter((t) => t.status === "blocked").map((t) => t.id) };
      }
      case "sweep": {
        const timedOut = orchestrator.sweepTimeouts(state);
        for (const id of timedOut) audit.log(ws, state.id, "task_timeout", { task: id });
        return { timed_out: timedOut };
      }
      case "reassign": {
        const task = orchestrator.reassign(state, a.task_id, a.agent);
        audit.log(ws, state.id, "task_reassigned", { task: task.id, agent: a.agent });
        return { task: task.id, agent: task.agent };
      }
      case "attach-approval": {
        const task = orchestrator.getTask(state, a.task_id);
        const approval = permissions.getApproval(state, a.approval);
        if (approval.status !== "approved") throw new BrainiverseError(`${approval.id} is ${approval.status}`);
        task.approval = approval.id;
        return { task: task.id, approval: approval.id };
      }
    }
    throw new BrainiverseError(`unknown task command ${sub}`);
  });
};

handlers.status = (ws, a) => {
  const state = ws.readMission(a.mission);
  const p = orchestrator.progress(state);
  const term = registry.terminology(ws.config().terminology);
  const names = Object.fromEntries(state.team.agents.map((x) => [x.id, x.name]));
  const lines = [
    `${term.project}: ${state.title} [${state.status}]`,
    `${term.team}: ${state.team.name} — ${state.team.agents.map((x) => `${x.name}${x.enabled ? "" : " (off)"}`).join(", ")}`,
    `Tasks: ${Object.entries(p.tasks).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(", ") || "none yet"}`,
    `Invocations: ${p.invocations}  Tokens: ${p.tokens}`,
  ];
  for (const t of Object.values(state.tasks)) {
    if (!["done", "cancelled"].includes(t.status)) {
      lines.push(`  ${t.id.padEnd(4)} ${t.status.padEnd(10)} ${(names[t.agent] || t.agent).padEnd(16)} ${t.objective.slice(0, 70)}`);
    }
  }
  if (p.ready.length) lines.push(`Ready to start: ${p.ready.join(", ")}`);
  if (p.awaiting_review.length) lines.push(`Awaiting your review/accept: ${p.awaiting_review.join(", ")}`);
  if (p.pending_approvals.length) lines.push(`Pending human approvals: ${p.pending_approvals.join(", ")}`);
  for (const q of p.open_questions) lines.push(`Open question (${q.meeting}): ${q.question}`);
  for (const m of Object.values(state.meetings).filter((m) => ["active", "paused"].includes(m.status))) {
    lines.push(m.mode === "direct"
      ? `Direct line ${m.id} [${m.status}] with ${names[m.participants[0]]}`
      : `${term.meeting} ${m.id} [${m.status}]: ${m.objective}`);
  }
  return lines.join("\n");
};

handlers.meeting = (ws, a, sub) => {
  if (sub === "show") {
    const state = ws.readMission(a.mission);
    const m = meetings.getMeeting(state, a.meeting_id);
    const { id, mode, objective, status, participants, decisions, assumptions, questions, actions, summary } = m;
    return { id, mode, objective, status, participants, decisions, assumptions, questions, actions, summary,
      transcript: meetings.transcript(state, a.meeting_id, 200) };
  }
  return ws.mission(a.mission, (state) => {
    switch (sub) {
      case "start": {
        const m = meetings.start(state, a.objective, splitCsv(a.with));
        audit.log(ws, state.id, "meeting_started", { meeting: m.id, participants: m.participants });
        return { meeting: m.id, participants: m.participants };
      }
      case "ask": {
        const created = splitCsv(a.agent).map((id) => meetings.ask(state, a.meeting_id, id, a.prompt).id);
        return { tasks: created, next: "Start them with `task start ready` and invoke the agents in parallel; " +
          "their submissions appear in the transcript." };
      }
      case "say": return meetings.say(state, a.meeting_id, a.text);
      case "human": {
        const message = meetings.human(state, a.meeting_id, a.text, a.answers);
        audit.log(ws, state.id, "human_input", { meeting: a.meeting_id, text: a.text });
        return message;
      }
      case "question": return meetings.question(state, a.meeting_id, a.text, a.to);
      case "decide": {
        const d = meetings.decide(state, a.meeting_id, a.text, Boolean(a.human_approved));
        audit.log(ws, state.id, "decision", { meeting: a.meeting_id, text: a.text, approved_by_human: Boolean(a.human_approved) });
        return d;
      }
      case "assume": return meetings.assume(state, a.meeting_id, a.text);
      case "action":
        return { task: meetings.action(state, a.meeting_id, a.agent, a.objective, { acceptance: a.accept || [], depends_on: splitCsv(a.after) }).id };
      case "add":
        meetings.addParticipant(state, a.meeting_id, a.agent);
        return { participants: state.meetings[a.meeting_id].participants };
      case "remove":
        meetings.removeParticipant(state, a.meeting_id, a.agent);
        return { participants: state.meetings[a.meeting_id].participants };
      case "pause":
      case "resume":
      case "end": {
        const target = { pause: "paused", resume: "active", end: "ended" }[sub];
        const m = meetings.setStatus(state, a.meeting_id, target, a.summary || "");
        audit.log(ws, state.id, `meeting_${target}`, { meeting: m.id });
        return { meeting: m.id, status: m.status };
      }
    }
    throw new BrainiverseError(`unknown meeting command ${sub}`);
  });
};

// Direct line: the human talks one-on-one with a single agent.
handlers.chat = (ws, a, sub) => {
  if (sub === "list") {
    return Object.values(ws.readMission(a.mission).meetings).filter((m) => m.mode === "direct")
      .map((m) => ({ id: m.id, agent: m.participants[0], status: m.status, topic: m.objective }));
  }
  if (sub === "show") return meetings.transcript(ws.readMission(a.mission), a.chat_id, 200);
  return ws.mission(a.mission, (state) => {
    switch (sub) {
      case "start": {
        if (a.agent === state.team.leader) throw new BrainiverseError("the leader is already your main contact; just talk to them");
        const m = meetings.startDirect(state, a.agent, a.topic || "");
        audit.log(ws, state.id, "direct_line_opened", { chat: m.id, agent: a.agent });
        return { chat: m.id, agent: a.agent };
      }
      case "say": {
        const task = meetings.directMessage(state, a.chat_id, a.text);
        const invocation = orchestrator.startTask(state, task.id);
        audit.log(ws, state.id, "direct_message", { chat: a.chat_id, task: task.id, text: a.text });
        return { ...startPayload(ws, state, task, invocation),
          next: "Invoke the agent_call with the Agent tool, then show the human the agent's reply verbatim " +
            "(`chat show`), attributed to the agent, with no commentary of your own." };
      }
      case "end": {
        const m = meetings.setStatus(state, a.chat_id, "ended", a.summary || "");
        audit.log(ws, state.id, "direct_line_closed", { chat: m.id });
        return { chat: m.id, status: m.status };
      }
    }
    throw new BrainiverseError(`unknown chat command ${sub}`);
  });
};

handlers.approval = (ws, a, sub) => {
  if (sub === "list") {
    const rows = Object.values(ws.readMission(a.mission).approvals);
    return a.status ? rows.filter((r) => r.status === a.status) : rows;
  }
  return ws.mission(a.mission, (state) => {
    if (sub === "request") {
      const approval = permissions.request(state, { kind: a.kind, detail: a.detail, agent: a.agent || null,
        capability: a.capability || null, task: a.task || null, skill: a.skill || null });
      audit.log(ws, state.id, "approval_requested", { approval: approval.id, detail: a.detail });
      return { ...approval, next: "Ask the human (AskUserQuestion), then record their answer with `approval resolve`." };
    }
    if (sub === "resolve") {
      if (!["approve", "reject"].includes(a.decision)) throw new BrainiverseError("decision must be approve or reject");
      const approval = permissions.resolve(state, a.approval_id, a.decision === "approve", a.note);
      audit.log(ws, state.id, "approval_resolved", { approval: approval.id, status: approval.status, note: a.note });
      return approval;
    }
    throw new BrainiverseError(`unknown approval command ${sub}`);
  });
};

handlers.memory = (ws, a, sub) => {
  const scope = a.scope;
  if (sub === "list") {
    const state = scope === "project" ? ws.readMission(a.mission) : null;
    return memory.list(ws, scope, { state, tags: splitCsv(a.tags) });
  }
  const write = (state) => {
    if (sub === "add") return memory.add(ws, scope, a.text, { tags: splitCsv(a.tags), state });
    if (sub === "edit") return memory.edit(ws, scope, a.record_id, a.text, { state });
    if (sub === "delete") {
      memory.remove(ws, scope, a.record_id, { state });
      return { deleted: a.record_id };
    }
    throw new BrainiverseError(`unknown memory command ${sub}`);
  };
  return scope === "project" ? ws.mission(a.mission, write) : write(null);
};

handlers.skill = (ws, a, sub) => {
  if (sub === "local") {
    let rows = skills.localInventory();
    if (a.query) {
      const words = a.query.toLowerCase().split(/\s+/);
      rows = rows.filter((s) => words.some((w) => `${s.name} ${s.description}`.toLowerCase().includes(w)));
    }
    return rows;
  }
  if (sub === "scan") {
    const result = skills.scan(a.path);
    if (a.candidate) {
      permissions.requireLeader("skill scan --candidate");
      ws.mission(a.mission, (state) => {
        skills.recordScan(state, a.candidate, result);
        audit.log(ws, state.id, "skill_scanned", { skill: a.candidate, risk: result.risk });
      });
    }
    return result;
  }
  if (sub === "list") {
    const s = ws.readMission(a.mission).skills;
    return { gaps: Object.values(s.gaps), candidates: Object.values(s.candidates) };
  }
  if (sub === "recommend") return skills.recommend(ws.readMission(a.mission));
  return ws.mission(a.mission, (state) => {
    switch (sub) {
      case "gap": return skills.addGap(state, a.capability, a.description);
      case "candidate": {
        const item = skills.addCandidate(state, {
          name: a.name, source: a.source, purpose: a.purpose, agent: a.agent, url: a.url || "", local_path: a.local_path || "",
          gap: a.gap || null, benefits: a.benefits || "", permissions: splitCsv(a.permissions),
          compatibility: a.compatibility || "unknown", risks: a.risks || "", install: a.install || "",
        });
        audit.log(ws, state.id, "skill_candidate", { skill: item.id, name: item.name, url: item.url });
        return item;
      }
      case "approve": {
        const approval = permissions.getApproval(state, a.approval, "skill_install");
        const item = skills.approve(state, a.skill_id, approval);
        audit.log(ws, state.id, "skill_approved", { skill: item.id, approval: approval.id });
        return item;
      }
      case "reject": return skills.reject(state, a.skill_id, a.reason);
      case "verify": {
        const item = skills.verify(state, a.skill_id, a.path);
        audit.log(ws, state.id, "skill_integrated", { skill: item.id, path: item.installed_path });
        return item;
      }
    }
    throw new BrainiverseError(`unknown skill command ${sub}`);
  });
};

handlers.review = (ws, a) => ws.mission(a.mission, (state) => {
  const review = evaluation.addReview(state, a.target, a.verdict, a.evidence || [], a.issue || [], a.reviewer || "leader");
  audit.log(ws, state.id, "review", { target: a.target, verdict: a.verdict });
  return review;
});

handlers.metrics = (ws, a) => evaluation.metrics(ws.readMission(a.mission));

handlers.perm = (ws, a) => ({
  agent: a.agent, capability: a.capability, result: permissions.check(ws.readMission(a.mission), a.agent, a.capability),
});

// -- command spec -------------------------------------------------------------------

const M = { mission: { short: "m", help: "mission id (default: the active mission)" } };
const TEAM = { team: { help: "team id, or @mission for the active mission's team (default: the agent library)" } };
const MULTI = { multi: true };

const agentSub = (positional, options = {}, help = "") => ({ help, positional, options: { ...M, ...TEAM, ...options } });
const teamSub = (positional = [], options = {}, help = "") => ({ help, positional: ["team_ref", ...positional], options: { ...M, ...options } });
const taskSub = (options = {}, help = "") => ({ help, positional: ["task_id"], options: { ...M, ...options } });
const meetingSub = (positional = [], options = {}, help = "") => ({ help, positional: ["meeting_id", ...positional], options: { ...M, ...options } });

export const SPEC = {
  help: "Brainiverse — a customizable multi-agent team runtime for Claude Code.",
  subs: {
    init: { help: "create the workspace", options: { theme: {}, terminology: { help: "themed | professional" } } },
    config: { help: "show or set theme / terminology / host", positional: ["?key", "?value"] },
    archetypes: { help: "list the ten archetypes" },
    themes: { help: "list identity themes" },
    capabilities: { help: "list capabilities, their risk, and host tools" },
    agent: {
      help: "create and customize agents",
      subs: {
        list: agentSub([], {}, "list agents (library, or --team)"),
        new: agentSub([], { archetype: { required: true }, id: {}, name: {}, set: { ...MULTI, help: "field=value (lists: a;b;c)" } }, "create an agent"),
        import: agentSub(["path"], {}, "import an agent JSON file (gated capabilities are stripped)"),
        show: agentSub(["agent_id"], {}, "show a profile"),
        edit: agentSub(["agent_id"], { set: MULTI, add: MULTI, remove: MULTI }, "edit fields"),
        rename: agentSub(["agent_id"], { name: {}, personality: {}, style: {}, avatar: {} }, "change identity only"),
        enable: agentSub(["agent_id"], {}, "enable an agent"),
        disable: agentSub(["agent_id"], {}, "disable an agent"),
        duplicate: agentSub(["agent_id", "new_id"], { name: {} }, "copy an agent"),
        delete: agentSub(["agent_id"], {}, "delete an agent"),
        export: agentSub(["agent_id"], { out: {} }, "export to JSON"),
        grant: agentSub(["agent_id", "capability"], { approval: { help: "approval id (required for gated capabilities)" } }, "grant a capability"),
        revoke: agentSub(["agent_id", "capability"], {}, "revoke a capability"),
        test: agentSub(["agent_id"], { task: { required: true } }, "get a prompt to test the agent in isolation"),
      },
    },
    team: {
      help: "propose, build, and save teams",
      subs: {
        templates: { help: "list team templates" },
        list: { help: "list saved teams" },
        propose: { help: "propose a team for a mission", positional: ["mission_text"], options: { max: { type: "int" }, id: {} } },
        "from-template": { help: "create a team from a template", positional: ["template"], options: { id: {} } },
        import: { help: "import a team JSON file", positional: ["path"] },
        show: teamSub([], {}, "show a team"),
        approve: teamSub([], {}, "mark a draft team approved"),
        add: teamSub([], { archetype: { default: "specialist" }, id: {}, name: {}, description: {}, expertise: { help: "comma-separated" },
          "from-library": { help: "add a saved agent from the library" } }, "add an agent"),
        remove: teamSub(["agent_id"], {}, "remove an agent"),
        leader: teamSub(["agent_id"], {}, "choose the leader"),
        rename: teamSub(["name"], {}, "rename the team"),
        save: teamSub([], { as: {} }, "save (e.g. @mission) to the team library"),
        export: teamSub([], { out: {} }, "export to JSON"),
        delete: teamSub([], {}, "delete a saved team"),
      },
    },
    mission: {
      help: "start and manage missions",
      subs: {
        new: { help: "start a mission", options: { goal: { required: true }, team: { required: true }, id: {}, title: {},
          success: MULTI, constraint: MULTI, assumption: MULTI, resource: MULTI, limit: { ...MULTI, help: "key=value" } } },
        list: { help: "list missions" },
        use: { help: "switch the active mission", positional: ["mission_id"] },
        show: { help: "mission details", options: M },
        pause: { help: "pause the mission", options: M },
        resume: { help: "resume the mission", options: M },
        close: { help: "close the mission", options: { ...M, force: { type: "bool" } } },
        update: { help: "add criteria/constraints, change limits", options: { ...M, success: MULTI, constraint: MULTI, assumption: MULTI, resource: MULTI, limit: MULTI } },
        finalize: { help: "save the Leader's synthesis", options: { ...M, file: { required: true } } },
        report: { help: "render the mission debrief", options: M },
        log: { help: "show the audit log", options: { ...M, limit: { type: "int", default: 50 } } },
      },
    },
    task: {
      help: "the task board",
      subs: {
        add: { help: "add a task", options: { ...M, agent: { required: true }, objective: { required: true }, input: MULTI, expect: {},
          constraint: MULTI, after: { help: "comma-separated dependency ids" }, accept: { ...MULTI, help: "acceptance criterion" },
          context: {}, needs: { help: "comma-separated capabilities" }, timeout: { type: "int" }, retries: { type: "int" }, parent: {} } },
        list: { help: "list tasks", options: { ...M, status: {} } },
        ready: { help: "tasks ready to run now", options: M },
        show: taskSub({}, "show a task"),
        brief: taskSub({}, "the agent's brief"),
        start: taskSub({}, "start a task (or 'ready' for all ready tasks) and get Agent-tool calls"),
        submit: taskSub({ file: {}, tokens: { type: "int" } }, "submit a result (JSON on stdin or --file)"),
        accept: taskSub({ evidence: {} }, "accept submitted work"),
        revise: taskSub({ feedback: { required: true } }, "send work back"),
        fail: taskSub({ error: { required: true } }, "mark an attempt failed (retries within limits)"),
        cancel: taskSub({ reason: {} }, "cancel a task"),
        reassign: { help: "reassign a pending task", positional: ["task_id", "agent"], options: M },
        "attach-approval": { help: "attach an approval to a task", positional: ["task_id", "approval"], options: M },
        sweep: { help: "fail tasks that exceeded their timeout", options: M },
      },
    },
    status: { help: "progress board", options: M },
    metrics: { help: "mission metrics", options: M },
    perm: { help: "check an agent's permission for a capability", positional: ["agent", "capability"], options: M },
    meeting: {
      help: "interactive meetings (war rooms)",
      subs: {
        start: { help: "open a meeting", options: { ...M, objective: { required: true }, with: { required: true, help: "comma-separated agent ids" } } },
        show: meetingSub([], {}, "meeting state and transcript"),
        ask: meetingSub([], { agent: { required: true, help: "one or more agent ids, comma-separated" }, prompt: { required: true } }, "ask agents to contribute"),
        say: meetingSub(["text"], {}, "the Leader speaks"),
        human: meetingSub(["text"], { answers: { help: "question id this answers" } }, "record the human's words"),
        question: meetingSub(["text"], { to: { default: "human" } }, "record an open question"),
        decide: meetingSub(["text"], { "human-approved": { type: "bool" } }, "record a decision"),
        assume: meetingSub(["text"], {}, "record an assumption"),
        action: meetingSub([], { agent: { required: true }, objective: { required: true }, accept: MULTI, after: {} }, "turn a conclusion into a task"),
        add: meetingSub(["agent"], {}, "add a participant"),
        remove: meetingSub(["agent"], {}, "remove a participant"),
        pause: meetingSub([], {}, "pause"),
        resume: meetingSub([], {}, "resume"),
        end: meetingSub([], { summary: { required: true } }, "end with a summary"),
      },
    },
    chat: {
      help: "direct line: the human talks one-on-one with a single agent",
      subs: {
        start: { help: "open a direct line", positional: ["agent"], options: { ...M, topic: {} } },
        say: { help: "send the human's message and get the Agent-tool call", positional: ["chat_id", "text"], options: M },
        show: { help: "the conversation so far", positional: ["chat_id"], options: M },
        list: { help: "list direct lines", options: M },
        end: { help: "close a direct line", positional: ["chat_id"], options: { ...M, summary: {} } },
      },
    },
    approval: {
      help: "human approvals",
      subs: {
        request: { help: "request an approval", options: { ...M, kind: { default: "capability", help: permissions.APPROVAL_KINDS.join(" | ") },
          detail: { required: true }, agent: {}, capability: {}, task: {}, skill: {} } },
        resolve: { help: "record the human's decision", positional: ["approval_id", "decision"],
          options: { ...M, note: { required: true, help: "the human's answer, quoted" } } },
        list: { help: "list approvals", options: { ...M, status: {} } },
      },
    },
    memory: {
      help: "agent / team / project memory",
      subs: Object.fromEntries(["add", "list", "edit", "delete"].map((name) => [name, {
        help: `${name} memory records`,
        positional: [...(["edit", "delete"].includes(name) ? ["record_id"] : []), ...(["add", "edit"].includes(name) ? ["text"] : [])],
        options: { ...M, scope: { default: "project", help: "project | agent:<id> | team:<id>" }, ...(["add", "list"].includes(name) ? { tags: {} } : {}) },
      }])),
    },
    skill: {
      help: "skill discovery and integration",
      subs: {
        local: { help: "skills installed locally", positional: ["?query"] },
        scan: { help: "static security scan of a skill directory", positional: ["path"], options: { ...M, candidate: {} } },
        list: { help: "gaps and candidates", options: M },
        recommend: { help: "the top candidates (max 3)", options: M },
        gap: { help: "record a capability gap", positional: ["capability", "description"], options: M },
        candidate: { help: "record a skill that was actually found", options: { ...M, name: { required: true },
          source: { required: true, help: "skills.sh, github, local, ..." }, purpose: { required: true }, agent: { required: true },
          url: {}, "local-path": {}, gap: {}, benefits: {}, permissions: {}, compatibility: {}, risks: {},
          install: { help: "the exact install command, as documented by the source" } } },
        approve: { help: "approve installation (needs a skill_install approval)", positional: ["skill_id"], options: { ...M, approval: { required: true } } },
        reject: { help: "reject a candidate", positional: ["skill_id"], options: { ...M, reason: { required: true } } },
        verify: { help: "verify an install and attach it to its agent", positional: ["skill_id"], options: { ...M, path: { required: true } } },
      },
    },
    review: { help: "record an evidence-backed review", positional: ["target"], options: { ...M,
      verdict: { required: true, help: evaluation.VERDICTS.join(" | ") }, evidence: MULTI, issue: MULTI, reviewer: {} } },
  },
};

function print(data) {
  process.stdout.write((typeof data === "string" ? data : JSON.stringify(data, null, 2)) + "\n");
}

export function main(argv = process.argv.slice(2)) {
  let home;
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--home") home = argv[++i];
    else if (argv[i].startsWith("--home=")) home = argv[i].slice(7);
    else rest.push(argv[i]);
  }
  try {
    const args = parse(rest, SPEC);
    const [command, sub] = args._path;
    if (permissions.actingAgent() && !AGENT_ALLOWED.has([command, sub].filter(Boolean).join(" "))) {
      permissions.requireLeader([command, sub].filter(Boolean).join(" "));
    }
    if (args.verdict && !evaluation.VERDICTS.includes(args.verdict)) {
      throw new BrainiverseError(`verdict must be one of ${evaluation.VERDICTS.join(", ")}`);
    }
    const ws = new Workspace(home);
    if (command !== "init") ws.require();
    print(handlers[command](ws, args, sub));
    return 0;
  } catch (err) {
    if (err instanceof HelpRequested) {
      print(err.message);
      return 0;
    }
    if (err instanceof BrainiverseError || err.code === "ENOENT") {
      process.stderr.write(`error: ${err.message}\n`);
      return 1;
    }
    throw err;
  }
}
