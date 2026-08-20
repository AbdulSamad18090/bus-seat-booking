import { ALL_SEAT_IDS, BUS_LAYOUT, compareSeats, getSeat, seatFare, totalFare } from "./bus-layout.js";
import { DEMO_TRIP } from "./trip.js";

/**
 * Process-local booking store. Everything lives in memory, so bookings are lost
 * on server restart — swapping this file for a database is the only change the
 * rest of the app should need, which is why every read/write goes through the
 * exported functions rather than touching the maps directly.
 *
 * Node is single-threaded per process, so a synchronous check-then-write inside
 * one function body cannot interleave with another request. Keep the availability
 * check and the seat assignment in the same synchronous block.
 */

/**
 * Seeded from the printed plan: every seat starts sold except the green-dot
 * seats and the last row, which carries no dot at all.
 *
 * Derived from the layout rather than listed seat by seat, so it stays correct
 * as the floor plan is corrected and columns are added or removed.
 */
const SEEDED_FREE_SEATS = ["A2", "B2", "C1", "C4"];

function seededSoldSeats() {
  // The floor plan gets corrected as the real coach is surveyed; fail loudly
  // rather than quietly seeding against a seat that no longer exists.
  for (const seatId of SEEDED_FREE_SEATS) {
    if (!getSeat(seatId)) {
      throw new Error(`Seeded free seat ${seatId} is not in ${BUS_LAYOUT.id}`);
    }
  }
  const free = new Set(SEEDED_FREE_SEATS);
  return BUS_LAYOUT.seats
    .filter((seat) => seat.type !== "rear" && !free.has(seat.id))
    .map((seat) => seat.id);
}

function createStore() {
  const store = {
    /** ref -> booking */
    bookings: new Map(),
    /** seatId -> booking ref */
    seatOwners: new Map(),
    nextRef: 1,
  };

  // One synthetic booking per pre-sold seat, so the seeded state behaves exactly
  // like real bookings (it can be looked up and cancelled).
  for (const seatId of seededSoldSeats()) {
    const ref = nextBookingRef(store);
    const booking = {
      ref,
      tripId: DEMO_TRIP.id,
      seatIds: [seatId],
      passenger: { name: "Walk-in passenger", phone: "—", email: "" },
      amount: seatFare(seatId),
      status: "confirmed",
      seeded: true,
      createdAt: "2026-08-20T05:00:00.000Z",
    };
    store.bookings.set(ref, booking);
    store.seatOwners.set(seatId, ref);
  }

  return store;
}

/**
 * Callers get a detached copy: handing out the stored object would let a later
 * cancellation mutate a booking someone is still holding.
 */
function snapshot(booking) {
  return booking ? { ...booking, seatIds: [...booking.seatIds], passenger: { ...booking.passenger } } : null;
}

function nextBookingRef(store) {
  const ref = `BK-${String(store.nextRef).padStart(4, "0")}`;
  store.nextRef += 1;
  return ref;
}

// Held on globalThis so dev-server hot reloads keep the existing bookings
// instead of silently re-seeding a fresh store on every edit.
const store = (globalThis.__busBookingStore ??= createStore());

export function getSeatAvailability() {
  return ALL_SEAT_IDS.map((seatId) => ({
    id: seatId,
    status: store.seatOwners.has(seatId) ? "booked" : "available",
  }));
}

export function getAvailabilitySummary() {
  const booked = ALL_SEAT_IDS.filter((seatId) => store.seatOwners.has(seatId)).length;
  return { total: ALL_SEAT_IDS.length, booked, available: ALL_SEAT_IDS.length - booked };
}

export function getBooking(ref) {
  return snapshot(store.bookings.get(ref) ?? null);
}

export function listBookings() {
  return [...store.bookings.values()]
    .filter((booking) => !booking.seeded)
    .sort((a, b) => b.ref.localeCompare(a.ref))
    .map(snapshot);
}

/**
 * @returns {{ok: true, booking: object} | {ok: false, error: string, conflicts?: string[]}}
 */
export function createBooking({ seatIds, passenger }) {
  const requested = [...new Set(seatIds)].sort(compareSeats);

  if (requested.length === 0) {
    return { ok: false, error: "Select at least one seat." };
  }
  if (requested.length > BUS_LAYOUT.maxSeatsPerBooking) {
    return {
      ok: false,
      error: `You can book at most ${BUS_LAYOUT.maxSeatsPerBooking} seats at a time.`,
    };
  }

  const unknown = requested.filter((seatId) => !getSeat(seatId));
  if (unknown.length > 0) {
    return { ok: false, error: `Unknown seat: ${unknown.join(", ")}.` };
  }

  const conflicts = requested.filter((seatId) => store.seatOwners.has(seatId));
  if (conflicts.length > 0) {
    return {
      ok: false,
      error:
        conflicts.length === 1
          ? `Seat ${conflicts[0]} was just taken. Pick another one.`
          : `Seats ${conflicts.join(", ")} were just taken. Pick others.`,
      conflicts,
    };
  }

  const ref = nextBookingRef(store);
  const booking = {
    ref,
    tripId: DEMO_TRIP.id,
    seatIds: requested,
    passenger,
    amount: totalFare(requested),
    status: "confirmed",
    seeded: false,
    createdAt: new Date().toISOString(),
  };

  store.bookings.set(ref, booking);
  for (const seatId of requested) {
    store.seatOwners.set(seatId, ref);
  }

  return { ok: true, booking: snapshot(booking) };
}

export function cancelBooking(ref) {
  const booking = store.bookings.get(ref);
  if (!booking) return { ok: false, error: "No booking found with that reference." };
  if (booking.status === "cancelled") return { ok: false, error: "That booking is already cancelled." };

  booking.status = "cancelled";
  for (const seatId of booking.seatIds) {
    if (store.seatOwners.get(seatId) === ref) {
      store.seatOwners.delete(seatId);
    }
  }

  return { ok: true, booking: snapshot(booking) };
}
