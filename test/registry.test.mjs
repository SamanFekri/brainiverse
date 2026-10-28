import { test } from "node:test";
import assert from "node:assert/strict";
import * as registry from "../skill/brainiverse/runtime/registry.mjs";
import { BrainiverseError } from "../skill/brainiverse/runtime/store.mjs";
import { workspace } from "./helpers.mjs";

test("all ten archetypes exist and produce valid agents", () => {
  const ids = Object.keys(registry.archetypes());
  assert.equal(ids.length, 10);
  for (const id of ids) {
    const agent = registry.makeAgent(id);
    assert.equal(agent.archetype, id);
    assert.ok(agent.responsibilities.length > 0);
  }
});

test("themes give agents names and personalities", () => {
  assert.equal(registry.makeAgent("researcher").name, "Lumen");
  assert.equal(registry.makeAgent("researcher", { theme: "classic" }).name, "Vision");
  assert.equal(registry.makeAgent("researcher", { theme: "professional" }).name, "Researcher");
});

test("renaming never changes responsibilities or permissions", () => {
  const agent = registry.makeAgent("researcher");
  const renamed = registry.rename(agent, { name: "Sherlock", personality: "Deductive" });
  assert.equal(renamed.name, "Sherlock");
  assert.deepEqual(renamed.capabilities, agent.capabilities);
  assert.deepEqual(renamed.responsibilities, agent.responsibilities);
  assert.equal(renamed.archetype, agent.archetype);
});

test("edit changes fields, but capabilities and id are protected", () => {
  const agent = registry.makeAgent("analyst");
  const edited = registry.edit(agent, {
    sets: ["instructions=Use EUR", "expertise=budgets;forecasting", "limits.timeout_s=300", "model=fast"],
    adds: ["decision_rules=Round to tens"],
  });
  assert.equal(edited.instructions, "Use EUR");
  assert.deepEqual(edited.expertise, ["budgets", "forecasting"]);
  assert.equal(edited.limits.timeout_s, 300);
  assert.ok(edited.decision_rules.includes("Round to tens"));
  assert.throws(() => registry.edit(agent, { sets: ["capabilities=spend_money"] }), /grant/);
  assert.throws(() => registry.edit(agent, { sets: ["id=other"] }), BrainiverseError);
  assert.throws(() => registry.edit(agent, { sets: ["model=gigantic"] }), /model/);
});

test("gated capabilities need an approved, matching approval", () => {
  const agent = registry.makeAgent("communicator", { id: "echo" });
  assert.throws(() => registry.grant(agent, "send_communication"), /approval/);
  const pending = { id: "A1", status: "pending", capability: "send_communication", agent: "echo" };
  assert.throws(() => registry.grant(agent, "send_communication", pending), /approval/);
  const wrong = { id: "A1", status: "approved", capability: "spend_money", agent: "echo" };
  assert.throws(() => registry.grant(agent, "send_communication", wrong), /does not match/);
  const ok = { id: "A1", status: "approved", capability: "send_communication", agent: "echo" };
  assert.ok(registry.grant(agent, "send_communication", ok).capabilities.includes("send_communication"));
  assert.ok(registry.grant(agent, "file_write").capabilities.includes("file_write"), "non-gated grants need no approval");
});

test("imports strip gated capabilities and reject junk", () => {
  const [profile, stripped] = registry.sanitizeImport({
    id: "sneaky", name: "Sneaky", archetype: "executor", capabilities: ["file_read", "spend_money", "delete_data"], evil: true,
  });
  assert.deepEqual(stripped.sort(), ["delete_data", "spend_money"]);
  assert.ok(!profile.capabilities.includes("spend_money"));
  assert.equal(profile.evil, undefined);
  assert.throws(() => registry.sanitizeImport([]), BrainiverseError);
  assert.throws(() => registry.sanitizeImport({ id: "x", name: "X", archetype: "wizard" }), /archetype/);
});

test("library: save, load, duplicate, delete", () => {
  const ws = workspace();
  registry.save(ws, registry.makeAgent("specialist", { id: "visa", name: "Visa Wizard", expertise: ["visas"] }));
  const copy = registry.duplicate(registry.load(ws, "visa"), "visa-eu", "Schengen Sage");
  registry.save(ws, copy);
  assert.deepEqual(registry.listAgents(ws).map((a) => a.id).sort(), ["visa", "visa-eu"]);
  assert.deepEqual(registry.load(ws, "visa-eu").expertise, ["visas"]);
  ws.deleteRecord("agents", "visa");
  assert.throws(() => registry.load(ws, "visa"), /no agent/);
});

test("invalid ids are rejected", () => {
  assert.throws(() => registry.makeAgent("analyst", { id: "../etc" }), /invalid agent id/);
  assert.throws(() => registry.makeAgent("analyst", { id: "Has Spaces" }), /invalid agent id/);
});
