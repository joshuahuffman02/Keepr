# Keepr Agents (Codex MCP + Agents SDK)

This folder contains a ready-to-run multi-agent workflow using Codex CLI as an MCP server and the OpenAI Agents SDK.

## Prerequisites

- Python 3.10+
- Node 18+ (for `npx`)
- Codex CLI installed (so `npx codex` works)
- An OpenAI API key

## Setup

```bash
cd tools/agents
python -m venv .venv
source .venv/bin/activate
pip install --upgrade openai openai-agents python-dotenv
printf "OPENAI_API_KEY=sk-..." > .env
```

## Run

Single run (task passed inline):

```bash
python camp_everyday_agents.py "Add a staff-only AI partner widget with action drafts and confirmations."
```

Or create `TASK.md` in this folder and run:

```bash
python camp_everyday_agents.py
```

Optional: restrict the active roles using a comma-separated list:

```bash
AGENT_ROLES="Project Manager,Frontend Engineer,Backend Engineer,QA Engineer" \
python camp_everyday_agents.py "Improve booking flow UX."
```

## How it works

- Codex CLI runs as a long-lived MCP server.
- The Project Manager writes `REQUIREMENTS.md`, `TEST.md`, and `AGENT_TASKS.md` at repo root.
- Specialists only act on their section in `AGENT_TASKS.md` and then hand control back.
- File writes are done through Codex MCP with `approval-policy: never` and `sandbox: workspace-write`.

## Agents included (20)

1. Project Manager (orchestrator)
2. Product Strategist
3. UX Researcher
4. Interaction Designer
5. Visual Designer
6. Frontend Engineer
7. Backend Engineer
8. Mobile Engineer
9. Data Engineer
10. Analytics Analyst
11. AI Engineer
12. Payments Specialist
13. Security Lead
14. DevOps Engineer
15. QA Engineer
16. Performance Engineer
17. Integrations Engineer
18. Technical Writer
19. Support Ops
20. Release Manager
