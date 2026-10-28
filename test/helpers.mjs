import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Workspace } from "../skill/brainiverse/runtime/store.mjs";
import * as orchestrator from "../skill/brainiverse/runtime/orchestrator.mjs";
import * as teams from "../skill/brainiverse/runtime/teams.mjs";

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const CLI = path.join(ROOT, "skill", "brainiverse", "bin", "brainiverse.mjs");

export function tmpdir(prefix = "bv-test-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function workspace() {
  const ws = new Workspace(path.join(tmpdir(), ".brainiverse"));
  ws.init();
  return ws;
}

/** A mission state built from a template, in memory (no files). */
export function missionState(template = "travel-squad", limits = {}) {
  return orchestrator.newMission("Test mission", teams.teamFromTemplate(template), { id: "test", limits });
}

export const result = (findings = ["done"], extra = {}) => ({ status: "complete", findings, ...extra });

/** Run the CLI synchronously. Returns { code, out, err, json }. */
export function cli(home, args, { input, agent, env = {} } = {}) {
  const proc = spawnSync(process.execPath, [CLI, ...args], {
    input, encoding: "utf8",
    env: { ...process.env, BRAINIVERSE_HOME: home, BRAINIVERSE_AGENT: agent ?? "", BRAINIVERSE_MISSION: "", ...env },
  });
  let json;
  try {
    json = JSON.parse(proc.stdout);
  } catch {
    json = undefined;
  }
  return { code: proc.status, out: proc.stdout, err: proc.stderr, json };
}

/** Run the CLI asynchronously (for concurrency tests). */
export function cliAsync(home, args, { input, agent } = {}) {
  let child;
  const done = new Promise((resolve) => {
    child = spawn(process.execPath, [CLI, ...args], {
      env: { ...process.env, BRAINIVERSE_HOME: home, BRAINIVERSE_AGENT: agent ?? "", BRAINIVERSE_MISSION: "" },
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => resolve({ code, out, err }));
    if (input !== undefined) child.stdin.end(input);
    else child.stdin.end();
  });
  done.child = child; // for long-running commands (the dashboard server)
  return done;
}

/** Stand-in for a subagent: fetch the brief, then submit a result as that agent. */
export function runAgent(home, taskId, agent, payload) {
  const brief = cli(home, ["task", "brief", taskId], { agent });
  if (brief.code !== 0) throw new Error(`brief failed: ${brief.err}`);
  const submitted = cli(home, ["task", "submit", taskId], { agent, input: JSON.stringify(payload) });
  if (submitted.code !== 0) throw new Error(`submit failed: ${submitted.err}`);
  return brief.out;
}
