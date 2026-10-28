import { test } from "node:test";
import assert from "node:assert/strict";
import * as o from "../skill/brainiverse/runtime/orchestrator.mjs";
import * as permissions from "../skill/brainiverse/runtime/permissions.mjs";
import { missionState, result } from "./helpers.mjs";

const ids = (tasks) => tasks.map((t) => t.id);

test("dependencies gate scheduling; independent tasks are ready together", () => {
  const s = missionState();
  o.addTask(s, { objective: "research", agent: "researcher" });
  o.addTask(s, { objective: "budget", agent: "budget-analyst" });
  o.addTask(s, { objective: "itinerary", agent: "itinerary-planner", depends_on: ["T1", "T2"] });
  assert.deepEqual(ids(o.readyTasks(s)), ["T1", "T2"]);
  assert.throws(() => o.startTask(s, "T3"), /waiting on dependencies/);
  for (const id of ["T1", "T2"]) {
    o.startTask(s, id);
    o.submit(s, id, result());
    o.accept(s, id);
  }
  assert.deepEqual(ids(o.readyTasks(s)), ["T3"]);
});

test("unknown dependencies and agents are rejected", () => {
  const s = missionState();
  assert.throws(() => o.addTask(s, { objective: "x", agent: "researcher", depends_on: ["T9"] }), /unknown dependency/);
  assert.throws(() => o.addTask(s, { objective: "x", agent: "nobody" }), /no agent/);
});

test("concurrency limit caps the ready set and starting", () => {
  const s = missionState("travel-squad", { max_concurrent: 2 });
  for (let i = 0; i < 4; i++) o.addTask(s, { objective: `t${i}`, agent: "researcher" });
  assert.equal(o.readyTasks(s).length, 2);
  o.startTask(s, "T1");
  o.startTask(s, "T2");
  assert.equal(o.readyTasks(s).length, 0);
  assert.throws(() => o.startTask(s, "T3"), /concurrency/);
});

test("invocation budget and per-agent limits stop runaway work", () => {
  const s = missionState("travel-squad", { max_invocations: 1 });
  o.addTask(s, { objective: "a", agent: "researcher" });
  o.addTask(s, { objective: "b", agent: "researcher" });
  o.startTask(s, "T1");
  assert.throws(() => o.startTask(s, "T2"), /invocation budget/);
});

test("task limit and delegation depth are enforced", () => {
  const s = missionState("travel-squad", { max_tasks: 3, max_delegation_depth: 1 });
  o.addTask(s, { objective: "root", agent: "researcher" });
  o.addTask(s, { objective: "child", agent: "researcher", parent: "T1" });
  assert.throws(() => o.addTask(s, { objective: "grandchild", agent: "researcher", parent: "T2" }), /delegation depth/);
  o.addTask(s, { objective: "third", agent: "researcher" });
  assert.throws(() => o.addTask(s, { objective: "fourth", agent: "researcher" }), /task limit/);
});

test("failures retry within limits, then fail and block dependents", () => {
  const s = missionState("travel-squad", { max_retries: 1 });
  o.addTask(s, { objective: "flaky", agent: "researcher" });
  o.addTask(s, { objective: "after", agent: "itinerary-planner", depends_on: ["T1"] });
  o.startTask(s, "T1");
  assert.equal(o.fail(s, "T1", "network").status, "pending", "first failure retries");
  o.startTask(s, "T1");
  assert.equal(o.fail(s, "T1", "network again").status, "failed");
  assert.equal(s.tasks.T2.status, "blocked");
  assert.equal(s.invocations.I1.status, "failed");
});

test("timeouts are swept into failures", () => {
  const s = missionState("travel-squad", { max_retries: 0 });
  o.addTask(s, { objective: "slow", agent: "researcher", timeout_s: 10 });
  o.startTask(s, "T1", 1000);
  assert.deepEqual(o.sweepTimeouts(s, 1005), []);
  assert.deepEqual(o.sweepTimeouts(s, 1011), ["T1"]);
  assert.equal(s.tasks.T1.status, "failed");
  assert.equal(s.invocations.I1.status, "timed_out");
});

