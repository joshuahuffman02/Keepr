---
name: ui-development
description: React UI development with Tailwind CSS and shadcn-style components. Use when creating or modifying React components, styling with Tailwind, or working on the frontend interface.
allowed-tools: Read, Write, Edit, Glob, Grep
---

# UI Development for Campreserv

## Tech Stack

- React 18 with TypeScript
- Next.js 14 (App Router)
- Tailwind CSS
- shadcn/ui-style components (custom implementations)
- Lucide React icons

## Component Patterns

### File Structure

```
components/
├── ui/           # Base UI components (Button, Card, Input, etc.)
├── forms/        # Form-specific components
├── layout/       # Layout components (DashboardShell, AdminTopBar)
└── [feature]/    # Feature-specific components
```

### Component Template

```tsx
"use client";

import { cn } from "@/lib/utils";

interface MyComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export function MyComponent({ className, children }: MyComponentProps) {
  return <div className={cn("base-styles", className)}>{children}</div>;
}
```

## Design Tokens

### Colors (Semantic)

- **Primary**: emerald-600 (actions, links, active states)
- **Neutral**: slate (backgrounds, text, borders)
- **Success**: green
- **Warning**: amber
- **Error**: red/rose

### Spacing Scale

Use Tailwind's default spacing: 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24

### Typography

- Headings: font-bold, text-slate-900
- Body: text-slate-700
- Muted: text-slate-500
- Small: text-sm, text-xs

### Border Radius

- Cards/modals: rounded-lg or rounded-xl
- Buttons: rounded-md
- Inputs: rounded-md
- Badges: rounded-full

### Shadows

- Cards: shadow-sm
- Modals: shadow-xl
- Dropdowns: shadow-lg

## Common Patterns

### Card Component

```tsx
<Card className="p-6">
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>{/* Content */}</CardContent>
</Card>
```

### Button Variants

```tsx
// Primary action
<Button className="bg-emerald-600 hover:bg-emerald-700 text-white">

// Secondary
<Button variant="outline">

// Destructive
<Button className="bg-red-600 hover:bg-red-700 text-white">
```

### Form Inputs

```tsx
<div className="space-y-2">
  <Label htmlFor="field">Label</Label>
  <Input id="field" placeholder="Placeholder" />
  {error && <p className="text-sm text-red-500">{error}</p>}
</div>
```

### Responsive Design

```tsx
// Mobile-first approach
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
```

## Best Practices

1. **Always use TypeScript** - Props should be typed
2. **Use `cn()` for conditional classes** - From lib/utils
3. **Mobile-first responsive** - Start with mobile styles
4. **Semantic colors** - Use design tokens, not arbitrary colors
5. **Consistent spacing** - Follow the spacing scale
6. **Focus states** - Always include focus-visible styles
7. **Loading states** - Show spinners or skeletons
8. **Empty states** - Handle no-data scenarios gracefully
