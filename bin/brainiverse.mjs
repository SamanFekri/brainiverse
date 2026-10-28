#!/usr/bin/env node
// npx entry point.
//   npx brainiverse install [--project] [--force]   copy the skill into Claude Code's skills folder
//   npx brainiverse uninstall [--project]
//   npx brainiverse doctor                          check the installation
//   npx brainiverse <runtime command ...>           anything else goes to the runtime CLI
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PACKAGE_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SKILL_SOURCE = path.join(PACKAGE_DIR, "skill", "brainiverse");
const VERSION = JSON.parse(fs.readFileSync(path.join(PACKAGE_DIR, "package.json"), "utf8")).version;

function target(project) {
  const base = project ? path.join(process.cwd(), ".claude", "skills") : path.join(os.homedir(), ".claude", "skills");
  return path.join(base, "brainiverse");
}

function installedVersion(dir) {
  try {
    return fs.readFileSync(path.join(dir, ".version"), "utf8").trim();
  } catch {
    return null;
  }
}

function install(flags) {
  const dest = target(flags.has("--project"));
  if (fs.existsSync(dest)) {
    const current = installedVersion(dest);
    if (!current) {
      console.error(`error: ${dest} exists but was not installed by brainiverse; refusing to overwrite it.`);
      return 1;
    }
    if (current === VERSION && !flags.has("--force")) {
      console.log(`brainiverse ${VERSION} is already installed at ${dest} (use --force to reinstall).`);
      return 0;
    }
    fs.rmSync(dest, { recursive: true, force: true });
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(SKILL_SOURCE, dest, { recursive: true });
  fs.writeFileSync(path.join(dest, ".version"), VERSION + "\n");
  fs.chmodSync(path.join(dest, "bin", "brainiverse.mjs"), 0o755);
  console.log(`Installed brainiverse ${VERSION} to ${dest}`);
  console.log("Restart Claude Code (or start a new session), then type /brainiverse or ask for a team.");
  if (flags.has("--project")) console.log("Tip: add .brainiverse/ to this project's .gitignore.");
  return 0;
}

function uninstall(flags) {
  const dest = target(flags.has("--project"));
  if (!fs.existsSync(dest)) {
    console.log(`Nothing installed at ${dest}.`);
    return 0;
  }
  if (!installedVersion(dest)) {
    console.error(`error: ${dest} was not installed by brainiverse; remove it yourself if you mean to.`);
    return 1;
  }
  fs.rmSync(dest, { recursive: true, force: true });
  console.log(`Removed ${dest}. Mission data in .brainiverse/ folders was left untouched.`);
  return 0;
}

function doctor() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  const nodeOk = major > 18 || (major === 18 && minor >= 17);
  console.log(`node ${process.versions.node} ${nodeOk ? "ok" : "— brainiverse needs >= 18.17"}`);
  for (const project of [false, true]) {
    const dest = target(project);
    const version = installedVersion(dest);
    console.log(`${project ? "project" : "user"} skill: ${fs.existsSync(path.join(dest, "SKILL.md")) ? `installed (${version ?? "unknown version"}) at ${dest}` : "not installed"}`);
  }
  const home = process.env.BRAINIVERSE_HOME || path.join(process.cwd(), ".brainiverse");
  console.log(`workspace: ${fs.existsSync(home) ? home : `${home} (created on first use)`}`);
  return nodeOk ? 0 : 1;
}

function help() {
  console.log(`brainiverse ${VERSION} — the right minds for every mission

  npx brainiverse install [--project] [--force]   install the skill for Claude Code
                                                  (default: ~/.claude/skills; --project: ./.claude/skills)
  npx brainiverse uninstall [--project]           remove the skill
  npx brainiverse doctor                          check node, install location, and workspace
  npx brainiverse <command> ...                   run the runtime directly (try: npx brainiverse --help)`);
  return 0;
}

const [command, ...rest] = process.argv.slice(2);
const flags = new Set(rest);
if (command === "install") process.exitCode = install(flags);
else if (command === "uninstall") process.exitCode = uninstall(flags);
else if (command === "doctor") process.exitCode = doctor();
else if (command === undefined || command === "help") process.exitCode = help();
else {
  const { main } = await import(pathToFileURL(path.join(SKILL_SOURCE, "runtime", "cli.mjs")).href);
  process.exitCode = main(process.argv.slice(2));
}
