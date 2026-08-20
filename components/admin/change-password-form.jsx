"use client";

import { useActionState } from "react";
import { CircleCheck, TriangleAlert } from "lucide-react";

import { changePasswordAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordForm({ minLength }) {
  const [state, formAction, pending] = useActionState(changePasswordAction, null);

  return (
    <form action={formAction} className="grid gap-3 sm:max-w-sm">
      <div className="grid gap-1.5">
        <Label htmlFor="currentPassword">Current password</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="newPassword">New password</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={minLength}
          required
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="confirmPassword">Repeat new password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={minLength}
          required
        />
      </div>

      {state?.status ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={
            state.status === "error"
              ? "flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"
              : "flex items-start gap-2 text-xs text-muted-foreground"
          }
        >
          {state.status === "error" ? (
            <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          ) : (
            <CircleCheck className="mt-px size-3.5 shrink-0" aria-hidden />
          )}
          {state.message}
        </p>
      ) : null}

      <Button type="submit" variant="outline" disabled={pending} className="justify-self-start">
        {pending ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}
