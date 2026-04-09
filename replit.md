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
- **AI**: OpenAI via Replit AI Integrations (`gpt-5.2`)

## Artifacts

### Prompt Studio (`artifacts/prompt-studio`)
Context-driven design prompt generator. Users create sessions, add context items (transcripts, notes, files, images, requirements, pasted text), and generate AI-composed design prompts from that session context.

- **No hardcoded domain knowledge** — all prompt generation is derived from user-supplied context
- **Pages**: home (sessions list) + session workspace (context panel + prompt panel)
- **Frontend**: React + Vite + TanStack Query + Shadcn UI + Tailwind
- **Preview**: served at `/`

### API Server (`artifacts/api-server`)
Express 5 backend with all routes:
- `GET/POST /api/sessions` — session management
- `GET/PATCH/DELETE /api/sessions/:id` — session CRUD
- `GET /api/sessions/:id/summary` — session context stats
- `GET/POST /api/sessions/:sessionId/context` — context item management
- `PATCH/DELETE /api/sessions/:sessionId/context/:id`
- `GET/POST /api/sessions/:sessionId/prompts` — prompt generation via AI
- `PATCH/DELETE /api/sessions/:sessionId/prompts/:id`

## Database Schema

- `sessions` — session records (id, title, description, timestamps)
- `context_items` — context pieces per session (type: transcript|note|file|image|requirement|paste, label, content)
- `generated_prompts` — AI-generated prompts per session (content, instruction, version, timestamps)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Design Principles

The app follows the document's requirement: **no hardcoded domain knowledge**. Prompt generation is entirely driven by what the user adds to the session. The AI model receives only the user's context items + optional instruction. No company-specific terms, product families, or design assumptions are baked in.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
