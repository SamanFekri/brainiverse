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
   bv meeting start --objective "Choose the product direction" --with shirin,kaveh,jake
   ```
2. **Introduce** them to the human in one line each, as Name (Position) and why they're in the room:
   `bv meeting say M1 "I've invited Shirin (Researcher) for the market, Kaveh (Analyst) for feasibility, Jake (Creative Thinker) for concepts."`
3. **Gather (round 1).** Ask everyone in parallel:
   ```bash
   bv meeting ask M1 --agent shirin,kaveh,jake --prompt "What should we know before choosing a direction?"
   bv task start ready      # then one Agent call per agent_call, in a single message
   ```
   Each submission becomes that agent's message in the transcript.
4. **Respond to each other (round 2, optional).** Ask specific agents to react to the transcript:
   `bv meeting ask M1 --agent neda --prompt "Challenge Jake's top concept using Kaveh's numbers."`
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

> **Captain (Leader):** Let's explore this together. I've invited Shirin, Kaveh and Jake.
> **Shirin (Researcher):** *(their actual submitted findings, condensed only if long, never altered in meaning)*
> **Kaveh (Analyst):** …
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

The human can talk to any teammate at any time: a question about their work, a further request, or just
a chat ("Babak, why is Kyoto cheaper?", "Tyler, also add a logout button"). The Leader becomes a
silent relay.

```bash
bv ask babak "Why is Kyoto cheaper than Tokyo?"   # opens (or reuses) the direct line, starts a real invocation
# → invoke the returned agent_call with the Agent tool
bv ask babak "Also check ryokan prices, please."  # same line, same agent, full conversation history
bv chat show M2                                    # the transcript; M2 is the chat id ask returned
bv chat end M2                                     # when the human turns back to the Leader
```

What the agent gets each time: the conversation so far, a summary of its own earlier results in this
mission, and its normal tools and permissions. So:
- **Questions about earlier work** are answered from what it actually did.
- **Further requests** are done right away with its own tools; files, sources and verified actions are
  recorded like any task result. Anything beyond its permissions it says so, and you take it from there.

Rules:
- Pass the human's words **exactly**. Show the reply **verbatim** under the agent's label,
  `**Babak (Budget Analyst):** …`. No commentary, summarizing or correcting unless the human asks.
- Keep routing the human's messages to that agent until they turn back to you ("back to Captain",
  "thanks Babak", or addressing you). Then `bv chat end <chat>` and resume as Leader.
- If the conversation changes the mission (new constraint, a decision, new work), confirm with the human
  and record it (`mission update`, a task, or a decision).
- The Leader can't open a direct line with itself; the human already talks to the Leader.
- `bv chat start <agent> --topic "..."` / `bv chat say <chat> "..."` remain for explicit control.
