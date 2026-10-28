// Agent Registry: archetypes, agent profiles, validation, and the reusable agent library.
import * as tools from "./tools.mjs";
import { BrainiverseError, checkSlug, loadData, slugify } from "./store.mjs";

export const SCHEMA_VERSION = 1;

// Identity is deliberately separate from role and permissions: renaming "Lumen" to
// "Sherlock" must never change what the agent does or may touch.
export const IDENTITY_FIELDS = ["name", "personality", "communication_style", "avatar"];
export const LIST_FIELDS = ["responsibilities", "expertise", "decision_rules", "skills"];
const PROTECTED_FIELDS = ["id", "archetype", "capabilities", "schema_version"];

export const DEFAULT_LIMITS = { timeout_s: 900, max_retries: 1, max_invocations: 25 };
const DEFAULT_OUTPUT_FORMAT =
  "Brainiverse result protocol (JSON): status, findings, evidence, assumptions, uncertainty, recommendations, blockers, next_steps";

export const PROFILE_FIELDS = [
  "schema_version", "id", "name", "archetype", "description", "responsibilities", "personality",
  "communication_style", "instructions", "expertise", "capabilities", "skills", "model",
  "input_format", "output_format", "decision_rules", "collaboration", "memory", "limits",
  "avatar", "enabled", "role_file",
];

const clone = (value) => structuredClone(value);

export const archetypes = () => loadData("archetypes.json");
export const themes = () => loadData("themes.json");

export function terminology(style) {
  const table = loadData("terminology.json");
  if (!(style in table)) throw new BrainiverseError(`unknown terminology ${style}; choose from ${Object.keys(table)}`);
  return table[style];
}

export function identityFor(archetype, theme = "heroes") {
  const all = themes();
  if (!(theme in all)) throw new BrainiverseError(`unknown theme ${theme}; choose from ${Object.keys(all)}`);
  return all[theme].identities[archetype] || {};
}

/** Build a complete, valid profile from an archetype plus overrides. */
export function makeAgent(archetype, { id, theme = "heroes", ...overrides } = {}) {
  const catalog = archetypes();
  if (!(archetype in catalog)) {
    throw new BrainiverseError(`unknown archetype ${archetype}; choose from ${Object.keys(catalog).join(", ")}`);
  }
  const base = catalog[archetype];
  const identity = identityFor(archetype, theme);
  const name = overrides.name || identity.name || base.title;
  delete overrides.name;
  const profile = {
    schema_version: SCHEMA_VERSION,
    id: id || slugify(name),
    name,
    archetype,
    description: base.purpose,
    responsibilities: [...base.responsibilities],
    personality: identity.personality || "",
    communication_style: "Concise and structured; leads with the answer.",
    instructions: "",
    expertise: [],
    capabilities: [...base.capabilities],
    skills: [],
    model: base.model || "inherit",
    input_format: "Task brief from the Leader (objective, inputs, constraints, acceptance criteria).",
    output_format: DEFAULT_OUTPUT_FORMAT,
    decision_rules: [...(base.decision_rules || [])],
    collaboration: base.collaboration || "",
    memory: { enabled: true },
    limits: { ...DEFAULT_LIMITS },
    avatar: identity.avatar || "",
    enabled: true,
    role_file: base.role_file,
  };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === null) continue;
    if (!PROFILE_FIELDS.includes(key)) throw new BrainiverseError(`unknown agent field ${key}`);
    profile[key] = clone(value);
  }
  return validateAgent(profile);
}

export function validateAgent(profile) {
  if (!profile || typeof profile !== "object") throw new BrainiverseError("agent profile must be an object");
  const missing = ["id", "name", "archetype"].filter((f) => !profile[f]);
  if (missing.length) throw new BrainiverseError(`agent profile missing ${missing.join(", ")}`);
  checkSlug(profile.id, "agent id");
  if (!(profile.archetype in archetypes())) throw new BrainiverseError(`unknown archetype ${profile.archetype}`);
  for (const field of [...LIST_FIELDS, "capabilities"]) {
    const value = profile[field] ?? [];
    if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
      throw new BrainiverseError(`agent field ${field} must be a list of strings`);
    }
  }
  const unknown = tools.unknownCapabilities(profile.capabilities || []);
  if (unknown.length) {
    throw new BrainiverseError(`unknown capabilities ${unknown}; known: ${Object.keys(tools.CAPABILITIES).join(", ")}`);
  }
  if (!tools.MODEL_TIERS.includes(profile.model ?? "inherit")) {
    throw new BrainiverseError(`model must be one of ${tools.MODEL_TIERS.join(", ")}`);
  }
  for (const [key, value] of Object.entries(profile.limits || {})) {
    if (!(key in DEFAULT_LIMITS) || !Number.isInteger(value) || value < 0) {
      throw new BrainiverseError(`invalid limit ${key}=${JSON.stringify(value)}`);
    }
  }
  if (typeof (profile.enabled ?? true) !== "boolean") throw new BrainiverseError("enabled must be true or false");
  if (profile.name.length > 60) throw new BrainiverseError("name is too long (max 60 characters)");
  return profile;
}

