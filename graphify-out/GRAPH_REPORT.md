# Graph Report - .  (2026-10-28)

## Corpus Check
- Corpus is ~36,519 words - fits in a single context window. You may not need a graph.

## Summary
- 448 nodes · 878 edges · 25 communities
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 102 edges (avg confidence: 0.88)
- Token cost: 125,517 input · 0 output

## Community Hubs (Navigation)
- Skill Concept & Agent Roles
- Agent Registry
- Meeting Engine
- CLI & Argument Parsing
- Evaluation & CLI Tests
- Orchestration Engine
- npm Package Manifest
- Workspace Storage
- Agent Briefs & Tool Adapters
- Memory & Audit Log
- Skill Discovery Runtime
- Customization & Permissions
- npx Installer
- Orchestration Workflow
- Collaboration & War Rooms
- Mission Intake & Team Creation
- Discovery Crew Roster
- CLI Reference Docs
- Limitations & Roadmap
- Travel Squad Roster
- Skill Discovery Workflow
- Example Workflows
- App Builders Roster
- Direct Line & Leader Session
- Memory Scopes

## God Nodes (most connected - your core abstractions)
1. `Brainiverse Architecture` - 28 edges
2. `Workspace` - 22 edges
3. `now()` - 19 edges
4. `post()` - 16 edges
5. `checkSlug()` - 15 edges
6. `nextId()` - 15 edges
7. `getMeeting()` - 14 edges
8. `readJson()` - 14 edges
9. `Result Protocol (status, findings, evidence, assumptions, uncertainty, ...)` - 13 edges
10. `CLI Reference` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Ground Rules (real work only, label everything, human approval, smallest team, data not instructions)` --semantically_similar_to--> `Human Approval Control`  [INFERRED] [semantically similar]
  skill/brainiverse/SKILL.md → README.md
- `Honest Output Labels (verified/proposed/assumed)` --semantically_similar_to--> `Proposals, Not Facts`  [INFERRED] [semantically similar]
  README.md → skill/brainiverse/docs/architecture.md
- `Two-Layer Design (Markdown behaviour + Node runtime)` --rationale_for--> `Brainiverse`  [INFERRED]
  skill/brainiverse/docs/architecture.md → README.md
- `Captain (Leader)` --references--> `Leader / Strategist`  [INFERRED]
  README.md → skill/brainiverse/agents/leader.md
- `Ten Agent Archetypes` --references--> `Creative Thinker / Innovator`  [INFERRED]
  README.md → skill/brainiverse/agents/creative-thinker.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Ten Agent Archetypes sharing the result protocol** — skill_brainiverse_agents_analyst_analyst, skill_brainiverse_agents_challenger_challenger, skill_brainiverse_agents_communicator_communicator, skill_brainiverse_agents_creative_thinker_creative_thinker, skill_brainiverse_agents_executor_executor, skill_brainiverse_agents_leader_leader, skill_brainiverse_agents_organizer_organizer, skill_brainiverse_agents_quality_reviewer_quality_reviewer, skill_brainiverse_agents_researcher_researcher, skill_brainiverse_agents_specialist_specialist [EXTRACTED 1.00]
- **Runtime trust enforcement (permissions, approvals, audit, identity!=authority)** — skill_brainiverse_docs_architecture_permission_manager, skill_brainiverse_docs_architecture_audit_logging, skill_brainiverse_docs_architecture_identity_not_authority, skill_brainiverse_docs_architecture_agents_submit_own_results, readme_human_approval_control [INFERRED 0.85]
- **Delegation cycle: start ready -> brief -> subagent -> submit -> accept** — skill_brainiverse_skill_plan_delegate_loop, skill_brainiverse_docs_architecture_orchestration_engine, skill_brainiverse_docs_architecture_agent_briefs, skill_brainiverse_docs_architecture_agents_fetch_own_brief, skill_brainiverse_docs_architecture_result_protocol, skill_brainiverse_docs_architecture_proposals_not_facts [INFERRED 0.85]
- **Gated capability approval flow** — skill_brainiverse_docs_customization_gated_capabilities, skill_brainiverse_docs_customization_human_approval, skill_brainiverse_docs_cli_approval_commands, skill_brainiverse_docs_cli_agent_commands, skill_brainiverse_workflows_skill_discovery_approve_install_verify, skill_brainiverse_teams_travel_squad_no_booking_without_approval [INFERRED 0.85]
- **Built-in team templates** — skill_brainiverse_teams_app_builders_template, skill_brainiverse_teams_discovery_crew_template, skill_brainiverse_teams_travel_squad_template, skill_brainiverse_docs_customization_templates_dir [INFERRED 0.85]
- **Agent collaboration patterns via orchestration** — skill_brainiverse_workflows_collaboration_hand_off, skill_brainiverse_workflows_collaboration_fan_out_fan_in, skill_brainiverse_workflows_collaboration_critique, skill_brainiverse_workflows_collaboration_review_gate, skill_brainiverse_workflows_collaboration_discussion, skill_brainiverse_workflows_collaboration_orchestration_layer_mediation [EXTRACTED 1.00]

## Communities (25 total, 0 thin omitted)

### Community 0 - "Skill Concept & Agent Roles"
Cohesion: 0.07
Nodes (60): Brainiverse, Captain (Leader), Direct Line, Honest Output Labels (verified/proposed/assumed), Human Approval Control, npx brainiverse installer (install/uninstall/doctor), Skill Discovery, Team Templates (Travel Squad, App Builders, Discovery Crew) (+52 more)

### Community 1 - "Agent Registry"
Cohesion: 0.08
Nodes (46): archetypes(), clone(), DEFAULT_LIMITS, duplicate(), edit(), grant(), IDENTITY_FIELDS, identityFor() (+38 more)

### Community 2 - "Meeting Engine"
Cohesion: 0.15
Nodes (29): action(), addParticipant(), ask(), assume(), decide(), directMessage(), findItem(), getMeeting() (+21 more)

### Community 3 - "CLI & Argument Parsing"
Cohesion: 0.09
Nodes (17): lines, HelpRequested, key(), parse(), usage(), addToTeamOrLibrary(), AGENT_ALLOWED, handlers (+9 more)

### Community 4 - "Evaluation & CLI Tests"
Cohesion: 0.14
Nodes (12): VERDICTS, setup(), startReady(), cli, cliAsync(), missionState(), result(), ROOT (+4 more)

### Community 5 - "Orchestration Engine"
Cohesion: 0.15
Nodes (24): accept(), addTask(), cancel(), checkPermissions(), createsCycle(), DEFAULT_LIMITS, depthOf(), fail() (+16 more)

### Community 6 - "npm Package Manifest"
Cohesion: 0.09
Nodes (23): author, bin, brainiverse, description, engines, node, files, keywords (+15 more)

### Community 7 - "Workspace Storage"
Cohesion: 0.23
Nodes (4): readJson(), sleepSync(), Workspace, writeJson()

### Community 8 - "Agent Briefs & Tool Adapters"
Cohesion: 0.12
Nodes (15): agentCall(), agentCommand(), BIN, build(), bullets(), RESULT_TEMPLATE, shellQuote(), SKILL_DIR (+7 more)

### Community 9 - "Memory & Audit Log"
Cohesion: 0.24
Nodes (15): clean(), log(), add(), contextFor(), edit(), findSecrets(), list(), loadScope() (+7 more)

### Community 10 - "Skill Discovery Runtime"
Cohesion: 0.20
Nodes (12): addGap(), approve(), candidate(), localInventory(), parseFrontmatter(), recordScan(), reject(), scan() (+4 more)

### Community 11 - "Customization & Permissions"
Cohesion: 0.18
Nodes (14): agent command group, approval command group, Customization Guide, Agent Library, Agent Profile, Agent Rename (identity only), Capabilities (risk-tiered permissions), Gated Capabilities (+6 more)

### Community 12 - "npx Installer"
Cohesion: 0.29
Nodes (9): [command, ...rest], doctor(), flags, install(), installedVersion(), PACKAGE_DIR, SKILL_SOURCE, target() (+1 more)

### Community 13 - "Orchestration Workflow"
Cohesion: 0.20
Nodes (10): BRAINIVERSE_HOME / .brainiverse workspace, review command, Local JSON State, Hand-off Pattern, Review Gate Pattern, Orchestration Workflow, Mission Limits, Status Board and Metrics (+2 more)

### Community 14 - "Collaboration & War Rooms"
Cohesion: 0.25
Nodes (9): meeting command group, Meeting State, War Room Meeting, Collaboration Workflow, Conflict Resolution, Critique Pattern, Discussion Pattern, Fan-out / Fan-in Pattern (+1 more)

### Community 15 - "Mission Intake & Team Creation"
Cohesion: 0.22
Nodes (9): mission command group, Mission Intake Workflow, Clarify Only What Matters, Mission Extraction Checklist, Small Requests Rule, Team Creation Workflow, Present Roster Table, Refine Roster With Judgment (+1 more)

### Community 16 - "Discovery Crew Roster"
Cohesion: 0.22
Nodes (9): Guardian, Auditor, Brain, Captain (Leader), Sherlock, Skeptic, Spark, Discovery Crew template (+1 more)

### Community 17 - "CLI Reference Docs"
Cohesion: 0.25
Nodes (8): CLI Reference, scripts/gen-cli-docs.mjs, runtime/cli.mjs, task command group, team command group, runtime/data/domains.json, task start ready / agent_calls, team propose (draft)

### Community 18 - "Limitations & Roadmap"
Cohesion: 0.32
Nodes (8): Known Limitations, BRAINIVERSE_AGENT convention, team export-claude-agents (planned), Future Improvements, Keyword-based Team Proposal, PreToolUse capability-check hook (planned), TOOL_ADAPTERS / MODEL_ADAPTERS, Two-Level Permission Enforcement

### Community 19 - "Travel Squad Roster"
Cohesion: 0.25
Nodes (8): Lumen, Captain (Leader), Logistics Expert, Lumen, Navigator, Penny, Scout, Travel Squad template

### Community 20 - "Skill Discovery Workflow"
Cohesion: 0.33
Nodes (7): skill command group, Skill Discovery Workflow, Capability Gap, External Skill Search (skills.sh, GitHub, marketplaces), Look Locally First, Recommend Max 3, Static Skill Security Scan

### Community 21 - "Example Workflows"
Cohesion: 0.33
Nodes (6): Example Workflows, test/e2e.test.mjs, App Builders Team, Discovery Crew Team, Travel Squad Team, No Bookings Without spend_money Approval

### Community 22 - "App Builders Roster"
Cohesion: 0.33
Nodes (6): Architect, Captain (Leader), Coder, Designer, Detective, App Builders template

### Community 23 - "Direct Line & Leader Session"
Cohesion: 0.50
Nodes (4): chat command group, Leader Is the Main Session, Meeting Protocol (War Rooms), Direct Line Chat

### Community 24 - "Memory Scopes"
Cohesion: 0.67
Nodes (3): memory command group, Memory Scopes (project/team/agent), memory_suggestions

## Ambiguous Edges - Review These
- `Local JSON State` → `Mission Limits`  [AMBIGUOUS]
  skill/brainiverse/docs/limitations.md · relation: conceptually_related_to

## Knowledge Gaps
- **83 isolated node(s):** `PACKAGE_DIR`, `SKILL_SOURCE`, `[command, ...rest]`, `flags`, `name` (+78 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Local JSON State` and `Mission Limits`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `Workspace` connect `Workspace Storage` to `Agent Registry`, `CLI & Argument Parsing`, `Evaluation & CLI Tests`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `CLI Reference` connect `CLI Reference Docs` to `Customization & Permissions`, `Orchestration Workflow`, `Collaboration & War Rooms`, `Mission Intake & Team Creation`, `Skill Discovery Workflow`, `Direct Line & Leader Session`, `Memory Scopes`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `Customization Guide` connect `Customization & Permissions` to `Memory Scopes`, `CLI Reference Docs`, `Mission Intake & Team Creation`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `PACKAGE_DIR`, `SKILL_SOURCE`, `[command, ...rest]` to the rest of the system?**
  _83 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Skill Concept & Agent Roles` be split into smaller, more focused modules?**
  _Cohesion score 0.07062146892655367 - nodes in this community are weakly interconnected._
- **Should `Agent Registry` be split into smaller, more focused modules?**
  _Cohesion score 0.07581453634085213 - nodes in this community are weakly interconnected._