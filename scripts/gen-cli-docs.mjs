// Regenerates skill/brainiverse/docs/cli.md from the CLI spec: `node scripts/gen-cli-docs.mjs`.
import fs from "node:fs";
import { SPEC } from "../skill/brainiverse/runtime/cli.mjs";

const lines = ["# CLI reference", "", "Generated from `runtime/cli.mjs` — `node scripts/gen-cli-docs.mjs` regenerates it.",
  "Every command also accepts `--home <dir>` (default `$BRAINIVERSE_HOME` or `./.brainiverse`) and `--help`.",
  "`-m/--mission` defaults to the active mission.", ""];

function render(path, spec) {
  if (spec.subs) {
    if (path.length) lines.push(`## ${path.join(" ")}`, "", spec.help || "", "");
    for (const [name, sub] of Object.entries(spec.subs)) render([...path, name], sub);
    return;
  }
  const pos = (spec.positional || []).map((p) => (p.startsWith("?") ? `[${p.slice(1)}]` : `<${p}>`)).join(" ");
  lines.push(`### \`${["brainiverse", ...path].join(" ")}${pos ? ` ${pos}` : ""}\``, spec.help || "", "");
  const opts = Object.entries(spec.options || {});
  if (opts.length) {
    for (const [name, o] of opts) {
      const flag = `\`--${name}${o.type === "bool" ? "" : o.type === "int" ? " <n>" : " <value>"}\``;
      const notes = [o.help, o.required && "required", o.multi && "repeatable", o.default !== undefined && `default: ${o.default}`].filter(Boolean).join("; ");
      lines.push(`- ${flag}${notes ? ` — ${notes}` : ""}`);
    }
    lines.push("");
  }
}
render([], SPEC);
fs.writeFileSync(new URL("../skill/brainiverse/docs/cli.md", import.meta.url), lines.join("\n").replace(/\n{3,}/g, "\n\n"));
console.log("wrote docs/cli.md");
