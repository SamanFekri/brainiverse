# Team creation

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
- **Missing expertise?** `bv team add <team> --archetype specialist --name "Visa Wizard" --expertise "visas,entry rules" --description "..."`
- **Redundant?** `bv team show <team>` reports duplicate roles; `bv team remove <team> <agent>`.
- **Template fits better?** `bv team templates` → `bv team from-template travel-squad --id my-trip`.
- **Reuse a saved specialist?** `bv team add <team> --from-library <agent-id>`.
- **Tools.** Check each agent can do its job (`bv agent show <id> --team <team>` shows host tools). Gated
  capabilities (spend, send, delete, push, install) need an approval — see `docs/customization.md`.

## 3. Present
A compact table, then the questions and assumptions:

| Agent | Role | Why they're here |
|---|---|---|
| 🛡️ Captain | Leader | Leads the mission and is your point of contact |
| 🔭 Lumen | Researcher | Finds destinations, seasonality, advisories |

Offer: rename anyone, change personalities, add/remove agents, choose a different leader, switch to the
professional theme. Apply edits with `agent rename|edit --team <team>` and `team add|remove|leader`.

## 4. Approve
When the human agrees: `bv team approve <team>`, then start the mission. If they reject it, ask what's off,
adjust or re-propose; delete abandoned drafts with `bv team delete <team>`.

## Adding agents mid-mission
"Call in a specialist": `bv team add @mission --archetype specialist --name ... --expertise ...`.
Tell the human who joined and why. Respect `HARD_MAX_AGENTS` (12) — prefer reusing an agent with a broader
brief to spawning near-duplicates.
