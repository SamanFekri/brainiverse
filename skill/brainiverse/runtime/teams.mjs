// Team Builder: mission analysis, capability mapping, team proposals, and templates.
import fs from "node:fs";
import path from "node:path";
import * as registry from "./registry.mjs";
import { BrainiverseError, DATA_DIR, checkSlug, loadData, readJson, slugify } from "./store.mjs";

export const CAPABILITY_TO_ARCHETYPE = {
  research: "researcher",
  ideation: "creative_thinker",
  analysis: "analyst",
  build: "executor",
  risk: "challenger",
  comms: "communicator",
  organize: "organizer",
  review: "quality_reviewer",
};

// When the team would exceed its size cap, roles later in this list are dropped first.
const PRIORITY = ["coordination", "review", "domain", "build", "research", "analysis", "risk", "ideation", "comms", "organize"];

export const SIZE_CAP = { small: 4, medium: 6, large: 8 };
export const HARD_MAX_AGENTS = 12;

const CAPABILITY_REASONS = {
  research: "the mission needs facts and options gathered from outside sources",
  ideation: "the mission benefits from fresh concepts and alternatives",
  analysis: "there are numbers, trade-offs, or a decision to evaluate",
  build: "someone has to produce the actual deliverable",
  risk: "the plan carries risk or rests on assumptions worth stress-testing",
  comms: "the result has to be communicated or pitched to other people",
  organize: "there are many moving parts, dates, or dependencies to track",
  review: "every deliverable gets checked against your requirements before it reaches you",
};

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const matches = (text, keyword) => new RegExp(`(?<![a-z])${escape(keyword)}`).test(text);

/** Deterministic first pass at capability mapping. The Leader refines it with judgment. */
export function analyzeMission(text) {
  if (!text || !text.trim()) throw new BrainiverseError("describe the mission first");
  const lowered = text.toLowerCase();
  const data = loadData("domains.json");
  const capabilities = Object.entries(data.capability_signals)
    .filter(([, words]) => words.some((w) => matches(lowered, w)))
    .map(([cap]) => cap);
  const scores = {};
  for (const [id, domain] of Object.entries(data.domains)) {
    const score = domain.keywords.filter((w) => matches(lowered, w)).length;
    if (score) scores[id] = score;
  }
  const domains = Object.keys(scores).sort((a, b) => scores[b] - scores[a]).slice(0, 2);
  for (const id of domains) {
    for (const cap of data.domains[id].needs || []) if (!capabilities.includes(cap)) capabilities.push(cap);
  }
  const large = data.complexity_signals.large.filter((w) => matches(lowered, w)).length;
  const small = data.complexity_signals.small.filter((w) => matches(lowered, w)).length;
  let complexity = "medium";
  if (small && !large) complexity = "small";
  else if ((large >= 1 && capabilities.length >= 4) || large >= 2) complexity = "large";
  const assumptions = [];
  if (!capabilities.length) {
    capabilities.push("research", "analysis");
    assumptions.push("No clear signals in the request; assuming it needs research and analysis.");
  }
  if (!domains.length) {
    assumptions.push("No specific domain detected; using general-purpose roles. " +
      "Add a Specialist if the mission needs domain expertise.");
  }
  return { domains, capabilities, complexity, assumptions };
}

const MAX_PER_ROUND = 4; // AskUserQuestion takes up to 4 questions per call

/**
 * The kickoff interview: everything worth agreeing on before work starts. Questions the request
 * already answers are dropped; choice questions come in rounds of 4, free-text ones separately.
 */
export function kickoffQuestions(text, { mode = "quick_team", domains } = {}) {
  const data = loadData("domains.json");
  const lowered = (text || "").toLowerCase();
  const doms = domains ?? (lowered.trim() ? analyzeMission(text).domains : []);
  const pool = mode === "continue_project"
    ? [...data.kickoff_project_task]
    : [...doms.flatMap((d) => data.domains[d].questions || []), ...data.kickoff_generic];
  const seen = new Set();
  const ask = [];
  const answered = [];
  for (const { answered_if: hints, ...question } of pool) {
    if (seen.has(question.id)) continue;
    seen.add(question.id);
    if (hints && hints.some((w) => matches(lowered, w))) answered.push(question.id);
    else ask.push(question);
  }
  const choice = ask.filter((q) => q.options);
  const rounds = [];
  for (let i = 0; i < choice.length; i += MAX_PER_ROUND) rounds.push(choice.slice(i, i + MAX_PER_ROUND));
  return {
    rounds,
    free_text: ask.filter((q) => !q.options),
    already_answered: answered,
    how: "A starting checklist, not a script. Ask the rounds with AskUserQuestion (header, question, options; " +
      "multiSelect when multi) and the free-text questions in a short message. After each round, ask the follow_ups " +
      "triggered by the chosen options, add your own questions this particular mission needs, and drop ones that no " +
      "longer apply. Keep going, in as many rounds as it takes, until nothing important is unclear. Skip anything the " +
      "human already told you. Then summarize everything you understood and get one OK together with the team.",
  };
}

