import Link from "next/link";

import { BookingFlow } from "@/components/booking/booking-flow";
import { BUS_LAYOUT } from "@/lib/bus-layout";
import { getSeatAvailability, summarizeSeats } from "@/lib/bookings-store";

// Reads the bookings collection, so this route renders per request rather than
// being prerendered at build time.
export const dynamic = "force-dynamic";

export default async function Home() {
  const bus = BUS_LAYOUT;
  const availability = await getSeatAvailability(bus.id);
  const seatStatuses = Object.fromEntries(availability.map((seat) => [seat.id, seat.status]));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-medium">Reserve Your Seat</h1>
        {/* Booking needs no account; this is only for whoever manages the bookings. */}
        <Link
          href="/admin"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Admin
        </Link>
      </div>

      <BookingFlow bus={bus} seatStatuses={seatStatuses} summary={summarizeSeats(availability)} />
    </main>
  );
}
