"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { MIN_PASSWORD_LENGTH, changeAdminPassword, verifyAdminCredentials } from "@/lib/admins";
import { endAdminSession, getAdminSession, requireAdmin, startAdminSession } from "@/lib/admin-session";
import { cancelBooking } from "@/lib/bookings-store";

/**
 * Admin-only Server Actions. Each one re-checks the session: a Server Action is
 * an endpoint anyone can POST to, so the guard on `/admin` protects the page and
 * nothing else.
 */

export async function signInAction(_previousState, formData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const admin = await verifyAdminCredentials(email, password);
  if (!admin) {
    // Deliberately vague: naming which half was wrong would confirm which
    // addresses are admin accounts.
    return { status: "error", message: "Email or password is incorrect." };
  }

  await startAdminSession(admin.email);
  redirect("/admin");
}

export async function signOutAction() {
  await endAdminSession();
  redirect("/admin/login");
}

export async function adminCancelBookingAction(_previousState, formData) {
  await requireAdmin();

  const ref = String(formData.get("ref") ?? "").trim();
  const result = await cancelBooking(ref);

  revalidatePath("/admin");
  // The seat is free again, so the public seat map is stale too.
  revalidatePath("/");

  if (!result.ok) return { status: "error", message: result.error, ref };
  return { status: "success", ref };
}

export async function changePasswordAction(_previousState, formData) {
  const session = await getAdminSession();
  if (!session) return { status: "error", message: "Your session expired — sign in again." };

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword !== confirmPassword) {
    return { status: "error", message: "The two new passwords do not match." };
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { status: "error", message: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  const result = await changeAdminPassword(session.email, currentPassword, newPassword);
  if (!result.ok) return { status: "error", message: result.error };

  return { status: "success", message: "Password changed." };
}
