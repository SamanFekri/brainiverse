# Mission intake

Goal: understand what the human wants well enough to propose a team, without an interrogation.

## 1. Get the mission
- Purpose unknown → *"Hey! What do you want your team to help you accomplish? Tell me your mission, and I'll
  assemble the right crew."*
- Purpose already stated (including in the message that triggered the skill) → don't ask again.
- No jargon: the human doesn't need to know about agents, archetypes, or orchestration.

## 2. Extract (silently, in your head)
| Item | Example (Japan trip) |
|---|---|
| Primary objective | A two-week itinerary for Japan |
| Expected outcomes | Day-by-day plan, budget, booking checklist |
| Constraints | April, ~€3,000, vegetarian |
| Resources | JR Pass? existing bookings? |
| Required expertise | Destinations, budgeting, transport logistics |
| Tools needed | Web search; no bookings without approval |
| Risks | Cherry-blossom crowds, price spikes |
| Success criteria | Fits budget; no more than 3 hotel changes; covers food interests |

## 3. Clarify only what matters
`bv team propose` returns domain-relevant `questions`. Ask a question only if the answer changes the plan
(dates and budget for a trip: yes; favourite colour: no). Batch them into **one** AskUserQuestion call (max 4)
or one short message. Everything else: make a reasonable assumption and list it under "Assumptions" in the
proposal.

## 4. Record it
Pass objective, success criteria, constraints, assumptions, and resources to `bv mission new` (step 3 of
SKILL.md). Add later discoveries with `bv mission update --constraint ...`.

## Small requests
If the request is simple enough to answer directly ("what's the capital of Japan?"), answer it and offer the
team only if a bigger mission is lurking. Don't spin up a squad for a one-liner.
