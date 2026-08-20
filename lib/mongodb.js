import { MongoClient, ServerApiVersion } from "mongodb";

/**
 * Single shared MongoClient. Next's dev server re-evaluates modules on every
 * edit, so the connect() promise is cached on `globalThis` — otherwise each
 * hot reload would open another pool and Atlas would start refusing connections.
 */

const DEFAULT_DB_NAME = "bus_seat_booking";

/** Duplicate-key error code; the unique indexes below are what enforce the rules. */
export const DUPLICATE_KEY = 11000;

export const COLLECTIONS = {
  bookings: "bookings",
  counters: "counters",
};

function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set — copy .env.example to .env.local and fill it in.");
  }

  const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, deprecationErrors: true },
  });

  // A failed connect must not be cached, or every later request replays the
  // same rejection without ever retrying.
  return client.connect().catch((error) => {
    globalThis.__busMongoClient = undefined;
    throw error;
  });
}

function clientPromise() {
  return (globalThis.__busMongoClient ??= connect());
}

export async function getDb() {
  const client = await clientPromise();
  return client.db(process.env.MONGODB_DB || DEFAULT_DB_NAME);
}

/**
 * The two unique indexes are the whole enforcement story:
 *
 *   one_booking_per_seat  — a seat on a bus can have one confirmed booking
 *   one_seat_per_email    — an email can hold one confirmed booking, on *any*
 *                           bus, because busId is deliberately not in the key
 *
 * Both are partial on `status: "confirmed"`, so cancelling frees the seat and
 * lets that passenger book again. Checking in application code first gives a
 * friendly message; these indexes are what make the rule true under a race.
 */
async function ensureIndexes(bookings) {
  await bookings.createIndexes([
    {
      key: { busId: 1, seatId: 1 },
      name: "one_booking_per_seat",
      unique: true,
      partialFilterExpression: { status: "confirmed" },
    },
    {
      key: { email: 1 },
      name: "one_seat_per_email",
      unique: true,
      partialFilterExpression: { status: "confirmed" },
    },
    { key: { ref: 1 }, name: "ref_unique", unique: true },
  ]);
}

export async function getBookingsCollection() {
  const db = await getDb();
  const bookings = db.collection(COLLECTIONS.bookings);

  globalThis.__busMongoIndexes ??= ensureIndexes(bookings).catch((error) => {
    globalThis.__busMongoIndexes = undefined;
    throw error;
  });
  await globalThis.__busMongoIndexes;

  return bookings;
}

/** Monotonic booking references (BK-0001…) from a counter document. */
export async function nextBookingRef() {
  const db = await getDb();
  const counter = await db
    .collection(COLLECTIONS.counters)
    .findOneAndUpdate(
      { _id: "bookingRef" },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );

  return `BK-${String(counter?.value ?? 1).padStart(4, "0")}`;
}
