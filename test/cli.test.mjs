import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { cli, cliAsync, runAgent, tmpdir } from "./helpers.mjs";

function setup() {
  const home = path.join(tmpdir(), ".brainiverse");
  assert.equal(cli(home, ["init"]).code, 0);
  assert.equal(cli(home, ["team", "from-template", "travel-squad"]).code, 0);
  assert.equal(cli(home, ["mission", "new", "--goal", "Japan trip", "--team", "travel-squad", "--id", "japan"]).code, 0);
  return home;
}

test("help and unknown commands", () => {
  const home = path.join(tmpdir(), ".brainiverse");
  assert.match(cli(home, ["--help"]).out, /commands:/);
  assert.match(cli(home, ["task", "add", "--help"]).out, /--objective/);
  const bad = cli(home, ["task", "explode"]);
  assert.equal(bad.code, 1);
  assert.match(bad.err, /unknown command/);
  assert.match(cli(home, ["task", "add", "--agent", "x"]).err, /--objective is required/);
});

test("start returns Agent-tool calls whose prompt fetches the brief", () => {
  const home = setup();
  cli(home, ["task", "add", "--agent", "lumen", "--objective", "Research regions"]);
  cli(home, ["task", "add", "--agent", "penny", "--objective", "Budget"]);
  const started = cli(home, ["task", "start", "ready"]).json.started;
  assert.equal(started.length, 2);
  const call = started[0].agent_call;
  assert.equal(call.subagent_type, "general-purpose");
  assert.equal(call.model, "sonnet");
  assert.match(call.prompt, /BRAINIVERSE_AGENT=lumen .*task brief T1 --mission japan/);
  const brief = cli(home, ["task", "brief", "T1"], { agent: "lumen" }).out;
  assert.match(brief, /# Lumen/);
  assert.match(brief, /agents\/researcher\.md/);
  assert.match(brief, /task submit T1/);
});

test("agents may only read and submit their own work", () => {
  const home = setup();
  cli(home, ["task", "add", "--agent", "lumen", "--objective", "Research"]);
  cli(home, ["task", "add", "--agent", "penny", "--objective", "Budget"]);
  cli(home, ["task", "start", "ready"]);
  const json = JSON.stringify({ status: "complete", findings: "x" });
  assert.match(cli(home, ["task", "submit", "T2"], { agent: "lumen", input: json }).err, /cannot submit penny's task/);
  assert.match(cli(home, ["task", "brief", "T2"], { agent: "lumen" }).err, /belongs to penny/);
  for (const args of [["approval", "request", "--detail", "x"], ["agent", "grant", "lumen", "file_write", "--team", "@mission"],
    ["task", "add", "--agent", "lumen", "--objective", "more work"], ["task", "accept", "T1"], ["meeting", "start", "--objective", "x", "--with", "penny"]]) {
    const r = cli(home, args, { agent: "lumen" });
    assert.equal(r.code, 1, args.join(" "));
    assert.match(r.err, /only the Leader/);
  }
  assert.equal(cli(home, ["status"], { agent: "lumen" }).code, 0);
  assert.equal(cli(home, ["task", "submit", "T1"], { agent: "lumen", input: json }).code, 0);
});

test("invalid results are rejected with a useful message", () => {
  const home = setup();
  cli(home, ["task", "add", "--agent", "lumen", "--objective", "Research"]);
  cli(home, ["task", "start", "T1"]);
  assert.match(cli(home, ["task", "submit", "T1"], { agent: "lumen", input: "not json" }).err, /not valid JSON/);
  assert.match(cli(home, ["task", "submit", "T1"], { agent: "lumen", input: "{\"status\":\"complete\"}" }).err, /findings/);
  const fenced = "```json\n{\"status\":\"complete\",\"findings\":\"ok\"}\n```";
  assert.equal(cli(home, ["task", "submit", "T1"], { agent: "lumen", input: fenced }).code, 0, "markdown fences are tolerated");
});

test("parallel submissions don't lose writes (locking)", async () => {
  const home = setup();
  const agents = ["lumen", "scout", "penny", "navigator"];
  for (const a of agents) cli(home, ["task", "add", "--agent", a, "--objective", `work for ${a}`]);
  cli(home, ["task", "start", "ready"]);
  const results = await Promise.all(agents.map((a, i) => cliAsync(home, ["task", "submit", `T${i + 1}`], {
    agent: a, input: JSON.stringify({ status: "complete", findings: `from ${a}` }),
  })));
  assert.deepEqual(results.map((r) => r.code), [0, 0, 0, 0], results.map((r) => r.err).join("\n"));
  const list = cli(home, ["task", "list"]).json;
  assert.deepEqual(list.map((t) => t.status), ["submitted", "submitted", "submitted", "submitted"]);
});

test("agent customization through the CLI keeps permissions independent of identity", () => {
  const home = setup();
  const before = cli(home, ["agent", "show", "lumen", "--team", "@mission"]).json;
  cli(home, ["agent", "rename", "lumen", "--team", "@mission", "--name", "Sherlock", "--personality", "Deductive"]);
  const after = cli(home, ["agent", "show", "lumen", "--team", "@mission"]).json;
  assert.equal(after.name, "Sherlock");
  assert.deepEqual(after.capabilities, before.capabilities);
  assert.match(cli(home, ["agent", "grant", "lumen", "spend_money", "--team", "@mission"]).err, /approval/);
  const a = cli(home, ["approval", "request", "--capability", "spend_money", "--agent", "lumen", "--detail", "book museum tickets"]).json;
  assert.match(cli(home, ["agent", "grant", "lumen", "spend_money", "--team", "@mission", "--approval", a.id]).err, /approval/);
  cli(home, ["approval", "resolve", a.id, "approve", "--note", "User: ok"]);
  assert.equal(cli(home, ["agent", "grant", "lumen", "spend_money", "--team", "@mission", "--approval", a.id]).code, 0);
  assert.match(cli(home, ["agent", "grant", "lumen", "spend_money", "--team", "@mission", "--approval", a.id]).err, /consumed|approved/);
});

test("teams and agents export, import, save and reuse", () => {
  const home = setup();
  const dir = tmpdir();
  cli(home, ["agent", "new", "--archetype", "specialist", "--id", "visa", "--name", "Visa Wizard", "--set", "expertise=visas;entry rules"]);
  cli(home, ["agent", "export", "visa", "--out", path.join(dir, "visa.json")]);
  const exported = JSON.parse(fs.readFileSync(path.join(dir, "visa.json"), "utf8"));
  exported.id = "visa-2";
  exported.capabilities.push("delete_data");
  fs.writeFileSync(path.join(dir, "visa2.json"), JSON.stringify(exported));
  assert.deepEqual(cli(home, ["agent", "import", path.join(dir, "visa2.json")]).json.stripped_gated_capabilities, ["delete_data"]);
  assert.equal(cli(home, ["team", "add", "@mission", "--from-library", "visa"]).code, 0);
  cli(home, ["team", "save", "@mission", "--as", "my-squad"]);
  cli(home, ["team", "export", "my-squad", "--out", path.join(dir, "squad.json")]);
  const other = path.join(tmpdir(), ".brainiverse");
  assert.equal(cli(other, ["team", "import", path.join(dir, "squad.json")]).code, 0);
  assert.ok(cli(other, ["team", "show", "my-squad"]).json.agents.some((a) => a.id === "visa"));
});

test("memory commands and secret refusal", () => {
  const home = setup();
  assert.equal(cli(home, ["memory", "add", "User is vegetarian"]).code, 0);
  assert.match(cli(home, ["memory", "add", "password: hunter2hunter2"]).err, /refusing/);
  assert.equal(cli(home, ["memory", "list"]).json.length, 1);
  cli(home, ["memory", "add", "Budgets in EUR", "--scope", "agent:penny"]);
  assert.equal(cli(home, ["memory", "delete", "R1", "--scope", "agent:penny"]).code, 0);
});

test("audit log records events and redacts secrets", () => {
  const home = setup();
  cli(home, ["approval", "request", "--detail", "use key sk-abcdefghijklmnopqrstuvwxyz0123"]);
  const log = cli(home, ["mission", "log"]).json;
  assert.ok(log.some((e) => e.event === "mission_created"));
  assert.ok(!JSON.stringify(log).includes("sk-abcdefghijklmnop"));
});

test("direct line through the CLI", () => {
  const home = setup();
  assert.match(cli(home, ["chat", "start", "captain"]).err, /already your main contact/);
  const chat = cli(home, ["chat", "start", "penny", "--topic", "budget"]).json.chat;
  const said = cli(home, ["chat", "say", chat, "Can I afford a ryokan?"]).json;
  assert.equal(said.agent, "penny");
  assert.match(said.agent_call.prompt, /task brief/);
  const brief = runAgent(home, said.task, "penny", { status: "complete", findings: "Yes, for one night." });
  assert.match(brief, /talk with you one-on-one/);
  assert.match(cli(home, ["chat", "show", chat]).out, /Penny: Yes, for one night\./);
  assert.match(cli(home, ["status"]).out, /Direct line/);
  assert.equal(cli(home, ["chat", "end", chat]).code, 0);
});
