# CLI reference

Generated from `runtime/cli.mjs` — `node scripts/gen-cli-docs.mjs` regenerates it.
Every command also accepts `--home <dir>` (default `$BRAINIVERSE_HOME` or `./.brainiverse`) and `--help`.
`-m/--mission` defaults to the active mission.

### `brainiverse init`
create the workspace

- `--theme <value>`
- `--terminology <value>` — themed | professional

### `brainiverse config [key] [value]`
show or set theme / terminology / host

### `brainiverse archetypes`
list the ten archetypes

### `brainiverse themes`
list identity themes

### `brainiverse capabilities`
list capabilities, their risk, and host tools

## agent

create and customize agents

### `brainiverse agent list`
list agents (library, or --team)

- `--mission <value>` — mission id (default: the active mission)
- `--team <value>` — team id, or @mission for the active mission's team (default: the agent library)

### `brainiverse agent new`
create an agent

- `--mission <value>` — mission id (default: the active mission)
- `--team <value>` — team id, or @mission for the active mission's team (default: the agent library)
- `--archetype <value>` — required
- `--id <value>`
- `--name <value>`
- `--position <value>` — shown in brackets, e.g. Budget Analyst
- `--set <value>` — field=value (lists: a;b;c); repeatable

### `brainiverse agent import <path>`
import an agent JSON file (gated capabilities are stripped)

- `--mission <value>` — mission id (default: the active mission)
- `--team <value>` — team id, or @mission for the active mission's team (default: the agent library)

### `brainiverse agent show <agent_id>`
show a profile

- `--mission <value>` — mission id (default: the active mission)
- `--team <value>` — team id, or @mission for the active mission's team (default: the agent library)

### `brainiverse agent edit <agent_id>`
edit fields

- `--mission <value>` — mission id (default: the active mission)
- `--team <value>` — team id, or @mission for the active mission's team (default: the agent library)
- `--set <value>` — repeatable
- `--add <value>` — repeatable
- `--remove <value>` — repeatable

### `brainiverse agent rename <agent_id>`
change identity only

- `--mission <value>` — mission id (default: the active mission)
- `--team <value>` — team id, or @mission for the active mission's team (default: the agent library)
- `--name <value>`
- `--personality <value>`
- `--style <value>`
- `--avatar <value>`

### `brainiverse agent enable <agent_id>`
enable an agent

- `--mission <value>` — mission id (default: the active mission)
- `--team <value>` — team id, or @mission for the active mission's team (default: the agent library)

### `brainiverse agent disable <agent_id>`
disable an agent

- `--mission <value>` — mission id (default: the active mission)
- `--team <value>` — team id, or @mission for the active mission's team (default: the agent library)

### `brainiverse agent duplicate <agent_id> <new_id>`
copy an agent

- `--mission <value>` — mission id (default: the active mission)
- `--team <value>` — team id, or @mission for the active mission's team (default: the agent library)
- `--name <value>`

### `brainiverse agent delete <agent_id>`
delete an agent

- `--mission <value>` — mission id (default: the active mission)
- `--team <value>` — team id, or @mission for the active mission's team (default: the agent library)

### `brainiverse agent export <agent_id>`
export to JSON

- `--mission <value>` — mission id (default: the active mission)
- `--team <value>` — team id, or @mission for the active mission's team (default: the agent library)
- `--out <value>`

### `brainiverse agent grant <agent_id> <capability>`
grant a capability

- `--mission <value>` — mission id (default: the active mission)
- `--team <value>` — team id, or @mission for the active mission's team (default: the agent library)
- `--approval <value>` — approval id (required for gated capabilities)

### `brainiverse agent revoke <agent_id> <capability>`
revoke a capability

- `--mission <value>` — mission id (default: the active mission)
- `--team <value>` — team id, or @mission for the active mission's team (default: the agent library)

### `brainiverse agent test <agent_id>`
get a prompt to test the agent in isolation

- `--mission <value>` — mission id (default: the active mission)
- `--team <value>` — team id, or @mission for the active mission's team (default: the agent library)
- `--task <value>` — required

## team

propose, build, and save teams

### `brainiverse team templates`
list team templates

### `brainiverse team list`
list saved teams

### `brainiverse team propose <mission_text>`
propose a team for a mission

- `--max <n>`
- `--id <value>`
- `--capabilities <value>` — your own analysis, comma-separated: research, ideation, analysis, build, risk, comms, organize
- `--domains <value>` — your own analysis, comma-separated domain ids (see `domains`)
- `--complexity <value>` — small | medium | large
- `--want <value>` — agents the human asked for, comma-separated positions, e.g. "Payments Expert, Translator:communicator"

