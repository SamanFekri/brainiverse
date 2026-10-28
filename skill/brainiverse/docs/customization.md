# Customization

Every command below works on the **agent library** by default, on a saved team with `--team <id>`, on the
project team with `--team @project` (its `.claude/agents/` files re-sync automatically), or on the running
mission's team with `--team @mission`. Agents can be referenced by id (`budget-analyst`) or name (`babak`).

## Agent profile
| Field | Meaning | Edit with |
|---|---|---|
| id | stable unique id | fixed (duplicate to change) |
| name, personality, communication_style, avatar | identity | `agent rename` |
| position | shown in brackets: Babak (Budget Analyst) | `agent edit --set position=...` |
| archetype | role template | fixed (create a new agent instead) |
| description, instructions, input_format, output_format, collaboration, role_file | behaviour | `agent edit --set field=value` |
| responsibilities, expertise, decision_rules, skills | lists | `--set field="a;b;c"`, `--add field=x`, `--remove field=x` |
| capabilities | permissions | `agent grant` / `agent revoke` only |
| model | inherit · fast · balanced · deep | `--set model=deep` |
| memory.enabled | include memory in briefs | `--set memory.enabled=false` |
| limits.timeout_s, limits.max_retries, limits.max_invocations | execution limits | `--set limits.timeout_s=600` |
| enabled | on/off | `agent enable` / `agent disable` |

Renaming never changes responsibilities or permissions:
```bash
bv agent rename shirin --team @project --name Sherlock --personality "Deductive, dry-witted"
```

## Create agents
```bash
bv agent new --archetype specialist --id visa-wizard --name "Leila" --position "Visa Expert" \
  --set "expertise=visas;entry rules" --set "instructions=Always cite the official government page"
bv agent duplicate visa-wizard visa-wizard-eu --name "Nina"
bv agent export visa-wizard --out visa-wizard.agent.json
bv agent import visa-wizard.agent.json            # gated capabilities are stripped on import
bv agent test visa-wizard --task "What does a US citizen need to visit Japan for 14 days?"
```
`agent test` returns an Agent-tool call that runs the agent in isolation without touching any mission.

## Capabilities and approvals
`bv capabilities` lists all capabilities, their risk, and the host tools they map to.
- **read / write** (`web_search`, `web_browse`, `file_read`, `file_write`, `code_exec`, `repo_write`): grant
  directly — `bv agent grant forge repo_write --team @mission`.
- **external / destructive / financial** (`repo_push`, `external_api`, `send_communication`,
  `calendar_write`, `install_skill`, `delete_data`, `spend_money`): need a human approval:
  ```bash
  bv approval request --capability send_communication --agent dariush --detail "Let Dariush send the pitch email to Ana"
  bv approval resolve A1 approve --note "User: 'yes, send it to Ana only'"
  bv agent grant dariush send_communication --team @mission --approval A1
  ```
  And each task that *uses* a gated capability declares it (`--needs send_communication`) and needs its own
  approval attached (`task attach-approval T# A2`). Approvals are single-use.

## Teams
```bash
bv team templates
bv team from-template discovery-crew --id idea-check
bv team add idea-check --archetype communicator --name "Dariush" --position "Pitch Coach"
bv team remove idea-check jake
bv team leader idea-check "Madison"   # the main session then speaks as Madison (Market Researcher)
bv team rename idea-check "Idea Lab"
bv team save @mission --as my-favourite-squad
bv team export idea-check --out idea-check.team.json
bv team import idea-check.team.json
```

## Themes and terminology
```bash
bv themes                               # people (default) · heroes · professional
bv config theme heroes                  # superhero-style names (Lumen, Spark, Sentinel…)
bv config theme professional            # positions only: "Budget Analyst", no nickname
bv config terminology professional      # Team/Project/Meeting instead of Squad/Mission/War Room
```
A theme applies to agents created after you switch; rename existing ones with `agent rename`.

## Project teams
```bash
bv project adopt <team>     # make it this project's team; writes .claude/agents/brainiverse-<id>.md
bv project status           # roster and agent files
bv project sync             # rewrite the agent files (automatic after team/agent changes)
bv project release          # stop using it; removes only the files brainiverse generated
```
Files you wrote yourself in `.claude/agents/` are never overwritten or deleted.

To add your own theme or template, edit `runtime/data/themes.json` or add a file to
`runtime/data/templates/` (same shape as the existing ones). To teach the team builder a new domain, add an
entry to `runtime/data/domains.json` (keywords, baseline needs, specialists, intake questions).

## Memory
```bash
bv memory add "User is vegetarian" --scope project
bv memory add "Prefer official sources for visa rules" --scope agent:visa-wizard
bv memory add "Budgets always in EUR" --scope team:travel-squad
bv memory list --scope team:travel-squad
bv memory edit R1 "User is vegan" --scope project
bv memory delete R1 --scope project
```
Agents see their own memory, their team's, and the current project's — never other agents' memory. Records
that look like secrets (API keys, tokens, private keys, card numbers) are refused.
