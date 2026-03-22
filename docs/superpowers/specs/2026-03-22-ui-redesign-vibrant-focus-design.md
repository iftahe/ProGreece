# ProGreece UI Redesign — "Vibrant Focus"

**Date:** 2026-03-22
**Type:** Visual refresh (no structural/feature changes)
**Scope:** All 11 pages, shared components, Tailwind config, global CSS

## Overview

A visual refresh of the ProGreece financial management app. The current design is functional but generic. The redesign applies a "Vibrant Focus" aesthetic: strategic use of indigo/purple gradients on key elements (hero KPI, primary buttons, sidebar active state, chart bars) against a clean white canvas. Dense, power-user layout is preserved.

**Design direction:** Bold & Vibrant
**Navigation:** Sidebar stays, restyled with deep indigo + gradient accents
**Density:** Maximum data density preserved (power-user)
**Philosophy:** Color is used strategically — gradient hero KPI, gradient primary buttons, indigo chart bars. The rest stays clean white. Vibrant moments punctuate a clean canvas.

## Design System Foundations

### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `primary-500` | `#6366f1` (Indigo) | Primary actions, active states, chart bars |
| `primary-600` | `#4f46e5` | Hover states, darker accents |
| `primary-gradient` | CSS class `.bg-primary-gradient` defined in `index.css` as `background: linear-gradient(135deg, #6366f1, #8b5cf6)` | Hero KPI, sidebar active, primary buttons |
| `sidebar-bg` | `#1e1b4b` | Sidebar background (deep indigo) |
| `sidebar-hover` | `#2e2a5e` | Sidebar hover state |
| `sidebar-active` | gradient `#6366f1 → #8b5cf6` | Active nav item |
| `sidebar-text` | `#a5b4fc` | Sidebar nav text |
| `sidebar-section` | `#6366f1` | Sidebar section labels |
| `page-bg` | `#f8fafc` | Page background (slate-50) |
| `card-bg` | `#ffffff` | Card backgrounds |
| `card-border` | `#e5e7eb` | Card borders (gray-200) |
| `income` | `#10b981` | Green — positive amounts, healthy status |
| `expense` | `#dc2626` | Red — negative amounts, danger |
| `warning` | `#f59e0b` | Amber — overdue, partial |
| `text-primary` | `#111827` | Headings, large values |
| `text-secondary` | `#6b7280` | Labels, descriptions |

### Typography

Font: Inter (unchanged)

| Element | Classes | Spec |
|---------|---------|------|
| Page titles | `text-lg font-extrabold` | 18px, weight 800 |
| KPI values | `text-2xl font-extrabold` | 24px, weight 800 |
| Card headings | `text-sm font-bold` | 14px, weight 700 |
| Labels | `text-xs uppercase tracking-wide text-gray-500` | 12px, uppercase |
| Body text | `text-sm` | 14px, weight 400 |
| Financial amounts | `font-mono tabular-nums font-semibold` | Monospace font family + weight 600 |

### Border Radius

| Element | Value |
|---------|-------|
| Cards | `rounded-xl` (12px) |
| Buttons, Inputs | `rounded-lg` (8px) |
| Badges | `rounded-md` (6px) |
| Modals | `rounded-2xl` (16px) |

### Shadows

Cards use `shadow-sm` only. No heavy shadows. Clean borders + subtle shadow.

## Layout & Sidebar

### Sidebar

- Background: `#1e1b4b` (deep indigo, replacing current `#1a1f36`)
- Logo: "P" in gradient `#818cf8 → #c084fc` rounded square
- Section labels: `#6366f1`, uppercase, small letter-spacing
- Nav links: `#a5b4fc` default, white on hover with `#2e2a5e` background
- Active link: gradient `#6366f1 → #8b5cf6` background, white text, `rounded-lg`
- Project dropdown: indigo accent border, deep indigo tones
- Width: `w-64` (16rem, unchanged)
- Mobile: hamburger menu pattern unchanged

### Page Layout

- Page background: `#f8fafc` (slate-50, unchanged)
- Content max-width: `max-w-7xl` (unchanged)
- Breadcrumbs: kept, active crumb in indigo
- Page header: title + subtitle left, action buttons right (consistent pattern across all pages)
- No structural changes to navigation grouping or project scoping

## Component System

### KPI Cards

- **Hero card** (primary metric): gradient `#6366f1 → #8b5cf6` background, white text, `rounded-xl`, slightly wider (`flex: 1.3`)
- **Regular cards**: white background, `border border-gray-200`, `rounded-xl`
- Labels: `text-xs uppercase tracking-wide text-gray-500`
- Values: `text-2xl font-extrabold text-gray-900`
- Status indicators: colored text with directional arrow

### Buttons

- **Primary**: `.bg-primary-gradient` background, white text, `rounded-lg`, hover via `filter brightness-90` transition
- **Secondary**: white background, `border border-gray-200`, gray text, hover `bg-gray-50`
- **Danger**: `bg-red-600`, white text, hover `bg-red-700` (delete actions)
- All buttons use shared `.btn-primary`, `.btn-secondary`, `.btn-danger` classes — no inline Tailwind overrides
- `.btn-danger` must be **created** in `src/index.css` (does not currently exist)

### Tables

- Header: `text-xs uppercase tracking-wide text-gray-500`, bottom border
- Body rows: white, no stripes
- Hover: `border-l-2 border-indigo-500` left accent + `bg-indigo-50/30` subtle tint
- Amounts: green for income, red for expense, `font-semibold tabular-nums`
- Pagination component used consistently across all table pages

### Modals

Unified to one pattern (replacing current inconsistent implementations):
- `rounded-2xl`, `shadow-xl`
- Semi-transparent backdrop at `opacity-50`
- Header: bold title + X close button
- Footer: action buttons right-aligned

