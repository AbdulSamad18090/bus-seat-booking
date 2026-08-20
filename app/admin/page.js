import { LogOut } from "lucide-react";
import Link from "next/link";

import { BookingsTable } from "@/components/admin/bookings-table";
import { ChangePasswordForm } from "@/components/admin/change-password-form";
import { signOutAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/admin-session";
import { MIN_PASSWORD_LENGTH } from "@/lib/admins";
import { BUSES } from "@/lib/bus-layout";
import { getSeatAvailability, listBookings, summarizeSeats } from "@/lib/bookings-store";

// Session cookie plus live booking data: never prerendered, never cached.
export const dynamic = "force-dynamic";

function Stat({ label, value }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs text-muted-foreground uppercase">{label}</span>
      <span className="font-heading text-2xl font-medium tabular-nums">{value}</span>
    </div>
  );
}

export default async function AdminPage() {
  // Guards the page. Every admin Server Action re-checks this on its own.
  const session = await requireAdmin();

  const [bookings, ...fleet] = await Promise.all([
    listBookings(),
    ...BUSES.map(async (bus) => ({ bus, summary: summarizeSeats(await getSeatAvailability(bus.id)) })),
  ]);

  const busNamesById = Object.fromEntries(BUSES.map((bus) => [bus.id, bus.name]));
  const confirmed = bookings.filter((booking) => booking.status === "confirmed").length;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-medium">Admin</h1>
          <p className="text-sm text-muted-foreground">Signed in as {session.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Base UI needs telling that the rendered element is not a <button>. */}
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/" />}>
            Seat map
          </Button>
          <form action={signOutAction}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
              <LogOut data-icon="inline-end" className="size-4" aria-hidden />
            </Button>
          </form>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Occupancy</CardTitle>
            <CardDescription>
              One seat per passenger, across every bus — {confirmed}{" "}
              {confirmed === 1 ? "passenger holds" : "passengers hold"} a seat right now.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-x-12 gap-y-4">
            {fleet.map(({ bus, summary }) => (
              <div key={bus.id} className="flex flex-wrap gap-x-8 gap-y-4">
                <Stat label={`${bus.name} · booked`} value={`${summary.booked} / ${summary.total}`} />
                <Stat label="Available" value={summary.available} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All bookings</CardTitle>
            <CardDescription>
              Newest first, cancelled ones included. Cancelling frees the seat and lets that email
              book again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BookingsTable bookings={bookings} busNamesById={busNamesById} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your password</CardTitle>
            <CardDescription>
              Changing it here makes the database authoritative, so the seeded value in{" "}
              <code>.env.local</code> stops mattering.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm minLength={MIN_PASSWORD_LENGTH} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
