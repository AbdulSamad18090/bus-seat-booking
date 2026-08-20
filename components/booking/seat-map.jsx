"use client";

import { Ban, DoorOpen, LifeBuoy, Snowflake } from "lucide-react";

import { SEAT_TYPES } from "@/lib/bus-layout";
import { cn } from "@/lib/utils";

const SEAT_STATE_CLASSES = {
  available:
    "bg-primary/10 text-foreground ring-primary/30 hover:bg-primary/20 hover:ring-primary/60",
  selected: "bg-primary text-primary-foreground ring-primary shadow-sm",
  booked: "bg-destructive/10 text-destructive/70 ring-destructive/20 cursor-not-allowed",
};

const FIXTURE_ICONS = {
  driver: LifeBuoy,
  door: DoorOpen,
  blocked: Ban,
  coolbox: Snowflake,
  arch: null,
};

function Seat({ seat, state, onSelect }) {
  const disabled = state === "booked";
  const seatType = SEAT_TYPES[seat.type];

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={state === "selected"}
      aria-label={`Seat ${seat.label}, ${seatType?.label ?? "standard"}, ${
        disabled ? "already booked" : state === "selected" ? "selected" : "available"
      }`}
      onClick={() => onSelect(seat.id)}
      style={{ gridColumn: seat.gridColumn, gridRow: seat.gridRow }}
      className={cn(
        "relative flex h-11 w-12 flex-col items-center justify-center rounded-lg ring-1 transition-all",
        "text-xs font-medium tabular-nums outline-none",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50",
        !disabled && "active:translate-y-px",
        SEAT_STATE_CLASSES[state],
      )}
    >
      {/* Backrest, so a seat reads as a seat rather than a plain tile. */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-1.5 top-1 h-1 rounded-full",
          state === "selected" ? "bg-primary-foreground/40" : "bg-current opacity-25",
        )}
      />
      <span className="mt-1.5">{seat.label}</span>
      {seat.type !== "standard" ? (
        <span aria-hidden className="text-[9px] leading-none opacity-70">
          {seat.type === "front" ? "front" : "last"}
        </span>
      ) : null}
    </button>
  );
}

function Fixture({ fixture }) {
  const Icon = FIXTURE_ICONS[fixture.kind];

  return (
    <div
      style={{ gridColumn: fixture.gridColumn, gridRow: fixture.gridRow }}
      title={fixture.label}
      className={cn(
        "flex h-11 flex-col items-center justify-center gap-0.5 rounded-lg bg-muted/60 text-muted-foreground",
        // The gangway band is drawn as a narrow strip rather than a full tile.
        fixture.kind === "arch" ? "w-6 justify-self-center" : "w-12",
        fixture.kind === "door" && "bg-secondary text-secondary-foreground",
        fixture.kind === "driver" && "ring-1 ring-border",
      )}
    >
      {Icon ? <Icon className="size-4" aria-hidden /> : null}
      {fixture.kind === "driver" ? (
        <span aria-hidden className="text-[9px] leading-none">
          driver
        </span>
      ) : null}
      <span className="sr-only">{fixture.label}</span>
    </div>
  );
}

function LegendItem({ className, icon: Icon, children }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={cn("flex size-4 items-center justify-center rounded ring-1", className)}>
        {Icon ? <Icon className="size-2.5" aria-hidden /> : null}
      </span>
      {children}
    </span>
  );
}

export function SeatMapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <LegendItem className={SEAT_STATE_CLASSES.available}>Available</LegendItem>
      <LegendItem className={SEAT_STATE_CLASSES.selected}>Selected</LegendItem>
      <LegendItem className={SEAT_STATE_CLASSES.booked}>Booked</LegendItem>
      <LegendItem className="bg-muted/60 text-muted-foreground ring-transparent" icon={Ban}>
        Driver, door and middle row — not bookable
      </LegendItem>
    </div>
  );
}

/**
 * Renders any bus of the `BUSES` shape, drawn top-down: the bus runs front-to-rear
 * down the page, so a plan column becomes a grid row and a lateral band becomes a
 * grid column. A different coach needs no changes here. One seat is selectable at
 * a time — a passenger may hold exactly one.
 */
export function SeatMap({ bus, seatStatuses, selectedSeatId, onSelectSeat }) {
  const gridColumnByBand = new Map(bus.bands.map((band, index) => [band.id, index + 1]));
  // Row 1 holds the band headers, so plan column N lands on grid row N + 1.
  const gridRowForColumn = (col) => col + 1;

  return (
    <div className="overflow-x-auto pb-2">
      <div className="mx-auto flex w-fit flex-col gap-2">
        <p className="text-center text-[10px] tracking-wide text-muted-foreground uppercase">
          ↑ Front
        </p>

        {/* Nose of the bus, matching the printed plan. */}
        <div className="h-5 rounded-t-3xl rounded-b-sm bg-muted/40" aria-hidden />

        <div
          className="grid gap-1.5"
          style={{
            gridTemplateColumns: `repeat(${bus.bands.length}, 3rem)`,
            gridTemplateRows: `1.25rem repeat(${bus.columns}, 2.75rem)`,
          }}
        >
          {bus.bands.map((band, index) => (
            <div
              key={band.id}
              style={{ gridColumn: index + 1, gridRow: 1 }}
              className="flex items-center justify-center text-[10px] font-medium text-muted-foreground"
              aria-hidden
            >
              {band.label}
            </div>
          ))}

          {bus.seats.map((seat) => (
            <Seat
              key={seat.id}
              seat={{
                ...seat,
                gridColumn: gridColumnByBand.get(seat.band),
                gridRow: gridRowForColumn(seat.col),
              }}
              state={
                seat.id === selectedSeatId ? "selected" : (seatStatuses[seat.id] ?? "available")
              }
              onSelect={onSelectSeat}
            />
          ))}

          {bus.fixtures.map((fixture) => (
            <Fixture
              key={fixture.id}
              fixture={{
                ...fixture,
                gridColumn: gridColumnByBand.get(fixture.band),
                gridRow: gridRowForColumn(fixture.col),
              }}
            />
          ))}
        </div>

        <p className="text-center text-[10px] tracking-wide text-muted-foreground uppercase">
          Last row ↓
        </p>
      </div>
    </div>
  );
}
