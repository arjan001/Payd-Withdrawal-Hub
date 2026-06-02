import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const credentialsTable = pgTable("credentials", {
  id: serial("id").primaryKey(),
  paydUsername: text("payd_username"),
  paydPassword: text("payd_password"),
  paydApiSecret: text("payd_api_secret"),
  paydAccountUsername: text("payd_account_username"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCredentialsSchema = createInsertSchema(credentialsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCredentials = z.infer<typeof insertCredentialsSchema>;
export type Credentials = typeof credentialsTable.$inferSelect;
