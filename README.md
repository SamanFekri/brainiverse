<p align="center">
  <img src="assets/brainiverse-intro.svg" alt="Brainiverse: the right minds for every mission" width="880">
</p>

<p align="center">
  <img src="assets/brainiverse.svg" alt="" width="20" align="center">
  &nbsp;<strong>A team of AI agents in your terminal, assembled for whatever you're trying to do.</strong>
</p>

<p align="center">
  <img alt="Claude Code skill" src="https://img.shields.io/badge/Claude%20Code-skill-5b21b6">
  <img alt="Node 18.17+" src="https://img.shields.io/badge/node-%E2%89%A518.17-312e81">
  <img alt="Zero dependencies" src="https://img.shields.io/badge/dependencies-0-1e1b4b">
  <img alt="MIT license" src="https://img.shields.io/badge/license-MIT-f59e0b">
</p>

---

You tell **Captain** what you want to get done. Captain picks a squad that fits: a researcher, a budget
analyst, an architect, a skeptic, whoever the job actually needs. The squad works **in parallel**. When a
real decision comes up, Captain calls everyone into a **war room** with you. Before anything reaches you, a
reviewer checks it.

```bash
npx brainiverse install
```
Open Claude Code, type `/brainiverse`, and describe your mission.

---

## Why we built this

A single AI assistant is a brilliant generalist working alone. Ask it to plan a trip, launch an app or
pressure-test a business idea, and it does the research, the maths, the building and the fact-checking
in one stream of thought. There's nobody to disagree with it and nobody to check its work.

Human teams don't work that way. Good ones split the work, argue about it, and have someone check it before
it goes out. We wanted that structure for everyday problems, without the usual multi-agent compromises:

- **No fake teams.** Many "multi-agent" demos are one model playing every role in a single prompt. In
  Brainiverse each agent is a real, separate Claude Code subagent with its own brief, tools and output.
- **No single-purpose rigs.** Most agent setups are hard-wired for one job, usually coding. Here the same
  machinery runs a travel plan, a codebase or a market study. Only the team changes.
- **No confident fiction.** Agents aren't allowed to claim they did something they didn't. Results are
  labelled *verified*, *proposed* or *assumed*, and the runtime keeps the receipts.
- **No loss of control.** Spending money, sending messages, deleting data, pushing code and installing
  anything all need your explicit OK, each time.

The result: the right minds for every mission, with you still in charge.

## What it feels like

```text
You      I want to plan two weeks in Japan in April, around €3,000. I love food and temples.

Captain  Here's the squad I'd put on this:
           🛡️ Captain     Leader            your point of contact
           🔭 Lumen       Researcher        regions, cherry-blossom timing, advisories
           📊 Penny       Budget analyst    real costs per option
           🧭 Navigator   Itinerary expert  the day-by-day plan
           🧭 Logistics   Specialist        rail passes, transfers, entry rules
           🎯 Sentinel    Quality reviewer  checks facts and the budget before you see anything
         One question first: relaxed pace, or pack it in?

You      Relaxed. And rename Lumen to Sherlock.

Captain  Done. Sherlock and Penny are working in parallel now…

         ⚔️ War Room: there are two good routes. Sherlock, Penny, you're up.
Sherlock Kyoto-heavy gives you the temples and the best blossom odds (sources attached).
Penny    It's also €340 cheaper if you skip one bullet-train leg.
Captain  Kyoto-heavy or Tokyo-heavy?

You      Kyoto. Actually, let me ask Penny something directly.

Penny    (direct line) Sure, what do you want to know?
```

Every line from Sherlock and Penny above comes from an actual agent run. Captain can't invent their
words: the runtime only accepts a contribution if it's tied to a real invocation.

## How it works

```
 You ⇄ Captain  ── the main Claude Code session, guided by SKILL.md
          │
          │  1. understands the mission, proposes a team, gets your OK
          │  2. breaks the goal into tasks with owners, dependencies and acceptance criteria
          │  3. "brainiverse task start ready" → one Agent-tool call per runnable task
          ▼
   ┌───────────┬───────────┬───────────┐
   │ Sherlock  │  Penny    │ Navigator │  real subagents, running in parallel
   └─────┬─────┴─────┬─────┴─────┬─────┘  each fetches its brief → works → submits a result
         ▼           ▼           ▼
   ┌─────────────────────────────────────┐
   │  Brainiverse runtime (Node, 0 deps) │  tasks · limits · permissions · approvals
   │  .brainiverse/ in your project      │  meetings · memory · audit log
   └─────────────────────────────────────┘
          │
          ▼
   4. Captain reviews each result: accept, or send it back with feedback
   5. War rooms when a decision needs you · direct lines when you want one agent
   6. Sentinel audits the final deliverable → Captain hands you a debrief
```

There are two layers:

1. **Behaviour, in Markdown.** [`SKILL.md`](skill/brainiverse/SKILL.md) is Captain's playbook. Role files in
   [`agents/`](skill/brainiverse/agents) tell each agent how to do its job; [`workflows/`](skill/brainiverse/workflows)
   and [`meetings/`](skill/brainiverse/meetings) cover intake, delegation, collaboration and war rooms. They're
   loaded only when needed, so the context stays small.
2. **Rules, in code.** A small Node runtime holds what must not depend on the model remembering it: the task
   graph, who may do what, limits, approvals and the audit trail. The model decides *what* to do; the runtime
   makes sure it's done *honestly*.

### Teams are built for your mission

