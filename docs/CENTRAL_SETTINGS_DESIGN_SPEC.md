# Central Settings Hub - Design Specification

## Overview

This document combines emotional design, UX, and accessibility requirements for the centralized settings hub. It provides concrete implementation guidance for creating an experience that is delightful, efficient, and accessible.

---

## Emotional Design Framework

### Emotional Goals by Context

| Context | Target Emotion | Design Approach |
|---------|---------------|-----------------|
| **First visit** | Curiosity, not overwhelm | Progressive reveal, welcoming empty states |
| **Finding a setting** | Confidence, control | Fast search, clear hierarchy |
| **Enabling optimization** | Trust, safety | Transparency, easy undo, clear explanations |
| **Completing setup** | Accomplishment | Celebration moments, progress tracking |
| **Fixing system issues** | Competence | Clear guidance, one-click fixes |

### Anxiety Points to Address

#### 1. "Where is that setting?"
- **Solution**: Global search with fuzzy matching
- **Micro-interaction**: Search results highlight matching text, animate in with stagger

#### 2. "Will auto-optimization mess up my reservations?"
- **Solution**: Preview mode, activity log, easy disable
- **Copy**: "You're always in control. Review changes before they happen."

#### 3. "Did my changes save?"
- **Solution**: Auto-save with visible indicator, undo capability
- **Micro-interaction**: Subtle pulse on save, toast confirmation

#### 4. "Am I missing something important?"
- **Solution**: System Check with clear actionable items
- **Micro-interaction**: Badge with count, cards that expand to show fix action

---

## Navigation Design

### 3-Level Tab Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ┌─────────┐                                                    [🔍 Search] │
│  │ ← Back  │  Central Settings                                              │
│  └─────────┘                                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────┐│
│   │ Property │ │ Pricing  │ │ Bookings │ │  Store   │ │  Access  │ │System││
│   │    🏕️    │ │    💰    │ │    📅    │ │    🛒    │ │    🔐    │ │  ⚙️  ││
│   └────┬─────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────┘│
│        │                                                                    │
│   Level 1: Main categories (persistent, always visible)                     │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Profile    Sites    Equipment    Amenities    Photos    Branding    ...   │
│   ━━━━━━                                                                    │
│                                                                             │
│   Level 2: Sub-sections (scrollable if overflow)                            │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                                                                     │   │
│   │   [Content Area - Forms, Tables, etc.]                              │   │
│   │                                                                     │   │
│   │   Level 3: Content tabs appear here when needed                     │   │
│   │                                                                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Tab Interaction States

```css
/* Level 1 Tabs */
.tab-l1 {
  /* Default */
  @apply px-6 py-4 text-slate-600 border-b-2 border-transparent;
  @apply transition-all duration-200 ease-out;

  /* Hover */
  @apply hover:text-slate-900 hover:bg-slate-50;

  /* Active */
  @apply aria-selected:text-emerald-700 aria-selected:border-emerald-600;
  @apply aria-selected:bg-emerald-50;

  /* Focus */
  @apply focus-visible:outline-none focus-visible:ring-2;
  @apply focus-visible:ring-emerald-500 focus-visible:ring-inset;
}

/* Level 2 Tabs - Smaller, subtler */
.tab-l2 {
  @apply px-4 py-2 text-sm text-slate-500 border-b border-transparent;
  @apply transition-colors duration-150;

  @apply hover:text-slate-700;
  @apply aria-selected:text-slate-900 aria-selected:border-slate-900;
}
```

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `Tab` | Move between interactive elements |
| `Arrow Left/Right` | Move between tabs at same level |
| `Arrow Down` | From L1 tab, focus first L2 tab |
| `Arrow Up` | From L2 tab, focus parent L1 tab |
| `Enter/Space` | Activate focused tab |
| `Home` | First tab in current level |
| `End` | Last tab in current level |
| `/` or `Cmd+K` | Open search |
| `Escape` | Close search/modal, go back |

---

## Component Specifications

### 1. Global Settings Search

**Emotional Goal**: Instant gratification, "I can find anything"

