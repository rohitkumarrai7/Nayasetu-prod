"use client";
import { useCallback, useState } from "react";

/** Turn a Convex error ("[Request ID: x] Server Error\nUncaught Error: Foo\n    at …") into "Foo". */
export function errMsg(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e ?? "Something went wrong");
  const m = raw.match(/Uncaught (?:Error|ConvexError): ([^\n]+)/);
  let msg = (m ? m[1] : raw.replace(/^\[Request ID: [^\]]+\]\s*/, "").split("\n")[0]).trim();
  if (/Server Error$/.test(msg) || !msg) msg = "The server hit an error. Please try again.";
  if (/Could not find public function/i.test(raw)) {
    msg = "The backend is out of date with this site (function missing). Redeploy Convex: npx convex deploy.";
  }
  if (/fetch failed|Failed to fetch|NetworkError/i.test(raw)) msg = "Can't reach the server. Check your connection and try again.";
  return msg;
}

export const CATEGORY_LABEL: Record<string, string> = {
  motor_vehicle: "Motor Vehicle",
  consumer: "Consumer Dispute",
  property: "Property / Tenancy",
  cheque_bounce: "Cheque Bounce",
  family: "Family / Matrimonial",
  employment: "Employment / Labour",
  criminal: "Criminal / Police",
  cyber: "Cyber Fraud",
  other: "General",
};

export const STATUS_META: Record<string, { label: string; cls: string }> = {
  intake: { label: "Intake", cls: "bg-slate-100 text-slate-700" },
  research: { label: "Research", cls: "bg-brand-50 text-brand" },
  drafting: { label: "Drafting", cls: "bg-saffron-50 text-saffron-700" },
  active: { label: "Active", cls: "bg-emerald-50 text-emerald-700" },
  closed: { label: "Closed", cls: "bg-paper-dark text-ink-muted" },
};

export const PRACTICE_AREAS =Object.entries(CATEGORY_LABEL)
  .filter(([k]) => k !== "other")
  .map(([, v]) => v);

/** One-shot browser geolocation with friendly errors. */
export function useGeolocation() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locate = useCallback(
    () =>
      new Promise<{ lat: number; lng: number } | null>((resolve) => {
        if (typeof navigator === "undefined" || !navigator.geolocation) {
          setError("Location isn't available in this browser — type your city instead.");
          return resolve(null);
        }
        setBusy(true);
        setError(null);
        navigator.geolocation.getCurrentPosition(
          (p) => {
            setBusy(false);
            resolve({ lat: p.coords.latitude, lng: p.coords.longitude });
          },
          (e) => {
            setBusy(false);
            setError(
              e.code === e.PERMISSION_DENIED
                ? "Location permission was denied — type your city instead."
                : "Couldn't get your location — type your city instead.",
            );
            resolve(null);
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
        );
      }),
    [],
  );
  return { locate, busy, error };
}

export function timeAgo(ms: number): string {
  const mins = Math.floor((Date.now() - ms) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}
