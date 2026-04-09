import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sessionsTable } from "./sessions";

export const generatedPromptsTable = pgTable("generated_prompts", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => sessionsTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  instruction: text("instruction"),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertGeneratedPromptSchema = createInsertSchema(generatedPromptsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGeneratedPrompt = z.infer<typeof insertGeneratedPromptSchema>;
export type GeneratedPrompt = typeof generatedPromptsTable.$inferSelect;
