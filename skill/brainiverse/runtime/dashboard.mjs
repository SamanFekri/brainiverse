// Read-only web dashboard over .brainiverse/: board, team, meetings, approvals, usage.
// `brainiverse dashboard` serves it on 127.0.0.1 and refreshes live; `--out file.html` writes a snapshot.
import http from "node:http";
import * as evaluation from "./evaluation.mjs";
import * as orchestrator from "./orchestrator.mjs";
import * as registry from "./registry.mjs";
import { BrainiverseError } from "./store.mjs";

const COLUMNS = ["pending", "running", "submitted", "done", "blocked", "failed", "cancelled"];

/** Everything the page shows, as plain JSON (no secrets live in state; memory isn't included). */
export function snapshot(ws, missionId) {
  const config = ws.config();
  const missions = ws.listMissions().map((m) => ({ id: m.id, title: m.title, status: m.status }));
  const id = missionId || config.active_mission || missions.at(-1)?.id;
  if (!id) return { generated: new Date().toISOString(), missions, mission: null };
  const state = ws.readMission(id);
  if (!state) throw new BrainiverseError(`no mission named ${id}`);
  const label = Object.fromEntries(state.team.agents.map((a) => [a.id, registry.label(a)]));
  label.human = "Human";
  return {
    generated: new Date().toISOString(),
    missions,
    mission: {
      id: state.id, title: state.title, goal: state.goal, status: state.status,
      team: { name: state.team.name, kind: state.team.kind || "quick",
        agents: state.team.agents.map((a) => ({ id: a.id, label: label[a.id], enabled: a.enabled, avatar: a.avatar || "" })) },
      columns: COLUMNS,
      tasks: Object.values(state.tasks).map((t) => ({
        id: t.id, status: t.status, agent: label[t.agent] || t.agent, objective: t.objective, kind: t.kind,
        depends_on: t.depends_on, attempts: t.attempts, iterations: t.iterations, error: t.errors.at(-1) || "",
      })),
      meetings: Object.values(state.meetings).map((m) => ({
        id: m.id, mode: m.mode || "group", objective: m.objective, status: m.status,
        messages: m.messages.map((msg) => ({ from: label[msg.from] || msg.from, kind: msg.kind, text: msg.text })),
      })),
      approvals: Object.values(state.approvals).map((a) => ({
        id: a.id, status: a.status, kind: a.kind, detail: a.detail, agent: label[a.agent] || a.agent || "", capability: a.capability || "",
      })),
      decisions: state.decisions.map((d) => ({ id: d.id, text: d.text, approved_by_human: d.approved_by_human })),
      usage: orchestrator.usageReport(state, config.prices || {}),
      metrics: { ...evaluation.metrics(state), idle_team_members: evaluation.metrics(state).idle_team_members.map((a) => label[a] || a) },
    },
  };
}

