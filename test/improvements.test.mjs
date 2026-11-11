import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ROOT, cli, cliAsync, runAgent, tmpdir } from "./helpers.mjs";
import { forbiddenCliCall } from "../skill/brainiverse/hooks/guard.mjs";

const GUARD = path.join(ROOT, "skill", "brainiverse", "hooks", "guard.mjs");

function project() {
  const root = tmpdir();
  fs.writeFileSync(path.join(root, "package.json"), "{}");
  const home = path.join(root, ".brainiverse");
  cli(home, ["team", "from-template", "app-builders", "--id", "todo"]);
  cli(home, ["project", "adopt", "todo"]);
  return { root, home };
}

function guard(root, agent, toolName, toolInput) {
  const proc = spawnSync(process.execPath, [GUARD, agent], {
    input: JSON.stringify({ tool_name: toolName, tool_input: toolInput, cwd: root }), encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: root, BRAINIVERSE_HOME: "" },
  });
  return proc.stdout ? JSON.parse(proc.stdout).hookSpecificOutput : { permissionDecision: "allow" };
}

test("PreToolUse guard: registered per agent, blocks state tampering, off-capability tools and unapproved risky commands", () => {
  const { root, home } = project();
  cli(home, ["mission", "new", "--goal", "Ship"]);
  const coderFile = fs.readFileSync(path.join(root, ".claude", "agents", "brainiverse-coder.md"), "utf8");
  assert.match(coderFile, /hooks:\n {2}PreToolUse:\n {4}- matcher: "\*"[\s\S]*guard\.mjs\\" coder"/);

  assert.equal(guard(root, "coder", "Bash", { command: "npm test" }).permissionDecision, "allow");
  assert.equal(guard(root, "coder", "Write", { file_path: "src/app.ts" }).permissionDecision, "allow");
  assert.equal(guard(root, "coder", "Write", { file_path: ".claude/agents/brainiverse-coder.md" }).permissionDecision, "deny");
  assert.equal(guard(root, "coder", "Edit", { file_path: path.join(root, ".brainiverse", "config.json") }).permissionDecision, "deny");
  assert.equal(guard(root, "coder", "Bash", { command: "echo x > .brainiverse/config.json" }).permissionDecision, "deny");
  assert.equal(guard(root, "coder", "WebSearch", { query: "x" }).permissionDecision, "deny", "no web capability");
  assert.equal(guard(root, "debugger", "Write", { file_path: "src/a.ts" }).permissionDecision, "deny", "debugger is read + run only");
  assert.match(guard(root, "coder", "Bash", { command: "git push origin main" }).permissionDecisionReason, /repo_push/);
  assert.match(guard(root, "coder", "Bash", { command: "rm -rf build" }).permissionDecisionReason, /delete_data/);
  assert.equal(guard(root, "nobody", "Read", { file_path: "x" }).permissionDecision, "deny");

  // With the capability AND an approved, running task, the risky command is allowed.
  const a1 = cli(home, ["approval", "request", "--capability", "repo_push", "--agent", "coder", "--detail", "push access"]).json.id;
  cli(home, ["approval", "resolve", a1, "approve", "--note", "User: yes"]);
  cli(home, ["agent", "grant", "coder", "repo_push", "--team", "@project", "--approval", a1]);
  assert.match(guard(root, "coder", "Bash", { command: "git push" }).permissionDecisionReason, /no human approval/);
  const t = cli(home, ["task", "add", "--agent", "coder", "--objective", "Push the release", "--needs", "repo_push"]).json.task;
  const a2 = cli(home, ["approval", "request", "--capability", "repo_push", "--agent", "coder", "--task", t, "--detail", "push v1"]).json.id;
  cli(home, ["approval", "resolve", a2, "approve", "--note", "User: go"]);
  cli(home, ["task", "attach-approval", t, a2]);
  cli(home, ["task", "start", t]);
  assert.equal(guard(root, "coder", "Bash", { command: "git push origin main" }).permissionDecision, "allow");
});

