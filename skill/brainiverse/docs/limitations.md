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
- **Token budgets are opt-in.** The runtime counts tokens only when `--tokens` is passed on submit.
- **Team proposals and intake start from keywords.** `team propose` and `intake` use deterministic keyword/domain matching so they're
  predictable and testable; the Leader is expected to refine the roster with judgment.
- **Skill discovery depends on the environment.** Searching needs web or `npx skills` access; installing
  needs Bash permission. The static scan is a heuristic, not a security guarantee. New skills generally load
  in the next session.
- **Memory is local.** State is JSON in `.brainiverse/`, per directory and per machine, with no encryption at
  rest. Don't keep sensitive personal data there; secrets are refused.
- **One machine, one user.** Missions are isolated from each other by directory and lock, but there's no
  multi-user authentication.

## Future improvements
- A hook (`PreToolUse`) that checks subagent tool calls against their recorded capabilities.
- LLM-assisted capability mapping as an option next to the keyword analyzer.
- More templates (Learning Lab, Launch Team, Life Ops) and more domains.
- A small web dashboard over `.brainiverse/` (board, meetings, approvals).
- Adapters for other hosts (Claude Agent SDK, other CLIs) via `TOOL_ADAPTERS` / `MODEL_ADAPTERS`.
- Cost tracking from the host's usage reports instead of opt-in token counts.
