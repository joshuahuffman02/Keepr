---
name: nextjs
description: Next.js 14 App Router patterns and best practices. Use when working with routing, server/client components, data fetching, or Next.js-specific features.
allowed-tools: Read, Write, Edit, Glob, Grep
---

# Next.js 14 App Router for Campreserv

## Project Structure

```
app/
├── (auth)/              # Auth route group
│   ├── signin/
│   └── signup/
├── (dashboard)/         # Dashboard route group
│   ├── layout.tsx       # Shared dashboard layout
│   └── settings/
├── api/                 # API routes
│   └── auth/[...nextauth]/
├── layout.tsx           # Root layout
└── page.tsx             # Home page
```

## Server vs Client Components

### Server Components (Default)

```tsx
// No "use client" directive
// Can directly access DB, fetch data, use secrets

export default async function Page() {
  const data = await fetchData(); // Server-side fetch
  return <div>{data}</div>;
}
```

### Client Components

```tsx
"use client";

// Required for:
// - useState, useEffect, other hooks
// - Event handlers (onClick, onChange)
// - Browser APIs (localStorage, window)
// - Interactive UI

import { useState } from "react";

export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;
}
```

### Composition Pattern

```tsx
// Server component with client interactivity
import { ClientButton } from "./ClientButton";

export default async function Page() {
  const data = await fetchServerData();
  return (
    <div>
      <h1>{data.title}</h1>
      <ClientButton /> {/* Interactive part */}
    </div>
  );
}
```

## Data Fetching

### Server Components

```tsx
// Direct fetch (cached by default)
async function getData() {
  const res = await fetch("https://api.example.com/data");
  return res.json();
}

// Opt out of caching
const res = await fetch(url, { cache: "no-store" });

// Revalidate every hour
const res = await fetch(url, { next: { revalidate: 3600 } });
```

### Client Components

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export function ReservationList() {
  const { data, isLoading } = useQuery({
    queryKey: ["reservations"],
    queryFn: apiClient.getReservations,
  });
}
```

## Routing

### Dynamic Routes

```
app/reservations/[id]/page.tsx  → /reservations/123
app/[...slug]/page.tsx          → /any/path/here
```

### Route Groups

```
app/(marketing)/       # Groups routes without affecting URL
app/(dashboard)/       # Separate layout for dashboard
```

### Layouts

```tsx
// app/dashboard/layout.tsx
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
```

## API Routes

```tsx
// app/api/example/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return NextResponse.json({ message: "Hello" });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  return NextResponse.json({ received: body });
}
```

## Metadata

```tsx
// Static metadata
export const metadata = {
  title: "Page Title",
  description: "Page description",
};

// Dynamic metadata
export async function generateMetadata({ params }) {
  return {
    title: `Reservation ${params.id}`,
  };
}
```

## Common Patterns

### Loading States

```tsx
// app/dashboard/loading.tsx
export default function Loading() {
  return <Skeleton />;
}
```

### Error Handling

```tsx
// app/dashboard/error.tsx
"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}
```

### Not Found

```tsx
// app/not-found.tsx
export default function NotFound() {
  return <div>Page not found</div>;
}
```

## Best Practices

1. **Prefer Server Components** - Default to server, add "use client" only when needed
2. **Colocate data fetching** - Fetch data where it's used
3. **Use route groups** - Organize related routes
4. **Leverage layouts** - Share UI between routes
5. **Handle loading/error states** - Use built-in conventions
6. **Minimize client bundles** - Only ship necessary JS to client
