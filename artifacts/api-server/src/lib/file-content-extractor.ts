import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

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

const PDF_MIME_TYPES = new Set(["application/pdf"]);

const DOCX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.ms-word",
]);

const MAX_EXTRACTED_LENGTH = 50000;

const EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  xml: "text/xml",
  html: "text/html",
  htm: "text/html",
};

function mimeFromExtension(fileUrl: string): string | null {
  const lastSegment = fileUrl.split("/").pop() ?? "";
  const ext = lastSegment.includes(".") ? lastSegment.split(".").pop()?.toLowerCase() : null;
  return ext ? (EXT_TO_MIME[ext] ?? null) : null;
}

function mimeFromMagicBytes(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;
  const b0 = buffer[0], b1 = buffer[1], b2 = buffer[2], b3 = buffer[3];

  if (b0 === 0x25 && b1 === 0x50 && b2 === 0x44 && b3 === 0x46) {
    return "application/pdf";
  }

  if (b0 === 0x50 && b1 === 0x4B && b2 === 0x03 && b3 === 0x04) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  if (b0 === 0xD0 && b1 === 0xCF && b2 === 0x11 && b3 === 0xE0) {
    return "application/msword";
  }

  const sampleLength = Math.min(512, buffer.length);
  let nonPrintable = 0;
  for (let i = 0; i < sampleLength; i++) {
    const byte = buffer[i];
    if (byte === 0x00) {
      return null;
    }
    if (byte < 0x09 || (byte > 0x0D && byte < 0x20 && byte !== 0x1B)) {
      nonPrintable++;
    }
  }
  if (nonPrintable / sampleLength < 0.1) {
    return "text/plain";
  }

  return null;
}

function truncate(text: string): string {
  if (!text) return text;
  return text.length > MAX_EXTRACTED_LENGTH
    ? `${text.slice(0, MAX_EXTRACTED_LENGTH)}\n[… truncated]`
    : text;
}

export async function extractFileContent(
  fileUrl: string | null | undefined,
  mimeType: string | null | undefined
): Promise<string | null> {
  if (!fileUrl) return null;

  try {
    const objectFile = await objectStorageService.getObjectEntityFile(fileUrl);

    let effectiveMime = (mimeType || "").toLowerCase().trim();

    if (!effectiveMime || effectiveMime === "application/octet-stream") {
      try {
        const [meta] = await objectFile.getMetadata();
        const gcsMime = ((meta.contentType as string) || "").toLowerCase();
        if (gcsMime && gcsMime !== "application/octet-stream") {
          effectiveMime = gcsMime;
        }
      } catch {
      }
    }

    if (!effectiveMime || effectiveMime === "application/octet-stream") {
      effectiveMime = mimeFromExtension(fileUrl) ?? effectiveMime;
    }

    const isPdf = PDF_MIME_TYPES.has(effectiveMime);
    const isDocx = DOCX_MIME_TYPES.has(effectiveMime);
    const isText = TEXT_MIME_TYPES.has(effectiveMime) || effectiveMime.startsWith("text/");

    const [buffer] = await objectFile.download();

    let resolvedMime = effectiveMime;
    if (!isPdf && !isDocx && !isText) {
      const detectedMime = mimeFromMagicBytes(buffer);
      if (!detectedMime) {
        return null;
      }
      resolvedMime = detectedMime;
    }

    const finalIsPdf = PDF_MIME_TYPES.has(resolvedMime);
    const finalIsDocx = DOCX_MIME_TYPES.has(resolvedMime);
    const finalIsText = TEXT_MIME_TYPES.has(resolvedMime) || resolvedMime.startsWith("text/");

    if (finalIsDocx) {
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value.trim();
      if (!text) return null;
      return truncate(text);
    }

    if (finalIsPdf) {
      const parser = new PDFParse({ data: buffer });
      await parser.load();
      const result = await parser.getText();
      const text = result.text?.trim();
      if (!text) return null;
      return truncate(text);
    }

    if (finalIsText) {
      const text = buffer.toString("utf-8").trim();
      if (!text) return null;
      return truncate(text);
    }

    return null;
  } catch (error) {
    if (error instanceof ObjectNotFoundError) return null;
    console.error(`Failed to extract content from ${fileUrl}:`, error);
    return null;
  }
}
