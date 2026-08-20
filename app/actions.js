"use server";

import { revalidatePath } from "next/cache";

import { DEFAULT_BUS_ID, getBus, getBusSeat } from "@/lib/bus-layout";
import { cancelBooking, createBooking } from "@/lib/bookings-store";

const PHONE_DIGITS = /\d/g;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validatePassenger(formData) {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  const fieldErrors = {};
  if (name.length < 2) fieldErrors.name = "Enter the passenger's full name.";
  if ((phone.match(PHONE_DIGITS) ?? []).length < 7) {
    fieldErrors.phone = "Enter a reachable phone number.";
  }
  // Required, not optional: the email is the passenger's identity, and the whole
  // one-seat-per-passenger rule is keyed on it.
  if (!email) {
    fieldErrors.email = "Enter your email — one seat per email address.";
  } else if (!EMAIL_SHAPE.test(email)) {
    fieldErrors.email = "That email address doesn't look right.";
  }

  return { passenger: { name, phone, email }, fieldErrors };
}

/**
 * Server Action for the passenger-details step. Reachable by direct POST, so the
 * bus, the seat and every passenger field are re-validated here rather than
 * trusting whatever the client submitted.
 */
export async function reserveSeatAction(_previousState, formData) {
  const busId = String(formData.get("busId") ?? "").trim() || DEFAULT_BUS_ID;
  const seatId = String(formData.get("seatId") ?? "").trim();

  if (!getBus(busId)) {
    return { status: "error", message: `Unknown bus: ${busId}.` };
  }
  if (!seatId) {
    return { status: "error", message: "Pick a seat before reserving." };
  }
  // Rejects fixtures as well as nonsense: A1 is the driver's seat, not a seat.
  if (!getBusSeat(busId, seatId)) {
    return { status: "error", message: `Unknown seat: ${seatId}.` };
  }

  const { passenger, fieldErrors } = validatePassenger(formData);
  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", message: "Check the highlighted fields.", fieldErrors };
  }

  const result = await createBooking({ busId, seatId, passenger });

  revalidatePath("/");
  if (!result.ok) {
    return {
      status: "error",
      message: result.error,
      conflicts: result.conflicts,
      existing: result.existing,
    };
  }

  return { status: "success", booking: result.booking };
}

export async function cancelBookingAction(_previousState, formData) {
  const ref = String(formData.get("ref") ?? "").trim();
  const result = await cancelBooking(ref);

  revalidatePath("/");
  if (!result.ok) return { status: "error", message: result.error };
  return { status: "success", ref };
}
