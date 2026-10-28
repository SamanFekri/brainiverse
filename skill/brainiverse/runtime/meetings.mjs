// Meeting Engine: structured discussions between the human, the Leader, and invited agents,
// plus direct lines (the human talking one-on-one with a single agent).
//
// There is deliberately no command for posting a message *as* an agent. Agent contributions
// enter the transcript only when the agent was actually invoked for a meeting task and
// submitted a result, so participation can never be fabricated.
import * as orchestrator from "./orchestrator.mjs";
import * as teams from "./teams.mjs";
import { BrainiverseError, nextId } from "./store.mjs";

const { now } = orchestrator;

export function getMeeting(state, meetingId) {
  if (!(meetingId in state.meetings)) throw new BrainiverseError(`no meeting ${meetingId}`);
  return state.meetings[meetingId];
}

function requireOpen(meeting, allowPaused = false) {
  const allowed = allowPaused ? ["active", "paused"] : ["active"];
  if (!allowed.includes(meeting.status)) throw new BrainiverseError(`meeting ${meeting.id} is ${meeting.status}`);
}

function post(meeting, from, kind, text, extra = {}) {
  const message = { seq: meeting.messages.length + 1, from, kind, text, at: now(), ...extra };
  meeting.messages.push(message);
  return message;
}

function newMeeting(state, fields) {
  const id = nextId("M", state.meetings);
  const meeting = {
    id, mode: "group", status: "active", started: now(), ended: null, messages: [], decisions: [],
    assumptions: [], questions: [], actions: [], summary: "", ...fields,
  };
  state.meetings[id] = meeting;
  return meeting;
}

export function start(state, objective, participants) {
  orchestrator.requireActive(state);
  if (!objective || !objective.trim()) throw new BrainiverseError("a meeting needs an objective");
  const leader = state.team.leader;
  const invited = [...new Set(participants)].filter((p) => p !== leader);
  if (!invited.length) throw new BrainiverseError("invite at least one agent besides the leader");
  const limit = state.limits.max_meeting_participants;
  if (invited.length > limit) {
    throw new BrainiverseError(`${invited.length} participants exceeds max_meeting_participants (${limit}); ` +
      "invite only agents who add value");
  }
  for (const id of invited) if (!teams.findAgent(state.team, id).enabled) throw new BrainiverseError(`${id} is disabled`);
  const meeting = newMeeting(state, { objective: objective.trim(), host: leader, participants: invited });
  const names = invited.map((a) => teams.findAgent(state.team, a).name).join(", ");
  post(meeting, leader, "system", `Meeting opened: ${meeting.objective}. Participants: ${names}.`);
  return meeting;
}

/** A one-on-one conversation between the human and a single agent, without the Leader. */
export function startDirect(state, agentId, topic = "") {
  orchestrator.requireActive(state);
  const profile = teams.findAgent(state.team, agentId);
  if (!profile.enabled) throw new BrainiverseError(`${profile.name} is disabled`);
  const meeting = newMeeting(state, {
    mode: "direct", objective: topic.trim() || `Direct conversation with ${profile.name}`, host: "human",
    participants: [agentId],
  });
  post(meeting, "human", "system", `Direct line opened with ${profile.name}.`);
  return meeting;
}

/** The human's message to the agent; creates the task whose real invocation produces the reply. */
export function directMessage(state, meetingId, text) {
  const meeting = getMeeting(state, meetingId);
  if (meeting.mode !== "direct") throw new BrainiverseError(`${meetingId} is a group meeting; use \`meeting human\` there`);
  requireOpen(meeting);
  if (!text || !text.trim()) throw new BrainiverseError("message is empty");
  post(meeting, "human", "human", text);
  return orchestrator.addTask(state, {
    objective: `Reply to the human: ${text.trim()}`, agent: meeting.participants[0], kind: "meeting",
    meeting: meetingId, expected_output: "Your reply to the human, in findings, written as you would say it",
  });
}

/** Create a contribution task. The Leader then runs it like any task (start, invoke, submit). */
export function ask(state, meetingId, agentId, prompt) {
  const meeting = getMeeting(state, meetingId);
  requireOpen(meeting);
  if (meeting.mode === "direct") throw new BrainiverseError(`${meetingId} is a direct line; the human's messages go through \`chat say\``);
  if (!meeting.participants.includes(agentId)) throw new BrainiverseError(`${agentId} is not in meeting ${meetingId}; add them first`);
  const task = orchestrator.addTask(state, {
    objective: prompt, agent: agentId, kind: "meeting", meeting: meetingId,
    expected_output: "A contribution to the discussion in the result protocol, responding to the transcript",
  });
  post(meeting, meeting.host, "request", `@${agentId}: ${prompt}`, { task: task.id });
  return task;
}

/** Called when a meeting task is submitted: the real result becomes the agent's message. */
export function recordContribution(state, task) {
  const meeting = getMeeting(state, task.meeting);
  const { findings, recommendations = [], uncertainty = "" } = task.result;
  const text = typeof findings === "string" ? findings : findings.map((f) => `- ${f}`).join("\n");
  post(meeting, task.agent, "contribution", text, {
    task: task.id, invocation: task.invocations.at(-1), recommendations, uncertainty,
  });
  task.status = "done"; // a contribution is discussion, not a deliverable awaiting acceptance
}

