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
  needs Bash permission. The static scan is a heuristic, not a security guarantee. Newly installed skills reach
  the Skill tool only from the next Claude Code session; until then agents follow the skill's SKILL.md directly,
  which covers instructions and scripts but not anything that relies on the skill being registered.
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

- **Token savings**: effort levels (`--effort light|standard|strict`, or `--mode` and `--checks` separately) choose
  agents' models and how much reviewing happens; no agent defaults to the most expensive tier. Results carry a
  required summary, full results live in `missions/<id>/results/T#.md`, and Captain reviews with `task results`.
  Teammates get summaries (`--after T1:full` for everything). Project teams keep a digest, kickoff answers and
  tagged memories, and `task add` surfaces similar accepted results from earlier missions. `SKILL.md` was halved,
  and CLI output is compact JSON when read by Claude.

## Trade-offs of the token savings
- **Cheaper models make more mistakes** on hard analysis and subtle review. *strict* effort buys that back per mission.
- **Summaries can lose detail.** Agents write them and the runtime checks only that one exists and is short. The
  full result file, `:full` hand-offs and the reviewer reading full results are the safeguards.
- **Continuing an agent** in a direct line relies on the host's SendMessage; where it isn't available, Captain
  starts a fresh run as before.
- **Light checks** mean no independent reviewer: Captain's acceptance is the only check.
- **Similar-result detection** is word overlap, not meaning; Captain decides whether an old result still holds.

## Future improvements
- Guard coverage for quick-team (general-purpose) agents, e.g. a session-level hook that maps subagent
  invocations to Brainiverse agents.
- Automatic usage capture (a PostToolUse hook on the Agent tool) instead of the Leader recording it.
- Write actions in the dashboard (approve, accept, cancel) behind a local confirmation.
- Shared team libraries: import teams and templates from a URL or repository.
- More languages for kickoff questions and agent replies.
