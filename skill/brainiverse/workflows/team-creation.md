# Team creation

There are two kinds of team. `bv intake` suggests which one a request needs; confirm with the human when unsure.

| | Project team | Quick team |
|---|---|---|
| For | ongoing work on this project: building or maintaining an app, a long research programme | one mission: a trip, a decision, a report |
| Lives | saved as the project's team (`config.project_team`), reused by every later mission | the mission it was built for (save it if it's worth reusing) |
| Agents | also written to `.claude/agents/brainiverse-<id>.md`, so Claude Code knows them and enforces their tools | run as general-purpose subagents with their brief |
| Grows | `bv team add @project …` adds a member for good (file written immediately) | `bv team add @mission …` |
| Set up | `team propose` → one OK → `team approve` → `project adopt <team>` | `team propose` → one OK → `team approve` |

An **instant** mission is a third option: a short-term team that isn't kept. `mission new --instant` deletes its
draft team when the mission closes. The kickoff's first question asks the human which of the three they want.

**The human's own picks.** Before the team is gathered, the kickoff asks whether they want specific agents. Pass them
as positions: `team propose "…" --want "Payments Expert, Translator"`. Each gets a fitting base role (reviewer,
researcher, analyst, builder, communicator, organizer, creative, challenger, or specialist by default) and a free
name, and always makes the team.

Every agent is shown as **Name (Position)**, e.g. Babak (Budget Analyst). Commands accept the id (`budget-analyst`)
or the name (`babak`, `Babak`).
## 1. Draft
```bash
bv team propose "<mission in the user's words>" [--max 5] [--id japan-squad]
```
The runtime maps the mission to capabilities (research, ideation, analysis, build, risk, comms, organize,
review), detects up to two domains, adds domain specialists, and fills remaining gaps with archetypes. Every
roster entry has a `why`. The Leader and a quality gate are always included; the team is capped by complexity
(small 4, medium 6, large 8, hard limit 12). Agents cut by the cap appear under `optional`.

The draft is saved as a team with `status: draft`.

## 2. Refine with judgment
The keyword pass is a starting point. Check it:
- **Missing expertise?** `bv team add <team> --archetype specialist --name "Leila" --position "Visa Expert" --expertise "visas,entry rules" --description "..."`
- **Redundant?** `bv team show <team>` reports duplicate roles; `bv team remove <team> <agent>`.
- **Template fits better?** `bv team templates` → `bv team from-template travel-squad --id my-trip`.
- **Reuse a saved specialist?** `bv team add <team> --from-library <agent-id>`.
- **Tools.** Check each agent can do its job (`bv agent show <id> --team <team>` shows host tools). Gated
  capabilities (spend, send, delete, push, install) need an approval — see `docs/customization.md`.

## 2b. The human chooses
- **Show everyone available** when the human wants to choose: `bv team catalog "<request>"` lists the relevant
  groups with your picks pre-checked (☑); `--all` lists every group. Invite them to remove anyone, add anyone
  from the catalog, or create new agents by position ("plus a Translator").
- **Build from their choices:** `bv team build --pick "shirin,babak,olivia" --want "Translator" --id <id>`
  (`--pick` takes ids or names; the Leader is always included; `--want` creates new agents with a fitting role and
  a free name; append `:role` to force one). If they're happy with your picks, keep the proposed team.
- **Effort shapes the roster:** `team propose --effort light` leaves out the separate reviewer (you check the
  work), `strict` adds a Challenger.
- **Skills:** for missions that clearly benefit, search with `/find-skills` and suggest at most 3, each paired
  with the agent who'd use it (`workflows/skill-discovery.md`). Skip for instant missions and simple requests.

## 3. Present
A compact table, then the questions and assumptions:

```
🛡️ Captain (Leader)          leads the mission, your point of contact
🔭 Shirin (Researcher)       destinations, seasonality, advisories
📊 Babak (Budget Analyst)   real costs per option
```
Ask for one OK in the same message.

Offer: rename anyone, change personalities, add/remove agents, choose a different leader, switch to the
professional theme. Apply edits with `agent rename|edit --team <team>` and `team add|remove|leader`.

## 4. Approve
When the human agrees: `bv team approve <team>`; for a project team also `bv project adopt <team>`. Adopting
writes each agent to `.claude/agents/brainiverse-<id>.md` with its tool list and a PreToolUse guard (no writes to
`.brainiverse/` or `.claude/`, no risky commands without an approved task). New agent types load in the next Claude
Code session; until then the runtime falls back to general-purpose automatically. Then start the mission. If they reject it, ask what's off,
adjust or re-propose; delete abandoned drafts with `bv team delete <team>`.

## Agent requests
A result may carry `agent_requests` ("I need a Payments Expert for the webhooks"). They show in `bv status` and
`bv team requests`. Grant with `bv team grant-request AR# [--team @project]` (creates the specialist with a fitting
role and a free name, and on a project team writes its agent file) or decline with
`bv team decline-request AR# --reason "…"` (already covered, team full, or not needed).

## Adding agents mid-mission
**Project team:** ask first, in one line (*"We need payments expertise. Add Amanda (Payments Expert) to the project
team?"*), and only on OK run `team add @project …`. **Short-term team:** add it and tell the human who joined and why.

"Call in a specialist": `bv team add @project …` (project team: permanent, written to `.claude/agents/`) or
`bv team add @mission …` (quick team).
Tell the human who joined, as Name (Position), and why. Respect `HARD_MAX_AGENTS` (12) — prefer reusing an agent with a broader
brief to spawning near-duplicates.
