import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  reference: text("reference").unique(),
  correlatorId: text("correlator_id").unique(),
  type: text("type").notNull(),
  status: text("status").notNull().default("pending"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("KES"),
  phoneNumber: text("phone_number"),
  narration: text("narration"),
  channel: text("channel"),
  businessAccount: text("business_account"),
  businessType: text("business_type"),
  receiverUsername: text("receiver_username"),
  walletType: text("wallet_type"),
  resultCode: integer("result_code"),
  remarks: text("remarks"),
  thirdPartyTransId: text("third_party_trans_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
