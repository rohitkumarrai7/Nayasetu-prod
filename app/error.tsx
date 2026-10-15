"use client";

import Link from "next/link";
import { useEffect } from "react";

// Route-level error boundary. Catches client-side exceptions (e.g. a Convex query hitting a
// deployment that doesn't have the function yet) so the app shows a helpful message instead of
// a blank "Application error" white screen.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface for debugging in the browser console.
    console.error("NyayaSetu error boundary:", error);
    // After a new Vercel deploy, an open tab can request JS chunks that no longer exist
    // (ChunkLoadError). One hard reload fetches the new build; the session flag prevents loops.
    if (/ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module/i.test(
      `${error?.name} ${error?.message}`,
    )) {
      try {
        if (!sessionStorage.getItem("ns-chunk-reload")) {
          sessionStorage.setItem("ns-chunk-reload", "1");
          window.location.reload();
        }
      } catch {
        /* storage unavailable — show the error UI instead */
      }
    }
  }, [error]);

  const looksLikeBackend =
    /function|convex|not found|deployment|fetch|network/i.test(error?.message ?? "");

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <div className="card p-8">
        <h1 className="text-xl font-semibold text-ink">Something didn&apos;t load</h1>
        {looksLikeBackend ? (
          <p className="mt-3 text-sm text-ink-soft">
            The app couldn&apos;t reach its backend functions. This usually means the Convex
            deployment hasn&apos;t been deployed yet, or <code>NEXT_PUBLIC_CONVEX_URL</code> points
            to a deployment without the latest functions. Deploy Convex
            (<code>npx convex deploy</code>) and confirm the URL, then reload.
          </p>
        ) : (
          <p className="mt-3 text-sm text-ink-soft">
            An unexpected error occurred. Please try again.
          </p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={reset} className="btn">
            Try again
          </button>
          <Link href="/" className="btn-ghost">
            Go home
          </Link>
        </div>
        {error?.message && (
          <p className="mt-4 break-words text-left text-xs text-ink-muted">{error.message}</p>
        )}
      </div>
    </main>
  );
}
