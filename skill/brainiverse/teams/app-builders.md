# App Builders

`bv team from-template app-builders [--id <name>]`

| Agent | Archetype | Focus |
|---|---|---|
| Captain | Leader | Leads the project |
| Architect | Specialist | System design, technology selection |
| Coder | Executor | Implements features |
| Detective | Analyst | Debugging, root-cause analysis |
| Designer | Creative Thinker | UX, interaction design, accessibility |
| Guardian | Quality Reviewer | Code review, security, tests |
| DevOps Engineer | Executor | CI/CD and deployment (**disabled** until needed) |

## Workflow
1. **Requirements** — users, core use case, platform, existing code, constraints. Inspect the repo first if
   one exists and follow its conventions.
2. **Design** — Architect proposes architecture; Designer the key flows. Meeting if there are real trade-offs.
3. **Implement** — Coder, in small tasks with testable acceptance criteria.
4. **Test and debug** — Guardian runs tests; Detective investigates failures.
5. **Review** — Guardian reviews quality and security against the requirements.
6. **Deploy** — enable DevOps (`bv agent enable devops --team @mission`) only when needed. Pushing or deploying
   needs `repo_push`/`external_api` plus an approval for that action.
7. **Report actual results** — what was built, what tests passed (with output), what's left.
