import {
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  tinyint,
  varchar,
} from "drizzle-orm/mysql-core";

// ---------------- Users & sessions (multi-user auth) ----------------
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 80 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 200 }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  role: mysqlEnum("role", ["admin", "user"]).default("user").notNull(),
  isActive: tinyint("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type User = typeof users.$inferSelect;
export type SafeUser = Omit<User, "passwordHash">;

export const sessions = mysqlTable("sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ---------------- Projects ----------------
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  name: varchar("name", { length: 200 }).notNull(),
  packageNo: varchar("packageNo", { length: 80 }),
  client: varchar("client", { length: 200 }),
  location: varchar("location", { length: 200 }),
  remarks: text("remarks"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

// ---------------- Test masters (seeded from shared/testDefinitions.ts) ----------------
export const testMasters = mysqlTable("test_masters", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  category: varchar("category", { length: 60 }).notNull(),
  isCode: varchar("isCode", { length: 120 }),
  unit: varchar("unit", { length: 40 }),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type TestMaster = typeof testMasters.$inferSelect;

// ---------------- Test entries ----------------
export const testEntries = mysqlTable("test_entries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  projectId: int("projectId").notNull(),
  testMasterId: int("testMasterId").notNull(),
  testDate: varchar("testDate", { length: 20 }).notNull(), // YYYY-MM-DD
  sampleId: varchar("sampleId", { length: 80 }),
  chainage: varchar("chainage", { length: 60 }),
  layer: varchar("layer", { length: 120 }),
  materialSource: varchar("materialSource", { length: 200 }),
  testedBy: varchar("testedBy", { length: 120 }),
  witnessBy: varchar("witnessBy", { length: 120 }),
  // Raw input values keyed by field key, e.g. { w1: "12.5", ... }
  inputs: json("inputs").$type<Record<string, string>>().notNull().default({}),
  // Calculated results keyed by calc key, e.g. { pi: "8.2", status: "Pass" }
  results: json("results").$type<Record<string, string | number>>().notNull().default({}),
  status: mysqlEnum("status", ["Pass", "Fail", "Pending", "Indicative"]).default("Pending").notNull(),
  remarks: text("remarks"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TestEntry = typeof testEntries.$inferSelect;
export type InsertTestEntry = typeof testEntries.$inferInsert;

// ---------------- Consumption statements (RA bill format) ----------------
export const consumptionStatements = mysqlTable("consumption_statements", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  date: varchar("date", { length: 20 }).notNull(), // YYYY-MM-DD
  raBillNo: varchar("raBillNo", { length: 60 }).notNull(),
  rows: json("rows").$type<Array<{ item: string; qty: number }>>().notNull().default([]),
  norms: json("norms").$type<Record<string, any>>().notNull().default({}),
  royaltyRates: json("royaltyRates").$type<Record<string, number>>().notNull().default({}),
  remarks: text("remarks"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
