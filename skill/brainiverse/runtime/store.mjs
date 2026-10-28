// Workspace storage: JSON files under a .brainiverse/ directory, with file locking.
//
// Layout:
//   .brainiverse/config.json              theme, terminology, active mission
//   .brainiverse/agents/<id>.json         reusable agent profiles (the agent library)
//   .brainiverse/teams/<id>.json          saved teams
//   .brainiverse/memory/<scope>.json      agent- and team-level memory
//   .brainiverse/missions/<id>/state.json mission state (team snapshot, tasks, meetings, ...)
//   .brainiverse/missions/<id>/audit.jsonl
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RUNTIME_DIR = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(RUNTIME_DIR, "data");

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,47}$/;
const LOCK_STALE_MS = 30_000;
const LOCK_WAIT_MS = 20_000;

/** A user-facing error: invalid input, a violated limit or a refused action. */
export class BrainiverseError extends Error {}

export function slugify(text) {
  const slug = String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug.slice(0, 48) || "item";
}

export function checkSlug(value, what = "id") {
  if (typeof value !== "string" || !SLUG_RE.test(value)) {
    throw new BrainiverseError(`invalid ${what} ${JSON.stringify(value)}: use lowercase letters, digits, '-' or '_' (max 48)`);
  }
  return value;
}

export function loadData(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8"));
}

export function readJson(file, fallback = null) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** Atomic write: a reader never sees a half-written file. */
export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = path.join(path.dirname(file), `.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", "utf8");
    fs.renameSync(tmp, file);
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    throw err;
  }
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Next sequential id like T1, T2 ... that never reuses a number. */
export function nextId(prefix, existing) {
  const keys = Array.isArray(existing) ? existing : Object.keys(existing);
  let max = 0;
  for (const key of keys) {
    const rest = key.startsWith(prefix) ? key.slice(prefix.length) : "";
    if (/^\d+$/.test(rest)) max = Math.max(max, Number(rest));
  }
  return `${prefix}${max + 1}`;
}

export const DEFAULT_CONFIG = { theme: "people", terminology: "themed", active_mission: null, host: "claude-code", project_team: null };

export class Workspace {
  constructor(root) {
    this.root = path.resolve(root || process.env.BRAINIVERSE_HOME || ".brainiverse");
  }

  path(...parts) {
    return path.join(this.root, ...parts);
  }

  get initialized() {
    return fs.existsSync(this.path("config.json"));
  }

  init({ theme, terminology } = {}) {
    for (const sub of ["agents", "teams", "memory", "missions"]) fs.mkdirSync(this.path(sub), { recursive: true });
    const config = { ...DEFAULT_CONFIG, ...(readJson(this.path("config.json"), {}) || {}) };
    if (theme) config.theme = theme;
    if (terminology) config.terminology = terminology;
    writeJson(this.path("config.json"), config);
    return config;
  }

  require() {
    if (!this.initialized) this.init();
  }

  config() {
    const config = { ...DEFAULT_CONFIG, ...(readJson(this.path("config.json"), {}) || {}) };
    if (config.theme === "avengers" || config.theme === "classic") config.theme = "people"; // removed themes
    return config;
  }

  setConfig(values) {
    this.require();
    const config = { ...this.config(), ...values };
    writeJson(this.path("config.json"), config);
    return config;
  }

  /** Exclusive lock (atomic mkdir) so parallel agents submitting results never clobber each other. */
  withLock(name, fn) {
    this.require();
    const lockDir = this.path(`.${name}.lock`);
    const deadline = Date.now() + LOCK_WAIT_MS;
    for (;;) {
      try {
        fs.mkdirSync(lockDir);
        break;
      } catch (err) {
        if (err.code !== "EEXIST") throw err;
        try {
          if (Date.now() - fs.statSync(lockDir).mtimeMs > LOCK_STALE_MS) {
            fs.rmSync(lockDir, { recursive: true, force: true });
            continue;
          }
        } catch {
          continue;
        }
        if (Date.now() > deadline) throw new BrainiverseError(`timed out waiting for lock ${name}`);
        sleepSync(25);
      }
    }
    try {
      return fn();
    } finally {
      fs.rmSync(lockDir, { recursive: true, force: true });
    }
  }

  // -- generic records -------------------------------------------------------
  recordPath(kind, id) {
    checkSlug(id, `${kind.slice(0, -1)} id`);
    return this.path(kind, `${id}.json`);
  }

  loadRecord(kind, id) {
    const data = readJson(this.recordPath(kind, id));
    if (data === null) throw new BrainiverseError(`no ${kind.slice(0, -1)} named ${JSON.stringify(id)}`);
    return data;
  }

  saveRecord(kind, id, data) {
    this.require();
    writeJson(this.recordPath(kind, id), data);
  }

  deleteRecord(kind, id) {
    const file = this.recordPath(kind, id);
    if (!fs.existsSync(file)) throw new BrainiverseError(`no ${kind.slice(0, -1)} named ${JSON.stringify(id)}`);
    fs.unlinkSync(file);
  }

  listRecords(kind) {
    const folder = this.path(kind);
    if (!fs.existsSync(folder)) return [];
    return fs.readdirSync(folder).filter((f) => f.endsWith(".json")).sort().map((f) => readJson(path.join(folder, f)));
  }

  // -- missions --------------------------------------------------------------
  missionDir(id) {
    checkSlug(id, "mission id");
    return this.path("missions", id);
  }

  resolveMission(id) {
    id = id || process.env.BRAINIVERSE_MISSION || this.config().active_mission;
    if (!id) throw new BrainiverseError("no active mission: run `brainiverse mission new` or pass --mission");
    if (!fs.existsSync(path.join(this.missionDir(id), "state.json"))) {
      throw new BrainiverseError(`no mission named ${JSON.stringify(id)}`);
    }
    return id;
  }

  readMission(id) {
    return readJson(path.join(this.missionDir(this.resolveMission(id)), "state.json"));
  }

  /** Load mission state under lock; saved only if fn returns without throwing. */
  mission(id, fn) {
    const missionId = this.resolveMission(id);
    return this.withLock(`mission-${missionId}`, () => {
      const file = path.join(this.missionDir(missionId), "state.json");
      const state = readJson(file);
      const result = fn(state);
      writeJson(file, state);
      return result;
    });
  }

  createMission(state) {
    const dir = this.missionDir(state.id);
    if (fs.existsSync(dir)) throw new BrainiverseError(`mission ${JSON.stringify(state.id)} already exists`);
    writeJson(path.join(dir, "state.json"), state);
  }

  listMissions() {
    const folder = this.path("missions");
    if (!fs.existsSync(folder)) return [];
    return fs.readdirSync(folder).sort()
      .map((d) => path.join(folder, d, "state.json"))
      .filter((f) => fs.existsSync(f))
      .map((f) => readJson(f));
  }
}
