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
When the human agrees: `bv team approve <team>`; for a project team also `bv project adopt <team>`. Then start the mission. If they reject it, ask what's off,
adjust or re-propose; delete abandoned drafts with `bv team delete <team>`.

## Adding agents mid-mission
"Call in a specialist": `bv team add @project …` (project team: permanent, written to `.claude/agents/`) or
`bv team add @mission …` (quick team).
Tell the human who joined, as Name (Position), and why. Respect `HARD_MAX_AGENTS` (12) — prefer reusing an agent with a broader
brief to spawning near-duplicates.
