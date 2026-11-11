# Orchestration

## Plan
Decompose the goal into tasks. Each task gets:
- one owner (`--agent`, an id or a name like `babak`) and one clear `--objective`
- `--input` items and `--expect` (what the output should look like)
- `--accept` criteria you can actually check (repeatable)
- `--after T1,T2` only for real dependencies
- `--needs` capabilities when the task requires specific access (checked at start)
- optional `--constraint`, `--context`, `--timeout <s>`, `--retries <n>`, `--parent T#` (sub-delegation)

```bash
bv task add --agent shirin --objective "Shortlist 4 regions for 14 days in April" \
  --accept "each region has 2+ sources" --accept "notes cherry-blossom timing"
bv task add --agent babak --objective "Estimate daily costs per region" --accept "low/expected/high"
bv task add --agent olivia --objective "Draft a day-by-day itinerary" --after T1,T2 --accept "fits budget"
```

## Run
```bash
bv task start ready      # starts every runnable task, up to max_concurrent; returns agent_calls
```
Make one Agent-tool call per `agent_call`, all in a single message. Each subagent runs
`... task brief T#` to get its full brief and `... task submit T#` to file its result. Use
`run_in_background: true` for long tasks if you want to keep talking to the human meanwhile.

When the calls return:
| Situation | Do |
|---|---|
| Agent ended with `SUBMITTED T#` | `bv task results` (summary view of everything awaiting review) |
| Entry had `leader_submits: true` (agent without Bash) | save the JSON it ended with to a file, `bv task submit T# --file <path>` |
| Agent returned JSON but couldn't submit | `bv task submit T# <<'EOF' {json} EOF` |
| Claude Code reports an unknown agent type | retry with `subagent_type: "general-purpose"` and the same prompt (new project agents load next session) |
| Agent errored / returned nothing useful | `bv task fail T# --error "..."` → retried automatically or marked failed |
| Agent took too long | `bv task sweep` marks overdue tasks timed out |
| Human says stop | `bv task cancel T#` (dependents become blocked); TaskStop the background agent |

After each Agent result, record what Claude Code reports:
`bv usage record T# --tokens <n> --tool-uses <n> --duration-ms <n>`. It feeds the token budget and `bv usage report`.

## Review from summaries
Every deliverable result carries a `summary` (under 700 characters) and its full text is saved to
`.brainiverse/missions/<id>/results/T#.md`.
- `bv task results` (or `bv task result T#`) gives the summary view: outcome, status, blockers, unverified actions,
  counts of findings and sources, files changed, and where the full result is.
- **Accept from the summary** when it clearly settles the acceptance criteria. **Open the full result file** when
  the criteria need checking line by line, the summary raises a doubt, or the work ships.
- `bv task accept T# --evidence "checked 2 sources per region"` — evidence required when the task has criteria.
- `bv task revise T# --feedback "..."` — back to pending with your feedback in the brief; bounded by
  `max_iterations`. Hitting the limit means: escalate to the human, don't loop. A vague summary is a reason to revise.
- Review depends on the mission's check level (`bv status` shows it): *light* = your acceptance only; *standard* =
  one Quality Reviewer task on the final deliverable (`--after T#`); *strict* = reviewer on every key deliverable
  plus the Challenger on key decisions. Record verdicts with
  `bv review T# --verdict pass_with_issues --evidence "..." --issue "..." --reviewer parisa`.

## Hand-offs
Dependent tasks get each earlier result's **summary** plus the path to its full text. Use `--after T1:full` when a
task truly builds on all of T1 (an itinerary from the research, code from a design). The Quality Reviewer always
gets full results.

## Memory that saves work
- **Tags:** `task add --tags payments,ui`. Briefs include untagged memories plus those sharing a tag, so an agent
  isn't handed every memory the team has. Tag memories the same way: `memory add "…" --tags payments`.
- **Past results:** on a project team, `task add` lists `similar_past_results` from earlier missions (summary and
  file). If one still holds, cancel or narrow the new task and pass the old result along instead.
- **Project digest:** `project digest` shows it; `project digest --file <path>` sets it. It goes into every project
  agent's brief.

## Spend tokens where they matter
- Do small steps yourself instead of delegating them: each agent run starts cold and costs far more than the step.
- Batch: one task per agent with everything it needs, not a chain of small tasks to the same agent.
- Don't add review layers the check level doesn't call for.

## Limits (per mission; `bv mission update --limit key=value` with the human's agreement)
| Limit | Default | Prevents |
|---|---|---|
| max_concurrent | 4 | too many parallel agents |
| max_invocations | 40 | runaway spending |
| max_tasks | 60 | uncontrolled task creation |
| max_retries | 1 | retry storms |
| default_timeout_s | 900 | stuck tasks |
| max_iterations | 3 | endless revise/review loops |
| max_delegation_depth | 2 | recursive delegation |
| max_meeting_participants | 5 | crowded meetings |
| token_budget | 0 (off) | cost overrun; counts tokens from `usage record` |

## Progress
`bv status` is the board: counts, open tasks, what's ready, what awaits your review, pending approvals, open
questions, active meetings and direct lines. `bv metrics` reports completion, first-pass acceptance, unused
invocations, idle members, latency.
