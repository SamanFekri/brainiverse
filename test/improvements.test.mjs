import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ROOT, cli, cliAsync, runAgent, tmpdir } from "./helpers.mjs";

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
  assert.equal(sdk.agent_call.agent_definition.model, "opus");
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
  cli(home, ["mission", "new", "--goal", "Trip", "--team", "travel-squad", "--limit", "token_budget=50000"]);
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
  const url = await new Promise((resolve, reject) => {
    let buffer = "";
    child.stdout.on("data", (d) => { buffer += d; const m = buffer.match(/"url": "([^"]+)"/); if (m) resolve(m[1]); });
    timer = setTimeout(() => reject(new Error("dashboard did not start")), 10000);
  });
  clearTimeout(timer);
  const get = (u) => fetch(u, { headers: { connection: "close" } });
  try {
    const state = await (await get(url + "api/state")).json();
    assert.equal(state.mission.title, "Trip");
    assert.ok(state.mission.team.agents.some((a) => a.label === "Babak (Budget Analyst)"));
    assert.match(await (await get(url)).text(), /<title>Brainiverse Board<\/title>/);
    assert.equal((await get(url + "nope")).status, 404);
  } finally {
    child.kill();
    await server;
  }
});
