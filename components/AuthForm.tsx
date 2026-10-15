"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

function authError(e: unknown, flow: "signIn" | "signUp"): string {
  const raw = e instanceof Error ? e.message : String(e);
  if (/JWT_PRIVATE_KEY|JWKS|SITE_URL|Missing environment variable/i.test(raw)) {
    return "Sign-in isn't configured on the server yet (Convex Auth keys missing). Admin: run `node scripts/setup-auth.mjs --prod`.";
  }
  if (/InvalidSecret|InvalidAccountId|Invalid credentials/i.test(raw)) {
    return flow === "signIn" ? "Wrong email or password." : "That email may already be registered — try signing in.";
  }
  if (/already exists/i.test(raw)) return "An account with this email already exists — sign in instead.";
  if (/TooManyFailedAttempts|rate/i.test(raw)) return "Too many attempts. Wait a minute and try again.";
  if (/Invalid password/i.test(raw)) return "Password must be at least 8 characters.";
  if (/fetch|network/i.test(raw)) return "Can't reach the server. Check your connection.";
  return flow === "signUp" ? "Could not sign up. Please try again." : "Could not sign in. Please try again.";
}

export default function AuthForm({ initialFlow = "signIn" }: { initialFlow?: "signIn" | "signUp" }) {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">(initialFlow);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn("password", { email: email.trim().toLowerCase(), password, flow });
    } catch (err) {
      console.error("auth error:", err);
      setError(authError(err, flow));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card w-full space-y-4 p-6 sm:p-7">
      <div className="grid grid-cols-2 rounded-xl bg-paper-dark p-1 text-sm">
        {(["signIn", "signUp"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => { setFlow(f); setError(null); }}
            className={`rounded-lg py-1.5 font-medium transition ${flow === f ? "bg-white text-ink shadow-card" : "text-ink-muted"}`}
          >
            {f === "signIn" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>
      <div>
        <h2 className="font-serif text-xl font-semibold">{flow === "signUp" ? "Start your advocate workspace" : "Welcome back"}</h2>
        <p className="mt-0.5 text-xs text-ink-muted">For advocates and firms. Citizens can ask questions without an account.</p>
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@chambers.in" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <div className="relative">
          <input
            id="password"
            className="input pr-10"
            type={show ? "text" : "password"}
            autoComplete={flow === "signUp" ? "new-password" : "current-password"}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 px-3 text-ink-muted" aria-label="Toggle password visibility">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {error && <p className="rounded-lg bg-red-50 p-2.5 text-sm text-red-700">{error}</p>}
      <button className="btn w-full py-2.5" disabled={busy}>
        {busy ? "Please wait…" : flow === "signUp" ? "Create account" : "Sign in"}
      </button>
    </form>
  );
}