test("guard fails open on unreadable input instead of blocking all work", () => {
  const proc = spawnSync(process.execPath, [GUARD, "coder"], { input: "not json", encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: tmpdir() } });
  assert.equal(proc.status, 0);
  assert.equal(proc.stdout, "");
  assert.match(proc.stderr, /guard skipped/);
});

test("LLM-assisted mapping: the Leader's own analysis overrides keywords, validated", () => {
  const home = path.join(tmpdir(), ".brainiverse");
  const p = cli(home, ["team", "propose", "something vague", "--capabilities", "research,risk", "--domains", "legal", "--complexity", "small"]).json;
  assert.equal(p.analysis.source, "leader");
  assert.ok(p.roster.some((r) => r.label === "Bahar (Legal Researcher)"));
  assert.ok(p.roster.length <= 4, "complexity small caps the team");
  assert.match(cli(home, ["team", "propose", "x", "--capabilities", "telepathy"]).err, /unknown capabilities/);
  assert.match(cli(home, ["team", "propose", "x", "--domains", "atlantis"]).err, /unknown domains/);
  assert.ok("events" in cli(home, ["team", "domains"]).json);
});

test("new templates and domains", () => {
  const home = path.join(tmpdir(), ".brainiverse");
  const templates = cli(home, ["team", "templates"]).json.map((t) => t.id);
  for (const id of ["learning-lab", "launch-team", "life-ops"]) {
    assert.ok(templates.includes(id), id);
    assert.equal(cli(home, ["team", "from-template", id]).code, 0);
  }
  const roster = (text) => cli(home, ["team", "propose", text]).json.roster.map((r) => r.label);
  assert.ok(roster("plan my wedding for 80 guests").includes("Heather (Event Planner)"));
  assert.ok(roster("I need a training plan for a marathon").includes("Derek (Fitness Coach)"));
  assert.ok(roster("help me find a new job and fix my resume").includes("Eric (Resume Writer)"));
  assert.ok(!roster("investigate whether a business idea is worth pursuing").includes("Steven (Financial Planner)"),
    "'investigate' must not trigger the finance domain");
});