```tsx
// Search Modal (Cmd+K)
<div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50">
  <div className="max-w-xl mx-auto mt-[20vh] bg-white rounded-xl shadow-2xl
                  animate-in fade-in slide-in-from-top-4 duration-200">

    {/* Search Input */}
    <div className="flex items-center gap-3 px-4 py-3 border-b">
      <Search className="h-5 w-5 text-slate-400" />
      <input
        type="text"
        placeholder="Search settings..."
        className="flex-1 text-lg outline-none"
        autoFocus
      />
      <kbd className="px-2 py-1 text-xs bg-slate-100 rounded">ESC</kbd>
    </div>

    {/* Results with stagger animation */}
    <div className="max-h-[50vh] overflow-auto p-2">
      {results.map((result, i) => (
        <SearchResult
          key={result.id}
          result={result}
          style={{ animationDelay: `${i * 30}ms` }}
          className="animate-in fade-in slide-in-from-left-2"
        />
      ))}
    </div>

    {/* Quick Actions Footer */}
    <div className="flex items-center gap-4 px-4 py-2 border-t text-xs text-slate-500">
      <span><kbd>↑↓</kbd> Navigate</span>
      <span><kbd>↵</kbd> Open</span>
      <span><kbd>ESC</kbd> Close</span>
    </div>
  </div>
</div>
```

**Accessibility**:
- `role="combobox"` with `aria-expanded`, `aria-controls`
- Results use `role="listbox"` with `aria-activedescendant`
- Live region announces result count

### 2. System Check Dashboard

**Emotional Goal**: Empowerment ("I can fix this!"), not anxiety

```tsx
// System Check Card
<div className="bg-white rounded-lg border shadow-sm overflow-hidden">
  {/* Header with count badge */}
  <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b">
    <div className="flex items-center gap-2">
      <AlertTriangle className="h-5 w-5 text-amber-500" />
      <h3 className="font-medium">System Check</h3>
    </div>

    {/* Animated badge */}
    <span className="px-2.5 py-0.5 text-sm font-medium bg-amber-100 text-amber-800
                     rounded-full animate-in zoom-in duration-300">
      {actionableCount} to review
    </span>
  </div>

  {/* Issue Cards */}
  <div className="divide-y">
    {issues.map(issue => (
      <div key={issue.id}
           className="flex items-center justify-between px-4 py-3
                      hover:bg-slate-50 transition-colors group">
        <div className="flex items-center gap-3">
          {/* Status icon with color + shape for accessibility */}
          <div className={cn(
            "h-2 w-2 rounded-full",
            issue.severity === 'error' && "bg-red-500",
            issue.severity === 'warning' && "bg-amber-500",
            issue.severity === 'info' && "bg-blue-500"
          )} />
          <span>{issue.message}</span>
        </div>

        {/* One-click fix button */}
        <Button
          variant="ghost"
          size="sm"
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          Fix now →
        </Button>
      </div>
    ))}
  </div>
</div>
```

**Micro-interactions**:
- Badge pulses when new issues appear
- Check mark animation when issue fixed
- Card slides out smoothly when resolved

### 3. Grid Optimization Settings

**Emotional Goal**: Trust, control, transparency

```tsx
// Optimization Enable Section
<Card className="border-2 border-dashed border-slate-200 bg-slate-50/50">
  <CardHeader>
    <div className="flex items-start justify-between">
      <div>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          Grid Optimization
          <Badge variant="secondary">Beta</Badge>
        </CardTitle>
        <CardDescription className="mt-1">
          Automatically optimize site assignments to maximize revenue
        </CardDescription>
      </div>

      {/* Trust-building toggle */}
      <Switch
        checked={enabled}
        onCheckedChange={setEnabled}
        aria-describedby="optimization-description"
      />
    </div>
  </CardHeader>

  {enabled && (
    <CardContent className="animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Trust-building elements */}
      <Alert className="mb-4 bg-purple-50 border-purple-200">
        <Shield className="h-4 w-4 text-purple-600" />
        <AlertTitle>You're always in control</AlertTitle>
        <AlertDescription>
          Optimization respects guest preferences, accessibility needs, and
          your site rules. View all changes in the activity log.
        </AlertDescription>
      </Alert>

      {/* Configuration */}
      <div className="space-y-4">
        {/* Stop optimization before arrival */}
        <div>
          <Label>Stop optimizing</Label>
          <div className="flex items-center gap-2 mt-1">
            <Input type="number" value={daysBuffer} className="w-20" />
            <span className="text-sm text-slate-500">days before arrival</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Reservations won't be moved within this window
          </p>
        </div>

        {/* Site classes to include */}
        <div>
          <Label>Optimize these site types</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {siteClasses.map(sc => (
              <Toggle
                key={sc.id}
                pressed={selectedClasses.includes(sc.id)}
                onPressedChange={() => toggleClass(sc.id)}
                className="data-[state=on]:bg-purple-100 data-[state=on]:text-purple-700"
              >
                {sc.name}
              </Toggle>
            ))}
          </div>
        </div>

        {/* Preview mode - builds trust */}
        <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
          <div>
            <p className="font-medium">Preview mode</p>
            <p className="text-sm text-slate-500">
              See suggested moves without applying them
            </p>
          </div>
          <Switch checked={previewMode} onCheckedChange={setPreviewMode} />
        </div>
      </div>

      {/* Activity log link */}
      <div className="mt-4 pt-4 border-t flex items-center justify-between">
        <span className="text-sm text-slate-500">
          Last run: {lastRun ? formatRelative(lastRun) : 'Never'}
        </span>
        <Button variant="link" className="text-purple-600">
          View optimization log →
        </Button>
      </div>
    </CardContent>
  )}
</Card>
```

