"use client";

import { useActionState } from "react";

import { adminCancelBookingAction } from "@/app/admin/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTimestamp } from "@/lib/format";

function CancelButton({ bookingRef }) {
  const [state, formAction, pending] = useActionState(adminCancelBookingAction, null);

  return (
    <form action={formAction} className="flex items-center justify-end gap-2">
      <input type="hidden" name="ref" value={bookingRef} />
      {state?.status === "error" ? (
        <span role="alert" className="text-xs text-destructive">
          {state.message}
        </span>
      ) : null}
      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        {pending ? "Cancelling…" : "Cancel"}
      </Button>
    </form>
  );
}

export function BookingsTable({ bookings, busNamesById }) {
  if (bookings.length === 0) {
    return <p className="text-sm text-muted-foreground">No bookings yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[52rem] text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground uppercase">
            <th scope="col" className="py-2 pr-4 font-medium">Ref</th>
            <th scope="col" className="py-2 pr-4 font-medium">Seat</th>
            <th scope="col" className="py-2 pr-4 font-medium">Bus</th>
            <th scope="col" className="py-2 pr-4 font-medium">Passenger</th>
            <th scope="col" className="py-2 pr-4 font-medium">Contact</th>
            <th scope="col" className="py-2 pr-4 font-medium">Booked</th>
            <th scope="col" className="py-2 text-right font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => (
            <tr key={booking.ref} className="border-b last:border-0 align-top">
              <td className="py-3 pr-4 font-mono text-xs">{booking.ref}</td>
              <td className="py-3 pr-4">
                <Badge variant="outline" className="font-mono">
                  {booking.seatId}
                </Badge>
              </td>
              <td className="py-3 pr-4">{busNamesById[booking.busId] ?? booking.busId}</td>
              <td className="py-3 pr-4">{booking.passenger.name}</td>
              <td className="py-3 pr-4">
                <span className="block">{booking.passenger.email}</span>
                {booking.passenger.phone ? (
                  <span className="block text-xs text-muted-foreground">
                    {booking.passenger.phone}
                  </span>
                ) : null}
              </td>
              <td className="py-3 pr-4 text-xs text-muted-foreground">
                {formatTimestamp(booking.createdAt)}
              </td>
              <td className="py-3 text-right">
                {booking.status === "confirmed" ? (
                  <CancelButton bookingRef={booking.ref} />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Cancelled
                    {booking.cancelledAt ? ` · ${formatTimestamp(booking.cancelledAt)}` : ""}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
