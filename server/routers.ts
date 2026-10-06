import { z } from "zod";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { router, publicProcedure } from "./trpc";
import { getDb } from "./db";
import { projects, testMasters, testEntries, consumptionStatements } from "../drizzle/schema";
import { TEST_DEFINITIONS, computeTest, getTestDef, CATEGORIES } from "../shared/testDefinitions";

const projectInput = z.object({
  name: z.string().min(1),
  packageNo: z.string().optional(),
  client: z.string().optional(),
  location: z.string().optional(),
  remarks: z.string().optional(),
});

export const appRouter = router({
  // ---------------- Projects ----------------
  projects: router({
    list: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(projects).orderBy(desc(projects.id));
    }),
    create: publicProcedure.input(projectInput).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not connected");
      const [res] = await db.insert(projects).values(input as any);
      return { id: Number((res as any).insertId) };
    }),
    update: publicProcedure
      .input(projectInput.extend({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not connected");
        const { id, ...data } = input;
        await db.update(projects).set(data as any).where(eq(projects.id, id));
        return { ok: true };
      }),
    delete: publicProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not connected");
      await db.delete(projects).where(eq(projects.id, input.id));
      return { ok: true };
    }),
  }),

  // ---------------- Test masters ----------------
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
    ensureSeeded: publicProcedure.mutation(async () => {
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

  // ---------------- Test entries ----------------
  entries: router({
    list: publicProcedure
      .input(z.object({
        projectId: z.number().optional(),
        testCode: z.string().optional(),
        status: z.enum(["Pass", "Fail", "Pending", "Indicative"]).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        limit: z.number().default(200),
      }).nullish())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const conds: any[] = [];
        if (input?.projectId) conds.push(eq(testEntries.projectId, input.projectId));
        if (input?.status) conds.push(eq(testEntries.status, input.status));
        if (input?.from) conds.push(gte(testEntries.testDate, input.from));
        if (input?.to) conds.push(lte(testEntries.testDate, input.to));
        const rows = await db
          .select({ entry: testEntries, master: testMasters, project: projects })
          .from(testEntries)
          .leftJoin(testMasters, eq(testEntries.testMasterId, testMasters.id))
          .leftJoin(projects, eq(testEntries.projectId, projects.id))
          .where(conds.length ? and(...conds) : undefined)
          .orderBy(desc(testEntries.testDate), desc(testEntries.id))
          .limit(input?.limit ?? 200);
        let out = rows;
        if (input?.testCode) {
          const def = getTestDef(input.testCode);
          out = rows.filter((r: any) => r.master?.code === def?.code);
        }
        return out;
      }),
    get: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not connected");
      const rows = await db
        .select({ entry: testEntries, master: testMasters, project: projects })
        .from(testEntries)
        .leftJoin(testMasters, eq(testEntries.testMasterId, testMasters.id))
        .leftJoin(projects, eq(testEntries.projectId, projects.id))
        .where(eq(testEntries.id, input.id));
      return rows[0] ?? null;
    }),
    create: publicProcedure
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
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not connected");
        const def = getTestDef(input.testCode);
        if (!def) throw new Error("Unknown test code");
        const masters = await db.select().from(testMasters).where(eq(testMasters.code, def.code));
        if (!masters[0]) throw new Error("Test master not seeded — run seed first");
        const computed = computeTest(def, input.inputs);
        const [res] = await db.insert(testEntries).values({
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
    update: publicProcedure
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
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not connected");
        const { id, inputs, ...rest } = input;
        const data: any = { ...rest };
        if (inputs) {
          const rows = await db
            .select({ entry: testEntries, master: testMasters })
            .from(testEntries)
            .leftJoin(testMasters, eq(testEntries.testMasterId, testMasters.id))
            .where(eq(testEntries.id, id));
          const code = rows[0]?.master?.code;
          const def = code ? getTestDef(code) : undefined;
          if (!def) throw new Error("Unknown test for entry");
          const computed = computeTest(def, inputs);
          data.inputs = inputs;
          data.results = { values: computed.formatted, status: computed.status };
          data.status = computed.status;
        }
        await db.update(testEntries).set(data).where(eq(testEntries.id, id));
        return { ok: true };
      }),
    delete: publicProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not connected");
      await db.delete(testEntries).where(eq(testEntries.id, input.id));
      return { ok: true };
    }),
  }),

  // ---------------- Dashboard ----------------
  dashboard: router({
    stats: publicProcedure
      .input(z.object({ projectId: z.number().optional() }).nullish())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { total: 0, pass: 0, fail: 0, pending: 0, indicative: 0, passPct: 0, byCategory: [] as any[] };
        const conds: any[] = [];
        if (input?.projectId) conds.push(eq(testEntries.projectId, input.projectId));
        const rows = await db
          .select({ status: testEntries.status, category: testMasters.category })
          .from(testEntries)
          .leftJoin(testMasters, eq(testEntries.testMasterId, testMasters.id))
          .where(conds.length ? and(...conds) : undefined);
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

  // ---------------- Consumption statements (RA bill format) ----------------
  statements: router({
    list: publicProcedure
      .input(z.object({ limit: z.number().default(100) }).nullish())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(consumptionStatements).orderBy(desc(consumptionStatements.id)).limit(input?.limit ?? 100);
      }),
    get: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not connected");
      const rows = await db.select().from(consumptionStatements).where(eq(consumptionStatements.id, input.id));
      return rows[0] ?? null;
    }),
    create: publicProcedure
      .input(z.object({
        date: z.string(),
        raBillNo: z.string().min(1),
        rows: z.array(z.object({ item: z.string(), qty: z.number() })),
        norms: z.record(z.string(), z.any()),
        royaltyRates: z.record(z.string(), z.number()),
        remarks: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not connected");
        const [res] = await db.insert(consumptionStatements).values(input as any);
        return { id: Number((res as any).insertId) };
      }),
    delete: publicProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not connected");
      await db.delete(consumptionStatements).where(eq(consumptionStatements.id, input.id));
      return { ok: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
