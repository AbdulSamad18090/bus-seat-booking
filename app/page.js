import { BookingFlow } from "@/components/booking/booking-flow";
import { BUS_LAYOUT } from "@/lib/bus-layout";
import { getAvailabilitySummary, getSeatAvailability } from "@/lib/bookings-store";
import { DEMO_TRIP } from "@/lib/trip";

// Seat availability lives in a mutable in-memory store, so this route must be
// rendered per request rather than prerendered at build time.
export const dynamic = "force-dynamic";

export default function Home() {
  // Reads the in-memory store, so this page renders per request.
  const seatStatuses = Object.fromEntries(
    getSeatAvailability().map((seat) => [seat.id, seat.status]),
  );
  const summary = getAvailabilitySummary();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      <h1 className="mb-8 font-heading text-2xl font-medium">Book Your Seat</h1>

      <BookingFlow
        layout={BUS_LAYOUT}
        trip={DEMO_TRIP}
        seatStatuses={seatStatuses}
        summary={summary}
      />
    </main>
  );
}
