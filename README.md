# Amora - AI-Powered Tech Store

**Amora** is a modern, AI-driven e-commerce platform that integrates intelligent search, a RAG (Retrieval-Augmented Generation) chatbot with price and category context, a full checkout flow, and a real-time seller dashboard. Built with a fullstack TypeScript/Node.js frontend, a Python AI service, and a PostgreSQL database with vector search capabilities.

## Tech Stack

### Frontend
- **Next.js** (App Router) with React
- **Tailwind CSS** for utility-first styling
- **shadcn/ui** for accessible, pre-built UI components

### Backend
- **Express** (TypeScript) running on Node.js
- **Prisma ORM** for type-safe database operations
- **PostgreSQL** (hosted on Neon Cloud) with `pgvector` extension for vector similarity search
- Environment variables: `AI_URL` (AI service URL, default `http://localhost:8000`), `AI_TIMEOUT_MS` (AI request timeout in ms, default `2000`)

### AI Service
- **Python FastAPI** serving as the AI backend
- **Sentence-Transformers** (`keepitreal/vietnamese-sbert`) for semantic embeddings (768-dim)
- **Groq LLM** (`qwen/qwen3.8-27b`) for RAG chatbot

### Database
- **PostgreSQL** on Neon Cloud
- `pgvector` extension for vector indexing and similarity queries

---

## Key Features

### 🔍 Semantic Search
- Natural language search across product catalog using vector embeddings
- Hybrid search: Full-Text Search (`pg_trgm`, `unaccent`) + pgvector cosine similarity + Reciprocal Rank Fusion (RRF, k=60)
- Filter by brand, category, price range, and specifications
- Typo-tolerance via trigram similarity (> 0.3)

### 💬 RAG Chatbot
- Context-aware conversations with product awareness
- Category and price context retention across turns
- Anti-hallucination: bypasses LLM when no products match hard filters
- LLM model: `qwen/qwen3.8-27b` via Groq

### 🛒 Full Checkout Flow
- Shopping cart with localStorage persistence
- Multi-step checkout (shipping info, payment method)
- Cash-on-Delivery (COD) and VNPay support
- Automatic 30,000 VND shipping fee calculation
- Order creation with stock decrement

### 📊 Seller Dashboard
- Real-time revenue and order statistics
- Order management table with filterable status
- Product catalog monitoring
- Sales performance tracking

### 🎯 Personalized Recommendations
- AI-driven product suggestions based on user interaction history (`view`, `click`, `add_to_cart`, `purchase`)
- Weighted-average embedding + cosine nearest, excludes already-interacted products
- Rule-based explanations (no LLM): brand match, category match, price fit, or generic preference
- Popular fallback when user has < 3 interactions

### 🔗 Related Products
- Similar product suggestions on product detail pages via cosine similarity of embeddings
- Top 4 results, excludes the current product and duplicate names

### 📝 Interaction Logging
- Client logs user actions (`view`, `click`, `add_to_cart`, `purchase`) to backend
- Token-gated: logged-in users log under their own ID; anonymous traffic falls back to shared mock buyer

### 🤖 Price Agent & Auto-buy Worker
- Deal Quality Score (DQS) 0–100: discount score (40) + history score (40, based on 30-day PriceHistory) + rating score (20)
- Threshold: `dqs >= 70` triggers auto-buy consideration
- Watchlist with target price, auto-buy toggle per user
- Auto-buy Worker runs on interval (`AUTO_BUY_WORKER_INTERVAL_MS`, default 60s in dev), scans watchlist hits, enqueues, executes sandbox orders
- Sandbox mode: creates `Order` with `status='sandbox'`, no real payment

---

## Prerequisites

- **Node.js** (v18 or higher)
- **Python** (3.11 or higher)
- **PostgreSQL** database (Neon Cloud account recommended)
- **Groq API Key** (for LLM chat)

---

## Installation & Setup

### 1. Configure Environment Variables

Create a `.env` file at the root level:

```
DATABASE_URL="postgresql://<user>:<password>@<host>/<db>?sslmode=require&channel_binding=require"
NEXT_PUBLIC_API_URL="http://localhost:4000"
AI_URL="http://localhost:8000"
AI_TIMEOUT_MS="2000"
```

Create a `.env` file inside `AI_features/` for the Python service:

```
DATABASE_URL="postgresql://<user>:<password>@<host>/<db>?sslmode=require&channel_binding=require"
GROQ_API_KEY="<your_groq_key>"
```

Create a `.env` file inside `backend/`:

```
DATABASE_URL="postgresql://<user>:<password>@<host>/<db>?sslmode=require&channel_binding=require"
JWT_SECRET="<your_jwt_secret_min_32_bytes>"
AI_URL="http://localhost:8000"
AI_TIMEOUT_MS="2000"
AUTO_BUY_WORKER_ENABLED="true"
AUTO_BUY_WORKER_INTERVAL_MS="60000"
AUTO_BUY_WORKER_BATCH_SIZE="10"
```

