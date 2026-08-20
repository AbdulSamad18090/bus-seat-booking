"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Armchair, TriangleAlert } from "lucide-react";

import { reserveSeatAction } from "@/app/actions";
import { BookingConfirmation } from "@/components/booking/booking-confirmation";
import { PassengerForm } from "@/components/booking/passenger-form";
import { SeatMap, SeatMapLegend } from "@/components/booking/seat-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SEAT_TYPES, getSeat } from "@/lib/bus-layout";

/**
 * One reservation attempt: pick a seat -> passenger details -> confirmation.
 * `BookingFlow` remounts this on "start over" so `useActionState` resets with it.
 */
function BookingSession({ bus, seatStatuses, summary, onStartOver }) {
  const [pickedSeatId, setPickedSeatId] = useState(null);
  const [step, setStep] = useState("select");
  const [state, formAction, pending] = useActionState(reserveSeatAction, null);

  const booking = state?.status === "success" ? state.booking : null;

  // The picked seat can be taken by someone else while it sits here. The page
  // re-renders with fresh statuses after any reservation, so derive the live
  // selection from those statuses rather than syncing it in an effect.
  const selectedSeatId =
    pickedSeatId && seatStatuses[pickedSeatId] !== "booked" ? pickedSeatId : null;
  const pickedSeatWasTaken = Boolean(pickedSeatId) && !selectedSeatId;

  const shownSeatId = booking ? booking.seatId : selectedSeatId;
  const seatTypeLabel = shownSeatId ? SEAT_TYPES[getSeat(shownSeatId)?.type]?.label : null;

  function selectSeat(seatId) {
    if (seatStatuses[seatId] === "booked") return;
    // One seat per passenger, so picking another replaces the current pick
    // rather than adding to it; picking the same seat again clears it.
    setPickedSeatId((current) => (current === seatId ? null : seatId));
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card>
        <CardHeader>
          <CardTitle>{bus.name}</CardTitle>
          <CardDescription>
            {summary.available} of {summary.total} seats available. The driver&apos;s seat and the
            plan&apos;s middle row are excluded — only the last row&apos;s bench crosses the gangway.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <SeatMap
            bus={bus}
            seatStatuses={seatStatuses}
            selectedSeatId={shownSeatId}
            onSelectSeat={step === "select" && !booking ? selectSeat : () => {}}
          />
          <Separator />
          <SeatMapLegend />
        </CardContent>
      </Card>

      <Card className="lg:sticky lg:top-6">
        <CardHeader>
          <CardTitle>
            {booking
              ? "Seat reserved"
              : step === "details"
                ? "Passenger details"
                : "Your seat"}
          </CardTitle>
          {booking ? null : (
            <CardDescription>
              {step === "details"
                ? `Seat ${selectedSeatId} is held until you confirm.`
                : "Pick one seat — a passenger may hold exactly one, on one bus."}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent>
          {booking ? (
            <BookingConfirmation booking={booking} bus={bus} onStartOver={onStartOver} />
          ) : step === "details" ? (
            <PassengerForm
              action={formAction}
              pending={pending}
              state={state}
              busId={bus.id}
              seatId={selectedSeatId}
              onBack={() => setStep("select")}
            />
          ) : (
            <div className="grid gap-4">
              {selectedSeatId ? (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <Badge variant="outline" className="font-mono">
                    {selectedSeatId}
                  </Badge>
                  <span className="text-muted-foreground">{seatTypeLabel}</span>
                </div>
              ) : (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Armchair className="size-4 shrink-0" aria-hidden />
                  No seat selected yet.
                </p>
              )}

              {pickedSeatWasTaken ? (
                <p role="status" className="text-xs text-destructive">
                  That seat was reserved by someone else. Pick another one.
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

              <Button
                disabled={!selectedSeatId}
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

export function BookingFlow({ bus, seatStatuses, summary }) {
  const [sessionKey, setSessionKey] = useState(0);

  return (
    <BookingSession
      key={sessionKey}
      bus={bus}
      seatStatuses={seatStatuses}
      summary={summary}
      onStartOver={() => setSessionKey((key) => key + 1)}
    />
  );
}