### 4. Rate Groups with Calendar Colors

**Emotional Goal**: Visual clarity, satisfaction in organization

```tsx
// Rate Group Row
<div className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-lg group">
  {/* Color picker with preview */}
  <Popover>
    <PopoverTrigger asChild>
      <button
        className="h-8 w-8 rounded-lg shadow-sm border-2 border-white
                   ring-1 ring-slate-200 transition-transform hover:scale-110"
        style={{ backgroundColor: group.color }}
        aria-label={`Color: ${group.color}. Click to change.`}
      />
    </PopoverTrigger>
    <PopoverContent className="w-auto p-3">
      <div className="grid grid-cols-6 gap-2">
        {PRESET_COLORS.map(color => (
          <button
            key={color}
            className={cn(
              "h-8 w-8 rounded-lg transition-all hover:scale-110",
              color === group.color && "ring-2 ring-offset-2 ring-slate-900"
            )}
            style={{ backgroundColor: color }}
            onClick={() => updateColor(group.id, color)}
            aria-label={`Select color ${color}`}
          />
        ))}
      </div>
    </PopoverContent>
  </Popover>

  {/* Name with inline edit */}
  <div className="flex-1">
    <InlineEdit
      value={group.name}
      onSave={(name) => updateName(group.id, name)}
      className="font-medium"
    />
    <p className="text-sm text-slate-500">
      {group.dateRanges.length} date range{group.dateRanges.length !== 1 && 's'}
    </p>
  </div>

  {/* Days count */}
  <div className="text-right">
    <p className="font-medium">{group.totalDays}</p>
    <p className="text-sm text-slate-500">days this year</p>
  </div>

  {/* Actions */}
  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>Edit date ranges</DropdownMenuItem>
        <DropdownMenuItem>Duplicate</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</div>
```

**Accessibility for Colors**:
- Each rate group has name displayed alongside color
- Calendar shows pattern/texture option for colorblind mode
- Screen reader: "Peak Season, red, 45 days assigned"

### 5. Custom Fields (UDFs)

**Emotional Goal**: Flexibility, "I can ask anything I need"

