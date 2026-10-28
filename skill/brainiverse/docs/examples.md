# Example workflows

These show the Leader's command sequence. Each "Agent ×N" step is one message containing N Agent-tool
calls built from the `agent_call`s returned by `task start`. The automated end-to-end tests in `test/e2e.test.mjs`
run these same flows, with scripted submissions standing in for the subagents.

## 1. Travel: "Plan a two-week trip to Japan"
```bash
bv init
bv team propose "Plan a two-week trip to Japan in April, about 3000 euros, I love food and temples"
# Show the roster; ask only the missing questions (pace? travelling solo?). The user renames Lumen → Sherlock.
bv agent rename lumen --team <team> --name Sherlock
bv team approve <team>
bv mission new --team <team> --goal "14-day Japan itinerary, April, ~€3000" \
  --success "Day-by-day plan" --success "Within budget" --constraint "Vegetarian-friendly"
bv task add --agent lumen --objective "Shortlist regions for 14 days in April" --accept "2+ sources per region"
bv task add --agent penny --objective "Daily cost ranges per region" --accept "low/expected/high"
bv task start ready                       # Agent ×2, parallel
bv task accept T1 --evidence "sources checked"; bv task accept T2 --evidence "ranges present"
bv meeting start --objective "Pick the route" --with lumen,penny
bv meeting ask M1 --agent lumen,penny --prompt "Which 3-region route fits best and why?"
bv task start ready                       # Agent ×2 → contributions appear in the transcript
bv meeting question M1 "Kyoto-heavy or Tokyo-heavy?"   # AskUserQuestion → answer:
bv meeting human M1 "Kyoto-heavy" --answers Q1
bv meeting decide M1 "Tokyo 4 / Kyoto 6 / Osaka 4" --human-approved
bv meeting action M1 --agent navigator --objective "Day-by-day itinerary for the chosen route" --accept "fits budget"
bv meeting end M1 --summary "Route chosen; itinerary assigned to Navigator"
bv task start ready                       # Agent ×1
bv task add --agent sentinel --objective "Audit the itinerary against the success criteria" --after T5
bv task start ready ; bv review T5 --verdict pass --evidence "..." --reviewer sentinel
bv mission finalize --file /path/synthesis.md ; bv mission report
bv team save @mission --as my-travel-squad
```
Midway, the user says "let me ask Penny directly": `bv chat start penny` → `bv chat say M2 "..."` → Agent ×1
→ show Penny's reply verbatim → `bv chat end M2`.

## 2. Software: "Build a small web app"
```bash
bv team from-template app-builders --id todo-app
bv team approve todo-app
bv mission new --team todo-app --goal "Todo web app with login, SQLite, deployable" --success "tests pass"
bv task add --agent architect --objective "Propose architecture and file layout" --accept "fits the stack"
bv task start ready                       # Agent ×1
bv task accept T1 --evidence "reviewed against requirements"
bv task add --agent coder --objective "Implement auth" --after T1 --needs file_write,code_exec --accept "tests for login pass"
bv task add --agent designer --objective "Design the main screens" --after T1
bv task start ready                       # Agent ×2, parallel
bv task add --agent guardian --objective "Review and run the tests" --after T2 --accept "test output attached"
bv task start ready
# Guardian found a failing test → revise
bv task revise T2 --feedback "login test fails on empty password; see Guardian's evidence"
bv task start ready                       # Coder again, brief includes the feedback
# Deploying needs two approvals: the capability itself, and this specific use of it.
# (One AskUserQuestion can cover both; record each answer.)
bv agent enable devops --team @mission
bv approval request --capability external_api --agent devops --detail "Give DevOps deploy access"
bv approval resolve A1 approve --note "User: 'yes, DevOps can deploy'"
bv agent grant devops external_api --team @mission --approval A1
bv task add --agent devops --objective "Deploy v1 to Fly.io" --needs external_api --accept "health check URL responds"
bv approval request --capability external_api --agent devops --task T6 --detail "Deploy v1 to Fly.io now"
bv approval resolve A2 approve --note "User: 'go ahead'"
bv task attach-approval T6 A2
bv task start T6
```

## 3. Open-ended research: "Is this business idea worth pursuing?"
```bash
bv team from-template discovery-crew --id idea
bv mission new --team idea --goal "Should I start a subscription service for indoor plants?"
bv task add --agent sherlock --objective "Market size and competitors" --accept "sources for every figure"
bv task add --agent lumen --objective "Relevant trends 2024-2026"
bv task start ready                        # Agent ×2
bv task add --agent spark --objective "3 distinct business concepts" --after T1,T2
bv task add --agent brain --objective "Unit economics for each concept" --after T3 --accept "assumptions explicit"
bv task add --agent skeptic --objective "Challenge the strongest concept" --after T4
# ...start/accept each wave...
bv meeting start --objective "Decide whether to pursue" --with brain,skeptic,spark
# rounds, human questions, decision
bv task add --agent auditor --objective "Audit the recommendation and its sources" --after T5
bv metrics
```

## Skill discovery inside a mission
```bash
bv skill gap "slides" "Turn the recommendation into a deck"
bv skill local deck slides                 # anything installed already?
# Researcher task: search `npx skills find slides`, skills.sh, GitHub; report only real results
bv skill candidate --name <real> --source skills.sh --url <real url> --purpose "..." --agent echo --gap G1 --install "<documented command>"
bv skill scan <cloned dir> --candidate S1
bv skill recommend
bv approval request --kind skill_install --skill S1 --detail "Install <name> for Echo"
bv approval resolve A1 approve --note "User: 'yes'"
bv skill approve S1 --approval A1
# run the documented install command, then:
bv skill verify S1 --path ~/.claude/skills/<name>
```
