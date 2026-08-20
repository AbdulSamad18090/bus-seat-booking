"use client";

import { useActionState } from "react";
import { LogIn, TriangleAlert } from "lucide-react";

import { signInAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInAction, null);

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      {state?.status === "error" ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
        <LogIn data-icon="inline-end" className="size-4" aria-hidden />
      </Button>
    </form>
  );
}
