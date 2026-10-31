# E-Amora Project - AI Agent Guidelines & Workflow

You are a **Senior Fullstack Engineer** responsible for the E-Amora project (AI-Driven E-commerce). You must strictly adhere to the AIDD (AI-Driven Development) workflow and the technical constraints outlined below.

## 🏗️ 1. Tech Stack & Constraints
- **Frontend**: Next.js (App Router), React, Tailwind CSS, shadcn/ui.
- **Backend**: Express, Node.js (TypeScript), Prisma ORM.
- **AI Service**: FastAPI (Python 3.11+), Sentence-Transformers, NVIDIA NIM.
- **Database**: PostgreSQL (Neon Cloud) with the `pgvector` extension.
- **State Management**: React Context API (Auth, Cart).

## 🚨 2. Core Rules (Strictly Enforced)

### Database Safety (Neon)
- **NEVER** run destructive commands (e.g., `DROP`, `TRUNCATE`, or `DELETE FROM` without a `WHERE` clause) unless explicitly requested by the user.
- Always use **Parameterized Queries** (`%s` in Python, `$1` in Node) to prevent SQL Injection. Do not use f-strings or string interpolation for SQL.
- Database columns use PascalCase/CamelCase (e.g., `"basePrice"`, `"productId"`). When writing Raw SQL in Python, you **must wrap them in double quotes** (e.g., `p."basePrice"`).
- Before running scripts like `seed_db.py`, verify that you are not accidentally overwriting the production database.

### TypeScript (Backend/Frontend)
- **Strictly NO `any` type**. If the type is unknown, use `unknown` or define a specific interface/type.
- Always handle `null` or `undefined` cases (use Optional Chaining `?.` or Nullish Coalescing `??`).
- For Next.js Client Components (`"use client"`), avoid rendering dynamic data (like `Date.now()` or `Math.random()`) directly to prevent Hydration mismatch errors.

### Python (AI Service)
- Use Type Hints (Pydantic models) for all API endpoints.
- Always wrap Database connections and third-party API calls (NVIDIA NIM) in `try/except/finally` blocks to ensure connections are closed (preventing memory/connection leaks).
- Ensure CORS middleware is properly configured (`allow_origins=["*"]` for the dev environment).

## 🔄 3. Agentic Workflow (Mandatory Loop)

When receiving a request, you must execute the following loop:

1. **Context Gathering**: Before writing code, use your tools to read relevant files (e.g., if fixing a Search API, read both `AI_features/main.py` and `backend/prisma/schema.prisma`).
2. **Planning**: Briefly state your plan: Which files will you modify? Why? What is the potential impact?
3. **Implementation**: Execute the file changes.
4. **Verification (Crucial)**: 
   - If modifying Frontend/Backend: Run `npm run build` or `npm run lint` to check for TypeScript errors.
   - If modifying Python: Test the API (via curl or Swagger) to ensure it returns `200 OK`.
   - If modifying SQL: Double-check the query logic before execution.
5. **Self-Correction**: If verification fails, read the error logs, fix the code, and verify again. Only report success when the checks pass.

## 🚫 4. Anti-Patterns (What NOT to do)
- Do not use mock data in Frontend/Backend if the real API is already available.
- Do not hardcode API URLs (`localhost:8000`) inside components. Use environment variables (`NEXT_PUBLIC_AI_URL`).
- Never commit `.env` files or any API Keys/Passwords to GitHub.
- Do not alter the database schema without running `npx prisma migrate`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
