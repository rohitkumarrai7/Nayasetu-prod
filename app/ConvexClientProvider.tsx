"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

// Client-side Convex Auth (no SSR middleware needed) — simplest reliable Vercel deploy.
// NEXT_PUBLIC_CONVEX_URL must be set in Vercel. The fallback is the production deployment named in
// the PRD (usable-horse-818); the old fallback pointed at a different deployment, which made the
// live site call functions that didn't exist there.
const FALLBACK = "https://usable-horse-818.convex.cloud";
const RAW = process.env.NEXT_PUBLIC_CONVEX_URL;
const CONVEX_URL = (RAW || FALLBACK).trim().replace(/\/+$/, "");
if (!RAW && typeof window !== "undefined") {
  console.warn(`[NyayaSetu] NEXT_PUBLIC_CONVEX_URL is not set; using fallback ${FALLBACK}`);
}
const convex = new ConvexReactClient(CONVEX_URL);

export default function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexAuthProvider client={convex}>{children}</ConvexAuthProvider>;
}
