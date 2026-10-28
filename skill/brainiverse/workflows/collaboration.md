# Collaboration

Agents never talk to each other directly. They collaborate **through the orchestration layer**, which keeps
everything auditable and keeps context small.

## Patterns
- **Hand-off:** `--after T1` puts T1's findings, sources, and assumptions into the dependent agent's brief
  (truncated to stay small). Only dependencies are shared, never the whole mission.
- **Fan-out / fan-in:** several independent research tasks, then one synthesis task with
  `--after T1,T2,T3`.
- **Critique:** proposal task → Challenger task `--after` it → revise the original with the critique as
  feedback (`task revise T1 --feedback "<the challenger's key points>"`).
- **Review gate:** deliverable → Quality Reviewer task `--after` it → accept or revise.
- **Discussion:** when agents need to respond to *each other*, use a meeting (rounds of contributions with
  the shared transcript), not a chain of tasks.

## Conflicts
When agents disagree: compare their evidence. If the evidence decides it, decide and say why. If it doesn't,
either commission a targeted research task, or put both positions to the human (meeting or one question).
Record the outcome as a decision (`meeting decide`) or mission assumption. Disclose unresolved disagreements
in the final report.

## Memory suggestions
Agents may put durable facts in `memory_suggestions`. You decide whether to keep them:
`bv memory add "<fact>" --scope project|team:<id>|agent:<id>`. Don't store transient details, personal data
the mission doesn't need, or anything secret (the runtime refuses obvious secrets).
