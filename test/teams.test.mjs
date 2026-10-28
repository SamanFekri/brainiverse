import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as teams from "../skill/brainiverse/runtime/teams.mjs";
import * as registry from "../skill/brainiverse/runtime/registry.mjs";

const archetypesOf = (proposal) => proposal.team.agents.map((a) => a.archetype);
const idsOf = (proposal) => proposal.team.agents.map((a) => a.id);

test("travel mission gets travel specialists, research, and review", () => {
  const p = teams.proposeTeam("I want to plan a two-week trip to Japan on a tight budget");
  assert.deepEqual(p.analysis.domains, ["travel"]);
  assert.ok(idsOf(p).includes("itinerary-planner"));
  assert.ok(idsOf(p).includes("budget-analyst"), "budget keyword brings in the budget analyst");
  assert.ok(p.team.agents.some((a) => a.name === "Babak" && a.position === "Budget Analyst"));
  assert.ok(archetypesOf(p).includes("researcher"));
  assert.ok(archetypesOf(p).includes("quality_reviewer"));
  assert.equal(p.team.leader, "leader");
  const asked = p.kickoff.rounds.flat().map((q) => q.id);
  assert.ok(asked.includes("transport") && asked.includes("travellers"), "travel kickoff covers transport and travellers");
  assert.ok(p.kickoff.already_answered.includes("budget"), "the request already said 'tight budget'");
  for (const agent of p.team.agents) assert.ok(p.reasons[agent.id], `reason for ${agent.id}`);
});

test("software mission adds conditional specialists only when signalled", () => {
  const withLogin = teams.proposeTeam("Build and launch a web application with user login");
  assert.ok(idsOf(withLogin).includes("security"));
  assert.ok(idsOf(withLogin).includes("devops"));
  const plain = teams.proposeTeam("Fix a bug in my web app");
  assert.ok(!idsOf(plain).includes("security"));
  assert.ok(!idsOf(plain).includes("devops"));
});

test("research mission gets researcher, analyst and challenger", () => {
  const p = teams.proposeTeam("I want to investigate whether a business idea is worth pursuing");
  assert.ok(archetypesOf(p).includes("researcher"));
  assert.ok(archetypesOf(p).includes("analyst"));
  assert.ok(archetypesOf(p).includes("challenger"));
});

test("unrelated domains share the same machinery and differ in rosters", () => {
  const a = teams.proposeTeam("I want to learn machine learning");
  const b = teams.proposeTeam("Help me organize my personal life");
  assert.ok(idsOf(a).includes("mentor"));
  assert.ok(idsOf(b).includes("coach"));
});

test("small requests get small teams and the cap is respected", () => {
  const small = teams.proposeTeam("Write me a quick haiku");
  assert.equal(small.analysis.complexity, "small");
  assert.ok(small.team.agents.length <= 4);
  const capped = teams.proposeTeam("Build and launch a full startup platform with marketing, pitch to investors and track milestones", { maxAgents: 3 });
  assert.equal(capped.team.agents.length, 3);
  assert.ok(capped.optional.length > 0);
  assert.equal(capped.team.agents[0].archetype, "leader");
});

test("no signals falls back to research + analysis with a disclosed assumption", () => {
  const p = teams.proposeTeam("hmm");
  assert.ok(p.assumptions.length > 0);
  assert.ok(archetypesOf(p).includes("researcher"));
});

test("templates load and are valid", () => {
  assert.deepEqual(teams.templateIds(), ["app-builders", "discovery-crew", "launch-team", "learning-lab", "life-ops", "travel-squad"]);
  for (const id of teams.templateIds()) {
    const team = teams.teamFromTemplate(id);
    assert.ok(team.agents.length >= 6);
    assert.equal(team.leader, "leader");
  }
  assert.equal(teams.findAgent(teams.teamFromTemplate("app-builders"), "devops").enabled, false);
});

test("team operations: add, remove, leader, redundancy", () => {
  let team = teams.teamFromTemplate("discovery-crew");
  assert.throws(() => teams.removeAgent(team, "leader"), /leader/);
  team = teams.addAgent(team, registry.makeAgent("communicator", { id: "echo" }));
  assert.throws(() => teams.addAgent(team, registry.makeAgent("communicator", { id: "echo" })), /already/);
  team = teams.addAgent(team, registry.makeAgent("creative_thinker", { id: "spark-2" }));
  assert.ok(teams.redundancyWarnings(team).some((w) => /duplicates/.test(w)));
  team = teams.setLeader(team, "Madison");
  assert.equal(team.leader, "market-researcher", "agents can be referenced by name");
  team = teams.removeAgent(team, "captain");
  assert.ok(!team.agents.some((a) => a.id === "leader"));
});

test("team size is hard-capped", () => {
  let team = teams.teamFromTemplate("travel-squad");
  for (let i = 0; i < 5; i++) team = teams.addAgent(team, registry.makeAgent("specialist", { id: `s${i}` }));
  assert.throws(() => teams.addAgent(team, registry.makeAgent("specialist", { id: "one-too-many" })), /limit/);
});

test("team import strips gated capabilities per agent", () => {
  const team = teams.teamFromTemplate("travel-squad");
  team.agents[1].capabilities.push("spend_money");
  const [imported, stripped] = teams.sanitizeImport(JSON.parse(JSON.stringify(team)));
  assert.deepEqual(stripped, { researcher: ["spend_money"] });
  assert.ok(!imported.agents[1].capabilities.includes("spend_money"));
});

test("kickoff questions fit AskUserQuestion and skip what the request already answers", () => {
  const data = JSON.parse(fs.readFileSync(new URL("../skill/brainiverse/runtime/data/domains.json", import.meta.url), "utf8"));
  const all = [...data.kickoff_generic, ...data.kickoff_project_task, ...Object.values(data.domains).flatMap((d) => d.questions)];
  const followUps = all.flatMap((q) => Object.values(q.follow_ups || {}).flat());
  assert.ok(followUps.length > 0);
  for (const q of [...all, ...followUps]) {
    assert.ok(q.header.length <= 12, `header too long: ${q.header}`);
    if (q.options) assert.ok(q.options.length >= 2 && q.options.length <= 4, `2-4 options: ${q.id}`);
  }
  const k = teams.kickoffQuestions("Plan a trip to Italy by train in June with my wife");
  assert.ok(k.rounds.every((r) => r.length <= 4));
  assert.deepEqual(["dates", "transport", "travellers"].filter((id) => k.already_answered.includes(id)), ["dates", "transport", "travellers"]);
  const open = teams.kickoffQuestions("Plan a trip to Italy");
  const transport = open.rounds.flat().find((q) => q.id === "transport");
  assert.ok(transport.multi, "transport offers car/train/plane/bus, multi-select");
  assert.ok(transport.follow_ups["My own car / a rental car"][0].question.includes("driving"), "answers trigger follow-ups");
  assert.match(open.how, /checklist, not a script/);
  const task = teams.kickoffQuestions("add dark mode", { mode: "continue_project" });
  assert.deepEqual([...task.rounds.flat(), ...task.free_text].map((q) => q.id).sort(), ["done", "priority", "scope"]);
});
