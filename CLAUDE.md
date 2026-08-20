# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # dev server on http://localhost:3000
npm run build    # production build
npm start        # serve the production build
npm run lint     # eslint (flat config, eslint-config-next/core-web-vitals)
                 # NOTE: `next lint` was removed in Next 16 — call eslint directly
```

No test runner is configured in this project.

## Architecture

Next.js 16 App Router app (`app/`), **JavaScript only — no TypeScript** (`components.json` sets `"tsx": false`; `jsconfig.json` maps `@/*` to the repo root). New components must be `.js`/`.jsx`.

The Next.js version here predates common training data — consult `node_modules/next/dist/docs/` (see `01-app/`) before writing routing, data-fetching, or config code rather than relying on remembered APIs.

- `app/layout.js` — root layout; loads Geist/Geist Mono via `next/font/google` into `--font-geist-sans` / `--font-geist-mono`, and sets the `html`/`body` full-height flex column shell.
- `app/globals.css` — the single styling source of truth. Tailwind v4 (no `tailwind.config.js`; PostCSS plugin only). Imports `tailwindcss`, `tw-animate-css`, and `shadcn/tailwind.css`, then declares the design tokens: `@theme inline` maps Tailwind color/radius utilities onto CSS variables, and `:root` / dark-variant blocks define them in oklch. Change colors and radii here, not in component classes. Dark mode is class-based (`@custom-variant dark (&:is(.dark *))`).
- `components/ui/` — shadcn components, style `base-maia`, base color `mauve`, built on **`@base-ui/react`** primitives (not Radix) with `class-variance-authority` variants. Add components via the shadcn CLI so they land here with the configured style; follow `button.jsx`'s pattern (cva variants + `cn()` + spread props onto the Base UI primitive).
- `lib/utils.js` — `cn()` (clsx + tailwind-merge), used by every UI component.

Icons come from `lucide-react`.

## Booking domain

The seat-booking feature is built around a **data-driven floor plan**, transcribed from the printed Toyota Coaster plan:

- `lib/bus-layout.js` — `BUS_LAYOUT` is the single source of truth for geometry and pricing. `col` runs front-to-rear; `band` is the lateral position across the bus. The map draws **top-down**: a plan column becomes a grid row, a band becomes a grid column. `BANDS` is in render order, left to right — `C` (door side), `D`, `B`, `A` (window side, its front position being the driver's seat). Band `D` is the plan's middle row — gangway and wheel arches — and is **not countable**. Reordering `BANDS` also reorders the last row's `R1`–`R4`, since the bench is built by mapping over it.
- A seat's `row` is its logical group (labels, ordering) and `band` is where it renders. They differ only for the **last row**, a single bench spanning the full width of the rear: one seat per band, all in the rear column, so it is the one thing that crosses `D`.
- **21 sellable seats**: A2–A7, B2–B7, C1, C4–C7, R1–R4. Non-bookable positions are fixtures, not seats — column 1 of bands A/B is cab (`A1` the **driver's seat**, `B1` blocked beside it), `C2` is the coolbox, `C3` the door, and `D3`–`D7` the wheel arches. Note `C1` *is* a seat, and there is no `B1` or `C2`. `REAR_COLUMN` must equal the highest seat column, or the map renders an empty gap. Fares come from `SEAT_TYPES`: columns 1–2 are `front`, the last row is `rear`, everything else `standard`.
- `components/booking/seat-map.jsx` renders whatever bands/cols/fixtures it is handed, so a new coach type means adding another `BUS_LAYOUT`-shaped object — not touching the UI.
- `lib/bookings-store.js` — process-local in-memory store, held on `globalThis` so dev hot-reloads don't re-seed it. Seeded from the plan's own occupancy, *derived from the layout* rather than listed seat by seat: everything starts sold except `SEEDED_FREE_SEATS` (A2, B2, C4, C1) and the undotted last row. That keeps the seed correct as columns are added or removed; it throws if a listed free seat no longer exists. All reads/writes go through the exported functions so swapping in a database touches only this file. Returns booking *snapshots*, never the stored object. Node is single-threaded per process, so keep each availability-check-then-assign in one synchronous block.
- `app/actions.js` — Server Actions. Reachable by direct POST, so seat IDs and passenger fields are re-validated server-side rather than trusted from the client, then `revalidatePath("/")`. A fixture position such as `A1` fails this check as an unknown seat.
- `app/page.js` — sets `export const dynamic = "force-dynamic"`: it reads the mutable store, so it must render per request instead of being prerendered.
- `app/api/availability/route.js` — read-only JSON availability feed, deliberately uncached.
- `components/booking/booking-flow.jsx` — the select → details → confirmation flow. `BookingFlow` remounts `BookingSession` via a `key` on "start over", which is how `useActionState` gets reset.

Two conventions worth keeping:

- **Derive, don't sync.** A selected seat can be sold by someone else mid-flow; the live selection is derived from the server's seat statuses. `eslint-plugin-react-hooks` errors on `setState` inside an effect (`react-hooks/set-state-in-effect`), so reach for derived state.
- **Deterministic formatting.** `lib/format.js` avoids `Intl` and `lib/trip.js` uses fixed time strings, so server and client markup can never diverge. Format money and timestamps through those helpers.

Relative imports inside `lib/` carry explicit `.js` extensions so the modules also run under plain Node (useful for quick logic checks); the `@/…` aliased imports need the bundler.

There is no trips table, auth, or payment step — the trip is a hardcoded `DEMO_TRIP` and "paying" just creates the booking.