### `brainiverse team domains`
list the domains the team builder knows, with their specialists

### `brainiverse team from-template <template>`
create a team from a template

- `--id <value>`

### `brainiverse team import <path>`
import a team JSON file

### `brainiverse team show <team_ref>`
show a team (team id, @project or @mission)

- `--mission <value>` — mission id (default: the active mission)

### `brainiverse team approve <team_ref>`
mark a draft team approved

- `--mission <value>` — mission id (default: the active mission)

### `brainiverse team add <team_ref>`
add an agent

- `--mission <value>` — mission id (default: the active mission)
- `--archetype <value>` — default: specialist
- `--id <value>`
- `--name <value>`
- `--position <value>` — shown in brackets, e.g. Visa Expert
- `--description <value>`
- `--expertise <value>` — comma-separated
- `--from-library <value>` — add a saved agent from the library

### `brainiverse team remove <team_ref> <agent_id>`
remove an agent

- `--mission <value>` — mission id (default: the active mission)

### `brainiverse team leader <team_ref> <agent_id>`
choose the leader

- `--mission <value>` — mission id (default: the active mission)

### `brainiverse team rename <team_ref> <name>`
rename the team

- `--mission <value>` — mission id (default: the active mission)

### `brainiverse team save <team_ref>`
save (e.g. @mission) to the team library

- `--mission <value>` — mission id (default: the active mission)
- `--as <value>`

### `brainiverse team export <team_ref>`
export to JSON

- `--mission <value>` — mission id (default: the active mission)
- `--out <value>`

### `brainiverse team delete <team_ref>`
delete a saved team

- `--mission <value>` — mission id (default: the active mission)

## mission

start and manage missions

### `brainiverse mission new`
start a mission (team defaults to the project team)

- `--goal <value>` — required
- `--team <value>`
- `--id <value>`
- `--title <value>`
- `--instant` — no team is kept: its draft is deleted when the mission closes
- `--success <value>` — repeatable
- `--constraint <value>` — repeatable
- `--assumption <value>` — repeatable
- `--resource <value>` — repeatable
- `--limit <value>` — key=value; repeatable

### `brainiverse mission list`
list missions

### `brainiverse mission use <mission_id>`
switch the active mission

### `brainiverse mission show`
mission details

- `--mission <value>` — mission id (default: the active mission)

### `brainiverse mission pause`
pause the mission

- `--mission <value>` — mission id (default: the active mission)

### `brainiverse mission resume`
resume the mission

- `--mission <value>` — mission id (default: the active mission)

### `brainiverse mission close`
close the mission

- `--mission <value>` — mission id (default: the active mission)
- `--force`

### `brainiverse mission update`
add criteria/constraints, change limits

- `--mission <value>` — mission id (default: the active mission)
- `--success <value>` — repeatable
- `--constraint <value>` — repeatable
- `--assumption <value>` — repeatable
- `--resource <value>` — repeatable
- `--limit <value>` — repeatable

### `brainiverse mission finalize`
save the Leader's synthesis

- `--mission <value>` — mission id (default: the active mission)
- `--file <value>` — required

### `brainiverse mission report`
render the mission debrief

- `--mission <value>` — mission id (default: the active mission)

### `brainiverse mission log`
show the audit log

- `--mission <value>` — mission id (default: the active mission)
- `--limit <n>` — default: 50

## task

the task board

### `brainiverse task add`
add a task

- `--mission <value>` — mission id (default: the active mission)
- `--agent <value>` — required
- `--objective <value>` — required
- `--input <value>` — repeatable
- `--expect <value>`
- `--constraint <value>` — repeatable
- `--after <value>` — comma-separated dependency ids
- `--accept <value>` — acceptance criterion; repeatable
- `--context <value>`
- `--needs <value>` — comma-separated capabilities
- `--timeout <n>`
- `--retries <n>`
- `--parent <value>`

### `brainiverse task list`
list tasks

- `--mission <value>` — mission id (default: the active mission)
- `--status <value>`

### `brainiverse task ready`
tasks ready to run now

- `--mission <value>` — mission id (default: the active mission)

### `brainiverse task show <task_id>`
show a task

- `--mission <value>` — mission id (default: the active mission)

### `brainiverse task brief <task_id>`
the agent's brief

- `--mission <value>` — mission id (default: the active mission)

### `brainiverse task start <task_id>`
start a task (or 'ready' for all ready tasks) and get Agent-tool calls

- `--mission <value>` — mission id (default: the active mission)