export function say(state, meetingId, text) {
  const meeting = getMeeting(state, meetingId);
  requireOpen(meeting);
  if (meeting.mode === "direct") throw new BrainiverseError("the Leader does not speak in a direct line");
  return post(meeting, meeting.host, "host", text);
}

const findItem = (items, id) => {
  const item = items.find((i) => i.id === id);
  if (!item) throw new BrainiverseError(`no item ${id}`);
  return item;
};

export function human(state, meetingId, text, questionId) {
  const meeting = getMeeting(state, meetingId);
  requireOpen(meeting, true);
  const message = post(meeting, "human", "human", text);
  if (questionId) findItem(meeting.questions, questionId).answer = text;
  return message;
}

export function question(state, meetingId, text, to = "human") {
  const meeting = getMeeting(state, meetingId);
  requireOpen(meeting);
  const item = { id: nextId("Q", meeting.questions.map((q) => q.id)), text, to, answer: null };
  meeting.questions.push(item);
  post(meeting, meeting.host, "question", text, { question: item.id });
  return item;
}

export function decide(state, meetingId, text, approvedByHuman = false) {
  const meeting = getMeeting(state, meetingId);
  requireOpen(meeting, true);
  const decision = {
    id: nextId("D", state.decisions.map((d) => d.id)), text, meeting: meetingId,
    approved_by_human: approvedByHuman, at: now(),
  };
  meeting.decisions.push(decision.id);
  state.decisions.push(decision);
  post(meeting, meeting.host, "decision", text, { decision: decision.id });
  return decision;
}

export function assume(state, meetingId, text) {
  const meeting = getMeeting(state, meetingId);
  meeting.assumptions.push(text);
  post(meeting, meeting.host, "assumption", text);
  return text;
}

/** Convert a conclusion into a real task on the board. */
export function action(state, meetingId, agentId, objective, { acceptance = [], depends_on = [] } = {}) {
  const meeting = getMeeting(state, meetingId);
  const task = orchestrator.addTask(state, {
    objective, agent: agentId, acceptance, depends_on,
    context: `Action item from meeting ${meetingId}: ${meeting.objective}`,
  });
  meeting.actions.push(task.id);
  post(meeting, meeting.host, "action", `${task.id} → ${agentId}: ${objective}`, { task: task.id });
  return task;
}

export function addParticipant(state, meetingId, agentId) {
  const meeting = getMeeting(state, meetingId);
  requireOpen(meeting, true);
  if (meeting.mode === "direct") throw new BrainiverseError("a direct line has exactly one agent; start a meeting instead");
  if (!teams.findAgent(state.team, agentId).enabled) throw new BrainiverseError(`${agentId} is disabled`);
  if (meeting.participants.includes(agentId)) throw new BrainiverseError(`${agentId} is already in the meeting`);
  if (meeting.participants.length >= state.limits.max_meeting_participants) {
    throw new BrainiverseError("meeting is at max_meeting_participants");
  }
  meeting.participants.push(agentId);
  post(meeting, meeting.host, "system", `${agentId} joined.`);
}

export function removeParticipant(state, meetingId, agentId) {
  const meeting = getMeeting(state, meetingId);
  if (!meeting.participants.includes(agentId)) throw new BrainiverseError(`${agentId} is not in the meeting`);
  meeting.participants = meeting.participants.filter((p) => p !== agentId);
  for (const task of Object.values(state.tasks)) {
    if (task.meeting === meetingId && task.agent === agentId && task.status === "pending") {
      orchestrator.cancel(state, task.id, "participant removed from meeting");
    }
  }
  post(meeting, meeting.host, "system", `${agentId} left.`);
}

export function setStatus(state, meetingId, status, summary = "") {
  const meeting = getMeeting(state, meetingId);
  const transitions = { paused: ["active"], active: ["paused"], ended: ["active", "paused"] };
  if (!transitions[status].includes(meeting.status)) {
    throw new BrainiverseError(`cannot move meeting from ${meeting.status} to ${status}`);
  }
  if (status === "ended") {
    if (!summary.trim() && meeting.mode === "direct") summary = "Direct conversation ended.";
    if (!summary.trim()) throw new BrainiverseError("ending a meeting needs a summary of decisions and open issues");
    meeting.summary = summary;
    meeting.ended = now();
    for (const task of Object.values(state.tasks)) {
      if (task.meeting === meetingId && task.kind === "meeting" && task.status === "pending") {
        orchestrator.cancel(state, task.id, "meeting ended");
      }
    }
  }
  meeting.status = status;
  post(meeting, meeting.host, "system", `Meeting ${status}.` + (summary ? ` Summary: ${summary}` : ""));
  return meeting;
}

export function transcript(state, meetingId, limit = 40) {
  const meeting = getMeeting(state, meetingId);
  const names = Object.fromEntries(state.team.agents.map((a) => [a.id, a.name]));
  names.human = "Human";
  return meeting.messages.slice(-limit)
    .map((m) => `[${m.kind}] ${names[m.from] ?? m.from}: ${m.text}`)
    .join("\n");
}
