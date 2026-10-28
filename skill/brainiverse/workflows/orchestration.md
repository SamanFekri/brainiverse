# Orchestration

## Plan
Decompose the goal into tasks. Each task gets:
- one owner (`--agent`) and one clear `--objective`
- `--input` items and `--expect` (what the output should look like)
- `--accept` criteria you can actually check (repeatable)
- `--after T1,T2` only for real dependencies
- `--needs` capabilities when the task requires specific access (checked at start)
- optional `--constraint`, `--context`, `--timeout <s>`, `--retries <n>`, `--parent T#` (sub-delegation)

```bash
bv task add --agent lumen --objective "Shortlist 4 regions for 14 days in April" \
  --accept "each region has 2+ sources" --accept "notes cherry-blossom timing"
bv task add --agent penny --objective "Estimate daily costs per region" --accept "low/expected/high"
bv task add --agent navigator --objective "Draft a day-by-day itinerary" --after T1,T2 --accept "fits budget"
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
| Agent ended with `SUBMITTED T#` | Read the result (`bv task show T#`) |
| Agent returned JSON but couldn't submit | `bv task submit T# <<'EOF' {json} EOF` |
| Agent errored / returned nothing useful | `bv task fail T# --error "..."` → retried automatically or marked failed |
| Agent took too long | `bv task sweep` marks overdue tasks timed out |
| Human says stop | `bv task cancel T#` (dependents become blocked); TaskStop the background agent |

## Review
- `bv task accept T# --evidence "checked 2 sources per region"` — required when the task has criteria.
- `bv task revise T# --feedback "..."` — back to pending with your feedback in the brief; bounded by
  `max_iterations`. Hitting the limit means: escalate to the human, don't loop.
- High-stakes output → add a review task for the Quality Reviewer with `--after T#`, and record its verdict:
  `bv review T# --verdict pass_with_issues --evidence "..." --issue "..." --reviewer sentinel`.

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
| token_budget | 0 (off) | cost overrun; pass `--tokens` on submit to track |

## Progress
`bv status` is the board: counts, open tasks, what's ready, what awaits your review, pending approvals, open
questions, active meetings and direct lines. `bv metrics` reports completion, first-pass acceptance, unused
invocations, idle members, latency.