### `brainiverse task submit <task_id>`
submit a result (JSON on stdin or --file)

- `--mission <value>` — mission id (default: the active mission)
- `--file <value>`
- `--tokens <n>`

### `brainiverse task accept <task_id>`
accept submitted work

- `--mission <value>` — mission id (default: the active mission)
- `--evidence <value>`

### `brainiverse task revise <task_id>`
send work back

- `--mission <value>` — mission id (default: the active mission)
- `--feedback <value>` — required

### `brainiverse task fail <task_id>`
mark an attempt failed (retries within limits)

- `--mission <value>` — mission id (default: the active mission)
- `--error <value>` — required

### `brainiverse task cancel <task_id>`
cancel a task

- `--mission <value>` — mission id (default: the active mission)
- `--reason <value>`

### `brainiverse task reassign <task_id> <agent>`
reassign a pending task

- `--mission <value>` — mission id (default: the active mission)

### `brainiverse task attach-approval <task_id> <approval>`
attach an approval to a task

- `--mission <value>` — mission id (default: the active mission)

### `brainiverse task sweep`
fail tasks that exceeded their timeout

- `--mission <value>` — mission id (default: the active mission)

### `brainiverse intake [request]`
decide how to handle a request: answer, quick team, new or existing project team

## project

the project's long-lived team (written to .claude/agents/)

### `brainiverse project status`
show the project team and its Claude Code agent files

### `brainiverse project adopt <team>`
make a team this project's team and write its agents

- `--force`

### `brainiverse project sync`
rewrite .claude/agents/ from the project team

### `brainiverse project release`
stop using a project team (removes its generated agent files)

- `--keep-files`

### `brainiverse ask <agent> <message>`
talk to one agent: a question or a further request (opens or reuses a direct line)

- `--mission <value>` — mission id (default: the active mission)

## usage

token usage and cost, from what the host reports

### `brainiverse usage record <task_id>`
record the usage an Agent result reported

- `--mission <value>` — mission id (default: the active mission)
- `--tokens <n>`
- `--tool-uses <n>`
- `--duration-ms <n>`
- `--invocation <value>`

### `brainiverse usage report`
usage by agent and model tier, with cost if prices are set

- `--mission <value>` — mission id (default: the active mission)

### `brainiverse usage price <tier> <usd_per_mtok>`
set your price for a model tier (USD per million tokens)

### `brainiverse dashboard`
read-only web dashboard: board, team, meetings, approvals, usage

- `--mission <value>` — mission id (default: the active mission)
- `--port <n>` — default 4777; 0 picks a free port
- `--out <value>` — write a static snapshot HTML file instead

### `brainiverse status`
progress board

- `--mission <value>` — mission id (default: the active mission)

### `brainiverse metrics`
mission metrics

- `--mission <value>` — mission id (default: the active mission)

### `brainiverse perm <agent> <capability>`
check an agent's permission for a capability

- `--mission <value>` — mission id (default: the active mission)

## meeting

interactive meetings (war rooms)

### `brainiverse meeting start`
open a meeting

- `--mission <value>` — mission id (default: the active mission)
- `--objective <value>` — required
- `--with <value>` — comma-separated agent ids; required

### `brainiverse meeting show <meeting_id>`
meeting state and transcript

- `--mission <value>` — mission id (default: the active mission)

### `brainiverse meeting ask <meeting_id>`
ask agents to contribute

- `--mission <value>` — mission id (default: the active mission)
- `--agent <value>` — one or more agent ids, comma-separated; required
- `--prompt <value>` — required

### `brainiverse meeting say <meeting_id> <text>`
the Leader speaks

- `--mission <value>` — mission id (default: the active mission)

### `brainiverse meeting human <meeting_id> <text>`
record the human's words

- `--mission <value>` — mission id (default: the active mission)
- `--answers <value>` — question id this answers

### `brainiverse meeting question <meeting_id> <text>`
record an open question

- `--mission <value>` — mission id (default: the active mission)
- `--to <value>` — default: human

### `brainiverse meeting decide <meeting_id> <text>`
record a decision

- `--mission <value>` — mission id (default: the active mission)
- `--human-approved`

### `brainiverse meeting assume <meeting_id> <text>`
record an assumption

- `--mission <value>` — mission id (default: the active mission)

### `brainiverse meeting action <meeting_id>`
turn a conclusion into a task

- `--mission <value>` — mission id (default: the active mission)
- `--agent <value>` — required
- `--objective <value>` — required
- `--accept <value>` — repeatable
- `--after <value>`

### `brainiverse meeting add <meeting_id> <agent>`
add a participant

