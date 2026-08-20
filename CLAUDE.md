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

MongoDB is required to run the app: copy `.env.example` to `.env.local` and set `MONGODB_URI`
(plus `MONGODB_DB`, default `bus_seat_booking`). Without it, any page that touches the store throws.

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

- `lib/bus-layout.js` — `BUSES` is the fleet and `BUS_LAYOUT` (the one Coaster) is the single source of truth for geometry. There is **no pricing anywhere in this app** — `SEAT_TYPES` carries labels only. `col` runs front-to-rear; `band` is the lateral position across the bus. The map draws **top-down**: a plan column becomes a grid row, a band becomes a grid column. `BANDS` is in render order, left to right — `C` (door side), `D`, `B`, `A` (window side, its front position being the driver's seat). Band `D` is the plan's middle row — gangway and wheel arches — and is **not countable**. Reordering `BANDS` also reorders the last row's `R1`–`R4`, since the bench is built by mapping over it.
- A seat's `row` is its logical group (labels, ordering) and `band` is where it renders. They differ only for the **last row**, a single bench spanning the full width of the rear: one seat per band, all in the rear column, so it is the one thing that crosses `D`.
- **21 sellable seats**: A2–A7, B2–B7, C1, C4–C7, R1–R4. Non-bookable positions are fixtures, not seats — column 1 of bands A/B is cab (`A1` the **driver's seat**, `B1` blocked beside it), `C2` is the coolbox, `C3` the door, and `D3`–`D7` the wheel arches. Note `C1` *is* a seat, and there is no `B1` or `C2`. `REAR_COLUMN` must equal the highest seat column, or the map renders an empty gap. `SEAT_TYPES` groups them for display only: columns 1–2 are `front`, the last row is `rear`, everything else `standard`. `getSeat` looks a seat up in the default bus; `getBusSeat(busId, seatId)` scopes it to one bus and is what the server validates against.
- `components/booking/seat-map.jsx` renders whatever bands/cols/fixtures it is handed, so a new coach means adding another `BUS_LAYOUT`-shaped object to `BUSES` — not touching the UI.
- `lib/mongodb.js` — the shared `MongoClient`, its `connect()` promise cached on `globalThis` so dev hot-reloads don't open a new pool per edit (a failed connect clears the cache instead of replaying forever). It also owns `ensureIndexes`, and those indexes are the enforcement mechanism for the booking rules below. `nextBookingRef()` `$inc`s a `counters` document for `BK-0001`-style refs.
- `lib/bookings-store.js` — every read and write against the `bookings` collection; all of it `async`. Snapshots are built field by field, so no `_id` (an `ObjectId` cannot cross the server/client boundary) and no live document ever reaches a caller. A booking is `{ref, busId, seatId, email, name, phone, status, createdAt}`; cancelling sets `status: "cancelled"` rather than deleting, which drops it out of both partial indexes. Nothing is seeded — a fresh database has all 21 seats free.
- **The two rules, and where they actually live.** One confirmed booking per seat per bus (`one_booking_per_seat` on `{busId, seatId}`) and **one confirmed booking per email across the whole fleet** (`one_seat_per_email` on `{email}` — `busId` is deliberately *not* in the key, which is what stops a passenger booking a second seat on a different bus). Both are `unique` and `partialFilterExpression: {status: "confirmed"}`. `createBooking` queries first only to produce a readable message; under a race the insert loses on the index, so its `11000` handler branches on `error.keyPattern` and returns the same message the pre-check would have. Never "simplify" that catch away.
- **Email is the identity.** There is no auth, so a normalized (trimmed, lower-cased) email is the user. `normalizeEmail` must be applied on every path that writes or looks up by email, or the same person books twice under `A@x.com` and `a@x.com`.
- `app/actions.js` — Server Actions (`reserveSeatAction`, `cancelBookingAction`). Reachable by direct POST, so `busId`, the single `seatId` and every passenger field are re-validated server-side rather than trusted from the client, then `revalidatePath("/")`. A fixture position such as `A1` fails this check as an unknown seat. Email is **required** here, unlike name/phone it is not just contact detail — the one-seat rule is keyed on it.
- `app/page.js` — an `async` server component that sets `export const dynamic = "force-dynamic"`: it reads the bookings collection, so it must render per request instead of being prerendered. It queries seat availability once and derives the counts with the pure `summarizeSeats`, rather than making the store round-trip twice.
- `app/api/availability/route.js` — read-only JSON availability feed, deliberately uncached.
- `components/booking/booking-flow.jsx` — the select → details → confirmation flow, **one seat at a time**: picking another seat replaces the pick instead of adding to it, and `SeatMap` takes a single `selectedSeatId`. `BookingFlow` remounts `BookingSession` via a `key` on "start over", which is how `useActionState` gets reset.

Two conventions worth keeping:

- **Derive, don't sync.** A selected seat can be taken by someone else mid-flow; the live selection is derived from the server's seat statuses. `eslint-plugin-react-hooks` errors on `setState` inside an effect (`react-hooks/set-state-in-effect`), so reach for derived state.
- **Deterministic formatting.** `lib/format.js` avoids `Intl` so server and client markup can never diverge. Format timestamps through `formatTimestamp`.

Relative imports inside `lib/` carry explicit `.js` extensions so the modules also run under plain Node (`node --env-file=.env.local` against `lib/bookings-store.js` is the quickest way to exercise the booking rules); the `@/…` aliased imports need the bundler.

**Scope, deliberately.** No trips, routes, timetables, fares, payment or auth — this is seat reservation and nothing else. Don't reintroduce any of them; if a feature seems to need one, ask first.