```tsx
// Custom Field Builder
<Card>
  <CardHeader>
    <CardTitle>Custom Fields</CardTitle>
    <CardDescription>
      Add custom questions to your reservation flow
    </CardDescription>
  </CardHeader>
  <CardContent>
    {/* Sortable field list */}
    <DndContext onDragEnd={handleDragEnd}>
      <SortableContext items={fields.map(f => f.id)}>
        <div className="space-y-2">
          {fields.map((field, index) => (
            <SortableFieldRow
              key={field.id}
              field={field}
              onEdit={() => openEditor(field)}
              onDelete={() => deleteField(field.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>

    {/* Empty state */}
    {fields.length === 0 && (
      <div className="text-center py-8 border-2 border-dashed rounded-lg">
        <FormInput className="h-8 w-8 mx-auto text-slate-400" />
        <h3 className="mt-2 font-medium text-slate-900">No custom fields yet</h3>
        <p className="text-sm text-slate-500 mt-1">
          Add questions to collect additional info from guests
        </p>
        <Button className="mt-4" onClick={() => openEditor(null)}>
          <Plus className="h-4 w-4 mr-2" />
          Add your first field
        </Button>
      </div>
    )}

    {/* Add button (when fields exist) */}
    {fields.length > 0 && (
      <Button variant="outline" className="w-full mt-4" onClick={() => openEditor(null)}>
        <Plus className="h-4 w-4 mr-2" />
        Add custom field
      </Button>
    )}
  </CardContent>
</Card>

// Field Editor Modal
<Dialog open={editorOpen} onOpenChange={setEditorOpen}>
  <DialogContent className="sm:max-w-lg">
    <DialogHeader>
      <DialogTitle>{editingField ? 'Edit' : 'Add'} Custom Field</DialogTitle>
    </DialogHeader>

    <div className="space-y-4 py-4">
      {/* Question */}
      <div>
        <Label htmlFor="question">Question</Label>
        <Input
          id="question"
          placeholder="e.g., What time will you arrive?"
          value={form.question}
          onChange={e => setForm({ ...form, question: e.target.value })}
        />
      </div>

      {/* Field Type */}
      <div>
        <Label>Answer Type</Label>
        <RadioGroup
          value={form.type}
          onValueChange={type => setForm({ ...form, type })}
          className="grid grid-cols-2 gap-2 mt-2"
        >
          {FIELD_TYPES.map(type => (
            <Label
              key={type.value}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer",
                "hover:bg-slate-50 transition-colors",
                form.type === type.value && "border-emerald-500 bg-emerald-50"
              )}
            >
              <RadioGroupItem value={type.value} className="sr-only" />
              <type.icon className="h-5 w-5 text-slate-600" />
              <div>
                <p className="font-medium">{type.label}</p>
                <p className="text-xs text-slate-500">{type.description}</p>
              </div>
            </Label>
          ))}
        </RadioGroup>
      </div>

      {/* When to show */}
      <div>
        <Label>Show this question during</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {DISPLAY_CONTEXTS.map(ctx => (
            <Toggle
              key={ctx.value}
              pressed={form.displayAt.includes(ctx.value)}
              onPressedChange={() => toggleDisplayContext(ctx.value)}
            >
              {ctx.label}
            </Toggle>
          ))}
        </div>
      </div>

      {/* Required toggle */}
      <div className="flex items-center justify-between">
        <div>
          <Label>Required</Label>
          <p className="text-sm text-slate-500">Guest must answer to continue</p>
        </div>
        <Switch
          checked={form.required}
          onCheckedChange={required => setForm({ ...form, required })}
        />
      </div>
    </div>

    <DialogFooter>
      <Button variant="outline" onClick={() => setEditorOpen(false)}>
        Cancel
      </Button>
      <Button onClick={handleSave}>
        {editingField ? 'Save changes' : 'Add field'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Celebration Moments

### Setup Progress

```tsx
// Settings completion tracker
<Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Rocket className="h-5 w-5 text-emerald-600" />
      Setup Progress
    </CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-3">
      {setupSteps.map(step => (
        <div key={step.id} className="flex items-center gap-3">
          {step.completed ? (
            <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center
                           animate-in zoom-in duration-300">
              <Check className="h-4 w-4 text-white" />
            </div>
          ) : (
            <div className="h-6 w-6 rounded-full border-2 border-slate-300" />
          )}
          <span className={step.completed ? 'text-slate-500 line-through' : ''}>
            {step.label}
          </span>
        </div>
      ))}
    </div>

    {/* Progress bar */}
    <div className="mt-4">
      <div className="h-2 bg-emerald-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <p className="text-sm text-emerald-700 mt-1">
        {completedCount} of {totalCount} complete
      </p>
    </div>
  </CardContent>
</Card>
```

### First Feature Enabled

```tsx
// Confetti trigger for first-time enablement
const handleEnableOptimization = () => {
  setEnabled(true);

  if (!hasEverEnabledOptimization) {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });

    toast({
      title: "Grid Optimization enabled! 🎉",
      description: "Your first optimization will run tonight at 2 AM.",
    });

    setHasEverEnabledOptimization(true);
  }
};
```

---

## Accessibility Checklist

### Tab Navigation

- [x] `role="tablist"` on tab container
- [x] `role="tab"` on each tab
- [x] `role="tabpanel"` on content areas
- [x] `aria-selected="true/false"` on tabs
- [x] `aria-controls` linking tab to panel
- [x] `aria-labelledby` on panel referencing tab
- [x] Arrow key navigation between tabs
- [x] Home/End for first/last tab
- [x] Focus visible indicator on all tabs

### Screen Reader Announcements

```tsx
// Announce tab changes
const [announcement, setAnnouncement] = useState('');

