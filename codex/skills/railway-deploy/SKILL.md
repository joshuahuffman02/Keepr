---
name: railway-deploy
description: Railway deployment patterns and troubleshooting.
allowed-tools: Read, Bash, Grep
---

# Railway Deploy (Codex)

## Use when
- Deploying or debugging Railway services.

## Services
- api (4000), web (3000), db (5432).

## Common commands
- `railway status`
- `railway logs --service api|web`
- `railway up --service api|web`

## Checklist
- Build passes locally.
- Env vars set.
- Migrations applied.
- Health checks verified.

## Allowed scope
- Deployment guidance only; no infra changes without approval.

## Ask before proceeding if unclear
- The failing service or error logs are missing.

## Stop condition
- A clear deploy or debug path is provided.
