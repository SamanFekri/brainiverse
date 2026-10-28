import { test } from "node:test";
import assert from "node:assert/strict";
import * as m from "../skill/brainiverse/runtime/meetings.mjs";
import * as meetingsModule from "../skill/brainiverse/runtime/meetings.mjs";
import * as o from "../skill/brainiverse/runtime/orchestrator.mjs";
import { missionState, result } from "./helpers.mjs";

function contribute(s, taskId, findings) {
  o.startTask(s, taskId);
  o.submit(s, taskId, result(findings));
  m.recordContribution(s, s.tasks[taskId]);
}

test("participants must be enabled team members, within the limit", () => {
  const s = missionState("app-builders", { max_meeting_participants: 2 });
  assert.throws(() => m.start(s, "Plan", ["leader"]), /at least one/);
  assert.throws(() => m.start(s, "Plan", ["devops"]), /disabled/);
  assert.throws(() => m.start(s, "Plan", ["architect", "coder", "designer"]), /max_meeting_participants/);
  const meeting = m.start(s, "Plan", ["leader", "architect", "coder"]);
  assert.deepEqual(meeting.participants, ["architect", "coder"], "the host is not a participant");
});

test("contributions come only from real invocations and land in the transcript", () => {
  const s = missionState("discovery-crew");
  const meeting = m.start(s, "Choose a direction", ["market-researcher", "financial-analyst"]);
  const t1 = m.ask(s, meeting.id, "market-researcher", "What does the market say?");
  const t2 = m.ask(s, meeting.id, "financial-analyst", "Is it feasible?");
  assert.throws(() => m.ask(s, meeting.id, "creative", "?"), /not in meeting/);
  contribute(s, t1.id, "Market is growing 12%/yr");
  contribute(s, t2.id, ["Break-even in 18 months"]);
  const contributions = meeting.messages.filter((x) => x.kind === "contribution");
  assert.equal(contributions.length, 2);
  assert.ok(contributions.every((x) => x.invocation && s.invocations[x.invocation]), "each linked to an invocation");
  assert.match(m.transcript(s, meeting.id), /Madison \(Market Researcher\): Market is growing/);
  assert.equal(s.tasks[t1.id].status, "done");
  assert.equal(typeof meetingsModule.post, "undefined", "no public API to post as an agent");
});

test("second round: agents respond to each other via the shared transcript", () => {
  const s = missionState("discovery-crew");
  const meeting = m.start(s, "Debate", ["creative", "challenger"]);
  contribute(s, m.ask(s, meeting.id, "creative", "Pitch").id, "Plant subscriptions");
  const challenge = m.ask(s, meeting.id, "challenger", "Challenge Spark's pitch");
  assert.match(challenge.objective, /Challenge Spark/);
  contribute(s, challenge.id, "Churn will kill it");
  assert.match(m.transcript(s, meeting.id), /Jake \(Creative Thinker\): Plant subscriptions[\s\S]*Neda \(Challenger\): Churn/);
});

test("human answers, decisions, assumptions, and action items", () => {
  const s = missionState();
  const meeting = m.start(s, "Route", ["researcher", "budget-analyst"]);
  const q = m.question(s, meeting.id, "Kyoto or Tokyo?");
  m.human(s, meeting.id, "Kyoto", q.id);
  assert.equal(meeting.questions[0].answer, "Kyoto");
  const d = m.decide(s, meeting.id, "Kyoto-heavy route", true);
  assert.equal(s.decisions[0].id, d.id);
  assert.ok(s.decisions[0].approved_by_human);
  m.assume(s, meeting.id, "April dates fixed");
  const task = m.action(s, meeting.id, "itinerary-planner", "Draft itinerary", { acceptance: ["fits budget"] });
  assert.equal(s.tasks[task.id].kind, "task");
  assert.deepEqual(meeting.actions, [task.id]);
});

test("pause, resume, add/remove participants, end with summary", () => {
  const s = missionState();
  const meeting = m.start(s, "Route", ["researcher"]);
  m.addParticipant(s, meeting.id, "budget-analyst");
  const pending = m.ask(s, meeting.id, "budget-analyst", "Costs?");
  m.removeParticipant(s, meeting.id, "budget-analyst");
  assert.equal(s.tasks[pending.id].status, "cancelled");
  m.setStatus(s, meeting.id, "paused");
  assert.throws(() => m.ask(s, meeting.id, "researcher", "?"), /paused/);
  m.human(s, meeting.id, "wait, one more thing"); // human input still recorded while paused
  m.setStatus(s, meeting.id, "active");
  m.ask(s, meeting.id, "researcher", "Anything else?");
  assert.throws(() => m.setStatus(s, meeting.id, "ended"), /summary/);
  m.setStatus(s, meeting.id, "ended", "Route chosen");
  assert.equal(meeting.status, "ended");
  assert.ok(Object.values(s.tasks).filter((t) => t.meeting === meeting.id).every((t) => t.status !== "pending"));
});

test("direct line: human talks one-on-one with a single agent", () => {
  const s = missionState();
  const chat = m.startDirect(s, "budget-analyst", "budget");
  assert.equal(chat.mode, "direct");
  const t1 = m.directMessage(s, chat.id, "Can I afford a ryokan?");
  assert.equal(t1.agent, "budget-analyst");
  contribute(s, t1.id, "Yes, one night fits if you skip the bullet train once.");
  const t2 = m.directMessage(s, chat.id, "Which night?");
  contribute(s, t2.id, "Your third night in Kyoto.");
  const transcript = m.transcript(s, chat.id);
  assert.match(transcript, /Human: Can I afford a ryokan\?[\s\S]*Babak \(Budget Analyst\): Yes, one night[\s\S]*Human: Which night\?[\s\S]*Babak \(Budget Analyst\): Your third night/);
  assert.throws(() => m.say(s, chat.id, "Captain here"), /does not speak/);
  assert.throws(() => m.ask(s, chat.id, "budget-analyst", "?"), /direct line/);
  assert.throws(() => m.addParticipant(s, chat.id, "researcher"), /exactly one agent/);
  m.setStatus(s, chat.id, "ended");
  assert.throws(() => m.directMessage(s, chat.id, "hello?"), /ended/);
});
