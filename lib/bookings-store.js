import { ALL_SEAT_IDS, getBus, getBusSeat } from "./bus-layout.js";
import { DUPLICATE_KEY, getBookingsCollection, nextBookingRef } from "./mongodb.js";

/**
 * MongoDB-backed booking store. Every read and write goes through the functions
 * here, so the rest of the app never touches a collection directly.
 *
 * Two rules, both enforced by unique partial indexes in `lib/mongodb.js`:
 *
 *   1. a seat on a bus holds at most one confirmed booking
 *   2. an email address holds at most one confirmed booking *fleet-wide* — book
 *      a seat on one bus and every other bus is closed to you until you cancel
 *
 * The checks below run first only to produce a readable message; the indexes are
 * what make the rules hold when two requests race.
 */

/** Email is the passenger's identity, so it is compared case-insensitively. */
export function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

/**
 * Callers get a plain object with no `_id`: an ObjectId cannot cross the
 * server/client boundary, and a detached copy cannot be mutated by a later write.
 */
function snapshot(booking) {
  if (!booking) return null;
  return {
    ref: booking.ref,
    busId: booking.busId,
    seatId: booking.seatId,
    passenger: {
      name: booking.name,
      email: booking.email,
      phone: booking.phone ?? "",
    },
    status: booking.status,
    createdAt:
      booking.createdAt instanceof Date ? booking.createdAt.toISOString() : booking.createdAt,
  };
}

async function confirmedSeatIds(busId) {
  const bookings = await getBookingsCollection();
  const rows = await bookings
    .find({ busId, status: "confirmed" }, { projection: { seatId: 1, _id: 0 } })
    .toArray();
  return new Set(rows.map((row) => row.seatId));
}

export async function getSeatAvailability(busId) {
  const seatIds = getBus(busId)?.seats.map((seat) => seat.id) ?? ALL_SEAT_IDS;
  const taken = await confirmedSeatIds(busId);
  return seatIds.map((seatId) => ({
    id: seatId,
    status: taken.has(seatId) ? "booked" : "available",
  }));
}

/** Pure, so a caller that already has the seat list needs no second query. */
export function summarizeSeats(seats) {
  const booked = seats.filter((seat) => seat.status === "booked").length;
  return { total: seats.length, booked, available: seats.length - booked };
}

export async function getBooking(ref) {
  const bookings = await getBookingsCollection();
  return snapshot(await bookings.findOne({ ref }));
}

/** The passenger's live booking, on whichever bus it happens to be. */
export async function findBookingByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const bookings = await getBookingsCollection();
  return snapshot(await bookings.findOne({ email: normalized, status: "confirmed" }));
}

export async function listBookings() {
  const bookings = await getBookingsCollection();
  const rows = await bookings.find({}).sort({ createdAt: -1 }).toArray();
  return rows.map(snapshot);
}

/** "You already hold a seat" — spelled out, since the other seat may be on another bus. */
function heldSeatMessage(existing, busId) {
  const sameBus = existing.busId === busId;
  const where = sameBus ? "on this bus" : `on the ${getBus(existing.busId)?.name ?? existing.busId}`;
  return `That email already holds seat ${existing.seatId} ${where} (${existing.ref}). One seat per passenger — cancel that booking first.`;
}

/**
 * @returns {Promise<{ok: true, booking: object} | {ok: false, error: string, conflicts?: string[], existing?: object}>}
 */
export async function createBooking({ busId, seatId, passenger }) {
  if (!getBus(busId)) {
    return { ok: false, error: `Unknown bus: ${busId}.` };
  }
  // A fixture position such as A1 is not a seat, so it fails here.
  if (!getBusSeat(busId, seatId)) {
    return { ok: false, error: `Unknown seat: ${seatId}.` };
  }

  const email = normalizeEmail(passenger?.email);
  if (!email) {
    return { ok: false, error: "An email address is required — it is what limits you to one seat." };
  }

  const bookings = await getBookingsCollection();

  const held = await bookings.findOne({ email, status: "confirmed" });
  if (held) {
    return { ok: false, error: heldSeatMessage(held, busId), existing: snapshot(held) };
  }

  const taken = await bookings.findOne({ busId, seatId, status: "confirmed" });
  if (taken) {
    return { ok: false, error: `Seat ${seatId} was just taken. Pick another one.`, conflicts: [seatId] };
  }

  const document = {
    ref: await nextBookingRef(),
    busId,
    seatId,
    email,
    name: String(passenger?.name ?? "").trim(),
    phone: String(passenger?.phone ?? "").trim(),
    status: "confirmed",
    createdAt: new Date(),
  };

  try {
    await bookings.insertOne(document);
  } catch (error) {
    // Lost a race between the checks above and this insert; the unique index
    // caught it, so report the same thing those checks would have.
    if (error?.code === DUPLICATE_KEY) {
      if (error.keyPattern?.email) {
        const other = await bookings.findOne({ email, status: "confirmed" });
        return {
          ok: false,
          error: other
            ? heldSeatMessage(other, busId)
            : "That email already holds a seat. One seat per passenger.",
          existing: snapshot(other),
        };
      }
      if (error.keyPattern?.seatId) {
        return {
          ok: false,
          error: `Seat ${seatId} was just taken. Pick another one.`,
          conflicts: [seatId],
        };
      }
      return { ok: false, error: "That booking clashed with another one. Please try again." };
    }
    throw error;
  }

  return { ok: true, booking: snapshot(document) };
}

export async function cancelBooking(ref) {
  const bookings = await getBookingsCollection();
  // Filtering on the status as well as the ref makes this idempotent: a double
  // submit matches nothing the second time instead of re-cancelling.
  const cancelled = await bookings.findOneAndUpdate(
    { ref, status: "confirmed" },
    { $set: { status: "cancelled", cancelledAt: new Date() } },
    { returnDocument: "after" },
  );

  if (!cancelled) {
    const existing = await bookings.findOne({ ref });
    if (!existing) return { ok: false, error: "No booking found with that reference." };
    return { ok: false, error: "That booking is already cancelled." };
  }

  return { ok: true, booking: snapshot(cancelled) };
}
