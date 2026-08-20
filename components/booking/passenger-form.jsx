"use client";

import { ArrowLeft, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/format";

function Field({ id, label, error, children, hint }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function PassengerForm({ action, pending, state, seatIds, amount, onBack }) {
  const fieldErrors = state?.fieldErrors ?? {};

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="seatIds" value={seatIds.join(",")} />

      <Field id="name" label="Full name" error={fieldErrors.name}>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          placeholder="Ayesha Khan"
          required
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? "name-error" : undefined}
        />
      </Field>

      <Field id="phone" label="Phone" error={fieldErrors.phone} hint="We text the ticket to this number.">
        <Input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="0300 1234567"
          required
          aria-invalid={Boolean(fieldErrors.phone)}
          aria-describedby={fieldErrors.phone ? "phone-error" : undefined}
        />
      </Field>

      <Field id="email" label="Email (optional)" error={fieldErrors.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
        />
      </Field>

      {state?.status === "error" && state.message ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          {state.message}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} disabled={pending}>
          <ArrowLeft data-icon="inline-start" className="size-4" aria-hidden />
          Seats
        </Button>
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? "Confirming…" : `Pay ${formatMoney(amount)}`}
        </Button>
      </div>
    </form>
  );
}
