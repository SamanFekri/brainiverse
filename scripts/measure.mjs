// Measures how much text the runtime puts into context for one scripted reference mission.
//   node scripts/measure.mjs [--json]
// Scripted results stand in for the agents, so the run is repeatable. Numbers are characters and a
// rough token estimate (chars / 4): they compare versions of the runtime, they are not billed tokens.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SKILL = path.join(ROOT, "skill", "brainiverse");
const CLI = path.join(SKILL, "bin", "brainiverse.mjs");
const home = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "bv-measure-")), ".brainiverse");

function bv(args, { input, agent = "" } = {}) {
  const proc = spawnSync(process.execPath, [CLI, ...args], {
    input, encoding: "utf8", env: { ...process.env, BRAINIVERSE_HOME: home, BRAINIVERSE_AGENT: agent, BRAINIVERSE_MISSION: "" },
  });
  return { ok: proc.status === 0, out: proc.stdout, err: proc.stderr };
}
const json = (args, opts) => JSON.parse(bv(args, opts).out);

const REQUEST = "Plan a two-week trip to Japan in April on a budget of 3000 euros";
const paragraph = (topic, n) => Array.from({ length: n }, (_, i) =>
  `${topic} point ${i + 1}: a concrete, sourced detail with numbers, dates and a short justification that a real agent would write.`);
const longResult = (topic) => ({
  status: "complete",
  summary: `${topic}: three options compared; the Kyoto-heavy route fits the budget best. Confidence is moderate; hotel prices are unverified for Golden Week.`,
  findings: paragraph(topic, 30),
  evidence: Array.from({ length: 8 }, (_, i) => `https://example.org/${topic.toLowerCase().replace(/\W+/g, "-")}/${i + 1}`),
  assumptions: ["mid-range hotels", "two travellers", "April dates are flexible by three days"],
  uncertainty: "Prices move weekly; treat the totals as ±10%.",
  recommendations: ["Book rail passes early", "Hold two refundable hotels"],
});

const sizes = {};
const record = (key, text) => { sizes[key] = (sizes[key] || 0) + text.length; };

// Captain's standing context and team assembly
record("captain: SKILL.md", fs.readFileSync(path.join(SKILL, "SKILL.md"), "utf8"));
record("captain: intake", bv(["intake", REQUEST]).out);
const proposal = bv(["team", "propose", REQUEST, "--id", "trip"]);
record("captain: team propose", proposal.out);
record("captain: team catalog", bv(["team", "catalog", REQUEST]).out);
const roster = JSON.parse(proposal.out).roster.map((r) => r.id);
const pick = (...ids) => ids.find((id) => roster.includes(id)) || roster[1];

bv(["mission", "new", "--goal", REQUEST, "--team", "trip", "--constraint", "Vegetarian-friendly", "--success", "Within budget"]);
const tasks = [
  ["T1", pick("researcher"), "Shortlist regions for 14 days in April", []],
  ["T2", pick("budget-analyst", "analyst"), "Daily cost ranges per region", []],
  ["T3", pick("itinerary-planner", "specialist"), "Day-by-day itinerary", ["T1", "T2"]],
  ["T4", pick("reviewer"), "Audit the itinerary against the success criteria", ["T3"]],
];
const models = {};
let invocations = 0;
for (const [id, agent, objective, after] of tasks) {
  bv(["task", "add", "--agent", agent, "--objective", objective, ...(after.length ? ["--after", after.join(",")] : []), "--accept", "meets the brief"]);
}
for (const [id, agent, objective] of tasks) {
  const started = json(["task", "start", id]).started[0];
  invocations += 1;
  const model = started.agent_call.model || "inherit";
  models[model] = (models[model] || 0) + 1;
  record("agents: spawn prompts", started.agent_call.prompt);
  const brief = bv(["task", "brief", id], { agent }).out;
  record("agents: briefs", brief);
  const role = brief.match(/read `([^`]+\.md)` before starting/);
  if (role && fs.existsSync(role[1])) record("agents: role files read", fs.readFileSync(role[1], "utf8"));
  bv(["task", "submit", id], { agent, input: JSON.stringify(longResult(objective)) });
  // What Captain reads to review: the lean view when the runtime has one, else the whole task.
  const lean = bv(["task", "result", id]);
  record("captain: reading results", lean.ok ? lean.out : bv(["task", "show", id]).out);
  bv(["task", "accept", id, "--evidence", "checked"]);
}
record("captain: mission report", bv(["mission", "report"]).out);
record("captain: status", bv(["status"]).out);

const group = (prefix) => Object.entries(sizes).filter(([k]) => k.startsWith(prefix)).reduce((n, [, v]) => n + v, 0);
const result = {
  version: JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version,
  invocations, models, chars: sizes,
  totals: { captain_chars: group("captain:"), agents_chars: group("agents:"), all_chars: group("captain:") + group("agents:") },
};
result.totals.approx_tokens = Math.round(result.totals.all_chars / 4);

if (process.argv.includes("--json")) console.log(JSON.stringify(result, null, 2));
else {
  console.log(`brainiverse ${result.version}: reference mission (${invocations} agent runs; models: ${Object.entries(models).map(([m, n]) => `${n}× ${m}`).join(", ")})`);
  for (const [key, value] of Object.entries(sizes)) console.log(`  ${key.padEnd(30)} ${String(value).padStart(7)} chars`);
  console.log(`  ${"TOTAL".padEnd(30)} ${String(result.totals.all_chars).padStart(7)} chars  ≈ ${result.totals.approx_tokens} tokens`);
}
