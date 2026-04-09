import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { PDFParse } from "pdf-parse";

const objectStorageService = new ObjectStorageService();

const TEXT_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "text/xml",
  "application/json",
  "application/xml",
  "text/css",
  "text/javascript",
  "application/javascript",
]);

const PDF_MIME_TYPES = new Set([
  "application/pdf",
]);

const MAX_EXTRACTED_LENGTH = 50_000;

export async function extractFileContent(
  fileUrl: string | null | undefined,
  mimeType: string | null | undefined
): Promise<string | null> {
  if (!fileUrl) return null;

  const effectiveMime = (mimeType || "").toLowerCase();

  const isPdf = PDF_MIME_TYPES.has(effectiveMime);
  const isText = TEXT_MIME_TYPES.has(effectiveMime) ||
    effectiveMime.startsWith("text/");

  if (!isPdf && !isText) return null;

  try {
    const file = await objectStorageService.getObjectEntityFile(fileUrl);
    const [buffer] = await file.download();

    if (isPdf) {
      const parser = new PDFParse({ data: buffer });
      await parser.load();
      const result = await parser.getText();
      const text = result.text?.trim();
      if (!text) return null;
      return text.length > MAX_EXTRACTED_LENGTH
        ? text.slice(0, MAX_EXTRACTED_LENGTH) + "\n[… truncated]"
        : text;
    }

    const text = buffer.toString("utf-8").trim();
    if (!text) return null;
    return text.length > MAX_EXTRACTED_LENGTH
      ? text.slice(0, MAX_EXTRACTED_LENGTH) + "\n[… truncated]"
      : text;
  } catch (error) {
    if (error instanceof ObjectNotFoundError) return null;
    console.error(`Failed to extract content from ${fileUrl}:`, error);
    return null;
  }
}
