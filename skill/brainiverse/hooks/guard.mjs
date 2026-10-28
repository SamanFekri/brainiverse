#!/usr/bin/env node
// PreToolUse guard for Brainiverse project agents.
//
// Each generated .claude/agents/brainiverse-<id>.md registers this hook in its frontmatter, so it
// runs before every tool call that agent makes:   node guard.mjs <agent-id>
// It reads Claude Code's hook input from stdin and denies the call when:
//   - the agent writes into .brainiverse/ (team state) or .claude/ (agent definitions, settings)
//   - the tool isn't covered by the agent's capabilities
//   - a Bash command needs a gated capability (push, delete, publish/deploy, install, send) that
//     the agent lacks, or that its current task has no approval for
// Anything else is left to Claude Code's normal permission flow.
import fs from "node:fs";
import path from "node:path";
import * as tools from "../runtime/tools.mjs";

const GATED_COMMANDS = [
  ["repo_push", /\bgit\s+push\b|\bgh\s+pr\s+(create|merge)\b|\bgh\s+release\s+create\b/],
  ["delete_data", /\brm\s+-[a-zA-Z]*[rRf]|\bgit\s+reset\s+--hard\b|\bgit\s+clean\s+-[a-z]*f|\bdrop\s+(table|database)\b|\btruncate\s+table\b/i],
  ["external_api", /\b(npm|yarn|pnpm)\s+publish\b|\bcurl\b[^|;&]*\s(-X\s*(POST|PUT|PATCH|DELETE)|--request\s+(POST|PUT|PATCH|DELETE)|-d\s|--data)|\b(vercel|netlify|flyctl|fly|heroku)\s+(deploy|--prod)|\bkubectl\s+(apply|delete)\b|\bterraform\s+(apply|destroy)\b/i],
  ["install_skill", /\bnpx\s+(-y\s+)?skills\s+add\b|\bbrainiverse(\.mjs)?\s+install\b/],
  ["send_communication", /\bsendmail\b|\bmail\s+-s\b|\bmailx\b/],
];
const WRITE_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);
// Only the Leader (Captain) creates agents or changes the team. Agents may read their task and submit their result.
const SPAWN_TOOLS = new Set(["Agent", "Task"]);
// A call to the Brainiverse CLI at the start of a command segment, after optional VAR=value prefixes:
//   brainiverse …   npx [-y] brainiverse[@version] …   node "…/brainiverse.mjs" …
const CLI_CALL = /^(?:\s*[A-Za-z_][A-Za-z0-9_]*=(?:'[^']*'|"[^"]*"|\S*)\s+)*\s*(?:(?:npx\s+(?:-y\s+)?)?brainiverse(?:@\S+)?|node\s+["']?\S*brainiverse\.mjs["']?)(?:\s+(.*))?$/s;
// What an agent may run: read its own task, submit its result, and read-only views.
const AGENT_COMMANDS = /^(task\s+(brief|submit|show|list)|status|chat\s+show|meeting\s+show|skill\s+(local|scan)|memory\s+list|archetypes|project\s+status)\b/;

/** The first Brainiverse CLI call in a shell command that an agent isn't allowed to make, if any. */
export function forbiddenCliCall(command) {
  for (const segment of command.split(/&&|\|\||;|\||\n/)) {
    const match = segment.match(CLI_CALL);
    if (match && !AGENT_COMMANDS.test((match[1] || "").trim())) return segment.trim();
  }
  return null;
}
const SHELL_WRITE = /(>|\btee\b|\brm\b|\bmv\b|\bcp\b|\bsed\s+-i|\bchmod\b|\btouch\b|\bmkdir\b)/;

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: `Brainiverse guard: ${reason}` },
  }));
  process.exit(0);
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

function main() {
  const input = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
  const agentId = process.argv[2] || String(input.agent_type || "").replace(/^brainiverse-/, "");
  if (!agentId) return; // not a Brainiverse agent
  const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const home = process.env.BRAINIVERSE_HOME || path.join(root, ".brainiverse");
  const config = readJson(path.join(home, "config.json"));
  if (!config.project_team) return;
  const team = readJson(path.join(home, "teams", `${config.project_team}.json`));
  const profile = team.agents.find((a) => a.id === agentId);
  if (!profile) deny(`${agentId} is not on the project team`);

  const tool = input.tool_name || "";
  const toolInput = input.tool_input || {};
  const protectedDirs = [home, path.join(root, ".claude")].map((d) => path.resolve(d) + path.sep);

  // 0. Only Captain creates agents: no spawning subagents, no team-changing Brainiverse commands.
  if (SPAWN_TOOLS.has(tool)) {
    deny(`only the Leader (Captain) can start agents; ${profile.name} can ask for a specialist in agent_requests instead`);
  }

  // 1. Never touch team state or agent definitions.
  if (WRITE_TOOLS.has(tool)) {
    const target = path.resolve(root, toolInput.file_path || toolInput.notebook_path || "");
    if (protectedDirs.some((d) => (target + path.sep).startsWith(d))) {
      deny(`${profile.name} may not modify ${path.relative(root, target)} (team state and agent definitions are off-limits)`);
    }
  }

  // 2. The tool must come from the agent's capabilities.
  const allowed = new Set(tools.hostTools(profile.capabilities, "claude-code"));
  const mapped = new Set(Object.values(tools.TOOL_ADAPTERS["claude-code"]).flat());
  if (mapped.has(tool) && !allowed.has(tool)) {
    deny(`${profile.name} has no capability that allows ${tool} (capabilities: ${profile.capabilities.join(", ")})`);
  }
  if (tool.startsWith("mcp__") && !profile.capabilities.includes("external_api")) {
    deny(`${profile.name} needs external_api to use MCP tools`);
  }

  // 3. Bash: protected paths and gated commands.
  if (tool === "Bash") {
    const command = String(toolInput.command || "");
    if (forbiddenCliCall(command)) {
      deny(`only the Leader (Captain) can create agents or change the team and the plan; ${profile.name} may only ` +
        "read its task and submit its result (ask for a specialist in agent_requests)");
    }
    if (/(\.brainiverse|\.claude)\//.test(command) && SHELL_WRITE.test(command) && !/bin\/brainiverse\.mjs\s+task\s+(brief|submit)\b/.test(command)) {
      deny(`${profile.name} may not change .brainiverse/ or .claude/ from the shell`);
    }
    for (const [capability, pattern] of GATED_COMMANDS) {
      if (!pattern.test(command)) continue;
      if (!profile.capabilities.includes(capability)) {
        deny(`this command needs ${capability}, which ${profile.name} doesn't have; ask the Leader`);
      }
      const missionId = config.active_mission;
      const state = missionId ? readJson(path.join(home, "missions", missionId, "state.json")) : null;
      const approved = state && Object.values(state.tasks).some((t) =>
        t.agent === agentId && t.status === "running" && t.approval &&
        state.approvals[t.approval]?.capability === capability);
      if (!approved) deny(`this command needs ${capability} and the current task has no human approval for it`);
    }
  }
}

function runGuard() {
  try {
    main();
  } catch (err) {
    // Fail open: a broken guard must not block all work; the error is shown in the transcript.
    process.stderr.write(`brainiverse guard skipped: ${err.message}\n`);
  }
}

// Run only as the hook script itself, so tests can import forbiddenCliCall.
if (process.argv[1]?.endsWith("guard.mjs")) runGuard();