### Forms

- All inputs: `.input-field` class — `rounded-lg border-gray-300 focus:ring-indigo-500 focus:border-indigo-500`
- Labels: `text-sm font-medium text-gray-700`
- Error messages: `text-sm text-red-600` below the field
- No inline styling overrides

### Charts (Recharts)

**Chart Color Rules:**
- **Single-series bars** (e.g., forecast, budget timeline): indigo gradient `#6366f1 → #818cf8`
- **Income bars**: keep `#10b981` (green) — semantic meaning must be preserved
- **Expense bars**: keep `#dc2626` / `#fca5a5` (red/light red) — semantic meaning must be preserved
- **Planned vs actual differentiation**: actual = solid color, planned = same color at 40% opacity
- **Lines**: indigo `#6366f1` for primary trend lines

**General:**
- Grid lines: `#f3f4f6` (light gray)
- Tooltip: white card, `shadow-lg`, `rounded-lg`

**Implementation note:** Recharts gradient bars require an SVG `<defs>` block with `<linearGradient>` inside the chart, referenced via `fill="url(#gradientId)"`. Define a shared gradient ID (e.g., `indigo-bar-gradient`) reusable across chart components.

### Skeleton Loading

- Unified skeleton building blocks in `/src/components/Skeleton.jsx`
- Replaces per-page skeleton implementations (SkeletonDashboard, SkeletonPortfolio, etc.)
- Shimmer animation uses indigo tint instead of gray
- **Component API:**
  - `<SkeletonBlock className="..." />` — basic shimmer rectangle, accepts className for sizing
  - Each page composes `SkeletonBlock` elements to match its layout (e.g., 4 KPI blocks + chart block for dashboard)
  - No complex variant props — keep it simple, each page arranges blocks as needed

### Empty States

- Unified empty state in `/src/components/EmptyState.jsx`
- Replaces per-page inline empty state implementations (e.g., the local `EmptyState` in Reports.jsx)
- **Component API:**
  - `<EmptyState icon={<IconComponent />} message="No data found" action={<button>...</button>} />`
  - `icon`: optional, renders an indigo-tinted SVG icon
  - `message`: required, the text to display
  - `action`: optional, a call-to-action button

### Status Badges

- Shared component in `/src/components/StatusBadge.jsx`
- **Component API:**
  - `<StatusBadge variant="success|warning|danger|info">{label}</StatusBadge>`
  - Each page maps its domain status strings to a variant (e.g., `"Paid" → "success"`, `"Overdue" → "danger"`)

Unified color mapping:

| Variant | Classes |
|---------|---------|
| `success` | `bg-emerald-100 text-emerald-700` |
| `warning` | `bg-amber-100 text-amber-700` |
| `danger` | `bg-red-100 text-red-700` |
| `info` | `bg-indigo-100 text-indigo-700` |

## Page-Specific Changes

This is a visual refresh. No new features, no layout restructuring. Every page keeps its current structure and data.

### All Pages

- Apply new color tokens, button classes, input classes, badge patterns
- Replace inline Tailwind overrides with shared utility classes
- Consistent page header pattern (title + subtitle left, actions right)

### Portfolio Dashboard & Project Dashboard

- Hero gradient KPI for the primary metric
- Chart bars switch to indigo gradient
- Grid layout unchanged

### Transactions

- Table hover accent style
- Filter inputs use `.input-field`
- Import/action buttons use `.btn-primary` gradient

### Apartments

- Status badges use shared badge pattern
- Progress bars get indigo fill
- Payment status colors align with new semantic palette

### Budget Report

- Timeline bars use indigo gradient
- Plan vs actual structure unchanged

### Reports (all 8 sub-reports: P&L, Plan vs Actual, Invoice Details, Customer Transactions, Customer Balance, VAT, Withholding Tax, Payments by Project)

- Charts switch to indigo gradient palette (preserving income/expense semantic colors)
- Tables get consistent hover style
- Replace the local inline `EmptyState` component in Reports.jsx with the shared `EmptyState` component
- Filter bar restyled with `.input-field` class

### Invoices

- Status badges unified
- Table hover style applied
- Import/create buttons use gradient primary

### Projects

- Admin table/card layout — apply new card styles, button classes
- Status indicators use shared `StatusBadge` component

### Counterparties & Customers

- Table hover style, button classes, badge styles applied

### Forecast

- Chart colors switch to indigo gradient
- Monthly drilldown modal uses unified modal pattern

## Implementation Notes

### Files to modify

**Config & Global:**
- `tailwind.config.js` — update custom color tokens (sidebar, primary)
- `src/index.css` — update utility classes (`.btn-primary`, `.btn-secondary`, `.btn-danger`, `.input-field`, `.card`, table classes, badge classes)

**Shared Components:**
- `src/components/Layout.jsx` — restyle sidebar colors, active states, breadcrumbs
- `src/components/Icons.jsx` — no changes needed
- `src/components/ConfirmDialog.jsx` — apply unified modal pattern
- `src/components/Pagination.jsx` — apply new button styles
- `src/components/BudgetPlanEditor.jsx` — apply unified modal + form patterns
- New: `src/components/StatusBadge.jsx` — shared badge component
- New: `src/components/Skeleton.jsx` — unified skeleton loading component
- New: `src/components/EmptyState.jsx` — unified empty state component

**Pages (all 11):**
- Each page updated to use shared component classes
- Replace inline Tailwind overrides with utility classes
- Apply consistent page header pattern
- Apply chart color updates

### What does NOT change

- Navigation structure and grouping
- Page routes and routing logic
- Data fetching and state management
- API calls and backend
- Feature functionality
- Mobile hamburger menu behavior
- Project context/scoping system