> ⚠️ **SECURITY WARNING**: Never commit real `.env` files or real secrets to this repository. Use `.env.example` as a template and keep actual credentials out of version control.

### 2. Install Frontend Dependencies

```bash
npm install
```

### 3. Install Backend Dependencies

```bash
cd backend && npm install
```

### 4. Setup AI Service

```bash
cd AI_features
python -m venv .venv
# Windows: .venv\Scripts\activate
source .venv/bin/activate
pip install -r requirements.txt
```

---

## How to Run (Crucial)

Three separate servers must be started in three different terminals:

### Terminal 1 — AI Service (Port 8000)

```bash
cd AI_features
source .venv/bin/activate  # Windows: .venv\Scripts\activate
uvicorn main:app --reload --port 8000
```

This serves the FastAPI backend for semantic search, chat, and price agent.

### Terminal 2 — Backend API (Port 4000)

```bash
cd backend
npm run dev
```

Express server with Prisma ORM, handling order creation, authentication, and seller endpoints.

### Terminal 3 — Frontend Development Server (Port 3000)

```bash
npm run dev
```

Next.js app router frontend at `http://localhost:3000`.

> **Note:** All three servers must be running for the full functionality (search, chat, cart, checkout).

---

## Database Seeding

### 1. Convert Mock Data

```bash
cd AI_features
python convert_data.py
```

This reads `AI_features/data.json` and prepares the data for database insertion.

### 2. Seed the Database

```bash
cd backend
npx prisma migrate deploy
npx prisma db push
```

Or run the seed script directly:

```bash
python seed_db.py
```

This creates the initial users, products, categories, and sample data in the PostgreSQL database.

### 3. Seed Price History (for Price Agent)

```bash
cd AI_features
python seed_price_history.py
```

Creates 30 days of price history for 200 products (6000 `PriceHistory` rows).

---

## Project Structure

```
e-Amora/
├── AI_features/              # Python FastAPI service
│   ├── main.py
│   ├── requirements.txt
│   ├── convert_data.py
│   ├── seed_db.py
│   ├── seed_price_history.py
│   └── data.json
├── backend/                  # Node.js/Express + Prisma
│   ├── src/
│   │   └── index.ts          # Main server entry point
│   ├── prisma/
│   │   └── schema.prisma
│   ├── package.json
│   └── migrations/
├── src/                      # Next.js frontend
│   ├── app/                  # App Router pages & layouts
│   ├── context/              # React CartContext, AuthContext
│   ├── components/           # shadcn/ui components
│   └── lib/                  # Helpers (formatPrice, formatDate, etc.)
├── docs/
│   ├── ARCHITECTURE.md       # System architecture & data flow
│   ├── API_CONTRACT.md       # Backend & AI service API contract
│   ├── EVALUATION_PLAN.md    # Evaluation metrics & results
│   ├── CHANGELOG.md          # Change history
│   ├── KNOWN_ISSUES.md       # Known issues & tech debt
│   ├── AI_SERVICE_CONTRACT.md
│   ├── DB_SCHEMA.md
│   └── DESIGN_TOKENS.md
├── .gitignore
├── package.json              # Root package.json (npm run dev)
└── README.md
```

---

## Development Notes

- **Cart persistence**: Cart items are stored in `localStorage` and synced on every state change via `CartProvider`
- **Hydration mismatch fixes**: The `Header` component uses an `isMounted` guard to prevent server/client rendering differences
- **Mock buyer ID**: When no authentication is present, orders use `buyerId: "mock-user-123"` to satisfy FK constraints
- **Field mapping**: Frontend `listingId` maps to backend `OrderItem.listingId`; `userId` → `buyerId`; `total` → `totalAmount`; `payment` → `paymentMethod`
- **CORS**: Backend configured with `allow_origins=["*"]` for development

---

## Documentation

- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — System architecture, data flow, ERD, algorithms
- [docs/API_CONTRACT.md](./docs/API_CONTRACT.md) — Node.js backend & FastAPI AI service API contract
- [docs/EVALUATION_PLAN.md](./docs/EVALUATION_PLAN.md) — Evaluation metrics & real results
- [docs/CHANGELOG.md](./CHANGELOG.md) — Changelog of added features and bug fixes
- [docs/KNOWN_ISSUES.md](./docs/KNOWN_ISSUES.md) — Known issues and technical debt

---

## Learn More

- **Next.js**: https://nextjs.org/docs
- **Prisma ORM**: https://www.prisma.io/docs
- **FastAPI**: https://fastapi.tiangolo.com/
- **shadcn/ui**: https://ui.shadcn.com/
- **pgvector**: https://github.com/pgvector/pgvector