Teams aren't picked from a fixed list. `team propose` reads your request and works out which capabilities it
needs: research, ideas, analysis, building, risk, communication, organizing, review. It adds specialists for
the domain (travel, software, business, science, learning, productivity, data, marketing, creative work) and
caps the size so you get **the smallest team that can do the job**. Each agent comes with a one-line reason
for being there. Captain then refines the roster, and you can change anything.

The ten building blocks: **Leader · Researcher · Creative Thinker · Analyst · Executor · Challenger ·
Specialist · Communicator · Organizer · Quality Reviewer**. Three ready-made templates (Travel Squad, App
Builders, Discovery Crew) are optional shortcuts.

### What keeps the agents honest

| Without guardrails, an agent could… | In Brainiverse |
|---|---|
| say "deployed ✅" after writing a script | Any action marked *verified* must include evidence, or the result is rejected |
| speak for another agent in a meeting | Meeting messages come only from real invocations, linked by id |
| approve its own request, or grant itself access | Agents can run only "read my brief" and "submit my result". Approvals are the human's, quoted in the log |
| loop forever or spawn endlessly | Limits on concurrency, invocations, retries, timeouts, revision rounds and delegation depth |
| change permissions by being renamed or imported | Identity is separate from authority, and imported agents never bring risky capabilities |
| follow instructions hidden in a web page or a downloaded skill | Outside content is treated as data. Downloaded skills are scanned and need your approval |
| leak an API key into memory or logs | Anything that looks like a secret is refused in memory and redacted in the audit log |

## Things you can do

- 🎯 **Describe a mission in plain words.** No setup and no agent jargon. Captain only asks questions whose
  answers change the plan.
- 🧩 **Customize everything.** Rename agents, change personalities, instructions, expertise or model tier, add
  specialists, pick a different leader. Use the original `heroes` theme or switch to plain professional
  names and terminology.
- ⚡ **Parallel work with hand-offs.** Independent tasks run at the same time, and each agent automatically
  receives the results it depends on.
- ⚔️ **War rooms.** Agents present, respond to each other, and challenge each other's proposals. You
  decide, and the conclusions become tasks.
- ☎️ **Direct line.** Talk one-on-one with any agent. Captain relays the replies word for word.
- 🧭 **Skill discovery.** When the team hits a real gap, it looks for existing skills, scans them for risky
  patterns, recommends at most three, and installs only with your approval.
- 💾 **Memory and reuse.** Save teams and agents, export or import them as JSON, and keep project, team and
  agent memories that you can inspect, edit or delete.
- 📋 **Debriefs.** Every mission ends with a report: accepted deliverables, decisions, assumptions,
  unresolved issues, reviews and metrics (including which agents were never needed).

## Install

You need Node.js 18.17 or newer and Claude Code.

```bash
npx brainiverse install            # for you: ~/.claude/skills/brainiverse
npx brainiverse install --project  # just this repo: ./.claude/skills/brainiverse
npx brainiverse doctor             # check the install
npx brainiverse uninstall          # remove it (your mission data stays)
```

Start a new Claude Code session, then type `/brainiverse`, or just say *"get me a team to…"*. Mission state
lives in `.brainiverse/` in your project, so add it to `.gitignore`.

## A taste of the controls

You'll mostly just talk to Captain, who runs these for you. They're also there if you want to drive directly:

```bash
brainiverse team propose "Build and launch a web app with user login"
brainiverse agent rename lumen --team @mission --name Sherlock --personality "Deductive, dry-witted"
brainiverse meeting start --objective "Pick the route" --with lumen,penny
brainiverse chat start penny
brainiverse status
brainiverse mission report
```

Full reference: [docs/cli.md](skill/brainiverse/docs/cli.md).

## Honest limits

- Captain is your main Claude Code session, not a separate process. Subagents can't talk to you directly or
  spawn their own agents.
- The runtime strictly enforces its own records (approvals, limits, who may submit what). Which tools a
  subagent actually calls during its turn is guided by its brief and Claude Code's permission prompts, not
  sandboxed per agent yet.
- `team propose` starts from keyword and domain matching. That makes it predictable, and Captain refines it
  with judgment.

More in [docs/limitations.md](skill/brainiverse/docs/limitations.md), including what's planned next.

## Repository layout

```
assets/                     icon and animated banner
bin/brainiverse.mjs         npx entry: install / uninstall / doctor (other commands go to the runtime)
skill/brainiverse/          the skill exactly as it's installed
  SKILL.md                  Captain's playbook (always loaded)
  agents/                   the 10 archetype role files (each subagent reads its own)
  workflows/ meetings/      intake, team creation, orchestration, collaboration, skills, war rooms
  teams/                    notes on the 3 optional templates
  docs/                     architecture, customization, CLI reference, examples, limitations
  runtime/                  orchestration, registry, team builder, meetings, permissions, memory, audit
test/                       64 tests: unit, CLI, end-to-end (travel, software, research), installer
```

## Development

```bash
npm test                                   # node:test, no dependencies
node skill/brainiverse/bin/brainiverse.mjs --help
node scripts/gen-cli-docs.mjs              # regenerate the CLI reference after changing commands
npm pack --dry-run                         # see what gets published
```

**Read more:** [Architecture](skill/brainiverse/docs/architecture.md) ·
[Customization](skill/brainiverse/docs/customization.md) · [Examples](skill/brainiverse/docs/examples.md)

## License

MIT. Assemble responsibly. 🛡️
