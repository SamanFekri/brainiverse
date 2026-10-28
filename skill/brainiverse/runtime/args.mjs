// Minimal declarative argument parser (no dependencies).
//
// A command spec looks like:
//   { help, positional: ["agent_id", "?optional"], options: { name: { type, multi, required, short, help } },
//     subs: { <sub>: <spec> } }
// Option types: "string" (default), "int", "bool". Dashed names map to underscored keys.
import { BrainiverseError } from "./store.mjs";

const key = (name) => name.replace(/-/g, "_");

function usage(prog, spec) {
  if (spec.subs) {
    const lines = Object.entries(spec.subs).map(([name, sub]) => `  ${name.padEnd(16)} ${sub.help || ""}`);
    return `usage: ${prog} <command>\n${spec.help ? `\n${spec.help}\n` : ""}\ncommands:\n${lines.join("\n")}`;
  }
  const pos = (spec.positional || []).map((p) => (p.startsWith("?") ? `[${p.slice(1)}]` : `<${p}>`)).join(" ");
  const opts = Object.entries(spec.options || {}).map(([name, o]) => {
    const flag = `--${name}${o.short ? `, -${o.short}` : ""}${o.type === "bool" ? "" : ` <${o.type === "int" ? "n" : "value"}>`}`;
    return `  ${flag.padEnd(28)} ${o.help || ""}${o.required ? " (required)" : ""}${o.multi ? " (repeatable)" : ""}`;
  });
  return `usage: ${prog} ${pos}${opts.length ? " [options]" : ""}${spec.help ? `\n\n${spec.help}` : ""}` +
    (opts.length ? `\n\noptions:\n${opts.join("\n")}` : "");
}

export class HelpRequested extends Error {}

export function parse(argv, spec, prog = "brainiverse") {
  const path = [];
  let node = spec;
  let i = 0;
  while (node.subs) {
    const token = argv[i];
    if (token === undefined || token === "--help" || token === "-h") throw new HelpRequested(usage([prog, ...path].join(" "), node));
    if (!(token in node.subs)) throw new BrainiverseError(`unknown command '${[...path, token].join(" ")}'\n\n${usage([prog, ...path].join(" "), node)}`);
    path.push(token);
    node = node.subs[token];
    i += 1;
  }
  const options = node.options || {};
  const shorts = Object.fromEntries(Object.entries(options).filter(([, o]) => o.short).map(([n, o]) => [o.short, n]));
  const out = { _path: path };
  const positional = [];
  for (; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--help" || token === "-h") throw new HelpRequested(usage([prog, ...path].join(" "), node));
    let name = null;
    let inline;
    if (token.startsWith("--") && token.length > 2) {
      [name, inline] = token.slice(2).split(/=(.*)/s, 2);
    } else if (/^-[a-zA-Z]$/.test(token) && shorts[token[1]]) {
      name = shorts[token[1]];
    }
    if (name === null) {
      positional.push(token);
      continue;
    }
    const opt = options[name];
    if (!opt) throw new BrainiverseError(`unknown option --${name} for '${path.join(" ")}'\n\n${usage([prog, ...path].join(" "), node)}`);
    let value;
    if (opt.type === "bool") value = inline === undefined ? true : inline !== "false";
    else {
      value = inline ?? argv[++i];
      if (value === undefined) throw new BrainiverseError(`--${name} needs a value`);
      if (opt.type === "int") {
        if (!/^-?\d+$/.test(value)) throw new BrainiverseError(`--${name} must be an integer`);
        value = Number(value);
      }
    }
    if (opt.multi) (out[key(name)] ||= []).push(value);
    else out[key(name)] = value;
  }
  const names = node.positional || [];
  if (positional.length > names.length) throw new BrainiverseError(`unexpected argument '${positional[names.length]}'`);
  names.forEach((p, idx) => {
    const optional = p.startsWith("?");
    const name = optional ? p.slice(1) : p;
    if (positional[idx] === undefined && !optional) {
      throw new BrainiverseError(`missing <${name}>\n\n${usage([prog, ...path].join(" "), node)}`);
    }
    out[key(name)] = positional[idx];
  });
  for (const [name, opt] of Object.entries(options)) {
    if (opt.required && out[key(name)] === undefined) throw new BrainiverseError(`--${name} is required`);
    if (opt.default !== undefined && out[key(name)] === undefined) out[key(name)] = opt.default;
  }
  return out;
}
