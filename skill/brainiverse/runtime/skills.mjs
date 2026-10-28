// Skill Discovery and Integration.
//
// The runtime does not search marketplaces itself: the Researcher does that with real tools
// (the `npx skills find` CLI, web search, GitHub) and records what it actually found here.
// The runtime provides what must not be left to judgment alone: the local inventory, a static
// security scan, the approval gate before installation, and verification after it.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as teams from "./teams.mjs";
import { now } from "./orchestrator.mjs";
import { BrainiverseError, nextId } from "./store.mjs";

export const MAX_RECOMMENDATIONS = 3;
const SCAN_MAX_FILES = 400;
const SCAN_MAX_BYTES = 512 * 1024;

const SCAN_RULES = [
  ["high", "pipes a download into a shell", /(curl|wget)[^\n|]*\|\s*(ba|z)?sh\b/],
  ["high", "asks the model to ignore its instructions",
    /(ignore|disregard|override) (all |any )?(previous|prior|system|above) (instructions|prompts?)/i],
  ["high", "tells the model to hide actions from the user", /(do not|don't|never) (tell|inform|show) the user/i],
  ["high", "reads credential stores", /(~|\$HOME)\/\.(ssh|aws|gnupg|config\/gh)|\.netrc|id_rsa|keychain/],
  ["high", "recursive forced delete", /rm\s+-[a-z]*r[a-z]*f|rm\s+-[a-z]*f[a-z]*r/],
  ["medium", "reads environment secrets", /(printenv|os\.environ|process\.env|\$[A-Z_]*(KEY|TOKEN|SECRET))/i],
  ["medium", "decodes and executes obfuscated content", /base64\s+(-d|--decode)|\beval\s*\(|\bexec\s*\(/],
  ["medium", "escalates privileges", /\bsudo\b|chmod\s+(\+s|[0-7]*7[0-7]{2})/],
  ["medium", "auto-approves or bypasses permissions", /dangerously|--yes\b|bypass ?permissions|skip[- ]?permissions/i],
  ["low", "makes network requests", /requests\.(get|post)|fetch\(|urllib|http\.client|axios/],
  ["low", "installs packages", /\b(npm|pip|pip3|brew|cargo) (install|add)\b/],
];
const SCRIPT_SUFFIXES = new Set([".sh", ".bash", ".zsh", ".py", ".js", ".mjs", ".cjs", ".ts", ".rb", ".pl", ".ps1"]);

export function parseFrontmatter(text) {
  if (!text.startsWith("---")) return {};
  const end = text.indexOf("\n---", 3);
  if (end === -1) return {};
  const meta = {};
  for (const line of text.slice(3, end).split("\n")) {
    const at = line.indexOf(":");
    if (at > 0 && !line.startsWith(" ")) meta[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^["']|["']$/g, "");
  }
  return meta;
}

export function skillRoots() {
  const override = process.env.BRAINIVERSE_SKILL_ROOTS;
  if (override) return override.split(path.delimiter).filter(Boolean);
  const home = path.join(os.homedir(), ".claude");
  const roots = [path.join(home, "skills"), path.join(process.cwd(), ".claude", "skills")];
  const plugins = path.join(home, "plugins");
  if (fs.existsSync(plugins)) {
    for (const entry of fs.readdirSync(plugins, { recursive: true, withFileTypes: true })) {
      if (entry.isDirectory() && entry.name === "skills") roots.push(path.join(entry.parentPath ?? entry.path, entry.name));
    }
  }
  return roots;
}

/** Skills actually installed where the host loads them from. */
export function localInventory(roots = skillRoots()) {
  const found = new Map();
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const dir of fs.readdirSync(root).sort()) {
      const skillMd = path.join(root, dir, "SKILL.md");
      if (!fs.existsSync(skillMd)) continue;
      const meta = parseFrontmatter(fs.readFileSync(skillMd, "utf8"));
      const name = meta.name || dir;
      if (!found.has(name)) found.set(name, { name, description: (meta.description || "").slice(0, 300), path: path.dirname(skillMd) });
    }
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

/** Static security review of a skill directory. Advisory: a clean scan is not proof of safety. */
export function scan(target) {
  const root = path.resolve(target.replace(/^~(?=$|\/)/, os.homedir()));
  if (!fs.existsSync(root)) throw new BrainiverseError(`${root} does not exist`);
  const isDir = fs.statSync(root).isDirectory();
  const files = isDir ? walk(root) : [root];
  const rel = (file) => (isDir ? path.relative(root, file) : path.basename(file));
  const findings = [];
  const scripts = [];
  let skipped = 0;
  for (const file of files.slice(0, SCAN_MAX_FILES)) {
    if (SCRIPT_SUFFIXES.has(path.extname(file))) scripts.push(rel(file));
    if (fs.statSync(file).size > SCAN_MAX_BYTES) {
      skipped += 1;
      continue;
    }
    fs.readFileSync(file, "utf8").split("\n").forEach((line, index) => {
      for (const [severity, issue, pattern] of SCAN_RULES) {
        if (pattern.test(line)) findings.push({ severity, issue, file: rel(file), line: index + 1, excerpt: line.trim().slice(0, 160) });
      }
    });
  }
  const severities = new Set(findings.map((f) => f.severity));
  const risk = severities.has("high") ? "high" : severities.has("medium") ? "medium" : "low";
  return {
    path: root, risk,
    has_skill_md: isDir ? fs.existsSync(path.join(root, "SKILL.md")) : path.basename(root) === "SKILL.md",
    scripts, findings: findings.slice(0, 100), files_scanned: Math.min(files.length, SCAN_MAX_FILES),
    files_skipped_large: skipped, truncated: files.length > SCAN_MAX_FILES,
  };
}

// -- mission records -----------------------------------------------------------

export function addGap(state, capability, description) {
  const id = nextId("G", state.skills.gaps);
  state.skills.gaps[id] = { id, capability, description, status: "open", created: now() };
  return state.skills.gaps[id];
}

export function addCandidate(state, {
  name, source, purpose, agent, url = "", local_path = "", gap = null, benefits = "", permissions = [],
  compatibility = "unknown", risks = "", install = "",
}) {
  if (!url && !local_path) {
    throw new BrainiverseError("a candidate needs the real --url or --local-path where it was found; " +
      "never record a skill that was not actually found");
  }
  if (gap && !(gap in state.skills.gaps)) throw new BrainiverseError(`no gap ${gap}`);
  agent = teams.findAgent(state.team, agent).id;
  const id = nextId("S", state.skills.candidates);
  state.skills.candidates[id] = {
    id, name, source, url, local_path, purpose, agent, gap, benefits, permissions: [...permissions], compatibility,
    risks, install, status: "proposed", scan: null, approval: null, installed_path: null, created: now(),
  };
  return state.skills.candidates[id];
}

export function candidate(state, id) {
  if (!(id in state.skills.candidates)) throw new BrainiverseError(`no skill candidate ${id}`);
  return state.skills.candidates[id];
}

export function recordScan(state, id, result) {
  const item = candidate(state, id);
  item.scan = { risk: result.risk, findings: result.findings.length, path: result.path, scripts: result.scripts };
  if (item.status === "proposed") item.status = "scanned";
  return item;
}

/** A short list, safest first. High-risk scans are excluded; unscanned candidates rank last. */
export function recommend(state, limit = MAX_RECOMMENDATIONS) {
  const order = { low: 0, medium: 1 };
  return Object.values(state.skills.candidates)
    .filter((c) => ["proposed", "scanned"].includes(c.status) && c.scan?.risk !== "high")
    .sort((a, b) => (order[a.scan?.risk] ?? 2) - (order[b.scan?.risk] ?? 2) || a.id.localeCompare(b.id, "en", { numeric: true }))
    .slice(0, limit);
}

export function approve(state, id, approval) {
  const item = candidate(state, id);
  if (approval.kind !== "skill_install" || approval.skill !== id) {
    throw new BrainiverseError(`approval ${approval.id} is not a skill_install approval for ${id}`);
  }
  if (approval.status !== "approved") throw new BrainiverseError(`approval ${approval.id} is ${approval.status}`);
  if (item.scan?.risk === "high") throw new BrainiverseError(`${id} scanned as high risk; it cannot be approved for install`);
  approval.status = "consumed";
  item.status = "approved";
  item.approval = approval.id;
  return item;
}

export function reject(state, id, reason) {
  const item = candidate(state, id);
  item.status = "rejected";
  item.risks = item.risks ? `${item.risks}; ${reason}` : reason;
  return item;
}

/** Confirm an install actually landed, then attach the skill to its agent. */
export function verify(state, id, dir) {
  const item = candidate(state, id);
  if (item.status !== "approved" && item.source !== "local") {
    throw new BrainiverseError(`${id} is ${item.status}; it must be approved before integration`);
  }
  const skillMd = path.join(path.resolve(dir.replace(/^~(?=$|\/)/, os.homedir())), "SKILL.md");
  if (!fs.existsSync(skillMd)) {
    throw new BrainiverseError(`verification failed: ${skillMd} not found; do not report the skill as installed`);
  }
  const meta = parseFrontmatter(fs.readFileSync(skillMd, "utf8"));
  if (!meta.name || !meta.description) {
    throw new BrainiverseError(`verification failed: ${skillMd} has no name/description frontmatter`);
  }
  Object.assign(item, { status: "integrated", installed_path: path.dirname(skillMd), installed_name: meta.name });
  const profile = teams.findAgent(state.team, item.agent);
  if (!profile.skills.includes(meta.name)) profile.skills.push(meta.name);
  if (item.gap) state.skills.gaps[item.gap].status = "covered";
  return item;
}
