import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { cli, runAgent, tmpdir } from "./helpers.mjs";

function projectDir({ repo = true } = {}) {
  const root = tmpdir();
  if (repo) fs.writeFileSync(path.join(root, "package.json"), "{}");
  return { root, home: path.join(root, ".brainiverse") };
}

const agentFile = (root, id) => path.join(root, ".claude", "agents", `brainiverse-${id}.md`);

test("intake routes requests: answer, quick team, new project, continue project, ask", () => {
  const { root, home } = projectDir();
  const mode = (text) => cli(home, ["intake", ...(text === undefined ? [] : [text])]).json.mode;
  assert.equal(mode(), "ask");
  assert.equal(mode("what time zone is Tokyo?"), "answer");
  assert.equal(mode("plan a two-week trip to Japan in April"), "quick_team");
  const trip = cli(home, ["intake", "plan a two-week trip to Japan in April"]).json;
  assert.ok(trip.kickoff.rounds.length >= 2, "a trip gets a full kickoff interview");
  assert.equal(mode("build and ship a todo web app with login"), "new_project");
  cli(home, ["team", "from-template", "app-builders", "--id", "todo"]);
  cli(home, ["project", "adopt", "todo"]);
  const cont = cli(home, ["intake", "add a dark mode feature"]).json;
  assert.equal(cont.mode, "continue_project");
  assert.ok(cont.project_team.roster.includes("Tyler (Coder)"));
  assert.equal(mode("plan a trip to Rome"), "quick_team", "one-off missions still get a quick team");
  assert.ok(fs.existsSync(agentFile(root, "coder")));
});

