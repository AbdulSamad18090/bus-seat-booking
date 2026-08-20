import { CURRENCY } from "./bus-layout.js";

/**
 * Deterministic on both server and client — `Intl` is deliberately avoided so
 * the markup never differs between render passes.
 */
export function formatMoney(amount) {
  const grouped = String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${CURRENCY.symbol} ${grouped}`;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Renders an ISO timestamp in UTC, e.g. "20 Aug 2026, 08:30". */
export function formatTimestamp(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const day = date.getUTCDate();
  const month = MONTHS[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${day} ${month} ${year}, ${hours}:${minutes}`;
}

export function formatSeatList(seatIds) {
  return seatIds.join(", ");
}