const handleTabChange = (category: string, section: string) => {
  setAnnouncement(`${category}, ${section} settings. ${getItemCount(section)} items.`);
};

// Live region
<div role="status" aria-live="polite" className="sr-only">
  {announcement}
</div>
```

### Color Independence

| Element | Color | Non-color indicator |
|---------|-------|---------------------|
| Active tab | Green underline | Bold text, underline |
| Error status | Red dot | Triangle icon + "Error" text |
| Warning status | Amber dot | Warning icon + "Warning" text |
| Success status | Green dot | Check icon + "Complete" text |
| Rate group color | User-chosen | Name always displayed |

### Focus Management

```tsx
// When switching L1 category, focus first L2 tab
useEffect(() => {
  if (categoryChanged) {
    const firstL2Tab = document.querySelector('[data-level="2"][data-index="0"]');
    (firstL2Tab as HTMLElement)?.focus();
  }
}, [activeCategory]);

// When modal closes, return focus to trigger
const triggerRef = useRef<HTMLButtonElement>(null);

const closeModal = () => {
  setOpen(false);
  triggerRef.current?.focus();
};
```

### Reduced Motion

```tsx
// Respect user preference
const prefersReducedMotion = usePrefersReducedMotion();

<div className={cn(
  "transition-all",
  prefersReducedMotion
    ? "duration-0"
    : "duration-300 ease-out"
)}>
  {/* Content */}
</div>

// CSS approach
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Mobile Responsive Design

### Breakpoint Behavior

| Breakpoint | L1 Tabs | L2 Tabs | Layout |
|------------|---------|---------|--------|
| Desktop (1024px+) | Horizontal | Horizontal scroll | Side-by-side |
| Tablet (768-1023px) | Horizontal | Horizontal scroll | Stacked |
| Mobile (<768px) | Dropdown select | Horizontal scroll | Full-width |

### Mobile Tab Selector

```tsx
// Mobile: L1 becomes dropdown
<div className="lg:hidden">
  <Select value={activeCategory} onValueChange={setActiveCategory}>
    <SelectTrigger className="w-full">
      <SelectValue placeholder="Select category" />
    </SelectTrigger>
    <SelectContent>
      {categories.map(cat => (
        <SelectItem key={cat.id} value={cat.id}>
          <span className="flex items-center gap-2">
            <cat.icon className="h-4 w-4" />
            {cat.label}
          </span>
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>

// Desktop: Standard tabs
<div className="hidden lg:flex" role="tablist">
  {categories.map(cat => (
    <Tab key={cat.id} {...cat} />
  ))}
</div>
```

---

## Animation Specifications

### Timing Tokens

```css
:root {
  --duration-instant: 50ms;
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
  --duration-slower: 600ms;

  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.45, 0, 0.55, 1);
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### Component Animations

| Component | Animation | Duration | Easing |
|-----------|-----------|----------|--------|
| Tab underline | Slide | 200ms | ease-out |
| Tab content | Fade + slide | 250ms | ease-out |
| Modal open | Fade + scale | 200ms | ease-out |
| Modal close | Fade + scale | 150ms | ease-in |
| Toast enter | Slide from right | 300ms | ease-out |
| Toast exit | Fade out | 150ms | ease-in |
| Search results | Stagger fade | 30ms delay each | ease-out |
| Success check | Scale + fade | 300ms | bounce |
| Badge pulse | Scale | 1000ms | ease-in-out, infinite |

---

## Implementation Priority

### Phase 1: Foundation
1. Tab navigation component (all 3 levels)
2. Settings layout wrapper
3. Global search
4. Route structure

### Phase 2: Core Features
1. System Check dashboard
2. Rate Groups with colors
3. Custom Fields (UDFs)
4. Equipment Types

### Phase 3: Advanced Features
1. Grid Optimization
2. Site Closures
3. Lock Codes
4. Referral Sources

### Phase 4: Polish
1. Celebration moments
2. Progress tracking
3. Keyboard shortcuts panel
4. Mobile optimization
