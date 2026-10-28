// Execution logging: an append-only, secret-redacted JSONL audit trail per mission.
import fs from "node:fs";
import path from "node:path";
import { redact } from "./memory.mjs";
import { now } from "./orchestrator.mjs";

function clean(value) {
  if (typeof value === "string") return redact(value);
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clean(v)]));
  return value;
}

export function log(ws, missionId, event, details = {}, actor = "leader") {
  const file = path.join(ws.missionDir(missionId), "audit.jsonl");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const entry = { at: now(), event, actor, ...clean(details) };
  fs.appendFileSync(file, JSON.stringify(entry) + "\n", "utf8");
  return entry;
}

export function read(ws, missionId, limit = 50) {
  const file = path.join(ws.missionDir(missionId), "audit.jsonl");
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).slice(-limit).map((line) => JSON.parse(line));
}
