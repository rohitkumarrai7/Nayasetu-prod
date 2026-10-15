// Platform-admin guard (PRD §5 "Platform Admin (us)"). Admins are configured on the Convex
// deployment — never self-serve:  npx convex env set ADMIN_EMAILS "you@example.com,ops@example.com"
import { MutationCtx, QueryCtx } from "../_generated/server";
import { currentUserId } from "./access";

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function isPlatformAdmin(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const userId = await currentUserId(ctx);
  if (!userId) return false;
  const user = await ctx.db.get(userId);
  const email = ((user as { email?: string } | null)?.email ?? "").toLowerCase();
  return !!email && adminEmails().includes(email);
}

export async function requirePlatformAdmin(ctx: QueryCtx | MutationCtx): Promise<void> {
  if (!(await isPlatformAdmin(ctx))) {
    throw new Error("Forbidden: platform admin only (set ADMIN_EMAILS on the Convex deployment)");
  }
}
