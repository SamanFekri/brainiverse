# Architecture

Brainiverse has two layers:

1. **Behaviour (Markdown).** `SKILL.md`, `agents/`, `workflows/`, `meetings/`, `teams/` tell the model *how*
   to lead, delegate, meet, and review. They are loaded on demand.
2. **Runtime (Node.js, zero dependencies).** `runtime/*.mjs` holds the state and rules that must not depend on
   the model's memory or goodwill: the agent registry, team builder, task graph, limits, permissions,
   approvals, meetings, memory, skill vetting, metrics, and the audit log.

Claude Code supplies the execution: the main session is the Leader; specialists are real subagents started
with the **Agent tool**; parallelism comes from multiple Agent calls in one message.

```
 Human ⇄ Leader (main Claude Code session) ── SKILL.md + workflows
              │  bv task start ready → agent_calls
              ▼
        Agent tool ×N (parallel subagents) ── each runs: bv task brief T# → work → bv task submit T#
              │
              ▼
   runtime (.brainiverse/ state, locked JSON + audit.jsonl)
```

## Modules
| Spec module | File | Responsibility |
|---|---|---|
| Agent Registry | `registry.mjs` | archetypes, profile schema and validation, rename/edit/duplicate, grant/revoke, import sanitization, library |
| Team Builder | `teams.mjs` | mission analysis, capability mapping, proposals with reasons, templates, team validation, redundancy warnings |
| Leader / Strategist | `agents/leader.md`, `SKILL.md` | the main session's behaviour |
| Orchestration Engine | `orchestrator.mjs` | missions, task DAG, ready-set scheduling, concurrency, retries, timeouts, cancellation, revision limits, result protocol |
| Meeting Engine | `meetings.mjs` | group meetings and direct lines, contributions only from real invocations, decisions, questions, action items |
| Model Adapters | `tools.mjs` (`MODEL_ADAPTERS`) | model tiers (fast/balanced/deep/inherit) → host models |
| Tool Adapters | `tools.mjs` (`TOOL_ADAPTERS`) | capabilities → host tools; risk levels |
| Skill Discovery | `skills.mjs`, `workflows/skill-discovery.md` | local inventory, candidates, static security scan, approval gate, install verification |
| Memory Manager | `memory.mjs` | agent / team / project scopes, secret refusal and redaction |
| Permission Manager | `permissions.mjs` | capability checks, approvals, agent-vs-leader command guard |
| Evaluation Engine | `evaluation.mjs` | evidence-required reviews, metrics |
| Logging | `audit.mjs` | append-only, redacted JSONL per mission |
| Integration layer | `cli.mjs`, `args.mjs`, `bin/` | CLI and npx installer |
| Agent briefs | `briefs.mjs` | the prompt each subagent receives: identity, role, task, upstream results, memory, permissions, report format |

## Key design decisions
- **Agents fetch their own brief.** The Agent-tool prompt is one line pointing to `task brief`, so the
  Leader's context doesn't fill with briefs, and briefs always reflect current state.
- **Agents submit their own results** with `BRAINIVERSE_AGENT=<id>`. Under that variable the CLI allows only
  read/submit commands, and only for that agent's own tasks. Agents can't approve, grant, re-plan, or post as
  someone else.
- **Proposals, not facts.** Submissions are `submitted` until the Leader accepts them, with evidence when
  acceptance criteria exist. Actions marked `verified` must carry evidence.
- **No fabricated participation.** There's no command to write an agent's message; meeting and direct-line
  messages are created only from submissions of real invocations (linked by invocation id).
- **Identity ≠ authority.** Names and personalities are separate from responsibilities and capabilities.
  Capabilities change only through `grant`/`revoke`; gated ones need a human approval record, consumed on use.
  Imported agents and teams never bring gated capabilities.
- **Bounded execution.** Per-mission limits on concurrency, invocations, tasks, retries, timeouts, revision
  iterations, delegation depth, meeting size, and an optional token budget.
- **Concurrency safety.** Mission state is written under an exclusive lock (atomic `mkdir`) with atomic file
  replacement, so parallel agents submitting at once don't lose writes.
- **Host-agnostic core.** Nothing outside `tools.mjs` and `briefs.agentCall` knows about Claude Code. Another
  host adds adapters and its own entry-point instructions.

## Data model (mission state)
`id, title, goal, status, success_criteria[], constraints[], assumptions[], resources[], team{…agents},
limits{}, tasks{T#}, invocations{I#}, meetings{M#}, approvals{A#}, skills{gaps{G#}, candidates{S#}},
reviews[], decisions[D#], memory[R#], usage{tokens}, final_report`.

Task: `id, kind (task|meeting), objective, agent, inputs, expected_output, constraints, depends_on,
acceptance, context, needs, timeout_s, max_retries, parent, meeting, status, attempts, iterations,
feedback[], errors[], approval, invocations[], result, acceptance_evidence, created/started/finished`.

Result protocol: `status (complete|partial|blocked|failed), findings (required), evidence[], assumptions[],
uncertainty, recommendations[], blockers[], next_steps[], deliverables[], actions[{action, verified,
evidence}], memory_suggestions[]`.
