// Permission Manager: capability checks and human approval records.
//
// Agents run as subagents with BRAINIVERSE_AGENT=<id> in the environment when they call the CLI.
// Every command that changes permissions, approvals, team composition or the plan refuses to
// run under that variable, so an agent cannot grant itself access or approve its own request.
import * as teams from "./teams.mjs";
import * as tools from "./tools.mjs";
import { now } from "./orchestrator.mjs";
import { BrainiverseError, nextId } from "./store.mjs";

export const APPROVAL_KINDS = ["capability", "skill_install", "action", "limit_change"];

export const actingAgent = () => process.env.BRAINIVERSE_AGENT || null;

export function requireLeader(command) {
  const agent = actingAgent();
  if (agent) {
    throw new BrainiverseError(`agent ${agent} cannot run \`${command}\`: only the Leader (main session) may. ` +
      "Put the request in your result's recommendations instead.");
  }
}

/** Return 'allowed', 'needs_approval', or 'denied'. */
export function check(state, agentId, capability) {
  if (!(capability in tools.CAPABILITIES)) throw new BrainiverseError(`unknown capability ${capability}`);
  const profile = teams.findAgent(state.team, agentId);
  if (!profile.enabled || !profile.capabilities.includes(capability)) return "denied";
  return tools.isGated(capability) ? "needs_approval" : "allowed";
}

export function request(state, { kind, detail, agent = null, capability = null, task = null, skill = null }) {
  if (!APPROVAL_KINDS.includes(kind)) throw new BrainiverseError(`approval kind must be one of ${APPROVAL_KINDS.join(", ")}`);
  if (!detail || !detail.trim()) throw new BrainiverseError("describe what is being approved (--detail)");
  if (capability && !(capability in tools.CAPABILITIES)) throw new BrainiverseError(`unknown capability ${capability}`);
  if (agent) teams.findAgent(state.team, agent);
  const id = nextId("A", state.approvals);
  state.approvals[id] = {
    id, kind, detail, agent, capability, task, skill, status: "pending", requested: now(), resolved: null, human_note: "",
  };
  return state.approvals[id];
}

/** Record the human's decision. humanNote should quote what the human actually said. */
export function resolve(state, approvalId, approve, humanNote) {
  requireLeader("approval resolve");
  const approval = state.approvals[approvalId];
  if (!approval) throw new BrainiverseError(`no approval ${approvalId}`);
  if (approval.status !== "pending") throw new BrainiverseError(`${approvalId} is already ${approval.status}`);
  if (!humanNote || !humanNote.trim()) {
    throw new BrainiverseError("record the human's answer (--note) so the approval is auditable");
  }
  Object.assign(approval, { status: approve ? "approved" : "rejected", resolved: now(), human_note: humanNote });
  return approval;
}

export function getApproval(state, approvalId, kind) {
  const approval = state.approvals[approvalId || ""];
  if (!approval) throw new BrainiverseError(`no approval ${approvalId}`);
  if (kind && approval.kind !== kind) throw new BrainiverseError(`${approvalId} is a ${approval.kind} approval, not ${kind}`);
  return approval;
}

export function consume(approval) {
  if (approval.status !== "approved") throw new BrainiverseError(`approval ${approval.id} is ${approval.status}, not approved`);
  approval.status = "consumed";
  return approval;
}
