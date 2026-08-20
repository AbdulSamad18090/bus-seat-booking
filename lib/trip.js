import { BUS_LAYOUT } from "./bus-layout.js";

/**
 * Stand-in for a trips table. Times are fixed strings rather than computed
 * dates so the server and client always render identical markup.
 */
export const DEMO_TRIP = {
  id: "trip-lhe-isb-0830",
  origin: "Lahore",
  destination: "Islamabad",
  departsAtLabel: "Fri, 21 Aug 2026 · 08:30",
  departsAtISO: "2026-08-21T03:30:00.000Z",
  durationLabel: "4h 20m",
  operator: "BKK Coaches",
  coach: BUS_LAYOUT.name,
  layoutId: BUS_LAYOUT.id,
};
