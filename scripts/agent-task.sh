#!/usr/bin/env bash
set -euo pipefail

read -r -p "Task ID: " TASK_ID
read -r -p "Agent name: " AGENT_NAME
read -r -p "Allowed files/folders: " ALLOWED_SCOPE

if [[ -z "$TASK_ID" || -z "$AGENT_NAME" || -z "$ALLOWED_SCOPE" ]]; then
  echo "Error: Task ID, Agent name, and Allowed files/folders are required."
  exit 1
fi

BRANCH="agent/${AGENT_NAME}/${TASK_ID}"

git checkout -b "$BRANCH"

mkdir -p agents/tasks

cat <<EOT > "agents/tasks/${TASK_ID}.md"
# Task ${TASK_ID}

## Goal
- TODO: Fill the task goal.

## Allowed scope
- ${ALLOWED_SCOPE}

## Acceptance checklist
- [ ] TODO: Fill the acceptance criteria.

## Recommended Codex agent/skill
- ${AGENT_NAME}
EOT

echo "codex \"Start task ${TASK_ID} as ${AGENT_NAME}. Use ./agents/tasks/${TASK_ID}.md and follow ./AGENTS.md.\""
