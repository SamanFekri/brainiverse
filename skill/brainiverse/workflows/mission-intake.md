# Mission intake and the kickoff interview

Goal: before anyone works, the human and the team agree on what "great" looks like. Asking ten good questions
up front is cheaper than redoing a plan built on wrong guesses.

## 1. Route the request
`bv intake "<request>"` → `mode` (ask / answer / continue_project / new_project / quick_team) plus `kickoff`.
If the purpose is unknown, ask naturally: *"Hey! What do you want your team to help you accomplish? Tell me your
mission, and I'll assemble the right crew."* Never make the human repeat what they already said.

## 2. Run the kickoff interview
`kickoff` gives you:
- `rounds`: choice questions grouped for AskUserQuestion (up to 4 per call, 2-4 options each; `multi` →
  `multiSelect: true`). The human can always pick "Other" and type.
- `free_text`: open questions (features, must-haves, target customer…). Ask them in one short message.
- `already_answered`: things the request already settled. Don't ask them.
- `follow_ups` on some questions: extra questions triggered by a specific answer.

It's a **starting checklist, not a script**:
1. Ask a round. Read the answers.
2. Ask the follow-ups those answers trigger, e.g. for a trip:
   - Transport "own car" → licence, automatic, tolls, parking
   - "Planes" → direct flights, luggage
   - Travellers "family with kids" → kids' ages
   - Booking "with my approval" → how payment works
3. Add questions this mission needs that no list could know. For example: "You mentioned your dog: is it
   coming?", or "Which city do you fly from?".
4. Drop questions that no longer apply (driving only → no rail preferences).
5. Repeat until nothing important is unclear. There's no fixed number of rounds: a weekend trip may need one,
   a new app several.

Good kickoff topics for any mission: the result's format, deadline, budget, how involved the human wants to
be, must-haves and things to avoid, what success looks like.

## 3. Confirm the picture
Write a compact summary, *"Here's what I understood: …"*, and put it in the same message as the team
proposal, so one OK confirms both. If they correct something, update and continue; don't re-ask everything.

## 4. Record it
- Mission facts → `bv mission new … --constraint "…" --success "…" --assumption "…"` (later:
  `bv mission update`).
- Durable preferences (vegetarian, prefers trains, TypeScript only) → `bv memory add "…" --scope project`
  or `--scope team:<id>` for a project team.

## Small requests
A request simple enough to answer directly gets an answer, not an interview.
