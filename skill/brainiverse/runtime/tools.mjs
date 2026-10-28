// Tool and model adapters.
//
// Agents are granted abstract *capabilities*; an adapter maps them onto the tools a host
// actually provides. Only the Claude Code adapter ships today. A new host adds an entry in
// TOOL_ADAPTERS and MODEL_ADAPTERS and nothing else changes.
//
// Risk levels:
//   read        observes only
//   write       changes local files or runs local code
//   external    affects systems or people outside this machine
//   destructive deletes data or is otherwise hard to undo
//   financial   spends money
// Capabilities at external, destructive or financial risk always need a human approval per use.

export const CAPABILITIES = {
  web_search: { risk: "read", description: "Search the web" },
  web_browse: { risk: "read", description: "Fetch and read web pages" },
  file_read: { risk: "read", description: "Read local files" },
  file_write: { risk: "write", description: "Create and edit local files" },
  code_exec: { risk: "write", description: "Run code and shell commands locally" },
  repo_write: { risk: "write", description: "Commit to the local repository" },
  repo_push: { risk: "external", description: "Push branches or open pull requests" },
  external_api: { risk: "external", description: "Call third-party APIs that change remote state" },
  send_communication: { risk: "external", description: "Send email, chat, or other messages" },
  calendar_write: { risk: "external", description: "Create or change calendar events" },
  install_skill: { risk: "external", description: "Install or enable external skills" },
  delete_data: { risk: "destructive", description: "Delete files, records, or resources" },
  spend_money: { risk: "financial", description: "Make purchases or bookings" },
};

const GATED_RISKS = new Set(["external", "destructive", "financial"]);

const CLAUDE_TOOLS = {
  web_search: ["WebSearch"],
  web_browse: ["WebFetch"],
  file_read: ["Read", "Grep", "Glob"],
  file_write: ["Write", "Edit"],
  code_exec: ["Bash"],
  repo_write: ["Bash"],
  repo_push: ["Bash"],
  external_api: ["Bash", "WebFetch"],
  send_communication: [],
  calendar_write: [],
  install_skill: ["Bash"],
  delete_data: ["Bash"],
  spend_money: [],
};

export const TOOL_ADAPTERS = {
  // The Claude Agent SDK uses the same built-in tool names as Claude Code.
  "claude-agent-sdk": CLAUDE_TOOLS,
  // Any other host: capabilities are passed through as-is for the host to map.
  generic: Object.fromEntries(Object.keys(CAPABILITIES).map((c) => [c, [c]])),
  "claude-code": CLAUDE_TOOLS,
};

// The Agent tool's `model` parameter; null means inherit the session model.
export const MODEL_ADAPTERS = {
  "claude-code": { inherit: null, fast: "haiku", balanced: "sonnet", deep: "opus" },
  // AgentDefinition.model in the Claude Agent SDK takes the same aliases.
  "claude-agent-sdk": { inherit: "inherit", fast: "haiku", balanced: "sonnet", deep: "opus" },
  generic: { inherit: null, fast: "fast", balanced: "balanced", deep: "deep" },
};

export const HOSTS = Object.keys(TOOL_ADAPTERS);

export const MODEL_TIERS = ["inherit", "fast", "balanced", "deep"];

export const isGated = (capability) => GATED_RISKS.has(CAPABILITIES[capability].risk);

export const unknownCapabilities = (capabilities) => capabilities.filter((c) => !(c in CAPABILITIES));

/** Concrete host tools an agent may use, from its capabilities. */
export function hostTools(capabilities, host = "claude-code") {
  const adapter = TOOL_ADAPTERS[host] || {};
  const tools = [];
  for (const capability of capabilities) {
    for (const tool of adapter[capability] || []) if (!tools.includes(tool)) tools.push(tool);
  }
  return tools;
}

export function hostModel(tier, host = "claude-code") {
  return (MODEL_ADAPTERS[host] || {})[tier || "inherit"] ?? null;
}
