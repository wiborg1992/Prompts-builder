import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sessionsTable } from "./sessions";

export const SuggestedFileSchema = z.object({
  filename: z.string(),
  reason: z.string(),
});
export type SuggestedFile = z.infer<typeof SuggestedFileSchema>;

export const generatedPromptsTable = pgTable("generated_prompts", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => sessionsTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  instruction: text("instruction"),
  version: integer("version").notNull().default(1),
  suggestedFiles: jsonb("suggested_files").$type<SuggestedFile[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertGeneratedPromptSchema = createInsertSchema(generatedPromptsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGeneratedPrompt = z.infer<typeof insertGeneratedPromptSchema>;
export type GeneratedPrompt = typeof generatedPromptsTable.$inferSelect;