export const COMPLEXITIES = ["small", "medium", "large"];

/**
 * Merge the Leader's own reading of the mission (it is an LLM) over the keyword analysis.
 * Only the fields it supplies are replaced; everything is validated against known values.
 */
export function leaderAnalysis(base, { capabilities, domains, complexity } = {}) {
  const data = loadData("domains.json");
  const knownCaps = [...Object.keys(data.capability_signals), "review"];
  const analysis = { ...base, assumptions: [...base.assumptions], source: "keywords" };
  if (capabilities) {
    const bad = capabilities.filter((c) => !knownCaps.includes(c));
    if (bad.length) throw new BrainiverseError(`unknown capabilities ${bad.join(", ")}; known: ${knownCaps.join(", ")}`);
    analysis.capabilities = capabilities.filter((c) => c !== "review");
    analysis.source = "leader";
  }
  if (domains) {
    const bad = domains.filter((d) => !(d in data.domains));
    if (bad.length) throw new BrainiverseError(`unknown domains ${bad.join(", ")}; known: ${Object.keys(data.domains).join(", ")}`);
    analysis.domains = domains;
    analysis.source = "leader";
  }
  if (complexity) {
    if (!COMPLEXITIES.includes(complexity)) throw new BrainiverseError(`complexity must be one of ${COMPLEXITIES.join(", ")}`);
    analysis.complexity = complexity;
    analysis.source = "leader";
  }
  if (analysis.source === "leader") {
    analysis.assumptions = analysis.assumptions.filter((a) => !a.startsWith("No clear signals") && !a.startsWith("No specific domain"));
  }
  return analysis;
}

export function proposeTeam(missionText, { theme = registry.DEFAULT_THEME, maxAgents, teamId, analysis: override } = {}) {
  const analysis = leaderAnalysis(analyzeMission(missionText), override);
  const domainsData = loadData("domains.json").domains;
  const lowered = missionText.toLowerCase();
  const members = []; // { tag, profile, reason }
  const covered = new Set();
  const usedIds = new Set();

  const add = (tag, profile, reason) => {
    const taken = members.map((m) => m.profile.name);
    if (taken.some((n) => n.toLowerCase() === profile.name.toLowerCase())) {
      profile.name = registry.unusedName(theme, taken) || profile.name;
    }
    const base = profile.id;
    for (let n = 2; usedIds.has(profile.id); n++) profile.id = `${base}-${n}`;
    usedIds.add(profile.id);
    members.push({ tag, profile, reason });
  };

  add("coordination", registry.makeAgent("leader", { theme }),
    "Leads the mission, plans and delegates, and is your single point of contact.");
  covered.add("coordination");

  for (const domainId of analysis.domains) {
    const domain = domainsData[domainId];
    for (const spec of domain.specialists) {
      if (spec.when && !spec.when.some((w) => matches(lowered, w))) continue;
      const profile = registry.makeAgent(spec.archetype, {
        id: spec.id, theme, names: spec.names, position: spec.position, description: spec.description,
        expertise: spec.expertise || [],
      });
      add("domain", profile, `${domain.label} specialist: ${spec.description.replace(/\.$/, "").toLowerCase()}.`);
      for (const cap of spec.covers || []) covered.add(cap);
    }
  }

  const needed = [...analysis.capabilities, "review"];
  if (analysis.complexity !== "large" && needed.includes("organize")) {
    needed.splice(needed.indexOf("organize"), 1);
    analysis.assumptions.push("Coordination is light enough for the Leader; no separate Organizer.");
  }
  if (analysis.complexity === "large" && !needed.includes("risk")) needed.push("risk");
  for (const capability of needed) {
    if (covered.has(capability)) continue;
    const archetype = CAPABILITY_TO_ARCHETYPE[capability];
    add(capability, registry.makeAgent(archetype, { theme }),
      `${registry.archetypes()[archetype].title}: ${CAPABILITY_REASONS[capability]}.`);
    covered.add(capability);
  }

  const cap = Math.min(maxAgents || SIZE_CAP[analysis.complexity], HARD_MAX_AGENTS);
  const rank = (tag) => (PRIORITY.includes(tag) ? PRIORITY.indexOf(tag) : PRIORITY.length);
  members.sort((a, b) => rank(a.tag) - rank(b.tag));
  const chosen = members.slice(0, cap);
  const optional = members.slice(cap);

  const team = validateTeam({
    schema_version: 1,
    id: checkSlug(teamId || slugify(missionText).slice(0, 40).replace(/-+$/, "") || "squad", "team id"),
    name: "Squad",
    description: missionText.trim(),
    leader: chosen[0].profile.id,
    theme,
    agents: chosen.map((m) => m.profile),
    workflow: [],
    source: "proposal",
  });
  return {
    mission: missionText.trim(),
    analysis,
    team,
    reasons: Object.fromEntries(chosen.map((m) => [m.profile.id, m.reason])),
    optional: optional.map((m) => ({ id: m.profile.id, name: m.profile.name, archetype: m.profile.archetype, reason: m.reason })),
    kickoff: kickoffQuestions(missionText, { domains: analysis.domains }),
    assumptions: analysis.assumptions,
  };
}

