import { z } from "zod";
import { eq, and, gte, lte, desc, gt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "./trpc";
import { getDb } from "./db";
import { projects, testMasters, testEntries, consumptionStatements, users, sessions } from "../drizzle/schema";
import { TEST_DEFINITIONS, computeTest, getTestDef, CATEGORIES } from "../shared/testDefinitions";
import type { SafeUser } from "../drizzle/schema";

const SESSION_DAYS = 30;

function toSafeUser(u: any): SafeUser {
  const { passwordHash, ...safe } = u;
  return safe as SafeUser;
}

const projectInput = z.object({
  name: z.string().min(1),
  packageNo: z.string().optional(),
  client: z.string().optional(),
  location: z.string().optional(),
  remarks: z.string().optional(),
});

export const appRouter = router({
  // ---------------- Auth ----------------
  auth: router({
    // True when no users exist yet — client shows first-time admin setup.
    needsSetup: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return true;
      const rows = await db.select({ id: users.id }).from(users).limit(1);
      return rows.length === 0;
    }),
    // First-ever registration creates the admin. Afterwards, registration is closed
    // (admin creates users via auth.createUser).
    register: publicProcedure
      .input(z.object({
        username: z.string().min(3).max(80).regex(/^[a-zA-Z0-9_.-]+$/, "Only letters, numbers, dot, dash and underscore allowed"),
        password: z.string().min(6, "Password must be at least 6 characters"),
        name: z.string().min(1).max(120),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not connected");
        const existing = await db.select({ id: users.id }).from(users).limit(1);
        if (existing.length > 0) throw new Error("Registration is closed — ask your admin to create an account");
        const uname = input.username.toLowerCase();
        const dup = await db.select({ id: users.id }).from(users).where(eq(users.username, uname)).limit(1);
        if (dup.length > 0) throw new Error("Username already taken");
        const passwordHash = await bcrypt.hash(input.password, 10);
        const [res] = await db.insert(users).values({
          username: uname, passwordHash, name: input.name.trim(), role: "admin", isActive: 1,
        } as any);
        const userId = Number((res as any).insertId);
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
        await db.insert(sessions).values({ userId, token, expiresAt } as any);
        const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        return { token, user: toSafeUser(u) };
      }),
    login: publicProcedure
      .input(z.object({ username: z.string().min(1), password: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not connected");
        const uname = input.username.toLowerCase().trim();
        const rows = await db.select().from(users).where(eq(users.username, uname)).limit(1);
        const u = rows[0] as any;
        if (!u) throw new Error("Invalid username or password");
        if (!u.isActive) throw new Error("Account is deactivated — contact your admin");
        const ok = await bcrypt.compare(input.password, u.passwordHash);
        if (!ok) throw new Error("Invalid username or password");
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
        await db.insert(sessions).values({ userId: u.id, token, expiresAt } as any);
        return { token, user: toSafeUser(u) };
      }),
    logout: protectedProcedure
      .input(z.object({ token: z.string() }).nullish())
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return { ok: true };
        // Delete the caller's session(s): by explicit token, else all of this user's sessions
        if (input?.token) {
          await db.delete(sessions).where(and(eq(sessions.token, input.token), eq(sessions.userId, ctx.user.id)));
        } else {
          await db.delete(sessions).where(eq(sessions.userId, ctx.user.id));
        }
        return { ok: true };
      }),
    me: protectedProcedure.query(({ ctx }) => ctx.user),
    // ---- Admin: user management ----
    listUsers: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(users).orderBy(desc(users.id));
      return (rows as any[]).map(toSafeUser);
    }),
    createUser: adminProcedure
      .input(z.object({
        username: z.string().min(3).max(80).regex(/^[a-zA-Z0-9_.-]+$/, "Only letters, numbers, dot, dash and underscore allowed"),
        password: z.string().min(6, "Password must be at least 6 characters"),
        name: z.string().min(1).max(120),
        role: z.enum(["admin", "user"]).default("user"),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not connected");
        const uname = input.username.toLowerCase();
        const dup = await db.select({ id: users.id }).from(users).where(eq(users.username, uname)).limit(1);
        if (dup.length > 0) throw new Error("Username already taken");
        const passwordHash = await bcrypt.hash(input.password, 10);
        const [res] = await db.insert(users).values({
          username: uname, passwordHash, name: input.name.trim(), role: input.role, isActive: 1,
        } as any);
        return { id: Number((res as any).insertId) };
      }),
    toggleActive: adminProcedure
      .input(z.object({ id: z.number(), isActive: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not connected");
        if (input.id === ctx.user.id) throw new Error("You cannot deactivate your own account");
        await db.update(users).set({ isActive: input.isActive ? 1 : 0 } as any).where(eq(users.id, input.id));
        if (!input.isActive) {
          // Kill all sessions of a deactivated user immediately
          await db.delete(sessions).where(eq(sessions.userId, input.id));
        }
        return { ok: true };
      }),
    resetPassword: adminProcedure
      .input(z.object({ id: z.number(), password: z.string().min(6, "Password must be at least 6 characters") }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not connected");
        const passwordHash = await bcrypt.hash(input.password, 10);
        await db.update(users).set({ passwordHash } as any).where(eq(users.id, input.id));
        // Force re-login after a password reset
        await db.delete(sessions).where(eq(sessions.userId, input.id));
        return { ok: true };
      }),
  }),

  // ---------------- Projects (per-user isolated) ----------------
  projects: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(projects).where(eq(projects.userId, ctx.user.id)).orderBy(desc(projects.id));
    }),
    create: protectedProcedure.input(projectInput).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not connected");
      const [res] = await db.insert(projects).values({ ...input, userId: ctx.user.id } as any);
      return { id: Number((res as any).insertId) };
    }),
    update: protectedProcedure
      .input(projectInput.extend({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not connected");
        const { id, ...data } = input;
        await db.update(projects).set(data as any)
          .where(and(eq(projects.id, id), eq(projects.userId, ctx.user.id)));
        return { ok: true };
      }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not connected");
      await db.delete(projects).where(and(eq(projects.id, input.id), eq(projects.userId, ctx.user.id)));
      return { ok: true };
    }),
  }),

  // ---------------- Test masters (shared reference data) ----------------
  testMasters: router({
    list: publicProcedure
      .input(z.object({ category: z.string().optional() }).nullish())
      .query(async ({ input }) => {
        const db = await getDb();
        // Fall back to in-code definitions if DB unavailable
        if (!db) {
          return TEST_DEFINITIONS.filter(
            d => !input?.category || d.category === input.category
          ).map(d => ({
            id: 0, code: d.code, name: d.name, category: d.category,
            isCode: d.isCode, unit: null, description: d.description,
          }));
        }
        const rows = await db.select().from(testMasters);
        return rows.filter((r: any) => !input?.category || r.category === input.category);
      }),
    categories: publicProcedure.query(async () => CATEGORIES),
    definition: publicProcedure.input(z.object({ code: z.string() })).query(async ({ input }) => {
      const def = getTestDef(input.code);
      if (!def) throw new Error("Unknown test code");
      // strip functions for transport — client imports definitions directly
      return { code: def.code, name: def.name, category: def.category, isCode: def.isCode, description: def.description };
    }),
    ensureSeeded: protectedProcedure.mutation(async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not connected");
      const existing = await db.select({ code: testMasters.code }).from(testMasters);
      const have = new Set(existing.map((r: any) => r.code));
      const missing = TEST_DEFINITIONS.filter(d => !have.has(d.code));
      for (const d of missing) {
        await db.insert(testMasters).values({
          code: d.code, name: d.name, category: d.category,
          isCode: d.isCode, description: d.description,
        });
      }
      return { seeded: missing.length, total: TEST_DEFINITIONS.length };
    }),
  }),

  // ---------------- Test entries (per-user isolated) ----------------
  entries: router({
    list: protectedProcedure
      .input(z.object({
        projectId: z.number().optional(),
        testCode: z.string().optional(),
        status: z.enum(["Pass", "Fail", "Pending", "Indicative"]).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        limit: z.number().default(200),
      }).nullish())
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return [];
        const conds: any[] = [eq(testEntries.userId, ctx.user.id)];
        if (input?.projectId) conds.push(eq(testEntries.projectId, input.projectId));
        if (input?.status) conds.push(eq(testEntries.status, input.status));
        if (input?.from) conds.push(gte(testEntries.testDate, input.from));
        if (input?.to) conds.push(lte(testEntries.testDate, input.to));
        const rows = await db
          .select({ entry: testEntries, master: testMasters, project: projects })
          .from(testEntries)
          .leftJoin(testMasters, eq(testEntries.testMasterId, testMasters.id))
          .leftJoin(projects, eq(testEntries.projectId, projects.id))
          .where(and(...conds))
          .orderBy(desc(testEntries.testDate), desc(testEntries.id))
          .limit(input?.limit ?? 200);
        let out = rows;
        if (input?.testCode) {
          const def = getTestDef(input.testCode);
          out = rows.filter((r: any) => r.master?.code === def?.code);
        }
        return out;
      }),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not connected");
      const rows = await db
        .select({ entry: testEntries, master: testMasters, project: projects })
        .from(testEntries)
        .leftJoin(testMasters, eq(testEntries.testMasterId, testMasters.id))
        .leftJoin(projects, eq(testEntries.projectId, projects.id))
        .where(and(eq(testEntries.id, input.id), eq(testEntries.userId, ctx.user.id)));
      return rows[0] ?? null;
    }),
    create: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        testCode: z.string(),
        testDate: z.string(),
        sampleId: z.string().optional(),
        chainage: z.string().optional(),
        layer: z.string().optional(),
        materialSource: z.string().optional(),
        testedBy: z.string().optional(),
        witnessBy: z.string().optional(),
        inputs: z.record(z.string(), z.string()),
        remarks: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not connected");
        // The project must belong to this user
        const owned = await db.select({ id: projects.id }).from(projects)
          .where(and(eq(projects.id, input.projectId), eq(projects.userId, ctx.user.id))).limit(1);
        if (!owned.length) throw new Error("Project not found");
        const def = getTestDef(input.testCode);
        if (!def) throw new Error("Unknown test code");
        const masters = await db.select().from(testMasters).where(eq(testMasters.code, def.code));
        if (!masters[0]) throw new Error("Test master not seeded — run seed first");
        const computed = computeTest(def, input.inputs);
        const [res] = await db.insert(testEntries).values({
          userId: ctx.user.id,
          projectId: input.projectId,
          testMasterId: masters[0].id,
          testDate: input.testDate,
          sampleId: input.sampleId || null,
          chainage: input.chainage || null,
          layer: input.layer || null,
          materialSource: input.materialSource || null,
          testedBy: input.testedBy || null,
          witnessBy: input.witnessBy || null,
          inputs: input.inputs,
          results: { values: computed.formatted, status: computed.status } as any,
          status: computed.status,
          remarks: input.remarks || null,
        } as any);
        return { id: Number((res as any).insertId), status: computed.status, computed };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        testDate: z.string().optional(),
        sampleId: z.string().optional(),
        chainage: z.string().optional(),
        layer: z.string().optional(),
        materialSource: z.string().optional(),
        testedBy: z.string().optional(),
        witnessBy: z.string().optional(),
        inputs: z.record(z.string(), z.string()).optional(),
        remarks: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not connected");
        const { id, inputs, ...rest } = input;
        const data: any = { ...rest };
        if (inputs) {
          const rows = await db
            .select({ entry: testEntries, master: testMasters })
            .from(testEntries)
            .leftJoin(testMasters, eq(testEntries.testMasterId, testMasters.id))
            .where(and(eq(testEntries.id, id), eq(testEntries.userId, ctx.user.id)));
          const code = rows[0]?.master?.code;
          const def = code ? getTestDef(code) : undefined;
          if (!def) throw new Error("Unknown test for entry");
          const computed = computeTest(def, inputs);
          data.inputs = inputs;
          data.results = { values: computed.formatted, status: computed.status };
          data.status = computed.status;
        }
        await db.update(testEntries).set(data)
          .where(and(eq(testEntries.id, id), eq(testEntries.userId, ctx.user.id)));
        return { ok: true };
      }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not connected");
      await db.delete(testEntries).where(and(eq(testEntries.id, input.id), eq(testEntries.userId, ctx.user.id)));
      return { ok: true };
    }),
  }),

  // ---------------- Dashboard (per-user isolated) ----------------
  dashboard: router({
    stats: protectedProcedure
      .input(z.object({ projectId: z.number().optional() }).nullish())
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return { total: 0, pass: 0, fail: 0, pending: 0, indicative: 0, passPct: 0, byCategory: [] as any[] };
        const conds: any[] = [eq(testEntries.userId, ctx.user.id)];
        if (input?.projectId) conds.push(eq(testEntries.projectId, input.projectId));
        const rows = await db
          .select({ status: testEntries.status, category: testMasters.category })
          .from(testEntries)
          .leftJoin(testMasters, eq(testEntries.testMasterId, testMasters.id))
          .where(and(...conds));
        const total = rows.length;
        const pass = rows.filter((r: any) => r.status === "Pass").length;
        const fail = rows.filter((r: any) => r.status === "Fail").length;
        const pending = rows.filter((r: any) => r.status === "Pending").length;
        const indicative = rows.filter((r: any) => r.status === "Indicative").length;
        const decided = pass + fail;
        const byCat: Record<string, { total: number; pass: number; fail: number }> = {};
        for (const r of rows) {
          const c = r.category || "Other";
          byCat[c] = byCat[c] || { total: 0, pass: 0, fail: 0 };
          byCat[c].total++;
          if (r.status === "Pass") byCat[c].pass++;
          if (r.status === "Fail") byCat[c].fail++;
        }
        return {
          total, pass, fail, pending, indicative,
          passPct: decided ? Math.round((pass / decided) * 100) : 0,
          byCategory: Object.entries(byCat).map(([category, s]) => ({ category, ...s })),
        };
      }),
  }),

  // ---------------- Consumption statements (per-user isolated) ----------------
  statements: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().default(100) }).nullish())
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(consumptionStatements)
          .where(eq(consumptionStatements.userId, ctx.user.id))
          .orderBy(desc(consumptionStatements.id)).limit(input?.limit ?? 100);
      }),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not connected");
      const rows = await db.select().from(consumptionStatements)
        .where(and(eq(consumptionStatements.id, input.id), eq(consumptionStatements.userId, ctx.user.id)));
      return rows[0] ?? null;
    }),
    create: protectedProcedure
      .input(z.object({
        date: z.string(),
        raBillNo: z.string().min(1),
        rows: z.array(z.object({ item: z.string(), qty: z.number() })),
        norms: z.record(z.string(), z.any()),
        royaltyRates: z.record(z.string(), z.number()),
        remarks: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not connected");
        const [res] = await db.insert(consumptionStatements).values({ ...input, userId: ctx.user.id } as any);
        return { id: Number((res as any).insertId) };
      }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not connected");
      await db.delete(consumptionStatements)
        .where(and(eq(consumptionStatements.id, input.id), eq(consumptionStatements.userId, ctx.user.id)));
      return { ok: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
