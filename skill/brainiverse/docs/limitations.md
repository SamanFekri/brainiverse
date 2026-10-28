# Known limitations and future improvements

## Limitations (honest list)
- **The Leader is the main session.** Claude Code subagents can't spawn subagents or talk to the human, so
  the main session plays the Leader. Choosing another agent as leader changes the persona and name the main
  session uses, not the process.
- **Permissions are enforced at two levels, with different strength.** The runtime strictly enforces
  everything recorded in it: capability grants, approvals, limits, who may submit what, and the agent-only
  command allowlist. **Project-team** agents run as their own Claude Code subagent types
  (`.claude/agents/brainiverse-<id>.md` with a `tools:` list), so Claude Code enforces their tools. **Quick-team**
  agents run as `general-purpose` subagents: their brief and Claude Code's permission prompts constrain them,
  but they technically have the full tool set.
- **New project agents load next session.** Claude Code reads `.claude/agents/` at startup, so agents added
  during a session run as `general-purpose` (with their brief) until Claude Code restarts.
- **Agents without Bash need the Leader to file their results.** Their brief is inlined and they return JSON
  that the Leader submits; agents with Bash fetch and submit on their own.
- **`BRAINIVERSE_AGENT` is a convention, not authentication.** It stops well-behaved agents from running
  Leader commands by mistake or under prompt injection; it can't stop a process that deliberately omits it.
  Human approvals are recorded with the human's quoted answer and audited, but they're entered through the
  Leader.
- **Timeouts are bookkeeping.** `task sweep` marks overdue tasks failed; stopping a running subagent needs
  Claude Code's TaskStop.
- **Usage is recorded by the Leader.** Token counts come from what the host reports for each Agent run
  (`usage record`); if the Leader skips it, budgets and costs undercount.
- **Team proposals and intake start from keywords.** `team propose` and `intake` use deterministic keyword/domain matching so they're
  predictable and testable; the Leader is expected to refine the roster with judgment.
- **Skill discovery depends on the environment.** Searching needs web or `npx skills` access; installing
  needs Bash permission. The static scan is a heuristic, not a security guarantee. New skills generally load
  in the next session.
- **Memory is local.** State is JSON in `.brainiverse/`, per directory and per machine, with no encryption at
  rest. Don't keep sensitive personal data there; secrets are refused.
- **One machine, one user.** Missions are isolated from each other by directory and lock, but there's no
  multi-user authentication.

## Built since the first release
- **PreToolUse guard** (`hooks/guard.mjs`): registered in every project agent's file. It enforces that only the
  Leader creates agents: project agents can't use the Agent tool, and the only Brainiverse commands they may run
  are reading their task, submitting their result and read-only views (no `team add`, `grant-request`,
  `agent grant`, `project adopt`…). It also blocks writes to
  `.brainiverse/` and `.claude/`, tools outside the agent's capabilities, MCP tools without `external_api`, and
  risky Bash commands (push, delete, publish/deploy, skill installs, sending mail) unless the agent holds that
  capability and its current task has a human approval. It fails open on unreadable input so a bug can't block all
  work. It's pattern-based: a determined agent could still disguise a command.
- **LLM-assisted capability mapping**: the Leader is an LLM, so `team propose` accepts its own analysis
  (`--capabilities`, `--domains`, `--complexity`), validated by the runtime.
- **More templates and domains**: Learning Lab, Launch Team and Life Ops, plus health, personal finance, events,
  career, legal research and home domains, each with kickoff questions.
- **Web dashboard**: `brainiverse dashboard` (live, read-only, localhost) or `--out` for a static snapshot.
- **Host adapters**: `claude-agent-sdk` (AgentDefinitions) and `generic`, next to `claude-code`.
- **Cost tracking**: `usage record` stores what the host reports for each Agent run; `usage report` breaks it down
  by agent and model tier, with cost for tiers you price. There's no built-in price list: prices change, so you set them.

## Future improvements
- Guard coverage for quick-team (general-purpose) agents, e.g. a session-level hook that maps subagent
  invocations to Brainiverse agents.
- Automatic usage capture (a PostToolUse hook on the Agent tool) instead of the Leader recording it.
- Write actions in the dashboard (approve, accept, cancel) behind a local confirmation.
- Shared team libraries: import teams and templates from a URL or repository.
- More languages for kickoff questions and agent replies.
