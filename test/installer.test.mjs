import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ROOT, tmpdir } from "./helpers.mjs";

const run = (home, args, cwd = home) => spawnSync(process.execPath, [path.join(ROOT, "bin", "brainiverse.mjs"), ...args], {
  cwd, encoding: "utf8", env: { ...process.env, HOME: home, USERPROFILE: home },
});

test("install, reinstall, doctor, uninstall (user scope)", () => {
  const home = tmpdir();
  const dest = path.join(home, ".claude", "skills", "brainiverse");
  assert.equal(run(home, ["install"]).status, 0);
  assert.ok(fs.existsSync(path.join(dest, "SKILL.md")));
  assert.ok(fs.existsSync(path.join(dest, "runtime", "cli.mjs")));
  assert.match(run(home, ["install"]).stdout, /already installed/);
  assert.equal(run(home, ["install", "--force"]).status, 0);
  assert.match(run(home, ["doctor"]).stdout, /user skill: installed/);
  // the installed copy runs on its own
  const installed = spawnSync(process.execPath, [path.join(dest, "bin", "brainiverse.mjs"), "archetypes"], { encoding: "utf8" });
  assert.equal(installed.status, 0);
  assert.equal(Object.keys(JSON.parse(installed.stdout)).length, 10);
  assert.equal(run(home, ["uninstall"]).status, 0);
  assert.ok(!fs.existsSync(dest));
});

test("project scope, and never overwriting a foreign skill", () => {
  const home = tmpdir();
  const project = tmpdir();
  assert.equal(run(home, ["install", "--project"], project).status, 0);
  assert.ok(fs.existsSync(path.join(project, ".claude", "skills", "brainiverse", "SKILL.md")));
  const foreign = path.join(home, ".claude", "skills", "brainiverse");
  fs.mkdirSync(foreign, { recursive: true });
  fs.writeFileSync(path.join(foreign, "SKILL.md"), "someone else's");
  const r = run(home, ["install"]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /refusing to overwrite/);
  assert.equal(fs.readFileSync(path.join(foreign, "SKILL.md"), "utf8"), "someone else's");
});

test("unknown commands pass through to the runtime", () => {
  const home = tmpdir();
  const r = run(home, ["archetypes"]);
  assert.equal(r.status, 0);
  assert.ok(JSON.parse(r.stdout).leader);
});
