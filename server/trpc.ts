import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { SafeUser } from "../drizzle/schema";

export interface Context {
  user: SafeUser | null;
}

const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;

// Requires a valid logged-in session. ctx.user is the authenticated user.
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Please log in to continue" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

// Admin-only guard
export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Please log in to continue" });
  }
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});