test("adopting a project team writes Claude Code agents; changes re-sync", () => {
  const { root, home } = projectDir();
  cli(home, ["team", "from-template", "app-builders", "--id", "todo"]);
  const adopted = cli(home, ["project", "adopt", "todo"]).json;
  assert.ok(adopted.written.includes(".claude/agents/brainiverse-coder.md"));
  assert.ok(!fs.existsSync(agentFile(root, "leader")), "the leader is the main session, not a subagent");
  assert.ok(!fs.existsSync(agentFile(root, "devops")), "disabled agents are not written");
  const coder = fs.readFileSync(agentFile(root, "coder"), "utf8");
  assert.match(coder, /^---\nname: brainiverse-coder\n/);
  assert.match(coder, /tools: Read, Grep, Glob, Write, Edit, Bash/);
  assert.match(coder, /# Tyler \(Coder\)/);
  const designer = fs.readFileSync(agentFile(root, "designer"), "utf8");
  assert.doesNotMatch(designer, /tools:.*Bash/, "tool lists follow capabilities");

  // a new agent joins the project for good
  cli(home, ["team", "add", "@project", "--archetype", "specialist", "--id", "a11y", "--name", "Hannah", "--position", "Accessibility Expert"]);
  assert.match(fs.readFileSync(agentFile(root, "a11y"), "utf8"), /Hannah \(Accessibility Expert\)/);
  // enabling DevOps writes it; removing an agent deletes its file
  cli(home, ["agent", "enable", "devops", "--team", "@project"]);
  assert.ok(fs.existsSync(agentFile(root, "devops")));
  cli(home, ["team", "remove", "@project", "Hannah"]);
  assert.ok(!fs.existsSync(agentFile(root, "a11y")));
  // renaming keeps the file name (id) and updates its contents
  cli(home, ["agent", "rename", "coder", "--team", "@project", "--name", "Peter"]);
  assert.match(fs.readFileSync(agentFile(root, "coder"), "utf8"), /# Peter \(Coder\)/);
});

test("never overwrites agent files brainiverse didn't write; release removes only its own", () => {
  const { root, home } = projectDir();
  fs.mkdirSync(path.join(root, ".claude", "agents"), { recursive: true });
  fs.writeFileSync(agentFile(root, "coder"), "my own agent");
  fs.writeFileSync(path.join(root, ".claude", "agents", "reviewer-bot.md"), "someone else's");
  cli(home, ["team", "from-template", "app-builders", "--id", "todo"]);
  const r = cli(home, ["project", "adopt", "todo"]);
  assert.equal(r.code, 1);
  assert.match(r.err, /not written by brainiverse/);
  assert.equal(fs.readFileSync(agentFile(root, "coder"), "utf8"), "my own agent");
  fs.unlinkSync(agentFile(root, "coder"));
  assert.equal(cli(home, ["project", "adopt", "todo"]).code, 0);
  const released = cli(home, ["project", "release"]).json;
  assert.ok(released.removed.length > 0);
  assert.ok(fs.existsSync(path.join(root, ".claude", "agents", "reviewer-bot.md")));
  assert.equal(cli(home, ["project", "status"]).json.project_team, null);
});

test("project missions use the project team and its own agent types; edits stick to the project", () => {
  const { root, home } = projectDir();
  cli(home, ["team", "from-template", "app-builders", "--id", "todo"]);
  cli(home, ["project", "adopt", "todo"]);
  assert.equal(cli(home, ["mission", "new", "--goal", "Add login"]).code, 0, "--team defaults to the project team");
  cli(home, ["task", "add", "--agent", "Tyler", "--objective", "Implement login"]);
  cli(home, ["task", "add", "--agent", "designer", "--objective", "Design the login screen"]);
  const started = cli(home, ["task", "start", "ready"]).json.started;
  const coder = started.find((s) => s.agent === "coder");
  assert.equal(coder.label, "Tyler (Coder)");
  assert.equal(coder.agent_call.subagent_type, "brainiverse-coder");
  assert.match(coder.agent_call.prompt, /task brief T1/, "agents with Bash fetch their own brief");
  assert.ok(coder.fallback);
  const designer = started.find((s) => s.agent === "designer");
  assert.equal(designer.leader_submits, true, "no Bash: the brief is inlined and the Leader submits");
  assert.match(designer.agent_call.prompt, /# Yasmin \(Designer\)/);
  assert.match(designer.agent_call.prompt, /Do not run any command to report/);

  // adding through the mission adds to the project
  cli(home, ["team", "add", "@mission", "--archetype", "challenger", "--id", "security", "--name", "Ben", "--position", "Security Reviewer"]);
  assert.ok(fs.existsSync(agentFile(root, "security")));
  assert.ok(cli(home, ["team", "show", "@project"]).json.agents.some((a) => a.id === "security"));
});

test("ask: follow-up questions and requests reuse one line and see the agent's earlier work", () => {
  const { home } = projectDir({ repo: false });
  cli(home, ["team", "from-template", "travel-squad"]);
  cli(home, ["mission", "new", "--goal", "Japan trip", "--team", "travel-squad"]);
  cli(home, ["task", "add", "--agent", "Babak", "--objective", "Daily costs per region"]);
  cli(home, ["task", "start", "ready"]);
  runAgent(home, "T1", "budget-analyst", { status: "complete", findings: "Kyoto is €150/day" });
  cli(home, ["task", "accept", "T1"]);

  const first = cli(home, ["ask", "babak", "Why is Kyoto cheaper than Tokyo?"]).json;
  assert.equal(first.label, "Babak (Budget Analyst)");
  const brief = runAgent(home, first.task, "budget-analyst", { status: "complete", findings: "Hotels cost less there." });
  assert.match(brief, /Your work so far in this mission:[\s\S]*Kyoto is €150\/day/);
  assert.match(brief, /If they ask for more work, do it now/);

  const second = cli(home, ["ask", "Babak", "Also check ryokan prices, please."]).json;
  assert.equal(second.chat, first.chat, "the same direct line is reused");
  runAgent(home, second.task, "budget-analyst", { status: "complete", findings: "Ryokans: €180-€400/night", evidence: ["https://example.org"] });
  const transcript = cli(home, ["chat", "show", first.chat]).out;
  assert.match(transcript, /Human: Why is Kyoto cheaper[\s\S]*Babak \(Budget Analyst\): Hotels cost less there\.[\s\S]*Babak \(Budget Analyst\): Ryokans/);
  assert.match(cli(home, ["ask", "captain", "hi"]).err, /main contact/);
  assert.match(cli(home, ["status"]).out, /Babak \(Budget Analyst\)/);
});

test("newcomers without a name get a free name from the pool, never a duplicate", () => {
  const { home } = projectDir();
  cli(home, ["team", "from-template", "travel-squad", "--id", "trip"]);
  const first = cli(home, ["team", "add", "trip", "--archetype", "researcher", "--id", "researcher-2"]).json;
  const second = cli(home, ["team", "add", "trip", "--archetype", "researcher", "--id", "researcher-3"]).json;
  assert.equal(first.label, "Amanda (Researcher)");
  assert.equal(second.label, "Josh (Researcher)");
  const names = cli(home, ["team", "show", "trip"]).json.agents.map((a) => a.name.toLowerCase());
  assert.equal(new Set(names).size, names.length);
});
