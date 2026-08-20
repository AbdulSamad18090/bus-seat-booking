/**
 * Data-driven floor plan, transcribed from the printed Toyota Coaster plan.
 *
 * `col` runs front-to-rear and `band` is the lateral position across the bus.
 * The map is drawn top-down — a plan column becomes a grid row, a band becomes a
 * grid column. Bands, left to right:
 *
 *   C  -> door side (the door and coolbox break the row up)
 *   D  -> the middle row of the plan: gangway and wheel arches. Not countable —
 *         the only seat in it is the last row's bench crossing the gangway.
 *   B  -> aisle row
 *   A  -> window row (its front position is the driver's seat)
 *
 * A seat's `row` is its logical group (used for labels and ordering) and `band`
 * is where it renders. They differ only for the last row, a single bench across
 * the full width of the rear: one seat per band, all in the rear column.
 *
 * Adding another coach type means adding another object of this shape — the seat
 * map renders whatever bands/cols/fixtures it is handed.
 */

export const CURRENCY = { code: "PKR", symbol: "Rs" };

export const SEAT_TYPES = {
  front: { id: "front", label: "Front row", fare: 600 },
  standard: { id: "standard", label: "Standard", fare: 450 },
  rear: { id: "rear", label: "Last row", fare: 450 },
};

/**
 * Lateral bands in render order, left to right across the bus. `C` leads so the
 * door side is on the left of the map.
 */
const BANDS = ["C", "D", "B", "A"];

// Columns 1-2 sit ahead of the wheel arches and are sold at the front-row fare.
const FRONT_ROW_COLUMNS = 2;
const REAR_COLUMN = 8;

/** Rows in listing order, so a ticket reads A…, B…, C…, then the last row. */
const ROW_ORDER = ["A", "B", "C", "R"];

function defineSeat(row, col) {
  return {
    id: `${row}${col}`,
    label: `${row}${col}`,
    row,
    band: row,
    col,
    type: col <= FRONT_ROW_COLUMNS ? "front" : "standard",
  };
}

// Column 1 of the upper bands is cab, not seating: A1 is the driver's seat and
// B1 beside it is not sellable either.
const ROW_A_COLUMNS = [2, 3, 4, 5, 6, 7];
const ROW_B_COLUMNS = [2, 3, 4, 5, 6, 7];
// C2 is the coolbox and C3 the door, so the lower row skips both — but C1 is a seat.
const ROW_C_COLUMNS = [1, 4, 5, 6, 7];

/** The last row: one bench, four seats, spanning every band at the rear. */
const REAR_BENCH = BANDS.map((band, index) => ({
  id: `R${index + 1}`,
  label: `R${index + 1}`,
  row: "R",
  band,
  col: REAR_COLUMN,
  type: "rear",
}));

export const BUS_LAYOUT = {
  id: "coaster",
  name: "Toyota Coaster",
  columns: REAR_COLUMN,
  maxSeatsPerBooking: 6,
  bands: BANDS.map((id) => ({ id, label: id === "D" ? "" : id })),
  seats: [
    ...ROW_A_COLUMNS.map((col) => defineSeat("A", col)),
    ...ROW_B_COLUMNS.map((col) => defineSeat("B", col)),
    ...ROW_C_COLUMNS.map((col) => defineSeat("C", col)),
    ...REAR_BENCH,
  ],
  fixtures: [
    { id: "driver", kind: "driver", band: "A", col: 1, label: "Driver — not bookable" },
    { id: "cab", kind: "blocked", band: "B", col: 1, label: "Cab — not bookable" },
    { id: "coolbox", kind: "coolbox", band: "C", col: 2, label: "Coolbox — not bookable" },
    { id: "door", kind: "door", band: "C", col: 3, label: "Door" },
    // The uncounted middle row of the plan.
    ...[3, 4, 5, 6, 7].map((col) => ({
      id: `arch-${col}`,
      kind: "arch",
      band: "D",
      col,
      label: "Wheel arch — not bookable",
    })),
  ],
};

export const SEATS_BY_ID = new Map(BUS_LAYOUT.seats.map((seat) => [seat.id, seat]));

export const ALL_SEAT_IDS = BUS_LAYOUT.seats.map((seat) => seat.id);

export const TOTAL_SEATS = BUS_LAYOUT.seats.length;

export function getSeat(seatId) {
  return SEATS_BY_ID.get(seatId) ?? null;
}

export function seatFare(seatOrId) {
  const seat = typeof seatOrId === "string" ? getSeat(seatOrId) : seatOrId;
  if (!seat) return 0;
  return SEAT_TYPES[seat.type]?.fare ?? SEAT_TYPES.standard.fare;
}

export function totalFare(seatIds) {
  return seatIds.reduce((sum, seatId) => sum + seatFare(seatId), 0);
}

/** Sort by row order then column so summaries read front-to-rear. */
export function compareSeats(aId, bId) {
  const a = getSeat(aId);
  const b = getSeat(bId);
  if (!a || !b) return String(aId).localeCompare(String(bId));
  if (a.row !== b.row) return ROW_ORDER.indexOf(a.row) - ROW_ORDER.indexOf(b.row);
  if (a.col !== b.col) return a.col - b.col;
  return a.label.localeCompare(b.label);
}
