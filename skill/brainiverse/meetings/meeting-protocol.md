# Meetings (War Rooms) and direct lines

Meetings are structured discussions between the human, the Leader (host), and the agents who add value.
Every agent message in a meeting comes from a real invocation: there is no command for posting as an agent.

## When to hold one
Yes: important decisions · ambiguous requirements · strategies with real trade-offs · agents disagree ·
human preferences decide the outcome · milestone review.
No: routine tasks, anything one question to the human can settle.

## Workflow
1. **Prepare.** One-sentence objective. Choose 2–4 participants whose views actually differ or matter.
   ```bash
   bv meeting start --objective "Choose the product direction" --with lumen,quant,spark
   ```
2. **Introduce** them to the human in one line each (name, role, why they're in the room):
   `bv meeting say M1 "I've invited Lumen for the market, Quant for feasibility, Spark for concepts."`
3. **Gather (round 1).** Ask everyone in parallel:
   ```bash
   bv meeting ask M1 --agent lumen,quant,spark --prompt "What should we know before choosing a direction?"
   bv task start ready      # then one Agent call per agent_call, in a single message
   ```
   Each submission becomes that agent's message in the transcript.
4. **Respond to each other (round 2, optional).** Ask specific agents to react to the transcript:
   `bv meeting ask M1 --agent riddle --prompt "Challenge Spark's top concept using Quant's numbers."`
5. **Surface** disagreements and uncertainties in your own words (`meeting say`).
6. **Ask the human** focused questions (AskUserQuestion works well for 2–4 options). Record them and the
   answers:
   ```bash
   bv meeting question M1 "Which direction do you prefer: A, B or C?"
   bv meeting human M1 "B, but keep costs under 5k" --answers Q1
   ```
7. **Adapt and decide.** `bv meeting decide M1 "Go with B; budget cap 5k" --human-approved`
   and assumptions: `bv meeting assume M1 "Launch in Q2"`.
8. **Assign follow-ups** as real tasks: `bv meeting action M1 --agent forge --objective "..." --accept "..."`.
9. **End** with a summary of decisions, open issues, and next steps:
   `bv meeting end M1 --summary "..."`, then return to execution.

## Presenting a meeting to the human
Show the conversation like a team discussion, not a pile of reports:

> **Captain:** Let's explore this together. I've invited Lumen, Quant and Spark.
> **Lumen:** *(their actual submitted findings, condensed only if long, never altered in meaning)*
> **Quant:** …
> **Captain:** So we have three directions… Which do you prefer?

`bv meeting show M1` gives the transcript. Quote agents faithfully; if you shorten, keep their meaning and
say "(condensed)".

## Controls
| Human says | Command |
|---|---|
| "pause / hold on" | `meeting pause M1` (human input is still recorded) |
| "continue" | `meeting resume M1` |
| "bring in X" / "X can leave" | `meeting add M1 x` / `meeting remove M1 x` |
| "X, what do you think about…" | `meeting ask M1 --agent x --prompt "..."` |
| "X, challenge Y's proposal" | `meeting ask M1 --agent x --prompt "Challenge Y's proposal: ..."` |
| "summarize" | summarize from `meeting show M1` |
| "let's go with…" / "no" | `meeting decide ... --human-approved` / record the rejection with `meeting human` |
| "make that a task" | `meeting action ...` |
| "back to work" | `meeting end M1 --summary "..."` |

## State
Stored on the mission: id, mode, objective, participants, status, messages (each agent message linked to its
task and invocation), human answers, decisions, assumptions, open questions, action items, summary. Agents in
later meetings get only that meeting's transcript, not other meetings.

---

## Direct line: the human talks to one agent

The human may want to skip the Leader and talk to one teammate ("let me ask Penny directly"). The Leader
becomes a silent relay.

```bash
bv chat start penny --topic "budget questions"           # → {"chat": "M2"}
bv chat say M2 "Can we afford a ryokan night in Kyoto?"  # records the human's words, starts a task
# → invoke the returned agent_call with the Agent tool
bv chat show M2                                          # the transcript including Penny's real reply
```
Rules:
- Pass the human's words **exactly** to `chat say`. Show the agent's reply **verbatim**, prefixed with the
  agent's name (`**Penny:** …`). No commentary, no summarizing, no correcting, unless the human asks you.
- Each message is a real invocation with the conversation so far, so the agent remembers the thread.
- The agent keeps its normal tools and permissions. If the human asks it to do work it can't, it says so.
- While the line is open, treat the human's messages as addressed to the agent until they say e.g. "back to
  Captain", "end chat", or address you by name. Then `bv chat end M2` and resume as Leader.
- If something said in the chat changes the mission (new constraint, decision), confirm with the human
  after the chat and record it (`mission update`, or a task).
- The Leader can't open a direct line with itself; the human already talks to the Leader.
