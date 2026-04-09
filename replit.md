# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: OpenAI via user's own `OPENAI_API_KEY`
- **Speech-to-text**: Deepgram direct browser-to-API WebSocket (nova-3 for English, nova-2 for Danish) via `DEEPGRAM_API_KEY`
- **Object Storage**: Google Cloud Storage via Replit App Storage (presigned URL uploads)

## Artifacts

### Prompt Studio (`artifacts/prompt-studio`)
Context-driven design prompt generator with recording-first workflow. Users create sessions, record audio with live transcription, add context items (notes, files, images, requirements, pasted text), and generate AI-composed design prompts from session context.

- **No hardcoded domain knowledge** — all prompt generation is derived from user-supplied context
- **Recording-first layout**: Session workspace opens to the Record tab by default
- **Transcript is separate from Context** — recorded transcription lives only in the Record tab (stored in `transcript_segments` table), not in Context
- **Live transcription**: Direct browser-to-Deepgram WebSocket with speaker diarization, filler word removal, smart buffering (14s silence / 90s max), and workshop-optimized settings
- **Transcript log**: Record tab shows the full accumulated transcript history for the session, plus live feed during recording
- **Language support**: English (nova-3) and Danish (nova-2)
- **Auto-generate**: Stop recording automatically saves transcript segments and generates a prompt
- **Speaker identification**: Multiple speakers detected and labeled in the feed
- **Context tab**: Only for manually added items — notes, files, images, requirements, pasted text. No transcripts.
- **Multi-file uploads**: Users can upload multiple files at once via drag-and-drop or file picker
- **File uploads**: Real file/image uploads via presigned URLs to GCS
- **Tabs**: Record (primary) | Context | Prompts
- **Frontend**: React + Vite + TanStack Query + Shadcn UI + Tailwind
- **Preview**: served at `/`

### API Server (`artifacts/api-server`)
Express 5 backend with all routes:
- `GET/POST /api/sessions` — session management
- `GET/PATCH/DELETE /api/sessions/:id` — session CRUD
- `GET /api/sessions/:id/summary` — session context + transcript stats
- `GET/POST /api/sessions/:sessionId/context` — context item management (notes, files, images, requirements, paste)
- `PATCH/DELETE /api/sessions/:sessionId/context/:id`
- `GET/POST /api/sessions/:sessionId/transcripts` — transcript segment management
- `POST /api/sessions/:sessionId/transcripts/batch` — batch save transcript segments
- `DELETE /api/sessions/:sessionId/transcripts` — clear all transcript segments for a session
- `DELETE /api/sessions/:sessionId/transcripts/:id` — delete a single transcript segment
- `GET/POST /api/sessions/:sessionId/prompts` — prompt generation via AI (reads both context items AND transcript segments)
- `PATCH/DELETE /api/sessions/:sessionId/prompts/:id`
- `GET /api/deepgram-token` — returns Deepgram API key for direct browser-to-Deepgram connection
- `POST /api/transcribe` — batch audio transcription (Deepgram or OpenAI, language-aware)
- `POST /api/storage/uploads/request-url` — presigned URL for file upload
- `GET /api/storage/objects/*` — serve uploaded objects
- `GET /api/storage/public-objects/*` — serve public assets

## Database Schema

- `sessions` — session records (id, title, description, timestamps)
- `context_items` — context pieces per session (type: note|file|image|requirement|paste, label, content, file_url, filename, mime_type)
- `transcript_segments` — transcript segments per session (speaker, text, language, recording_id, timestamps). Separate from context items.
- `generated_prompts` — AI-generated prompts per session (content, instruction, version, timestamps)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Prompt Engineering

The prompt generator (`artifacts/api-server/src/lib/prompt-generator.ts`) follows a best-practice system prompt informed by five reference sources (PEEM, Anthropic context engineering, OpenAI/Claude best practices, and a custom system prompt spec). Reference material is stored in `artifacts/api-server/src/lib/prompt-engineering-context/`.

Key aspects:
- **4-part output structure**: Every generated prompt contains labeled sections: PRIORITIZATION SUMMARY → INPUT CONTEXT → SYSTEM INSTRUCTIONS → OUTPUT CONSTRAINTS → FEW-SHOT EXAMPLES
- **Conversation hierarchy**: Transcript is analyzed and grouped into core requirements / secondary preferences / explorations
- **Context mining**: Design constraints (colors, typography, tokens) are extracted from context items and inserted explicitly
- **PEEM self-evaluation**: The model internally evaluates the prompt across 9 quality axes (clarity, linguistic quality, fairness, accuracy, coherence, relevance, objectivity, clarity, conciseness) before finalizing
- **Language matching**: Prompt language matches the dominant transcript language (English/Danish)
- **XML-structured context**: Context items and transcripts are passed in XML tags for clear delimiting
- **File content extraction**: Uploaded PDFs and text files are downloaded from object storage and their text content is extracted at prompt generation time. PDF parsing via `pdf-parse` (externalized in esbuild). Text-based formats (txt, md, csv, html, json, xml) read as UTF-8. Max 50k chars per file.
- **max_completion_tokens**: 4096 (increased from 2048 to accommodate the richer structure)

## Design Principles

The app follows the document's requirement: **no hardcoded domain knowledge**. Prompt generation is entirely driven by what the user adds to the session. The AI model receives the user's context items + transcript segments + optional instruction. No company-specific terms, product families, or design assumptions are baked in.

**Transcript and Context are separate concerns**: Recorded speech lives in the Record tab only (stored as `transcript_segments`). The Context tab is exclusively for manually added items like notes, files, images, and requirements. Prompt generation reads both sources.

The recording experience is the primary workflow — users start recording immediately and see live transcription as they speak.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
