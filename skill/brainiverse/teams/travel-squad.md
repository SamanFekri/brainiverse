# Travel Squad

`brainiverse team from-template travel-squad [--id <name>]`

Plans trips: research, budget, itinerary, logistics, and a risk check.

| Agent (default names) | heroes theme | id | Role |
|---|---|---|---|
| Captain (Leader) | Captain | `leader` | Leads the mission and communicates with the human. |
| Shirin (Researcher) | Lumen | `researcher` | Researches destinations and travel information. |
| Laleh (Local Explorer) | Scout | `local-explorer` | Finds local experiences and hidden attractions. |
| Babak (Budget Analyst) | Penny | `budget-analyst` | Analyzes the budget. |
| Olivia (Itinerary Planner) | Navigator | `itinerary-planner` | Creates the itinerary. |
| Ryan (Logistics Expert) | Logistics | `logistics` | Checks transport and practical constraints. |
| Parisa (Quality Reviewer) | Sentinel | `reviewer` | Reviews risks and verifies important details. |

## Workflow
1. Understand preferences (dates, budget, interests, style)
2. Research destinations and local experiences in parallel
3. Compare options and budget
4. Plan the itinerary
5. Validate logistics
6. Review risks and facts
7. Present the result for human review

Bookings and payments are **never** made without the `spend_money` capability and an explicit approval for that specific purchase. By default the team produces a plan and a booking checklist.
