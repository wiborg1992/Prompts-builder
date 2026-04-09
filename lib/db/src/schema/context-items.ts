import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sessionsTable } from "./sessions";

export const contextItemTypeEnum = ["transcript", "note", "file", "image", "requirement", "paste"] as const;

export const contextItemsTable = pgTable("context_items", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => sessionsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull().$type<typeof contextItemTypeEnum[number]>(),
  label: text("label"),
  content: text("content").notNull(),
  fileUrl: text("file_url"),
  filename: text("filename"),
  mimeType: text("mime_type"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertContextItemSchema = createInsertSchema(contextItemsTable).omit({ id: true, createdAt: true });
export type InsertContextItem = z.infer<typeof insertContextItemSchema>;
export type ContextItem = typeof contextItemsTable.$inferSelect;
