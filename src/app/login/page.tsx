"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState, Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";

  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, pin }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Sign in failed");
        setLoading(false);
        return;
      }

      router.push(redirect);
      router.refresh();
      // Keep loading until navigation completes.
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col justify-center bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-logo-serif text-4xl tracking-tight text-foreground">
            Pilot
          </p>
          <p className="mt-1 font-mono text-[10px] font-medium tracking-[0.35em] text-muted uppercase">
            Thread Mills
          </p>
          <h1 className="mt-6 text-xl font-medium tracking-tight text-foreground">
            Employee sign in
          </h1>
          <p className="mt-2 text-sm text-muted">
            Use your mobile number and PIN. No OTP required.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-slate-700"
            >
              Mobile number
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="9876543210"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-foreground shadow-sm outline-none placeholder:text-muted focus:border-foreground"
            />
          </div>

          <div>
            <label
              htmlFor="pin"
              className="block text-sm font-medium text-slate-700"
            >
              PIN
            </label>
            <input
              id="pin"
              name="pin"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              placeholder="••••"
              required
              minLength={4}
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-foreground shadow-sm outline-none placeholder:text-muted focus:border-foreground"
            />
          </div>

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full justify-center rounded-lg bg-foreground px-4 py-3 text-sm font-semibold text-surface shadow-sm transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60 sm:py-2.5"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-full bg-background">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
