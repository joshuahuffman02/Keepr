---
description: Fetch and work on tickets from the database
---

# Working on Tickets

To see current tickets from the production database:

```bash
curl -s https://camp-everydayapi-production.up.railway.app/api/tickets | jq '.tickets'
```

To filter by status (open tickets only):

```bash
curl -s https://camp-everydayapi-production.up.railway.app/api/tickets | jq '.tickets | map(select(.status == "open"))'
```

To update a ticket after completing work:

```bash
curl -X PATCH https://camp-everydayapi-production.up.railway.app/api/tickets/{TICKET_ID} \
  -H "Content-Type: application/json" \
  -d '{"status": "resolved", "agentNotes": "Fixed by updating X in file Y"}'
```

## Ticket Fields

- `id` - Unique ticket ID
- `title` - Short description of issue
- `notes` - Detailed description from submitter
- `category` - issue | question | feature | other
- `status` - open | in_progress | blocked | resolved | closed
- `url` / `path` - Where the issue was reported from
- `agentNotes` - Notes from the agent who worked on it
