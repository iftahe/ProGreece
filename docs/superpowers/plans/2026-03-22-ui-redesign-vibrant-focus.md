# UI Redesign "Vibrant Focus" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Visual refresh of the ProGreece app with a "Vibrant Focus" aesthetic — indigo/purple gradients on key elements against a clean white canvas.

**Architecture:** Pure styling changes. No structural, routing, API, or state management changes. Update Tailwind config and CSS first (design tokens), then shared components (Layout, modals), then create new shared components (StatusBadge, EmptyState, SkeletonBlock), then apply to each page.

**Tech Stack:** React 18, Vite, Tailwind CSS 3.4.17, Recharts 3.6.0

**Spec:** `docs/superpowers/specs/2026-03-22-ui-redesign-vibrant-focus-design.md`

**Branch:** All work on a new branch `feature/ui-redesign-vibrant-focus` off `main`.

---

## File Structure

### Modified Files
| File | Responsibility |
|------|---------------|
| `frontend/tailwind.config.js` | Color tokens (primary, sidebar) |
| `frontend/src/index.css` | Utility classes (.btn-primary, .btn-secondary, .btn-danger, .card, .input-field, .skeleton, .table-row-accent, .amount, .bg-primary-gradient) |
| `frontend/src/components/Layout.jsx` | Sidebar, nav links, breadcrumbs, mobile header |
| `frontend/src/components/ConfirmDialog.jsx` | Unified modal pattern + .btn-danger |
| `frontend/src/components/Pagination.jsx` | Indigo active page, button styling |
| `frontend/src/components/BudgetPlanEditor.jsx` | Modal + form styling alignment |
| `frontend/src/pages/PortfolioDashboard.jsx` | Hero KPI, chart colors |
| `frontend/src/pages/Dashboard.jsx` | Hero KPI, chart colors (preserve income/expense semantics) |
| `frontend/src/pages/Transactions.jsx` | Table hover, buttons, filters |
| `frontend/src/pages/Apartments.jsx` | Badges, progress bars, table |
| `frontend/src/pages/BudgetReport.jsx` | Timeline bars, chart colors |
| `frontend/src/pages/Reports.jsx` | Charts, tables, replace inline EmptyState |
| `frontend/src/pages/Invoices.jsx` | Badges, table, buttons |
| `frontend/src/pages/Forecast.jsx` | Chart colors, modal styling |
| `frontend/src/pages/Projects.jsx` | Cards, buttons, badges |
| `frontend/src/pages/Counterparties.jsx` | Table, buttons |
| `frontend/src/pages/Customers.jsx` | Table, buttons |

### New Files
| File | Responsibility |
|------|---------------|
| `frontend/src/components/StatusBadge.jsx` | Shared badge: `<StatusBadge variant="success\|warning\|danger\|info">{label}</StatusBadge>` |
| `frontend/src/components/EmptyState.jsx` | Shared empty state: `<EmptyState icon={...} message="..." action={...} />` |
| `frontend/src/components/Skeleton.jsx` | Shimmer block: `<SkeletonBlock className="h-8 w-full" />` (exports `SkeletonBlock`) |

---

## Task 1: Create branch and update Tailwind config

**Files:**
- Modify: `frontend/tailwind.config.js` (lines 12-32)

- [ ] **Step 1: Create the feature branch**

```bash
git checkout -b feature/ui-redesign-vibrant-focus
```

- [ ] **Step 2: Update color tokens in tailwind.config.js**

Replace the `colors` object (lines 12-32) with:

```javascript
primary: {
  50: '#eef2ff',
  100: '#e0e7ff',
  200: '#c7d2fe',
  300: '#a5b4fc',
  400: '#818cf8',
  500: '#6366f1',
  600: '#4f46e5',
  700: '#4338ca',
  800: '#3730a3',
  900: '#312e81',
},
sidebar: {
  DEFAULT: '#1e1b4b',
  hover: '#2e2a5e',
  // Note: sidebar active state now uses .bg-primary-gradient CSS class, not a Tailwind token
},
income: '#10b981',
expense: '#dc2626',
```

- [ ] **Step 3: Verify the dev server starts without errors**

