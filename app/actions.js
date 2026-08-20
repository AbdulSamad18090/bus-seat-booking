"use server";

import { revalidatePath } from "next/cache";

import { BUS_LAYOUT, getSeat } from "@/lib/bus-layout";
import { cancelBooking, createBooking } from "@/lib/bookings-store";

const PHONE_DIGITS = /\d/g;

function parseSeatIds(raw) {
  return String(raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function validatePassenger(formData) {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  const fieldErrors = {};
  if (name.length < 2) fieldErrors.name = "Enter the passenger's full name.";
  if ((phone.match(PHONE_DIGITS) ?? []).length < 7) {
    fieldErrors.phone = "Enter a reachable phone number.";
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = "That email address doesn't look right.";
  }

  return { passenger: { name, phone, email }, fieldErrors };
}

/**
 * Server Action for the passenger-details step. Reachable by direct POST, so the
 * seat list is re-validated here rather than trusting the client's selection.
 */
export async function bookSeatsAction(_previousState, formData) {
  const seatIds = parseSeatIds(formData.get("seatIds"));

  if (seatIds.length === 0) {
    return { status: "error", message: "Select at least one seat before booking." };
  }
  if (seatIds.length > BUS_LAYOUT.maxSeatsPerBooking) {
    return {
      status: "error",
      message: `You can book at most ${BUS_LAYOUT.maxSeatsPerBooking} seats at a time.`,
    };
  }
  const unknown = seatIds.filter((seatId) => !getSeat(seatId));
  if (unknown.length > 0) {
    return { status: "error", message: `Unknown seat: ${unknown.join(", ")}.` };
  }

  const { passenger, fieldErrors } = validatePassenger(formData);
  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", message: "Check the highlighted fields.", fieldErrors };
  }

  const result = createBooking({ seatIds, passenger });
  if (!result.ok) {
    revalidatePath("/");
    return { status: "error", message: result.error, conflicts: result.conflicts };
  }

  revalidatePath("/");
  return { status: "success", booking: result.booking };
}

export async function cancelBookingAction(_previousState, formData) {
  const ref = String(formData.get("ref") ?? "").trim();
  const result = cancelBooking(ref);

  revalidatePath("/");
  if (!result.ok) return { status: "error", message: result.error };
  return { status: "success", ref };
}