test("host adapters: Claude Agent SDK definitions and a generic host", () => {
  const home = path.join(tmpdir(), ".brainiverse");
  cli(home, ["team", "from-template", "travel-squad"]);
  cli(home, ["mission", "new", "--goal", "Trip", "--team", "travel-squad"]);
  assert.match(cli(home, ["config", "host", "mainframe"]).err, /unknown host/);
  cli(home, ["config", "host", "claude-agent-sdk"]);
  cli(home, ["task", "add", "--agent", "babak", "--objective", "Budget"]);
  const sdk = cli(home, ["task", "start", "T1"]).json.started[0];
  assert.equal(sdk.agent_call.agent_name, "brainiverse-budget-analyst");
  assert.deepEqual(sdk.agent_call.agent_definition.tools, ["Read", "Grep", "Glob", "Bash"]);
  assert.equal(sdk.agent_call.agent_definition.model, "sonnet");
  assert.match(sdk.agent_call.agent_definition.prompt, /# Babak \(Budget Analyst\)/);
  assert.equal(sdk.leader_submits, true);
  cli(home, ["config", "host", "generic"]);
  cli(home, ["task", "add", "--agent", "shirin", "--objective", "Regions"]);
  const generic = cli(home, ["task", "start", "T2"]).json.started[0];
  assert.deepEqual(generic.agent_call.capabilities, ["web_search", "web_browse", "file_read"]);
  assert.equal(generic.agent_call.model_tier, "balanced");
});

test("cost tracking from host-reported usage, by agent and tier, with user-set prices", () => {
  const home = path.join(tmpdir(), ".brainiverse");
  cli(home, ["team", "from-template", "travel-squad"]);
  // quality mode puts the analyst on the strongest tier, so the report has two tiers to break down
  cli(home, ["mission", "new", "--goal", "Trip", "--team", "travel-squad", "--limit", "token_budget=50000", "--mode", "quality"]);
  cli(home, ["task", "add", "--agent", "shirin", "--objective", "Regions"]);
  cli(home, ["task", "add", "--agent", "babak", "--objective", "Budget"]);
  cli(home, ["task", "start", "ready"]);
  runAgent(home, "T1", "researcher", { status: "complete", findings: "x" });
  assert.equal(cli(home, ["usage", "record", "T1", "--tokens", "30000", "--tool-uses", "12", "--duration-ms", "45000"]).code, 0);
  assert.equal(cli(home, ["usage", "record", "T2", "--tokens", "25000"]).code, 0);
  assert.match(cli(home, ["usage", "record", "T1", "--tokens", "-5"]).err, /non-negative/);
  let report = cli(home, ["usage", "report"]).json;
  assert.equal(report.tokens, 55000);
  assert.equal(report.by_agent.researcher.tool_uses, 12);
  assert.equal(report.by_tier.balanced.tokens, 30000);
  assert.deepEqual(report.unpriced_tiers.sort(), ["balanced", "deep"]);
  cli(home, ["usage", "price", "balanced", "3"]);
  report = cli(home, ["usage", "report"]).json;
  assert.equal(report.by_tier.balanced.cost_usd, 0.09);
  assert.deepEqual(report.unpriced_tiers, ["deep"]);
  cli(home, ["task", "add", "--agent", "olivia", "--objective", "Itinerary"]);
  assert.match(cli(home, ["task", "start", "T3"]).err, /token budget exhausted/, "host-reported tokens count toward the budget");
});

test("dashboard: static snapshot escapes agent text; live server serves state", async () => {
  const home = path.join(tmpdir(), ".brainiverse");
  cli(home, ["team", "from-template", "travel-squad"]);
  cli(home, ["mission", "new", "--goal", "Trip", "--team", "travel-squad"]);
  cli(home, ["task", "add", "--agent", "shirin", "--objective", "</script><script>alert(1)</script>"]);
  const out = path.join(tmpdir(), "board.html");
  cli(home, ["dashboard", "--out", out]);
  const html = fs.readFileSync(out, "utf8");
  assert.ok(!html.includes("</script><script>alert(1)"), "embedded data can't break out of the script tag");
  assert.match(html, /Shirin \(Researcher\)/);

  const server = cliAsync(home, ["dashboard", "--port", "0"]);
  const child = server.child;
  let timer;
  const get = (u) => fetch(u, { headers: { connection: "close" } });
  // Everything after spawning sits inside try/finally, so a failed start can't leave the server running.
  try {
    const url = await new Promise((resolve, reject) => {
      let buffer = "";
      child.stdout.on("data", (d) => { buffer += d; const m = buffer.match(/"url":\s*"([^"]+)"/); if (m) resolve(m[1]); });
      timer = setTimeout(() => reject(new Error("dashboard did not start")), 10000);
    });
    clearTimeout(timer);
    const state = await (await get(url + "api/state")).json();
    assert.equal(state.mission.title, "Trip");
    assert.ok(state.mission.team.agents.some((a) => a.label === "Babak (Budget Analyst)"));
    assert.match(await (await get(url)).text(), /<title>Brainiverse Board<\/title>/);
    assert.equal((await get(url + "nope")).status, 404);
  } finally {
    clearTimeout(timer);
    child.kill();
    await server;
  }
});

test("only Captain creates agents: project agents can't spawn subagents or change the team via the CLI", () => {
  const { root } = project();
  assert.match(guard(root, "coder", "Agent", { prompt: "do it", subagent_type: "general-purpose" }).permissionDecisionReason, /only the Leader/);
  assert.equal(guard(root, "coder", "Task", { prompt: "x" }).permissionDecision, "deny");
  for (const command of [
    "node /x/skill/brainiverse/bin/brainiverse.mjs team add @project --archetype specialist --position Hacker",
    "npx -y brainiverse team grant-request AR1",
    "brainiverse status && brainiverse agent grant coder repo_push",
    "BRAINIVERSE_HOME=/p/.brainiverse node /x/bin/brainiverse.mjs project adopt evil",
  ]) {
    assert.equal(guard(root, "coder", "Bash", { command }).permissionDecision, "deny", command);
  }
  for (const command of [
    "BRAINIVERSE_HOME=/p/.brainiverse BRAINIVERSE_AGENT=coder node \"/x/skill/brainiverse/bin/brainiverse.mjs\" task submit T1 --mission m",
    "BRAINIVERSE_HOME=/p/.brainiverse node /x/bin/brainiverse.mjs task brief T1",
    "cd /Users/me/Documents/brainiverse && npm test",
    "git log | grep brainiverse",
  ]) {
    assert.equal(forbiddenCliCall(command), null, command);
  }
});

test("cost settings: balanced by default, economy and quality change agents' models, effort sets both", () => {
  const home = path.join(tmpdir(), ".brainiverse");
  cli(home, ["team", "from-template", "travel-squad"]);
  const models = (flags, id) => {
    const created = cli(home, ["mission", "new", "--goal", "Trip", "--team", "travel-squad", "--id", id, ...flags]).json;
    for (const agent of ["shirin", "babak", "parisa", "olivia"]) cli(home, ["task", "add", "--agent", agent, "--objective", `work for ${agent}`]);
    const started = cli(home, ["task", "start", "ready"]).json.started;
    return { created, models: Object.fromEntries(started.map((s) => [s.agent, s.agent_call.model])) };
  };
  const balanced = models([], "m1");
  assert.deepEqual([balanced.created.mode, balanced.created.checks], ["balanced", "standard"]);
  assert.deepEqual(balanced.models, { researcher: "sonnet", "budget-analyst": "sonnet", reviewer: "sonnet", "itinerary-planner": "sonnet" },
    "no agent runs on the most expensive model by default");
  const economy = models(["--effort", "light"], "m2");
  assert.deepEqual([economy.created.mode, economy.created.checks], ["economy", "light"]);
  assert.equal(economy.models.researcher, "haiku");
  assert.equal(economy.models.reviewer, "sonnet", "the reviewer never drops to the cheapest model");
  const quality = models(["--effort", "strict"], "m3");
  assert.equal(quality.models["budget-analyst"], "opus");
  assert.equal(quality.models.reviewer, "opus");
  assert.equal(quality.models.researcher, "sonnet");
  const mixed = cli(home, ["mission", "new", "--goal", "Trip", "--team", "travel-squad", "--id", "m4", "--effort", "light", "--checks", "strict"]).json;
  assert.deepEqual([mixed.mode, mixed.checks], ["economy", "strict"], "explicit flags win over effort");
  assert.equal(cli(home, ["mission", "update", "--mode", "quality"]).json.mode, "quality");
  assert.match(cli(home, ["mission", "new", "--goal", "x", "--team", "travel-squad", "--id", "m5", "--mode", "turbo"]).err, /mode must be one of/);
  assert.match(cli(home, ["status"]).out, /models: quality · checks: strict/);
});

test("check levels shape the team: light has no separate reviewer, strict adds a challenger", () => {
  const home = path.join(tmpdir(), ".brainiverse");
  const roster = (flags) => cli(home, ["team", "propose", "Plan a two-week trip to Japan", ...flags]).json.roster.map((r) => r.archetype);
  assert.ok(roster([]).includes("quality_reviewer"));
  assert.ok(!roster([]).includes("challenger"));
  assert.ok(!roster(["--effort", "light"]).includes("quality_reviewer"));
  assert.ok(roster(["--checks", "strict"]).includes("challenger"));
  const intake = (text) => cli(home, ["intake", text]).json;
  assert.equal(intake("deploy our payments service to production").recommended_effort, "strict");
  assert.equal(intake("just a quick draft of a packing list").recommended_effort, "light");
  const effort = intake("plan a trip to Rome").kickoff.rounds.flat().find((q) => q.id === "effort");
  assert.match(effort.options[0], /^Standard.*\(Recommended\)$/);
});

test("summaries: required and short; the full result goes to a file; the Leader reviews the summary view", () => {
  const home = path.join(tmpdir(), ".brainiverse");
  cli(home, ["team", "from-template", "travel-squad"]);
  cli(home, ["mission", "new", "--goal", "Trip", "--team", "travel-squad"]);
  cli(home, ["task", "add", "--agent", "shirin", "--objective", "Regions", "--accept", "2 sources each"]);
  cli(home, ["task", "start", "T1"]);
  const submit = (payload) => cli(home, ["task", "submit", "T1"], { agent: "researcher", input: JSON.stringify(payload) });
  assert.match(submit({ status: "complete", findings: "x" }).err, /summary is required/);
  assert.match(submit({ status: "complete", summary: "y".repeat(800), findings: "x" }).err, /keep it under 700/);
  const findings = Array.from({ length: 40 }, (_, i) => `detail ${i + 1}: long sourced paragraph about a region`);
  const ok = submit({ status: "complete", summary: "Kyoto, Tokyo, Osaka fit best; prices unverified.", findings,
    evidence: ["https://a", "https://b"], blockers: ["Golden Week hotels"] }).json;
  assert.ok(fs.existsSync(ok.result_file));
  assert.match(fs.readFileSync(ok.result_file, "utf8"), /## Findings\n- detail 1:[\s\S]*detail 40/);

  const lean = cli(home, ["task", "result", "T1"]).json;
  assert.equal(lean.summary, "Kyoto, Tokyo, Osaka fit best; prices unverified.");
  assert.deepEqual(lean.counts, { findings: 40, evidence: 2, assumptions: 0 });
  assert.deepEqual(lean.blockers, ["Golden Week hotels"]);
  assert.equal(lean.full_result, ok.result_file);
  assert.ok(!JSON.stringify(lean).includes("detail 7"), "the summary view leaves the findings out");
  assert.equal(cli(home, ["task", "result", "T1", "--full"]).json.findings.length, 40);
  assert.equal(cli(home, ["task", "results"]).json.length, 1);
  assert.equal(cli(home, ["task", "result", "T1"], { agent: "researcher" }).code, 0, "agents may read results too");
});

test("teammates get summaries; the whole result only when asked (:full) and always for the reviewer", () => {
  const home = path.join(tmpdir(), ".brainiverse");
  cli(home, ["team", "from-template", "travel-squad"]);
  cli(home, ["mission", "new", "--goal", "Trip", "--team", "travel-squad"]);
  cli(home, ["task", "add", "--agent", "shirin", "--objective", "Regions"]);
  cli(home, ["task", "add", "--agent", "babak", "--objective", "Budget", "--after", "T1"]);
  cli(home, ["task", "add", "--agent", "olivia", "--objective", "Itinerary", "--after", "T1:full"]);
  cli(home, ["task", "add", "--agent", "parisa", "--objective", "Audit", "--after", "T1"]);
  cli(home, ["task", "start", "T1"]);
  runAgent(home, "T1", "researcher", { status: "complete", summary: "SHORT VERSION", findings: ["SECRET DETAIL in the full findings"] });
  cli(home, ["task", "accept", "T1"]);
  cli(home, ["task", "start", "ready"]);
  const brief = (task, agent) => cli(home, ["task", "brief", task], { agent }).out;
  const budget = brief("T2", "budget-analyst");
  assert.match(budget, /SHORT VERSION/);
  assert.doesNotMatch(budget, /SECRET DETAIL/);
  assert.match(budget, /Full result, only if you need the detail: `.*results\/T1\.md`/);
  assert.match(brief("T3", "itinerary-planner"), /SECRET DETAIL/, "--after T1:full passes everything");
  assert.match(brief("T4", "reviewer"), /SECRET DETAIL/, "the reviewer always sees the whole result");
  assert.match(budget, /whole final reply is one line: `SUBMITTED T2`/);
  assert.match(cli(home, ["mission", "report"]).out, /SHORT VERSION\n {2}- full result: .*T1\.md/);
});
