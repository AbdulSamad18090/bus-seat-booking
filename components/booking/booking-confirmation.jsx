"use client";

import { useActionState } from "react";
import { CircleCheck, Ticket } from "lucide-react";

import { cancelBookingAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatMoney, formatSeatList, formatTimestamp } from "@/lib/format";

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function BookingConfirmation({ booking, trip, onStartOver }) {
  const [cancelState, cancelAction, cancelPending] = useActionState(cancelBookingAction, null);
  const cancelled = cancelState?.status === "success";

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2">
        {cancelled ? (
          <Badge variant="destructive">Cancelled</Badge>
        ) : (
          <Badge>
            <CircleCheck className="size-3" aria-hidden />
            Confirmed
          </Badge>
        )}
        <span className="flex items-center gap-1.5 font-mono text-sm">
          <Ticket className="size-3.5 text-muted-foreground" aria-hidden />
          {booking.ref}
        </span>
      </div>

      <div className="grid gap-2">
        <Row label="Passenger" value={booking.passenger.name} />
        <Row label="Phone" value={booking.passenger.phone} />
        {booking.passenger.email ? <Row label="Email" value={booking.passenger.email} /> : null}
        <Separator className="my-1" />
        <Row label="Route" value={`${trip.origin} → ${trip.destination}`} />
        <Row label="Departs" value={trip.departsAtLabel} />
        <Row label="Coach" value={trip.coach} />
        <Row
          label={booking.seatIds.length === 1 ? "Seat" : "Seats"}
          value={formatSeatList(booking.seatIds)}
        />
        <Separator className="my-1" />
        <Row label="Total paid" value={formatMoney(booking.amount)} />
        <Row label="Booked at" value={formatTimestamp(booking.createdAt)} />
      </div>

      {cancelState?.status === "error" ? (
        <p role="alert" className="text-xs text-destructive">
          {cancelState.message}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button onClick={onStartOver} className="flex-1">
          Book more seats
        </Button>
        {cancelled ? null : (
          <form action={cancelAction}>
            <input type="hidden" name="ref" value={booking.ref} />
            <Button type="submit" variant="destructive" disabled={cancelPending}>
              {cancelPending ? "Cancelling…" : "Cancel"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
