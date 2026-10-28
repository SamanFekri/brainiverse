import { test } from "node:test";
import assert from "node:assert/strict";
import * as teams from "../skill/brainiverse/runtime/teams.mjs";
import * as registry from "../skill/brainiverse/runtime/registry.mjs";

const archetypesOf = (proposal) => proposal.team.agents.map((a) => a.archetype);
const idsOf = (proposal) => proposal.team.agents.map((a) => a.id);

test("travel mission gets travel specialists, research, and review", () => {
  const p = teams.proposeTeam("I want to plan a two-week trip to Japan on a tight budget");
  assert.deepEqual(p.analysis.domains, ["travel"]);
  assert.ok(idsOf(p).includes("navigator"));
  assert.ok(idsOf(p).includes("penny"), "budget keyword brings in the budget analyst");
  assert.ok(archetypesOf(p).includes("researcher"));
  assert.ok(archetypesOf(p).includes("quality_reviewer"));
  assert.equal(p.team.leader, "captain");
  assert.ok(p.questions.some((q) => /budget/i.test(q)));
  for (const agent of p.team.agents) assert.ok(p.reasons[agent.id], `reason for ${agent.id}`);
});

test("software mission adds conditional specialists only when signalled", () => {
  const withLogin = teams.proposeTeam("Build and launch a web application with user login");
  assert.ok(idsOf(withLogin).includes("security-guardian"));
  assert.ok(idsOf(withLogin).includes("devops"));
  const plain = teams.proposeTeam("Fix a bug in my web app");
  assert.ok(!idsOf(plain).includes("security-guardian"));
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
  assert.deepEqual(teams.templateIds(), ["app-builders", "discovery-crew", "travel-squad"]);
  for (const id of teams.templateIds()) {
    const team = teams.teamFromTemplate(id);
    assert.ok(team.agents.length >= 7);
    assert.equal(team.leader, "captain");
  }
  assert.equal(teams.findAgent(teams.teamFromTemplate("app-builders"), "devops").enabled, false);
});

test("team operations: add, remove, leader, redundancy", () => {
  let team = teams.teamFromTemplate("discovery-crew");
  assert.throws(() => teams.removeAgent(team, "captain"), /leader/);
  team = teams.addAgent(team, registry.makeAgent("communicator", { id: "echo" }));
  assert.throws(() => teams.addAgent(team, registry.makeAgent("communicator", { id: "echo" })), /already/);
  team = teams.addAgent(team, registry.makeAgent("creative_thinker", { id: "spark-2" }));
  assert.ok(teams.redundancyWarnings(team).some((w) => /duplicates/.test(w)));
  team = teams.setLeader(team, "sherlock");
  assert.equal(team.leader, "sherlock");
  team = teams.removeAgent(team, "captain");
  assert.ok(!team.agents.some((a) => a.id === "captain"));
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
  assert.deepEqual(stripped, { lumen: ["spend_money"] });
  assert.ok(!imported.agents[1].capabilities.includes("spend_money"));
});
