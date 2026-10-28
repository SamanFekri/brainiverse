// Memory Manager: agent, team, and project memory, plus secret redaction.
//
// Scopes:
//   agent:<id>   role-specific knowledge an agent keeps across missions
//   team:<id>    shared conventions and team-level decisions
//   project      goals, findings and decisions for the active mission (stored in mission state)
//
// Nothing is remembered automatically. Agents may suggest memories in their results; only the
// Leader writes them, and records that look like secrets are refused.
import { now } from "./orchestrator.mjs";
import { BrainiverseError, checkSlug, nextId, readJson, writeJson } from "./store.mjs";

// The generic "key: value" rule runs first so it consumes the whole value, and never matches a
// "[redacted ...]" marker left by an earlier rule.
const SECRET_PATTERNS = [
  [/\b(?:password|passwd|secret|api[_-]?key|token)\s*[:=]\s*[^\s[]\S{5,}/gi, "credential"],
  [/\bsk-[A-Za-z0-9_-]{16,}/g, "API key"],
  [/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, "AWS access key"],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}/g, "GitHub token"],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}/g, "Slack token"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/g, "private key"],
  [/\b(?:\d[ -]?){13,16}\b/g, "card number"],
];

export function findSecrets(text) {
  const found = new Set();
  for (const [pattern, label] of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text || "")) found.add(label);
  }
  return [...found].sort();
}

export function redact(text) {
  if (typeof text !== "string") return text;
  for (const [pattern, label] of SECRET_PATTERNS) text = text.replace(pattern, `[redacted ${label}]`);
  return text;
}

function parseScope(scope) {
  if (scope === "project") return ["project", null];
  const [kind, ...rest] = String(scope).split(":");
  const ref = rest.join(":");
  if (!["agent", "team"].includes(kind) || !ref) throw new BrainiverseError("scope must be 'project', 'agent:<id>' or 'team:<id>'");
  return [kind, checkSlug(ref, `${kind} id`)];
}

const storePath = (ws, kind, ref) => ws.path("memory", `${kind}-${ref}.json`);

function loadScope(ws, scope, state) {
  const [kind, ref] = parseScope(scope);
  if (kind === "project") {
    if (!state) throw new BrainiverseError("project memory needs an active mission");
    return state.memory;
  }
  return readJson(storePath(ws, kind, ref), []);
}

function saveScope(ws, scope, records, state) {
  const [kind, ref] = parseScope(scope);
  if (kind === "project") state.memory = records;
  else writeJson(storePath(ws, kind, ref), records);
}

function refuseSecrets(text) {
  const secrets = findSecrets(text);
  if (secrets.length) {
    throw new BrainiverseError(`refusing to store what looks like a ${secrets.join(", ")}; ` +
      "secrets belong in the environment or a secret manager, not in memory");
  }
}

export function add(ws, scope, text, { tags = [], source = "leader", state = null } = {}) {
  if (!text || !text.trim()) throw new BrainiverseError("memory text is empty");
  refuseSecrets(text);
  const records = loadScope(ws, scope, state);
  const record = { id: nextId("R", records.map((r) => r.id)), text: text.trim(), tags: [...tags], source, created: now() };
  records.push(record);
  saveScope(ws, scope, records, state);
  return record;
}

export function list(ws, scope, { state = null, tags = [] } = {}) {
  const records = loadScope(ws, scope, state);
  return tags.length ? records.filter((r) => r.tags.some((t) => tags.includes(t))) : records;
}

export function edit(ws, scope, recordId, text, { state = null } = {}) {
  refuseSecrets(text);
  const records = loadScope(ws, scope, state);
  const record = records.find((r) => r.id === recordId);
  if (!record) throw new BrainiverseError(`no memory record ${recordId} in ${scope}`);
  record.text = text.trim();
  record.edited = now();
  saveScope(ws, scope, records, state);
  return record;
}

export function remove(ws, scope, recordId, { state = null } = {}) {
  const records = loadScope(ws, scope, state);
  const kept = records.filter((r) => r.id !== recordId);
  if (kept.length === records.length) throw new BrainiverseError(`no memory record ${recordId} in ${scope}`);
  saveScope(ws, scope, kept, state);
}

/** Memory shared with one agent: its own, its team's, and the project's. Never other agents'. */
export function contextFor(ws, state, agentId, limit = 12) {
  const agentMemory = agentId ? readJson(storePath(ws, "agent", agentId), []) : [];
  const teamMemory = readJson(storePath(ws, "team", state.team_ref), []);
  return {
    agent: agentMemory.slice(-limit).map((r) => r.text),
    team: teamMemory.slice(-limit).map((r) => r.text),
    project: state.memory.slice(-limit).map((r) => r.text),
  };
}
