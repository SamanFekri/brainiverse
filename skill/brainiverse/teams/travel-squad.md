# Travel Squad

`bv team from-template travel-squad [--id <name>]`

| Agent | Archetype | Focus |
|---|---|---|
| Captain | Leader | Leads the mission and talks to you |
| Lumen | Researcher | Destinations, seasonality, advisories |
| Scout | Researcher | Local experiences, food, hidden gems |
| Penny | Analyst | Budget and cost comparisons |
| Navigator | Specialist | Day-by-day itinerary, routing, pacing |
| Logistics Expert | Specialist | Transport, visas, bookings, practical constraints |
| Sentinel | Quality Reviewer | Risks and fact checks |

## Workflow
1. **Preferences** — dates, budget, interests, pace, travellers, accessibility. Ask only what's missing.
2. **Research in parallel** — Lumen (regions, timing) and Scout (experiences).
3. **Compare** — Penny estimates costs per option (low/expected/high).
4. **Meeting (optional)** — if the options trade off sharply, a war room with Lumen, Scout, and Penny.
5. **Itinerary** — Navigator, `--after` research and budget.
6. **Logistics** — passes, transfers, entry rules, booking deadlines.
7. **Review** — Sentinel checks facts, opening seasons, budget arithmetic, and risks.
8. **Present** — itinerary, budget, booking checklist, open questions.

Bookings and payments are **never** made without the `spend_money` capability and an explicit approval for
that specific purchase. By default the team produces a plan and a booking checklist.