Run: `cd frontend && npm run dev`
Expected: Vite dev server starts, no Tailwind compilation errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/tailwind.config.js
git commit -m "feat(ui): update Tailwind color tokens to indigo palette"
```

---

## Task 2: Update global CSS utility classes

**Files:**
- Modify: `frontend/src/index.css` (lines 13-68)

- [ ] **Step 1: Add `.bg-primary-gradient` class**

Add after the existing utility classes:

```css
.bg-primary-gradient {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
}
```

- [ ] **Step 2: Update `.btn-primary` (lines 36-40)**

Replace with:

```css
.btn-primary {
  @apply bg-primary-gradient text-white font-medium rounded-lg px-4 py-2 transition-all;
  &:hover {
    filter: brightness(0.9);
  }
}
```

- [ ] **Step 3: Update `.btn-secondary` (lines 42-46)**

Replace with:

```css
.btn-secondary {
  @apply bg-white text-gray-700 font-medium rounded-lg px-4 py-2 border border-gray-200 transition-colors hover:bg-gray-50;
}
```

- [ ] **Step 4: Create `.btn-danger` (does not exist yet)**

Add after `.btn-secondary`:

```css
.btn-danger {
  @apply bg-red-600 text-white font-medium rounded-lg px-4 py-2 transition-colors hover:bg-red-700;
}
```

- [ ] **Step 5: Update `.skeleton` (lines 19-21)**

Replace with indigo-tinted shimmer:

```css
.skeleton {
  @apply animate-pulse-slow rounded-lg bg-indigo-100/50;
}
```

- [ ] **Step 6: Update `.table-row-accent` (lines 63-68)**

Replace with:

```css
.table-row-accent {
  @apply transition-colors duration-150;
}
.table-row-accent:hover {
  @apply bg-indigo-50/30 border-l-2 border-l-indigo-500;
}
```

- [ ] **Step 7: Update `.amount` (lines 53-55)**

Replace with:

```css
.amount {
  @apply font-mono tabular-nums font-semibold;
}
```

- [ ] **Step 8: Update `.card` border color (line 25)**

Change `border-gray-100` to `border-gray-200` to match the spec's `card-border: #e5e7eb`:

```css
.card {
  @apply bg-white border border-gray-200 shadow-sm rounded-xl;
}
```

- [ ] **Step 9: Verify dev server renders correctly**

Run: `cd frontend && npm run dev`
Expected: No compilation errors. Buttons, cards, and skeleton animations reflect new colors.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(ui): update global CSS — gradient buttons, indigo skeleton, table hover, card border"
```

---

## Task 3: Create StatusBadge component

**Files:**
- Create: `frontend/src/components/StatusBadge.jsx`

- [ ] **Step 1: Create the component**

```jsx
const variantClasses = {
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-indigo-100 text-indigo-700',
};

