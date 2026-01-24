---
paths:
  - "platform/apps/web/**"
---

# Web-Specific Rules

When working in the Next.js frontend:

## Components

1. **Client components need "use client"**

   ```typescript
   "use client";
   ```

2. **Initialize state from props**

   ```typescript
   const [form, setForm] = useState({
     name: props.data?.name || "",
   });
   ```

3. **Use TanStack Query for data fetching**

   ```typescript
   const { data, isLoading } = useQuery({
     queryKey: ["resource", id],
     queryFn: () => apiClient.getResource(id),
     enabled: !!id,
   });
   ```

4. **Invalidate cache on mutations**
   ```typescript
   const qc = useQueryClient();
   onSuccess: () => {
     qc.invalidateQueries({ queryKey: ["resource"] });
   };
   ```

## Hydration Safety

1. **Check for browser before localStorage**

   ```typescript
   const isBrowser = typeof window !== "undefined";
   const value = isBrowser ? localStorage.getItem("key") : null;
   ```

2. **Use enabled flag in queries**
   ```typescript
   enabled: typeof window !== "undefined" && !!token;
   ```

## API Calls

1. **Always use apiClient from lib/api-client.ts**
2. **Include campgroundId when required**
3. **Handle loading and error states**

## Forms

1. **Prevent default on submit**

   ```typescript
   <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
   ```

2. **Disable button during mutation**

   ```typescript
   <Button disabled={mutation.isPending}>Save</Button>
   ```

3. **Use FormField component for accessibility**

## Accessibility

1. **Use semantic HTML** (button, label, etc.)
2. **Generate IDs with React.useId()**
3. **Add aria-invalid and aria-describedby for errors**
4. **Use role="alert" for error messages**

## File Naming

- `page.tsx` - Route pages
- `layout.tsx` - Layouts
- `ComponentName.tsx` - PascalCase components
- `use-hook-name.ts` - Kebab-case hooks
