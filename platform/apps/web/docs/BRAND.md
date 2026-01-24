# Keepr Brand Guidelines

> "Reservation software for places worth returning to"

## Brand Philosophy

Keepr is calm, trustworthy, human, and premium. We build software that feels like "quiet infrastructure" - it works reliably in the background so campground operators can focus on creating memorable guest experiences.

**Voice**: Plainspoken, calm, outcome-focused. We avoid jargon like "optimize", "leverage", "synergy", or "disrupt".

---

## Color Palette

### Primary Colors

| Name              | Hex       | HSL           | Usage                                    |
| ----------------- | --------- | ------------- | ---------------------------------------- |
| **Evergreen**     | `#1F3D34` | `160 33% 18%` | Primary actions, brand emphasis, buttons |
| **Warm Charcoal** | `#2F2F2C` | `60 3% 18%`   | Body text, UI elements                   |
| **Soft Clay**     | `#C47A63` | `14 46% 58%`  | Focus rings, accents (~5% of UI)         |
| **Off-White**     | `#FAF7F2` | `38 50% 96%`  | Background                               |

### Color Ratios

- **65-70%** Off-White (backgrounds)
- **20-25%** Evergreen/Charcoal (text, primary actions)
- **5%** Soft Clay (focus rings, small highlights)

### Usage in Code

```tsx
// Using Tailwind classes
<div className="bg-background text-foreground">
  <Button className="bg-action-primary">Save</Button>
  <input className="focus:ring-ring" />
</div>

// Direct Keepr colors (when semantic tokens don't fit)
<div className="bg-keepr-evergreen text-white">
  <span className="text-keepr-clay">Accent</span>
</div>
```

### Contrast Ratios (WCAG AA)

| Combination            | Ratio  | Status                      |
| ---------------------- | ------ | --------------------------- |
| Evergreen on Off-White | ~8.5:1 | ✅ Pass                     |
| Charcoal on Off-White  | ~10:1  | ✅ Pass                     |
| White on Evergreen     | ~8.5:1 | ✅ Pass                     |
| Clay on Off-White      | ~3.2:1 | ⚠️ Large text/graphics only |

**Important**: Soft Clay should only be used for focus rings, decorative elements, and large text (18px+ or 14px+ bold). Never use it for body text.

---

## Typography

### Fonts

| Purpose   | Font    | Weights  | CSS Variable     |
| --------- | ------- | -------- | ---------------- |
| Headlines | DM Sans | 500, 700 | `--font-display` |
| Body/UI   | Inter   | 400, 500 | `--font-body`    |

### Type Scale

| Element  | Size    | Font    | Weight | Letter-spacing |
| -------- | ------- | ------- | ------ | -------------- |
| H1       | 48-56px | DM Sans | 700    | -2.5%          |
| H2       | 32-40px | DM Sans | 500    | -2.5%          |
| H3       | 24-28px | DM Sans | 500    | -2.5%          |
| Body     | 16-18px | Inter   | 400    | normal         |
| UI Label | 14-15px | Inter   | 500    | normal         |
| Button   | 14-16px | Inter   | 500    | normal         |

### Typography Rules

1. **Sentence case** - No ALL CAPS headings
2. **Tighter tracking** - Headlines use `tracking-tighter` (-2.5%)
3. **Comfortable line-height** - Body text uses 1.55-1.65

### Usage in Code

```tsx
// Headlines use display font
<h1 className="font-display font-bold tracking-tighter text-4xl">
  Welcome to Keepr
</h1>

// Body uses default (Inter)
<p className="text-base leading-relaxed">
  Modern campground management software.
</p>

// Card titles inherit display font
<CardTitle>Reservation Details</CardTitle>
```

---

## Components

### Buttons

```tsx
// Primary - Evergreen background, white text
<Button>Save Changes</Button>

// Secondary - Light background, charcoal text
<Button variant="secondary">Cancel</Button>

// Ghost - Text only
<Button variant="ghost">Learn More</Button>

// Outline - Border with transparent bg
<Button variant="outline">Edit</Button>

// Destructive - Red for dangerous actions
<Button variant="destructive">Delete</Button>
```

### Focus States

All interactive elements use **Soft Clay** for focus rings:

```tsx
// Input with focus ring
<Input className="focus-visible:ring-ring" />

// The ring color is automatically Clay (#C47A63)
```

### Border Radius

| Element                    | Radius              |
| -------------------------- | ------------------- |
| Controls (buttons, inputs) | 8px (`rounded-md`)  |
| Cards                      | 12px (`rounded-xl`) |

---

## Do's and Don'ts

### Do

- ✅ Use Off-White as the default background
- ✅ Use Evergreen for primary CTAs
- ✅ Use Clay sparingly (focus rings, selected states)
- ✅ Use DM Sans for headlines, Inter for body
- ✅ Keep copy calm and outcome-focused
- ✅ Use sentence case for headings
- ✅ Maintain generous whitespace

### Don't

- ❌ Use bright blues or neon colors
- ❌ Use gradients or glows excessively
- ❌ Use heavy drop shadows
- ❌ Use ALL CAPS for headings
- ❌ Use bubbly/trendy styling
- ❌ Use camping imagery in UI components (tents, RVs as icons)
- ❌ Use Clay for body text (fails contrast)

---

## CSS Variables Reference

```css
/* Keepr Brand Colors */
--keepr-evergreen: 160 33% 18%;
--keepr-evergreen-light: 160 33% 25%;
--keepr-charcoal: 60 3% 18%;
--keepr-charcoal-muted: 60 3% 45%;
--keepr-clay: 14 46% 58%;
--keepr-clay-light: 14 46% 68%;
--keepr-off-white: 38 50% 96%;

/* Semantic Tokens (mapped to Keepr palette) */
--background: 38 50% 96%; /* Off-White */
--foreground: 60 3% 18%; /* Charcoal */
--primary: 160 33% 18%; /* Evergreen */
--accent: 14 46% 58%; /* Clay */
--ring: 14 46% 58%; /* Clay (focus) */

/* Action Tokens */
--action-primary: 160 33% 18%; /* Evergreen */
--action-primary-hover: 160 33% 25%;
--action-secondary: 38 30% 92%; /* Warm light */

/* Typography */
--font-display: "DM Sans", system-ui, sans-serif;
--font-body: "Inter", system-ui, sans-serif;
```

---

## Utility Classes

### Glow Effects

```tsx
// Clay glow for special emphasis
<div className="glow-clay">Featured</div>

// Hover glow for cards
<Card className="hover-glow">...</Card>
```

### Gradients

```tsx
// Evergreen gradient for hero sections
<div className="gradient-evergreen text-white">Hero Content</div>
```

---

## Migration Notes

### From Emerald to Keepr

If you see old emerald-based classes, update them:

| Old                 | New                                         |
| ------------------- | ------------------------------------------- |
| `bg-emerald-600`    | `bg-action-primary` or `bg-keepr-evergreen` |
| `text-emerald-600`  | `text-primary`                              |
| `ring-emerald-500`  | `ring-ring`                                 |
| `.glow-emerald`     | `.glow-clay`                                |
| `.gradient-emerald` | `.gradient-evergreen`                       |

---

## Questions?

The brand system is defined in:

- `/app/globals.css` - CSS variables and utilities
- `/tailwind.config.ts` - Tailwind extensions
- `/lib/fonts.ts` - Font configuration
- `/lib/seo/constants.ts` - SEO and metadata