// -- templates -----------------------------------------------------------------

export function templateIds() {
  return fs.readdirSync(path.join(DATA_DIR, "templates")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort();
}

export function loadTemplate(templateId) {
  const data = readJson(path.join(DATA_DIR, "templates", `${checkSlug(templateId, "template")}.json`));
  if (!data) throw new BrainiverseError(`no template ${templateId}; available: ${templateIds().join(", ")}`);
  return data;
}

export function teamFromTemplate(templateId, { teamId, theme = registry.DEFAULT_THEME } = {}) {
  const template = loadTemplate(templateId);
  const agents = template.agents.map(({ id, archetype, ...fields }) => registry.makeAgent(archetype, { id, theme, ...fields }));
  return validateTeam({
    schema_version: 1,
    id: teamId || template.id,
    name: template.name,
    description: template.description,
    leader: template.leader,
    theme,
    agents,
    workflow: [...(template.workflow || [])],
    doc: template.doc,
    source: `template:${template.id}`,
  });
}

// -- team operations -------------------------------------------------------------

export function validateTeam(team) {
  checkSlug(team.id || "", "team id");
  const agents = team.agents || [];
  if (!agents.length) throw new BrainiverseError("a team needs at least one agent");
  if (agents.length > HARD_MAX_AGENTS) {
    throw new BrainiverseError(`team has ${agents.length} agents; the limit is ${HARD_MAX_AGENTS}`);
  }
  const ids = agents.map((a) => a.id);
  const duplicates = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  if (duplicates.length) throw new BrainiverseError(`duplicate agent ids: ${duplicates.join(", ")}`);
  agents.forEach(registry.validateAgent);
  if (!findAgent(team, team.leader).enabled) throw new BrainiverseError("the leader cannot be disabled");
  return team;
}

/** Find an agent by id or by name ("rocket", "Rocket", "spider-man", "Spider-Man"). */
export function findAgent(team, ref) {
  const want = String(ref ?? "").trim().toLowerCase();
  const agent = team.agents.find((a) => a.id === ref) ||
    team.agents.find((a) => a.name.toLowerCase() === want || slugify(a.name) === want);
  if (!agent) {
    throw new BrainiverseError(`no agent ${JSON.stringify(ref)} on team ${team.id}; members: ` +
      team.agents.map((a) => `${a.id} = ${registry.label(a)}`).join(", "));
  }
  return agent;
}

/** Pairs of enabled agents with the same archetype and expertise. */
export function redundancyWarnings(team) {
  const seen = new Map();
  const warnings = [];
  for (const agent of team.agents) {
    if (!agent.enabled) continue;
    const key = `${agent.archetype}|${[...(agent.expertise || [])].sort().join(",")}`;
    if (seen.has(key)) warnings.push(`${registry.label(agent)} duplicates ${seen.get(key)} (${agent.archetype}, same expertise)`);
    else seen.set(key, registry.label(agent));
  }
  return warnings;
}

export function addAgent(team, profile) {
  if (team.agents.some((a) => a.id === profile.id)) throw new BrainiverseError(`team already has an agent ${profile.id}`);
  const updated = structuredClone(team);
  updated.agents.push(profile);
  return validateTeam(updated);
}

export function removeAgent(team, ref) {
  const agentId = findAgent(team, ref).id;
  if (agentId === team.leader) throw new BrainiverseError("cannot remove the leader; choose another leader first");
  const updated = structuredClone(team);
  updated.agents = updated.agents.filter((a) => a.id !== agentId);
  return validateTeam(updated);
}

export function replaceAgent(team, profile) {
  findAgent(team, profile.id);
  const updated = structuredClone(team);
  updated.agents = updated.agents.map((a) => (a.id === profile.id ? profile : a));
  return validateTeam(updated);
}

export function setLeader(team, ref) {
  return validateTeam({ ...structuredClone(team), leader: findAgent(team, ref).id });
}

export function sanitizeImport(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.agents)) {
    throw new BrainiverseError("import file must contain a team object with agents");
  }
  const agents = [];
  const stripped = {};
  for (const raw of data.agents) {
    const [profile, removed] = registry.sanitizeImport(raw);
    agents.push(profile);
    if (removed.length) stripped[profile.id] = removed;
  }
  const team = validateTeam({
    schema_version: 1,
    id: checkSlug(data.id || "", "team id"),
    name: String(data.name || data.id),
    description: String(data.description || ""),
    leader: data.leader,
    theme: data.theme || registry.DEFAULT_THEME,
    agents,
    workflow: (data.workflow || []).map(String),
    source: "import",
  });
  return [team, stripped];
}

export function save(ws, team) {
  validateTeam(team);
  ws.saveRecord("teams", team.id, team);
  return team;
}

export const load = (ws, id) => ws.loadRecord("teams", id);
