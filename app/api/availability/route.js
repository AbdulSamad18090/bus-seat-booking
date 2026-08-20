import { BUS_LAYOUT } from "@/lib/bus-layout";
import { getAvailabilitySummary, getSeatAvailability } from "@/lib/bookings-store";
import { DEMO_TRIP } from "@/lib/trip";

/**
 * Read-only availability feed. Not cached: `getSeatAvailability` reads the
 * in-memory store, which changes on every booking.
 */
export async function GET() {
  return Response.json({
    trip: DEMO_TRIP,
    layoutId: BUS_LAYOUT.id,
    summary: getAvailabilitySummary(),
    seats: getSeatAvailability(),
  });
}
