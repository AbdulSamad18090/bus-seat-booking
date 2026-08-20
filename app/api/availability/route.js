import { DEFAULT_BUS_ID, getBus } from "@/lib/bus-layout";
import { getSeatAvailability, summarizeSeats } from "@/lib/bookings-store";

/**
 * Read-only availability feed. Never cached: it reads the bookings collection,
 * which changes on every reservation.
 */
export const dynamic = "force-dynamic";

export async function GET(request) {
  const busId = new URL(request.url).searchParams.get("busId") ?? DEFAULT_BUS_ID;
  const bus = getBus(busId);
  if (!bus) {
    return Response.json({ error: `Unknown bus: ${busId}.` }, { status: 404 });
  }

  const seats = await getSeatAvailability(busId);
  return Response.json({
    bus: { id: bus.id, name: bus.name },
    summary: summarizeSeats(seats),
    seats,
  });
}
