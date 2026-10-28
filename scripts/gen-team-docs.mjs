// Regenerates skill/brainiverse/teams/<template>.md from the template data: `node scripts/gen-team-docs.mjs`.
import fs from "node:fs";

const dir = new URL("../skill/brainiverse/runtime/data/templates/", import.meta.url);
const out = new URL("../skill/brainiverse/teams/", import.meta.url);
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  const t = JSON.parse(fs.readFileSync(new URL(file, dir), "utf8"));
  const rows = t.agents.map((a) => `| ${a.names.people} (${a.position}) | ${a.names.heroes} | \`${a.id}\` | ${a.description}${a.enabled === false ? " *(starts disabled)*" : ""} |`);
  const md = [`# ${t.name}`, "", `\`brainiverse team from-template ${t.id} [--id <name>]\``, "", t.description, "",
    "| Agent (default names) | heroes theme | id | Role |", "|---|---|---|---|", ...rows, "",
    "## Workflow", ...t.workflow.map((w, i) => `${i + 1}. ${w}`), "", ...(t.notes || []).flatMap((n) => [n, ""])].join("\n");
  fs.writeFileSync(new URL(`${t.id}.md`, out), md);
}
console.log("wrote team docs");
