# App Builders

`brainiverse team from-template app-builders [--id <name>]`

Builds software: requirements, design, implementation, testing, review, deployment.

| Agent (default names) | heroes theme | id | Role |
|---|---|---|---|
| Captain (Leader) | Captain | `leader` | Leads the project. |
| Arash (Architect) | Architect | `architect` | Designs the architecture. |
| Tyler (Coder) | Coder | `coder` | Implements features. |
| Grace (Debugger) | Detective | `debugger` | Investigates bugs. |
| Yasmin (Designer) | Designer | `designer` | User experience specialist. |
| Parisa (Quality & Security Reviewer) | Guardian | `reviewer` | Quality and security reviewer. |
| Jason (DevOps Engineer) | DevOps | `devops` | Infrastructure specialist. *(starts disabled)* |

## Workflow
1. Clarify requirements
2. Design the architecture
3. Implement
4. Test and debug
5. Review quality and security
6. Deploy (only with approval)
7. Report actual results

Best used as a **project team**: `project adopt` writes each agent to `.claude/agents/` and the team stays with the repo.

DevOps starts disabled: `agent enable devops --team @project` when deployment is near. Pushing or deploying needs `repo_push`/`external_api` plus an approval for that action.