- `--mission <value>` — mission id (default: the active mission)

### `brainiverse meeting remove <meeting_id> <agent>`
remove a participant

- `--mission <value>` — mission id (default: the active mission)

### `brainiverse meeting pause <meeting_id>`
pause

- `--mission <value>` — mission id (default: the active mission)

### `brainiverse meeting resume <meeting_id>`
resume

- `--mission <value>` — mission id (default: the active mission)

### `brainiverse meeting end <meeting_id>`
end with a summary

- `--mission <value>` — mission id (default: the active mission)
- `--summary <value>` — required

## chat

direct line: the human talks one-on-one with a single agent

### `brainiverse chat start <agent>`
open a direct line

- `--mission <value>` — mission id (default: the active mission)
- `--topic <value>`

### `brainiverse chat say <chat_id> <text>`
send the human's message and get the Agent-tool call

- `--mission <value>` — mission id (default: the active mission)

### `brainiverse chat show <chat_id>`
the conversation so far

- `--mission <value>` — mission id (default: the active mission)

### `brainiverse chat list`
list direct lines

- `--mission <value>` — mission id (default: the active mission)

### `brainiverse chat end <chat_id>`
close a direct line

- `--mission <value>` — mission id (default: the active mission)
- `--summary <value>`

## approval

human approvals

### `brainiverse approval request`
request an approval

- `--mission <value>` — mission id (default: the active mission)
- `--kind <value>` — capability | skill_install | action | limit_change; default: capability
- `--detail <value>` — required
- `--agent <value>`
- `--capability <value>`
- `--task <value>`
- `--skill <value>`

### `brainiverse approval resolve <approval_id> <decision>`
record the human's decision

- `--mission <value>` — mission id (default: the active mission)
- `--note <value>` — the human's answer, quoted; required

### `brainiverse approval list`
list approvals

- `--mission <value>` — mission id (default: the active mission)
- `--status <value>`

## memory

agent / team / project memory

### `brainiverse memory add <text>`
add memory records

- `--mission <value>` — mission id (default: the active mission)
- `--scope <value>` — project | agent:<id> | team:<id>; default: project
- `--tags <value>`

### `brainiverse memory list`
list memory records

- `--mission <value>` — mission id (default: the active mission)
- `--scope <value>` — project | agent:<id> | team:<id>; default: project
- `--tags <value>`

### `brainiverse memory edit <record_id> <text>`
edit memory records

- `--mission <value>` — mission id (default: the active mission)
- `--scope <value>` — project | agent:<id> | team:<id>; default: project

### `brainiverse memory delete <record_id>`
delete memory records

- `--mission <value>` — mission id (default: the active mission)
- `--scope <value>` — project | agent:<id> | team:<id>; default: project

## skill

skill discovery and integration

### `brainiverse skill local [query]`
skills installed locally

### `brainiverse skill scan <path>`
static security scan of a skill directory

- `--mission <value>` — mission id (default: the active mission)
- `--candidate <value>`

### `brainiverse skill list`
gaps and candidates

- `--mission <value>` — mission id (default: the active mission)

### `brainiverse skill recommend`
the top candidates (max 3)

- `--mission <value>` — mission id (default: the active mission)

### `brainiverse skill gap <capability> <description>`
record a capability gap

- `--mission <value>` — mission id (default: the active mission)

### `brainiverse skill candidate`
record a skill that was actually found

- `--mission <value>` — mission id (default: the active mission)
- `--name <value>` — required
- `--source <value>` — skills.sh, github, local, ...; required
- `--purpose <value>` — required
- `--agent <value>` — required
- `--url <value>`
- `--local-path <value>`
- `--gap <value>`
- `--benefits <value>`
- `--permissions <value>`
- `--compatibility <value>`
- `--risks <value>`
- `--install <value>` — the exact install command, as documented by the source

### `brainiverse skill approve <skill_id>`
approve installation (needs a skill_install approval)

- `--mission <value>` — mission id (default: the active mission)
- `--approval <value>` — required

### `brainiverse skill reject <skill_id>`
reject a candidate

- `--mission <value>` — mission id (default: the active mission)
- `--reason <value>` — required

### `brainiverse skill verify <skill_id>`
verify an install and attach it to its agent

- `--mission <value>` — mission id (default: the active mission)
- `--path <value>` — required

### `brainiverse review <target>`
record an evidence-backed review

- `--mission <value>` — mission id (default: the active mission)
- `--verdict <value>` — pass | pass_with_issues | fail; required
- `--evidence <value>` — repeatable
- `--issue <value>` — repeatable
- `--reviewer <value>`
