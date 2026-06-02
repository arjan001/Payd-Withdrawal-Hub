import { pgTable, serial, text, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const credentialsTable = pgTable(
  "credentials",
  {
    id: serial("id").primaryKey(),
    paydUsername: text("payd_username").notNull(),
    paydPassword: text("payd_password").notNull(),
    paydApiSecret: text("payd_api_secret"),
    paydAccountUsername: text("payd_account_username").notNull(),
    isActive: boolean("is_active").notNull().default(false),
    withdrawalsEnabled: boolean("withdrawals_enabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("credentials_account_username_idx").on(t.paydAccountUsername)],
);

export const insertCredentialsSchema = createInsertSchema(credentialsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCredentials = z.infer<typeof insertCredentialsSchema>;
export type Credentials = typeof credentialsTable.$inferSelect;