export default function StatusBadge({ variant = 'info', children }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${variantClasses[variant] || variantClasses.info}`}>
      {children}
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/StatusBadge.jsx
git commit -m "feat(ui): add shared StatusBadge component"
```

---

## Task 4: Create EmptyState component

**Files:**
- Create: `frontend/src/components/EmptyState.jsx`

- [ ] **Step 1: Create the component**

```jsx
export default function EmptyState({ icon, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && (
        <div className="text-indigo-300 mb-4">
          {icon}
        </div>
      )}
      <p className="text-sm text-gray-500 mb-4">{message}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/EmptyState.jsx
git commit -m "feat(ui): add shared EmptyState component"
```

---

## Task 5: Create Skeleton component

**Files:**
- Create: `frontend/src/components/Skeleton.jsx`

- [ ] **Step 1: Create the component**

```jsx
export function SkeletonBlock({ className = 'h-4 w-full' }) {
  return <div className={`skeleton ${className}`} />;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Skeleton.jsx
git commit -m "feat(ui): add shared Skeleton component with SkeletonBlock"
```

---

## Task 6: Restyle Layout sidebar and navigation

**Files:**
- Modify: `frontend/src/components/Layout.jsx` (lines 34-182)

- [ ] **Step 1: Update SectionLabel styling (line 36)**

Change from:
```
text-[11px] font-semibold text-slate-500 uppercase tracking-wider
```
To:
```
text-[11px] font-semibold text-indigo-400 uppercase tracking-wider
```

This maps to the spec's `sidebar-section: #6366f1` — using `text-indigo-400` (`#818cf8`) for readability on the dark background.

- [ ] **Step 2: Update NavLink active/inactive styles (lines 50-55)**

Change active state from `bg-sidebar-active text-white` to:
```
bg-primary-gradient text-white rounded-lg
```

Change inactive state from `text-slate-300 hover:bg-sidebar-hover hover:text-white` to:
```
text-indigo-300 hover:bg-sidebar-hover hover:text-white
```

- [ ] **Step 3: Update sidebar background (line 71)**

Change from `bg-sidebar` to `bg-[#1e1b4b]` (or ensure tailwind.config.js sidebar.DEFAULT maps correctly — it should after Task 1).

- [ ] **Step 4: Update branding/logo (lines 73-81)**

Change logo badge from `bg-primary-500` to `bg-primary-gradient` (use the `.bg-primary-gradient` class or inline `background: linear-gradient(135deg, #818cf8, #c084fc)`).

Update brand text color from white to `text-indigo-100`.

- [ ] **Step 5: Update project selector (lines 97-110)**

Update border from `border-white/10` to `border-indigo-500/30`.
Update focus ring from `border-primary-400` to `border-indigo-400`.

- [ ] **Step 6: Update sidebar footer (lines 131-132)**

Update border from `border-white/10` to `border-indigo-500/20`.
Update text from `text-slate-500` to `text-indigo-400/50`.

- [ ] **Step 7: Update breadcrumbs (lines 160-169)**

Update active breadcrumb text to `text-indigo-600` (from `text-gray-700`).

- [ ] **Step 8: Update mobile header logo (around line 209)**

The mobile header also has a "P" logo badge using `bg-primary-500`. Update it to use `.bg-primary-gradient` (or inline `style={{ background: 'linear-gradient(135deg, #818cf8, #c084fc)' }}`) to match the sidebar logo.

- [ ] **Step 9: Visual verification**

Open the app in browser. Check:
- Sidebar has deep indigo background
- Active nav link has gradient background
- Section labels are indigo-tinted
- Logo has gradient background
- Breadcrumbs show indigo active state

- [ ] **Step 10: Commit**

```bash
git add frontend/src/components/Layout.jsx
git commit -m "feat(ui): restyle sidebar with deep indigo + gradient accents"
```

---

## Task 7: Update ConfirmDialog modal

**Files:**
- Modify: `frontend/src/components/ConfirmDialog.jsx` (lines 8-26)

- [ ] **Step 1: Update confirm button to use `.btn-danger`**

Change the danger variant button (lines 19-22) from inline `bg-rose-600 hover:bg-rose-700` to just `btn-danger`.

Change the default variant button from `bg-primary-600 hover:bg-primary-700` to `btn-primary`.

- [ ] **Step 2: Verify modal looks correct**

Open app, trigger a delete confirmation. Check:
- Rounded-2xl modal (already uses card-modal)
- Red danger button with proper hover
- Clean backdrop

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ConfirmDialog.jsx
git commit -m "feat(ui): update ConfirmDialog to use shared button classes"
```

---

## Task 8: Update Pagination component

**Files:**
- Modify: `frontend/src/components/Pagination.jsx` (lines 29-72)

- [ ] **Step 1: Update active page button color (line ~52)**

Change from `bg-primary-600 text-white` to `bg-primary-500 text-white` (indigo-500).

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Pagination.jsx
git commit -m "feat(ui): update Pagination active state to indigo-500"
```

---

## Task 9: Update BudgetPlanEditor styling

**Files:**
- Modify: `frontend/src/components/BudgetPlanEditor.jsx` (lines 93-187)

- [ ] **Step 1: Update container border (line 93)**

Change `border-primary-200` to `border-indigo-200`.

- [ ] **Step 2: Update action button hover states (lines 160-167)**

Change `text-primary-600 bg-primary-50` to `text-indigo-600 bg-indigo-50`.

- [ ] **Step 3: Verify the budget plan editor renders correctly**

Navigate to Budget Report, open the plan editor. Check colors are consistent with new indigo palette.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/BudgetPlanEditor.jsx
git commit -m "feat(ui): update BudgetPlanEditor to indigo palette"
```

---

## Task 10: Update PortfolioDashboard page

**Files:**
- Modify: `frontend/src/pages/PortfolioDashboard.jsx`

- [ ] **Step 1: Add hero gradient to primary KPI card**

Find the first/primary KPI card (the most important metric). Replace its white background with `bg-primary-gradient text-white`. Update inner text colors: label becomes `text-white/80`, value stays white, subtitle becomes `text-indigo-200`.

- [ ] **Step 2: Update chart colors**

Find Recharts `<Bar>` or `<ComposedChart>` usage. For single-series bars, add an SVG gradient definition inside the chart:

```jsx
<defs>
  <linearGradient id="indigo-bar-gradient" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stopColor="#818cf8" />
    <stop offset="100%" stopColor="#6366f1" />
  </linearGradient>
</defs>
```

Then use `fill="url(#indigo-bar-gradient)"` on single-series `<Bar>` components.

**Keep income bars green and expense bars red** — only change single-series/non-semantic bars to indigo.

- [ ] **Step 3: Update any inline button classes**

Replace any inline `bg-primary-600`/`bg-primary-700` button styles with `btn-primary` class.

- [ ] **Step 4: Update Recharts tooltip styling**

On any `<Tooltip>` components, add `contentStyle` prop:
```jsx
<Tooltip contentStyle={{ borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', border: 'none' }} />
```

- [ ] **Step 5: Replace skeleton loading with SkeletonBlock**

Import `{ SkeletonBlock }` from `../components/Skeleton`. Find the local `SkeletonPortfolio` component (around line 40) and replace it with a composition of `<SkeletonBlock>` elements matching the page layout. Remove the `SkeletonPortfolio` function definition.

- [ ] **Step 6: Visual verification**

Check: hero KPI card has gradient, chart bars are indigo, buttons are gradient, loading skeleton is indigo-tinted.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/PortfolioDashboard.jsx
git commit -m "feat(ui): restyle PortfolioDashboard — hero KPI, indigo charts"
```

---

## Task 11: Update Dashboard page

**Files:**
- Modify: `frontend/src/pages/Dashboard.jsx`

- [ ] **Step 1: Add hero gradient to primary KPI card**

Same pattern as Task 10 — gradient on the most important KPI.

- [ ] **Step 2: Update chart colors (preserve semantics)**

This page has multi-series charts with income (green) and expense (red) bars. **Do NOT change these to indigo.** Only apply indigo gradient to any single-series or non-semantic bars/lines.

Add the SVG gradient `<defs>` block for any eligible bars.

- [ ] **Step 3: Update inline button classes to `btn-primary`/`btn-secondary`**

- [ ] **Step 4: Update Recharts tooltip styling**

Same `contentStyle` pattern as Task 10 Step 4.

- [ ] **Step 5: Replace skeleton loading with SkeletonBlock**

Import `{ SkeletonBlock }` from `../components/Skeleton`. Find the local `SkeletonDashboard` component (around line 35) and replace with `<SkeletonBlock>` compositions. Remove the `SkeletonDashboard` function definition.

- [ ] **Step 6: Visual verification**

Check: hero KPI gradient, income stays green, expense stays red, buttons are gradient.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/Dashboard.jsx
git commit -m "feat(ui): restyle Dashboard — hero KPI, preserve semantic chart colors"
```

---

## Task 12: Update Transactions page

**Files:**
- Modify: `frontend/src/pages/Transactions.jsx`

- [ ] **Step 1: Update table rows to use `.table-row-accent` consistently**

Ensure all table body rows have the `table-row-accent` class for the indigo hover effect.

- [ ] **Step 2: Update filter inputs to use `.input-field`**

Replace any inline input styling with the `input-field` class.

- [ ] **Step 3: Update buttons to shared classes**

Replace inline button styles with `btn-primary`, `btn-secondary`, or `btn-danger` as appropriate.

- [ ] **Step 4: Replace skeleton loading with SkeletonBlock**

Import `{ SkeletonBlock }` from `../components/Skeleton`. Find the local skeleton component and replace with `<SkeletonBlock>` compositions. Remove the local skeleton function.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Transactions.jsx
git commit -m "feat(ui): restyle Transactions — indigo table hover, shared buttons"
```

---

## Task 13: Update Apartments page

**Files:**
- Modify: `frontend/src/pages/Apartments.jsx`

- [ ] **Step 1: Replace inline status badges with StatusBadge component**

Import `StatusBadge` from `../components/StatusBadge`. Map existing status strings to variants:
- Paid/Completed → `success`
- Partial → `warning`
- Unpaid → `danger`
- Active/other → `info`

- [ ] **Step 2: Update progress bars to indigo fill**

Change progress bar fill colors from current blue to `bg-indigo-500` or `bg-primary-500`.

- [ ] **Step 3: Update buttons to shared classes**

- [ ] **Step 4: Replace skeleton loading with SkeletonBlock**

Import `{ SkeletonBlock }` from `../components/Skeleton`. Find and remove the local skeleton component. Replace with `<SkeletonBlock>` compositions.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Apartments.jsx
git commit -m "feat(ui): restyle Apartments — StatusBadge, indigo progress bars"
```

---

## Task 14: Update BudgetReport page

**Files:**
- Modify: `frontend/src/pages/BudgetReport.jsx`

- [ ] **Step 1: Update timeline bar colors to indigo gradient**

Find Recharts bar components. Apply indigo gradient SVG `<defs>` for non-semantic bars. Keep any actual-vs-planned color distinctions (actual = solid, planned = 40% opacity).

- [ ] **Step 2: Update buttons to shared classes**

- [ ] **Step 3: Replace skeleton loading with SkeletonBlock**

Import `{ SkeletonBlock }` from `../components/Skeleton`. Find and remove the local `SkeletonBudgetReport` component (around line 8). Replace with `<SkeletonBlock>` compositions.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/BudgetReport.jsx
git commit -m "feat(ui): restyle BudgetReport — indigo timeline bars"
```

---

## Task 15: Update Reports page

**Files:**
- Modify: `frontend/src/pages/Reports.jsx`

- [ ] **Step 1: Replace inline EmptyState with shared EmptyState component**

Import `EmptyState` from `../components/EmptyState`. Find the local `EmptyState` component definition in Reports.jsx and remove it. Replace all usages with the shared component.

- [ ] **Step 2: Update chart colors to indigo gradient palette**

Add SVG gradient `<defs>` for applicable charts. Preserve income/expense semantic colors.

- [ ] **Step 3: Update table hover styles**

Apply `table-row-accent` class to table rows.

- [ ] **Step 4: Update filter inputs to `.input-field`**

- [ ] **Step 5: Update buttons to shared classes**

- [ ] **Step 6: Replace skeleton loading with SkeletonBlock**

Import `{ SkeletonBlock }` from `../components/Skeleton`. Find and remove the local `SkeletonTable` component (around line 48). Replace with `<SkeletonBlock>` compositions.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/Reports.jsx
git commit -m "feat(ui): restyle Reports — shared EmptyState, indigo charts, table hover"
```

---

## Task 16: Update Invoices page

**Files:**
- Modify: `frontend/src/pages/Invoices.jsx`

- [ ] **Step 1: Replace inline status badges with StatusBadge**

Map: Paid → `success`, Partial → `warning`, Unpaid → `danger`, Draft → `info`.

- [ ] **Step 2: Update table rows with `.table-row-accent`**

- [ ] **Step 3: Update buttons to shared classes**

- [ ] **Step 4: Replace skeleton loading with SkeletonBlock**

Import `{ SkeletonBlock }` from `../components/Skeleton`. Find and remove the local `SkeletonInvoices` component (around line 9). Replace with `<SkeletonBlock>` compositions.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Invoices.jsx
git commit -m "feat(ui): restyle Invoices — StatusBadge, table hover, shared buttons"
```

---

## Task 17: Update Forecast page

**Files:**
- Modify: `frontend/src/pages/Forecast.jsx`

- [ ] **Step 1: Update chart colors**

Apply indigo gradient for forecast bars (single-series). Add SVG `<defs>` gradient.

- [ ] **Step 2: Update modal to unified pattern**

Ensure the monthly drilldown modal uses `card-modal` class and consistent backdrop.

- [ ] **Step 3: Replace inline badges with StatusBadge if applicable**

- [ ] **Step 4: Update buttons to shared classes**

- [ ] **Step 5: Replace skeleton loading with SkeletonBlock**

Import `{ SkeletonBlock }` from `../components/Skeleton`. Find and remove the local skeleton component. Replace with `<SkeletonBlock>` compositions.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Forecast.jsx
git commit -m "feat(ui): restyle Forecast — indigo charts, unified modal"
```

---

## Task 18: Update Projects page

**Files:**
- Modify: `frontend/src/pages/Projects.jsx`

- [ ] **Step 1: Replace inline status indicators with StatusBadge**

- [ ] **Step 2: Update buttons to shared classes**

- [ ] **Step 3: Update card styling if needed**

Ensure cards use `.card` class consistently.

- [ ] **Step 4: Replace skeleton loading with SkeletonBlock**

Import `{ SkeletonBlock }` from `../components/Skeleton`. Find and remove the local `SkeletonProjects` component (around line 28). Replace with `<SkeletonBlock>` compositions.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Projects.jsx
git commit -m "feat(ui): restyle Projects — StatusBadge, shared buttons"
```

---

## Task 19: Update Counterparties page

**Files:**
- Modify: `frontend/src/pages/Counterparties.jsx`

- [ ] **Step 1: Update table rows with `.table-row-accent`**

- [ ] **Step 2: Update buttons to shared classes**

- [ ] **Step 3: Replace skeleton loading with SkeletonBlock**

Import `{ SkeletonBlock }` from `../components/Skeleton`. Find and remove the local `SkeletonCounterparties` component (around line 6). Replace with `<SkeletonBlock>` compositions.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Counterparties.jsx
git commit -m "feat(ui): restyle Counterparties — table hover, shared buttons"
```

---

## Task 20: Update Customers page

**Files:**
- Modify: `frontend/src/pages/Customers.jsx`

- [ ] **Step 1: Update table rows with `.table-row-accent`**

- [ ] **Step 2: Update buttons to shared classes**

- [ ] **Step 3: Replace skeleton loading with SkeletonBlock**

Import `{ SkeletonBlock }` from `../components/Skeleton`. Find and remove the local `SkeletonCustomers` component (around line 6). Replace with `<SkeletonBlock>` compositions.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Customers.jsx
git commit -m "feat(ui): restyle Customers — table hover, shared buttons"
```

---

## Task 21: Final visual verification and cleanup

**Files:**
- All modified files

- [ ] **Step 1: Full visual walkthrough**

Open each page in the browser and verify:
1. Portfolio Dashboard — hero KPI gradient, indigo charts
2. Dashboard — hero KPI, semantic chart colors preserved
3. Transactions — indigo table hover, gradient buttons
4. Apartments — StatusBadge, indigo progress bars
5. Budget Report — indigo timeline bars
6. Reports (all 8 tabs) — shared EmptyState, indigo charts
7. Invoices — StatusBadge, table hover
8. Forecast — indigo charts, unified modal
9. Projects — StatusBadge, shared buttons
10. Counterparties — table hover
11. Customers — table hover
12. Sidebar — deep indigo, gradient active, indigo section labels
13. Modals — consistent rounded-2xl pattern
14. Mobile hamburger menu — works correctly

- [ ] **Step 2: Check for any remaining inline primary-600/primary-700 references**

Search across all frontend files for `primary-600`, `primary-700`, `bg-blue-`, `bg-rose-` to find any missed inline overrides that should use shared classes instead.

```bash
cd frontend && grep -rn "primary-600\|primary-700\|bg-blue-\|bg-rose-" src/ --include="*.jsx"
```

Fix any remaining occurrences.

- [ ] **Step 3: Run the build to check for errors**

```bash
cd frontend && npm run build
```

Expected: Clean build with no errors.

- [ ] **Step 4: Final commit if any cleanup was needed**

```bash
git add -A
git commit -m "feat(ui): final visual cleanup and consistency pass"
```
