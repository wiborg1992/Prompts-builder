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
Context-driven design prompt generator with recording-first workflow. Users create sessions, record audio with live transcription, add context items (transcripts, notes, files, images, requirements, pasted text), and generate AI-composed design prompts from session context.

- **No hardcoded domain knowledge** — all prompt generation is derived from user-supplied context
- **Recording-first layout**: Session workspace opens to the Record tab by default
- **Live transcription**: Direct browser-to-Deepgram WebSocket with speaker diarization, filler word removal, smart buffering (14s silence / 90s max), and workshop-optimized settings
- **Language support**: English (nova-3) and Danish (nova-2)
- **Auto-generate**: Stop recording automatically saves transcript and generates a prompt
- **Speaker identification**: Multiple speakers detected and labeled in the feed
- **File uploads**: Real file/image uploads via presigned URLs to GCS
- **Tabs**: Record (primary) | Context | Prompts
- **Frontend**: React + Vite + TanStack Query + Shadcn UI + Tailwind
- **Preview**: served at `/`

### API Server (`artifacts/api-server`)
Express 5 backend with all routes:
- `GET/POST /api/sessions` — session management
- `GET/PATCH/DELETE /api/sessions/:id` — session CRUD
- `GET /api/sessions/:id/summary` — session context stats
- `GET/POST /api/sessions/:sessionId/context` — context item management (text + file metadata)
- `PATCH/DELETE /api/sessions/:sessionId/context/:id`
- `GET/POST /api/sessions/:sessionId/prompts` — prompt generation via AI
- `PATCH/DELETE /api/sessions/:sessionId/prompts/:id`
- `GET /api/deepgram-token` — returns Deepgram API key for direct browser-to-Deepgram connection
- `POST /api/transcribe` — batch audio transcription (Deepgram or OpenAI, language-aware)
- `POST /api/storage/uploads/request-url` — presigned URL for file upload
- `GET /api/storage/objects/*` — serve uploaded objects
- `GET /api/storage/public-objects/*` — serve public assets

## Database Schema

- `sessions` — session records (id, title, description, timestamps)
- `context_items` — context pieces per session (type: transcript|note|file|image|requirement|paste, label, content, file_url, filename, mime_type)
- `generated_prompts` — AI-generated prompts per session (content, instruction, version, timestamps)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Design Principles

The app follows the document's requirement: **no hardcoded domain knowledge**. Prompt generation is entirely driven by what the user adds to the session. The AI model receives only the user's context items + optional instruction. No company-specific terms, product families, or design assumptions are baked in.

The recording experience is the primary workflow — users start recording immediately and see live transcription as they speak.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