/** Change identity only. Role, responsibilities and permissions are untouched. */
export function rename(profile, { name, personality, communication_style, avatar } = {}) {
  const updated = clone(profile);
  for (const [field, value] of Object.entries({ name, personality, communication_style, avatar })) {
    if (value !== undefined && value !== null) updated[field] = value;
  }
  return validateAgent(updated);
}

export function parseValue(raw) {
  const lowered = String(raw).trim().toLowerCase();
  if (lowered === "true" || lowered === "false") return lowered === "true";
  if (/^-?\d+$/.test(lowered)) return Number(lowered);
  return raw;
}

function splitField(item) {
  const at = item.indexOf("=");
  return at === -1 ? [item.trim(), ""] : [item.slice(0, at).trim(), item.slice(at + 1)];
}

/**
 * Apply field edits given as 'field=value' strings.
 * Capabilities are deliberately not editable here: they change only through grant/revoke,
 * which enforce the approval rules.
 */
export function edit(profile, { sets = [], adds = [], removes = [] } = {}) {
  const updated = clone(profile);
  for (const item of sets) {
    const [field, value] = splitField(item);
    if (PROTECTED_FIELDS.includes(field)) {
      throw new BrainiverseError(`${field} cannot be edited directly` +
        (field === "capabilities" ? "; use `agent grant` / `agent revoke`" : ""));
    }
    if (field.startsWith("limits.")) {
      (updated.limits ||= {})[field.split(".", 2)[1]] = parseValue(value);
    } else if (field === "memory.enabled") {
      (updated.memory ||= {}).enabled = parseValue(value);
    } else if (LIST_FIELDS.includes(field)) {
      updated[field] = value.split(";").map((v) => v.trim()).filter(Boolean);
    } else if (PROFILE_FIELDS.includes(field)) {
      updated[field] = field === "enabled" ? parseValue(value) : value;
    } else {
      throw new BrainiverseError(`unknown agent field ${field}`);
    }
  }
  for (const [items, adding] of [[adds, true], [removes, false]]) {
    for (const item of items) {
      const [field, value] = splitField(item);
      if (!LIST_FIELDS.includes(field)) {
        throw new BrainiverseError(`--add/--remove work on list fields: ${LIST_FIELDS.join(", ")}`);
      }
      const current = (updated[field] ||= []);
      if (adding && !current.includes(value)) current.push(value);
      else if (!adding) {
        if (!current.includes(value)) throw new BrainiverseError(`${JSON.stringify(value)} is not in ${field}`);
        current.splice(current.indexOf(value), 1);
      }
    }
  }
  return validateAgent(updated);
}

/** Add a capability. Gated capabilities require a granted, matching approval record. */
export function grant(profile, capability, approval = null) {
  if (!(capability in tools.CAPABILITIES)) throw new BrainiverseError(`unknown capability ${capability}`);
  if (tools.isGated(capability)) {
    if (!approval || approval.status !== "approved") {
      throw new BrainiverseError(`${capability} is ${tools.CAPABILITIES[capability].risk}: ` +
        "granting it needs a human-approved approval record (--approval)");
    }
    if (approval.capability !== capability || ![null, undefined, profile.id].includes(approval.agent)) {
      throw new BrainiverseError("approval record does not match this agent and capability");
    }
  }
  const updated = clone(profile);
  if (!updated.capabilities.includes(capability)) updated.capabilities.push(capability);
  return updated;
}

export function revoke(profile, capability) {
  const updated = clone(profile);
  updated.capabilities = updated.capabilities.filter((c) => c !== capability);
  return updated;
}

export function duplicate(profile, newId, name) {
  const copy = clone(profile);
  copy.id = checkSlug(newId, "agent id");
  copy.name = name || `${profile.name} II`;
  return validateAgent(copy);
}

/** Validate an imported profile. Gated capabilities are stripped, never trusted from a file. */
export function sanitizeImport(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new BrainiverseError("import file must contain an agent object");
  }
  let profile = Object.fromEntries(Object.entries(data).filter(([k]) => PROFILE_FIELDS.includes(k)).map(([k, v]) => [k, clone(v)]));
  profile.schema_version ??= SCHEMA_VERSION;
  if (profile.archetype in archetypes()) {
    profile = { ...makeAgent(profile.archetype, { id: profile.id || "imported" }), ...profile };
  }
  const caps = Array.isArray(profile.capabilities) ? profile.capabilities : [];
  const stripped = caps.filter((c) => c in tools.CAPABILITIES && tools.isGated(c));
  profile.capabilities = caps.filter((c) => !stripped.includes(c));
  return [validateAgent(profile), stripped];
}

// -- library persistence -----------------------------------------------------

export function save(ws, profile) {
  validateAgent(profile);
  ws.saveRecord("agents", profile.id, profile);
  return profile;
}

export const load = (ws, id) => ws.loadRecord("agents", id);
export const listAgents = (ws) => ws.listRecords("agents");
