---
description: Load Cloudflare skill for Workers, Pages, D1, R2, AI, and more
---

# Cloudflare Development

Load the Cloudflare platform skill and help with any Cloudflare development task.

## Workflow

1. **Load the cloudflare skill** to get access to comprehensive Cloudflare documentation
2. **Use decision trees** in SKILL.md to identify the right product(s)
3. **Read relevant reference files** from `references/<product>/`
4. **Execute the task** using Cloudflare-specific patterns and APIs

## Reference File Structure

Each product in `./references/<product>/` contains:

| File               | Purpose                 | When to Read         |
| ------------------ | ----------------------- | -------------------- |
| `README.md`        | Overview, when to use   | Always read first    |
| `api.md`           | Runtime API, types      | Writing code         |
| `configuration.md` | wrangler.toml, bindings | Configuring projects |
| `patterns.md`      | Best practices          | Implementation       |
| `gotchas.md`       | Pitfalls, limitations   | Debugging            |

## Task Mapping

| Task               | Files to Read                          |
| ------------------ | -------------------------------------- |
| New project        | `README.md` + `configuration.md`       |
| Implement feature  | `README.md` + `api.md` + `patterns.md` |
| Debug/troubleshoot | `gotchas.md`                           |

## Available Products

**Compute:** Workers, Pages, Durable Objects, Workflows, Containers
**Storage:** KV, D1, R2, Queues, Vectorize, Hyperdrive
**AI/ML:** Workers AI, Vectorize, Agents SDK, AI Gateway
**Networking:** Tunnel, Spectrum, TURN
**Security:** WAF, DDoS, Bot Management, Turnstile
**Media:** Images, Stream, Browser Rendering
**IaC:** Terraform, Pulumi

<user-request>
$ARGUMENTS
</user-request>
