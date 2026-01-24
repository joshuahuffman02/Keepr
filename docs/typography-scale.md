# Typography Pairing and Scale

This guide defines the font pairing and the recommended type scale for Campreserv UI and marketing pages.

## Font pairing

- Body: `var(--font-body)` (Inter, Geist, system)
- Display: `var(--font-display)` (Inter, Geist, system)

Tailwind helpers:

- Use `font-sans` for body and UI copy (default).
- Use `font-display` for headline and hero text.

## Type scale

| Token      | Tailwind class              | Typical use                |
| ---------- | --------------------------- | -------------------------- |
| Display 1  | `text-5xl leading-tight`    | Marketing hero headlines   |
| Display 2  | `text-4xl leading-tight`    | Product page heroes        |
| Heading 1  | `text-3xl leading-snug`     | Page titles                |
| Heading 2  | `text-2xl leading-snug`     | Section headings           |
| Heading 3  | `text-xl leading-snug`      | Card headers               |
| Body       | `text-base leading-relaxed` | Primary body copy          |
| Body small | `text-sm leading-relaxed`   | Form hints, secondary text |
| Caption    | `text-xs leading-relaxed`   | Metadata, labels           |

## Usage notes

- Prefer one size step between adjacent hierarchy levels.
- Avoid mixing multiple headline sizes in the same component.
- Keep body copy at `text-base` for readability in dense tables and forms.
