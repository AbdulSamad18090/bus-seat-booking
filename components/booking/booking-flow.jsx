"use client";

import { useActionState, useMemo, useState } from "react";
import { ArrowRight, Armchair, TriangleAlert } from "lucide-react";

import { bookSeatsAction } from "@/app/actions";
import { BookingConfirmation } from "@/components/booking/booking-confirmation";
import { PassengerForm } from "@/components/booking/passenger-form";
import { SeatMap, SeatMapLegend } from "@/components/booking/seat-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SEAT_TYPES, compareSeats, getSeat, seatFare } from "@/lib/bus-layout";
import { formatMoney } from "@/lib/format";

/**
 * One booking attempt: seat selection -> passenger details -> confirmation.
 * `BookingFlow` remounts this on "start over" so `useActionState` resets with it.
 */
function BookingSession({ layout, trip, seatStatuses, summary, onStartOver }) {
  const [pickedSeatIds, setPickedSeatIds] = useState([]);
  const [step, setStep] = useState("select");
  const [state, formAction, pending] = useActionState(bookSeatsAction, null);

  const booking = state?.status === "success" ? state.booking : null;

  // A seat can be sold by someone else while it sits in this selection. The page
  // re-renders with fresh statuses after any booking, so derive the live
  // selection from those statuses rather than syncing it in an effect.
  const selectedSeatIds = useMemo(
    () => pickedSeatIds.filter((seatId) => seatStatuses[seatId] !== "booked"),
    [pickedSeatIds, seatStatuses],
  );
  const droppedSeatCount = pickedSeatIds.length - selectedSeatIds.length;

  const amount = useMemo(
    () => selectedSeatIds.reduce((total, seatId) => total + seatFare(seatId), 0),
    [selectedSeatIds],
  );

  const atSeatLimit = selectedSeatIds.length >= layout.maxSeatsPerBooking;

  function toggleSeat(seatId) {
    if (seatStatuses[seatId] === "booked") return;
    setPickedSeatIds((current) => {
      const live = current.filter((id) => seatStatuses[id] !== "booked");
      if (live.includes(seatId)) return live.filter((id) => id !== seatId);
      if (live.length >= layout.maxSeatsPerBooking) return live;
      return [...live, seatId].sort(compareSeats);
    });
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card>
        <CardHeader>
          <CardTitle>{layout.name}</CardTitle>
          <CardDescription>
            {summary.available} of {summary.total} seats available. The driver&apos;s seat and the
            plan&apos;s middle row are excluded — only the last row&apos;s bench crosses the gangway.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <SeatMap
            layout={layout}
            seatStatuses={seatStatuses}
            selectedSeatIds={booking ? booking.seatIds : selectedSeatIds}
            onToggleSeat={step === "select" && !booking ? toggleSeat : () => {}}
          />
          <Separator />
          <SeatMapLegend />
        </CardContent>
      </Card>

      <Card className="lg:sticky lg:top-6">
        <CardHeader>
          <CardTitle>
            {booking ? "Booking confirmed" : step === "details" ? "Passenger details" : "Your selection"}
          </CardTitle>
          {booking ? null : (
            <CardDescription>
              {step === "details"
                ? `Seats ${selectedSeatIds.join(", ")} are held until you confirm.`
                : `Pick up to ${layout.maxSeatsPerBooking} seats.`}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent>
          {booking ? (
            <BookingConfirmation booking={booking} trip={trip} onStartOver={onStartOver} />
          ) : step === "details" ? (
            <PassengerForm
              action={formAction}
              pending={pending}
              state={state}
              seatIds={selectedSeatIds}
              amount={amount}
              onBack={() => setStep("select")}
            />
          ) : (
            <div className="grid gap-4">
              {selectedSeatIds.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Armchair className="size-4 shrink-0" aria-hidden />
                  No seats selected yet.
                </p>
              ) : (
                <ul className="grid gap-2">
                  {selectedSeatIds.map((seatId) => (
                    <li key={seatId} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          {seatId}
                        </Badge>
                        <span className="text-muted-foreground">
                          {SEAT_TYPES[getSeat(seatId)?.type]?.label}
                        </span>
                      </span>
                      <span className="tabular-nums">{formatMoney(seatFare(seatId))}</span>
                    </li>
                  ))}
                </ul>
              )}

              {droppedSeatCount > 0 ? (
                <p role="status" className="text-xs text-destructive">
                  {droppedSeatCount === 1
                    ? "One of your seats was booked by someone else and has been removed."
                    : `${droppedSeatCount} of your seats were booked by someone else and have been removed.`}
                </p>
              ) : null}

              {atSeatLimit ? (
                <p className="text-xs text-muted-foreground">
                  That&apos;s the {layout.maxSeatsPerBooking}-seat maximum per booking.
                </p>
              ) : null}

              {state?.status === "error" ? (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"
                >
                  <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
                  {state.message}
                </p>
              ) : null}

              <Separator />
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">
                  Total · {selectedSeatIds.length}{" "}
                  {selectedSeatIds.length === 1 ? "seat" : "seats"}
                </span>
                <span className="font-heading text-lg font-medium tabular-nums">
                  {formatMoney(amount)}
                </span>
              </div>

              <Button
                disabled={selectedSeatIds.length === 0}
                onClick={() => setStep("details")}
                className="w-full"
              >
                Continue
                <ArrowRight data-icon="inline-end" className="size-4" aria-hidden />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function BookingFlow({ layout, trip, seatStatuses, summary }) {
  const [sessionKey, setSessionKey] = useState(0);

  return (
    <BookingSession
      key={sessionKey}
      layout={layout}
      trip={trip}
      seatStatuses={seatStatuses}
      summary={summary}
      onStartOver={() => setSessionKey((key) => key + 1)}
    />
  );
}