const PAGE = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Brainiverse Board</title>
<style>
  :root { --bg:#f6f5fb; --panel:#ffffff; --ink:#1e1b4b; --muted:#6b6894; --line:#e4e1f3; --accent:#5b21b6; --amber:#b45309;
          --ok:#047857; --bad:#b91c1c; --chip:#efecfb; }
  @media (prefers-color-scheme: dark) { :root { --bg:#14122e; --panel:#1e1b4b; --ink:#eef0ff; --muted:#a5b4fc; --line:#312e81;
          --accent:#c4b5fd; --amber:#fcd34d; --ok:#34d399; --bad:#f87171; --chip:#2a2668; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.45 system-ui, sans-serif; }
  header { padding:20px 24px 8px; display:flex; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between; }
  h1 { margin:0; font-size:22px; } h2 { font-size:15px; margin:0 0 10px; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; }
  .goal { color:var(--muted); margin:2px 0 0; }
  main { padding:8px 24px 32px; display:grid; gap:18px; }
  .panel { background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:16px; }
  .chips { display:flex; flex-wrap:wrap; gap:8px; } .chip { background:var(--chip); border-radius:999px; padding:4px 12px; font-size:14px; }
  .chip.off { opacity:.5; text-decoration:line-through; }
  .board { display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:12px; }
  .col h3 { font-size:13px; margin:0 0 8px; color:var(--muted); text-transform:capitalize; }
  .card { border:1px solid var(--line); border-radius:10px; padding:10px; margin-bottom:8px; background:var(--bg); }
  .card .id { font-weight:700; color:var(--accent); } .card .who { font-size:13px; color:var(--muted); } .card .err { color:var(--bad); font-size:13px; }
  .grid2 { display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:18px; }
  details { border-top:1px solid var(--line); padding:8px 0; } summary { cursor:pointer; font-weight:600; }
  .msg { margin:6px 0 0 4px; } .msg b { color:var(--accent); } .msg.human b { color:var(--amber); }
  table { width:100%; border-collapse:collapse; font-size:14px; } td, th { text-align:left; padding:4px 6px; border-bottom:1px solid var(--line); }
  .pending { color:var(--amber); font-weight:700; } .muted { color:var(--muted); }
  select { font:inherit; padding:4px 8px; border-radius:8px; border:1px solid var(--line); background:var(--panel); color:var(--ink); }
  @media (max-width: 600px) { header, main { padding-left:16px; padding-right:16px; } }
</style>
</head>
<body>
<header><div><h1 id="title">Brainiverse</h1><p class="goal" id="goal"></p></div>
<div><select id="mission" aria-label="Mission"></select> <span class="muted" id="stamp"></span></div></header>
<main id="main"></main>
<script>
const EMBEDDED = __DATA__;
const el = (tag, attrs = {}, ...kids) => { const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (k === "class") n.className = v; else n.setAttribute(k, v);
  for (const kid of kids) n.append(kid instanceof Node ? kid : document.createTextNode(String(kid ?? ""))); return n; };
const panel = (title, ...kids) => el("section", { class: "panel" }, el("h2", {}, title), ...kids);
let current = new URLSearchParams(location.search).get("mission") || "";

function render(data) {
  const select = document.getElementById("mission");
  select.replaceChildren(...data.missions.map((m) => el("option", { value: m.id }, m.title + " [" + m.status + "]")));
  const main = document.getElementById("main");
  document.getElementById("stamp").textContent = "updated " + new Date(data.generated).toLocaleTimeString();
  const m = data.mission;
  if (!m) { main.replaceChildren(panel("No missions yet", el("p", {}, "Start one with: brainiverse mission new"))); return; }
  select.value = m.id; current = m.id;
  document.getElementById("title").textContent = m.title + " · " + m.status;
  document.getElementById("goal").textContent = m.goal;
  const team = panel(m.team.name + (m.team.kind === "project" ? " (project team)" : ""),
    el("div", { class: "chips" }, ...m.team.agents.map((a) => el("span", { class: "chip" + (a.enabled ? "" : " off") }, (a.avatar ? a.avatar + " " : "") + a.label))));
  const board = panel("Board", el("div", { class: "board" }, ...m.columns.map((c) => {
    const tasks = m.tasks.filter((t) => t.status === c);
    return el("div", { class: "col" }, el("h3", {}, c + " (" + tasks.length + ")"), ...tasks.map((t) => el("div", { class: "card" },
      el("div", {}, el("span", { class: "id" }, t.id), t.kind === "meeting" ? " 💬" : ""), el("div", {}, t.objective),
      el("div", { class: "who" }, t.agent + (t.depends_on.length ? " · after " + t.depends_on.join(", ") : "")),
      t.error ? el("div", { class: "err" }, t.error) : "")));
  })));
  const meetings = panel("Meetings and direct lines", ...(m.meetings.length ? m.meetings.map((mt) => el("details", mt.status === "active" ? { open: "" } : {},
    el("summary", {}, (mt.mode === "direct" ? "☎️ " : "⚔️ ") + mt.objective + " [" + mt.status + "]"),
    ...mt.messages.map((msg) => msg.kind === "system" ? el("div", { class: "msg muted" }, msg.text)
      : el("div", { class: "msg" + (msg.from === "Human" ? " human" : "") }, el("b", {}, msg.from + ": "), msg.text)))) : [el("p", { class: "muted" }, "None yet.")]));
  const approvals = panel("Approvals", m.approvals.length ? el("table", {}, el("tr", {}, el("th", {}, "id"), el("th", {}, "status"), el("th", {}, "what")),
    ...m.approvals.map((a) => el("tr", {}, el("td", {}, a.id), el("td", { class: a.status === "pending" ? "pending" : "" }, a.status),
      el("td", {}, a.detail + (a.capability ? " (" + a.capability + (a.agent ? ", " + a.agent : "") + ")" : ""))))) : el("p", { class: "muted" }, "None."));
  const u = m.usage, x = m.metrics;
  const usage = panel("Usage and metrics", el("table", {},
    el("tr", {}, el("td", {}, "Tasks done"), el("td", {}, x.tasks_done + " / " + x.tasks_total)),
    el("tr", {}, el("td", {}, "Agent runs"), el("td", {}, u.invocations + " (" + u.host_reported + " with host usage)")),
    el("tr", {}, el("td", {}, "Tokens"), el("td", {}, u.tokens.toLocaleString())),
    el("tr", {}, el("td", {}, "Cost"), el("td", {}, "$" + u.cost_usd + (u.unpriced_tiers.length ? " (no price set for: " + u.unpriced_tiers.join(", ") + ")" : ""))),
    el("tr", {}, el("td", {}, "Idle members"), el("td", {}, x.idle_team_members.join(", ") || "none"))),
    ...(m.decisions.length ? [el("h2", { style: "margin-top:14px" }, "Decisions"), ...m.decisions.map((d) => el("div", { class: "msg" }, el("b", {}, d.id + ": "), d.text + (d.approved_by_human ? " ✓" : "")))] : []));
  main.replaceChildren(team, board, el("div", { class: "grid2" }, meetings, el("div", { style: "display:grid;gap:18px" }, approvals, usage)));
}

async function refresh() {
  try { const res = await fetch("api/state" + (current ? "?mission=" + encodeURIComponent(current) : "")); if (res.ok) render(await res.json()); } catch {}
}
document.getElementById("mission").addEventListener("change", (e) => { current = e.target.value; EMBEDDED ? null : refresh(); });
if (EMBEDDED) render(EMBEDDED); else { refresh(); setInterval(refresh, 3000); }
</script>
</body>
</html>`;

export function page(data = null) {
  // Escape "<" so embedded agent text can never close the script tag.
  return PAGE.replace("__DATA__", data ? JSON.stringify(data).replace(/</g, "\\u003c") : "null");
}

export function serve(ws, port = 4777) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    try {
      if (url.pathname === "/api/state") {
        const body = JSON.stringify(snapshot(ws, url.searchParams.get("mission")));
        res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" }).end(body);
      } else if (url.pathname === "/") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(page());
      } else {
        res.writeHead(404).end("not found");
      }
    } catch (err) {
      res.writeHead(500, { "content-type": "application/json" }).end(JSON.stringify({ error: err.message }));
    }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}
