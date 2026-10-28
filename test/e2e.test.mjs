// End-to-end flows through the real CLI. Scripted submissions stand in for the subagents; everything
// else (planning, scheduling, meetings, approvals, review, report) is the actual runtime.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { cli, runAgent, tmpdir } from "./helpers.mjs";

const ok = (findings, extra = {}) => ({ status: "complete", findings, ...extra });

function startReady(home) {
  const r = cli(home, ["task", "start", "ready"]);
  assert.equal(r.code, 0, r.err);
  return r.json.started;
}

test("travel: propose → customize → parallel research → meeting → itinerary → review → report", () => {
  const home = path.join(tmpdir(), ".brainiverse");
  const proposal = cli(home, ["team", "propose", "Plan a two-week trip to Japan in April on a budget of 3000 euros", "--id", "japan"]).json;
  assert.ok(proposal.roster.find((r) => r.id === "itinerary-planner").why);
  cli(home, ["agent", "rename", "researcher", "--team", "japan", "--name", "Sherlock"]);
  cli(home, ["team", "approve", "japan"]);
  cli(home, ["mission", "new", "--team", "japan", "--goal", "14-day Japan itinerary", "--success", "Within budget", "--constraint", "Vegetarian"]);

  cli(home, ["task", "add", "--agent", "researcher", "--objective", "Shortlist regions", "--accept", "2+ sources per region"]);
  cli(home, ["task", "add", "--agent", "budget-analyst", "--objective", "Daily costs per region"]);
  const wave = startReady(home);
  assert.deepEqual(wave.map((s) => s.agent), ["researcher", "budget-analyst"], "independent tasks start together");
  const brief = runAgent(home, "T1", "researcher", ok(["Tokyo", "Kyoto", "Osaka"], { evidence: ["https://www.japan.travel"] }));
  assert.match(brief, /Sherlock/, "renamed identity flows into the brief");
  assert.match(brief, /Vegetarian/, "mission constraints flow into the brief");
  runAgent(home, "T2", "budget-analyst", ok("Tokyo €180/day, Kyoto €150/day", { assumptions: ["mid-range hotels"] }));
  assert.match(cli(home, ["task", "accept", "T1"]).err, /evidence/);
  cli(home, ["task", "accept", "T1", "--evidence", "two sources each"]);
  cli(home, ["task", "accept", "T2"]);

  const meeting = cli(home, ["meeting", "start", "--objective", "Pick the route", "--with", "researcher,budget-analyst"]).json.meeting;
  cli(home, ["meeting", "ask", meeting, "--agent", "researcher,budget-analyst", "--prompt", "Which route?"]);
  const round = startReady(home);
  for (const s of round) runAgent(home, s.task, s.agent, ok(`${s.agent} prefers Kyoto-heavy`));
  const q = cli(home, ["meeting", "question", meeting, "Kyoto-heavy or Tokyo-heavy?"]).json;
  cli(home, ["meeting", "human", meeting, "Kyoto-heavy", "--answers", q.id]);
  cli(home, ["meeting", "decide", meeting, "Tokyo 4 / Kyoto 6 / Osaka 4", "--human-approved"]);
  const action = cli(home, ["meeting", "action", meeting, "--agent", "itinerary-planner", "--objective", "Day-by-day itinerary", "--accept", "fits budget"]).json.task;
  cli(home, ["meeting", "end", meeting, "--summary", "Route chosen"]);
  const transcript = cli(home, ["meeting", "show", meeting]).json.transcript;
  assert.match(transcript, /Sherlock \(Researcher\): researcher prefers Kyoto-heavy/);
  assert.match(transcript, /Human: Kyoto-heavy/);

  startReady(home);
  const itineraryBrief = runAgent(home, action, "itinerary-planner", ok(["Day 1: Tokyo", "Day 14: Osaka"], { deliverables: [{ path: "itinerary.md", description: "plan" }] }));
  assert.match(itineraryBrief, /Action item from meeting/);
  cli(home, ["task", "accept", action, "--evidence", "total €2,700 < €3,000"]);
  const review = cli(home, ["task", "add", "--agent", "reviewer", "--objective", "Audit itinerary", "--after", action]).json.task;
  startReady(home);
  const reviewBrief = runAgent(home, review, "reviewer", ok("pass: within budget, sources valid"));
  assert.match(reviewBrief, /Day 1: Tokyo/, "upstream results are shared with dependents");
  cli(home, ["task", "accept", review]);
  cli(home, ["review", action, "--verdict", "pass", "--evidence", "budget recomputed", "--reviewer", "reviewer"]);

  const synthesis = path.join(tmpdir(), "synthesis.md");
  fs.writeFileSync(synthesis, "Kyoto-heavy 14-day plan within budget.");
  cli(home, ["mission", "finalize", "--file", synthesis]);
  const report = cli(home, ["mission", "report"]).out;
  for (const expected of [/Day-by-day itinerary/, /Tokyo 4 \/ Kyoto 6/, /mid-range hotels/, /Leader's synthesis/, /itinerary\.md/]) {
    assert.match(report, expected);
  }
  assert.equal(cli(home, ["team", "save", "@mission", "--as", "my-travel-squad"]).code, 0);
  const metrics = cli(home, ["metrics"]).json;
  assert.equal(metrics.tasks_failed, 0);
  assert.ok(metrics.idle_team_members.includes("logistics"), "unused members are surfaced");
});

test("software: template → implement → failing review → revise → gated deploy with approvals", () => {
  const home = path.join(tmpdir(), ".brainiverse");
  cli(home, ["team", "from-template", "app-builders", "--id", "todo"]);
  cli(home, ["mission", "new", "--team", "todo", "--goal", "Todo app with login", "--limit", "max_iterations=2"]);
  cli(home, ["task", "add", "--agent", "architect", "--objective", "Design"]);
  startReady(home);
  runAgent(home, "T1", "architect", ok("Express + SQLite"));
  cli(home, ["task", "accept", "T1"]);
  cli(home, ["task", "add", "--agent", "coder", "--objective", "Implement auth", "--after", "T1", "--needs", "file_write,code_exec", "--accept", "tests pass"]);
  startReady(home);
  // a claimed-but-unverified action is rejected
  const bad = cli(home, ["task", "submit", "T2"], { agent: "coder", input: JSON.stringify(ok("done", { actions: [{ action: "ran tests", verified: true }] })) });
  assert.match(bad.err, /no evidence/);
  runAgent(home, "T2", "coder", ok("auth implemented", { actions: [{ action: "ran tests", verified: true, evidence: "3 passed" }] }));
  cli(home, ["task", "add", "--agent", "reviewer", "--objective", "Review auth", "--after", "T2"]);
  // T3 can't start until T2 is accepted
  assert.match(cli(home, ["task", "start", "T3"]).err, /waiting on dependencies/);
  assert.match(cli(home, ["review", "T2", "--verdict", "fail", "--evidence", "ran tests"]).err, /issues/);
  cli(home, ["review", "T2", "--verdict", "fail", "--evidence", "ran tests", "--issue", "empty password accepted"]);
  cli(home, ["task", "revise", "T2", "--feedback", "reject empty passwords"]);
  startReady(home);
  const brief = runAgent(home, "T2", "coder", ok("fixed"));
  assert.match(brief, /reject empty passwords/, "feedback reaches the agent");
  cli(home, ["task", "accept", "T2", "--evidence", "4 tests pass"]);

  // deployment: disabled agent, then capability approval, then per-use approval
  assert.match(cli(home, ["task", "add", "--agent", "devops", "--objective", "Deploy"]).err, /disabled/);
  cli(home, ["agent", "enable", "devops", "--team", "@mission"]);
  const deploy = cli(home, ["task", "add", "--agent", "devops", "--objective", "Deploy", "--needs", "external_api"]).json.task;
  assert.match(cli(home, ["task", "start", deploy]).err, /lacks external_api/);
  const grant = cli(home, ["approval", "request", "--capability", "external_api", "--agent", "devops", "--detail", "deploy access"]).json.id;
  cli(home, ["approval", "resolve", grant, "approve", "--note", "User: yes"]);
  cli(home, ["agent", "grant", "devops", "external_api", "--team", "@mission", "--approval", grant]);
  assert.match(cli(home, ["task", "start", deploy]).err, /human approval/);
  const use = cli(home, ["approval", "request", "--capability", "external_api", "--agent", "devops", "--task", deploy, "--detail", "deploy now"]).json.id;
  cli(home, ["approval", "resolve", use, "reject", "--note", "User: not yet"]);
  assert.match(cli(home, ["task", "attach-approval", deploy, use]).err, /rejected/);
  const use2 = cli(home, ["approval", "request", "--capability", "external_api", "--agent", "devops", "--task", deploy, "--detail", "deploy now"]).json.id;
  cli(home, ["approval", "resolve", use2, "approve", "--note", "User: go"]);
  cli(home, ["task", "attach-approval", deploy, use2]);
  assert.equal(cli(home, ["task", "start", deploy]).code, 0);
  cli(home, ["task", "cancel", deploy]);
  assert.match(cli(home, ["mission", "report"]).out, /Outstanding or unsuccessful work[\s\S]*Deploy/);
  assert.match(cli(home, ["mission", "report"]).out, /empty password accepted/);
});

test("research: fan-out → synthesis → challenge → skill discovery → audit", () => {
  const home = path.join(tmpdir(), ".brainiverse");
  cli(home, ["team", "from-template", "discovery-crew", "--id", "idea"]);
  cli(home, ["mission", "new", "--team", "idea", "--goal", "Is a plant subscription worth pursuing?"]);
  cli(home, ["task", "add", "--agent", "market-researcher", "--objective", "Market"]);
  cli(home, ["task", "add", "--agent", "trend-explorer", "--objective", "Trends"]);
  cli(home, ["task", "add", "--agent", "creative", "--objective", "Concepts", "--after", "T1,T2"]);
  cli(home, ["task", "add", "--agent", "challenger", "--objective", "Challenge", "--after", "T3"]);
  for (const [ids, findings] of [[["T1", "T2"], "growing market"], [["T3"], "3 concepts"], [["T4"], "churn risk"]]) {
    const started = startReady(home).map((s) => s.task);
    assert.deepEqual(started, ids);
    for (const s of started) {
      runAgent(home, s, cli(home, ["task", "show", s]).json.agent, ok(findings));
      cli(home, ["task", "accept", s]);
    }
  }
  // skill discovery with a locally "installed" skill
  const skillDir = path.join(tmpdir(), "deck");
  fs.mkdirSync(skillDir);
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), "---\nname: deck\ndescription: makes slide decks\n---\nMake slides.\n");
  cli(home, ["skill", "gap", "slides", "need a deck"]);
  assert.match(cli(home, ["skill", "candidate", "--name", "invented", "--source", "?", "--purpose", "x", "--agent", "creative"]).err, /actually found/);
  cli(home, ["skill", "candidate", "--name", "deck", "--source", "github", "--url", "https://github.com/example/deck", "--purpose", "slides", "--agent", "creative", "--gap", "G1"]);
  assert.equal(cli(home, ["skill", "scan", skillDir, "--candidate", "S1"]).json.risk, "low");
  assert.equal(cli(home, ["skill", "recommend"]).json.length, 1);
  assert.match(cli(home, ["skill", "verify", "S1", "--path", skillDir]).err, /approved/);
  const a = cli(home, ["approval", "request", "--kind", "skill_install", "--skill", "S1", "--detail", "install deck"]).json.id;
  cli(home, ["approval", "resolve", a, "approve", "--note", "User: yes"]);
  cli(home, ["skill", "approve", "S1", "--approval", a]);
  assert.equal(cli(home, ["skill", "verify", "S1", "--path", skillDir]).json.status, "integrated");
  assert.ok(cli(home, ["agent", "show", "creative", "--team", "@mission"]).json.skills.includes("deck"));

  cli(home, ["task", "add", "--agent", "reviewer", "--objective", "Audit recommendation", "--after", "T4"]);
  startReady(home);
  assert.match(runAgent(home, "T5", "reviewer", ok("sources valid")), /churn risk/);
  const report = cli(home, ["mission", "report"]).out;
  assert.match(report, /Skills integrated[\s\S]*deck/);
  assert.equal(cli(home, ["metrics"]).json.completion_rate, 0.8);
});