test("cancellation cascades to dependents", () => {
  const s = missionState();
  o.addTask(s, { objective: "a", agent: "researcher" });
  o.addTask(s, { objective: "b", agent: "budget-analyst", depends_on: ["T1"] });
  o.addTask(s, { objective: "c", agent: "itinerary-planner", depends_on: ["T2"] });
  o.startTask(s, "T1");
  o.cancel(s, "T1");
  assert.equal(s.invocations.I1.status, "cancelled");
  assert.deepEqual([s.tasks.T2.status, s.tasks.T3.status], ["blocked", "blocked"]);
  assert.throws(() => o.cancel(s, "T1"), /already/);
});

test("submissions are proposals until accepted; criteria need evidence", () => {
  const s = missionState();
  o.addTask(s, { objective: "a", agent: "researcher", acceptance: ["has sources"] });
  o.startTask(s, "T1");
  o.submit(s, "T1", result(["x"], { evidence: ["https://example.org"] }));
  assert.equal(s.tasks.T1.status, "submitted");
  assert.throws(() => o.accept(s, "T1"), /evidence/);
  o.accept(s, "T1", "checked the source");
  assert.equal(s.tasks.T1.status, "done");
});

test("revisions are bounded by max_iterations", () => {
  const s = missionState("travel-squad", { max_iterations: 1 });
  o.addTask(s, { objective: "draft", agent: "researcher" });
  o.startTask(s, "T1");
  o.submit(s, "T1", result());
  o.revise(s, "T1", "add sources");
  assert.equal(s.tasks.T1.status, "pending");
  o.startTask(s, "T1");
  o.submit(s, "T1", result());
  assert.throws(() => o.revise(s, "T1", "again"), /max_iterations/);
});

test("result protocol: required fields and verified actions need evidence", () => {
  assert.throws(() => o.validateResult({ status: "complete" }), /findings/);
  assert.throws(() => o.validateResult({ status: "great", findings: "x" }), /status/);
  assert.throws(() => o.validateResult({ status: "complete", findings: "x", evidence: "nope" }), /list/);
  assert.throws(() => o.validateResult({ status: "complete", findings: "x", actions: [{ action: "deployed", verified: true }] }), /no evidence/);
  const ok = o.validateResult({ status: "complete", findings: "x", actions: [{ action: "wrote file", verified: true, evidence: "ls output" }] });
  assert.deepEqual(ok.blockers, []);
});

test("only running tasks accept submissions", () => {
  const s = missionState();
  o.addTask(s, { objective: "a", agent: "researcher" });
  assert.throws(() => o.submit(s, "T1", result()), /only a running task/);
});

test("gated capabilities need the agent to hold them and an approval per task", () => {
  const s = missionState();
  o.addTask(s, { objective: "book hotel", agent: "logistics", needs: ["spend_money"] });
  assert.throws(() => o.startTask(s, "T1"), /lacks spend_money/);
  s.team.agents.find((a) => a.id === "logistics").capabilities.push("spend_money");
  assert.throws(() => o.startTask(s, "T1"), /human approval/);
  const approval = permissions.request(s, { kind: "capability", detail: "book hotel", agent: "logistics", capability: "spend_money", task: "T1" });
  permissions.resolve(s, approval.id, true, "User: yes");
  s.tasks.T1.approval = approval.id;
  o.startTask(s, "T1");
  assert.equal(s.approvals[approval.id].status, "consumed", "approvals are single-use");
});

test("paused missions refuse new work", () => {
  const s = missionState();
  s.status = "paused";
  assert.throws(() => o.addTask(s, { objective: "a", agent: "researcher" }), /paused/);
});

test("progress reports counts, ready tasks and pending approvals", () => {
  const s = missionState();
  o.addTask(s, { objective: "a", agent: "researcher" });
  permissions.request(s, { kind: "action", detail: "x" });
  const p = o.progress(s);
  assert.equal(p.tasks.pending, 1);
  assert.deepEqual(p.ready, ["T1"]);
  assert.deepEqual(p.pending_approvals, ["A1"]);
});
