# E-Amora - AI-Powered E-commerce Platform

## Project Title & Description

**E-Amora** is a modern, AI-driven e-commerce platform that integrates intelligent search, a RAG (Retrieval-Augmented Generation) chatbot with price and category context, a full checkout flow, and a real-time seller dashboard. Built with a fullstack TypeScript/Node.js frontend, a Python AI service, and a PostgreSQL database with vector search capabilities.

---

## Tech Stack

### Frontend
- **Next.js** (App Router) with React
- **Tailwind CSS** for utility-first styling
- **shadcn/ui** for accessible, pre-built UI components

### Backend
- **Express** (TypeScript) running on Node.js
- **Prisma ORM** for type-safe database operations
- **PostgreSQL** (hosted on Neon Cloud) with `pgvector` extension for vector similarity search

### AI Service
- **Python FastAPI** serving as the AI backend
- **Sentence-Transformers** for semantic embeddings
- **NVIDIA NIM** (Llama-3.3-70b) for LLM-powered chat and price agent

### Database
- **PostgreSQL** on Neon Cloud
- `pgvector` extension for vector indexing and similarity queries

---

## Key Features

### 🔍 Semantic Search
- Natural language search across product catalog using vector embeddings
- Filter by brand, category, price range, and specifications

### 💬 RAG Chatbot
- Context-aware conversations with product awareness
- Category and price context retention across turns
- Price tracking agent with historical trend visualization
- Automatic watchlist creation for price-drop notifications

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

---

## Prerequisites

- **Node.js** (v18 or higher)
- **Python** (3.11 or higher)
- **PostgreSQL** database (Neon Cloud account recommended)
- **NVIDIA API Key** (for LLM and embedding services)

---

## Installation & Setup

### 1. Configure Environment Variables

Create a `.env` file at the root level with:

```
DATABASE_URL="postgresql://neondb_owner:npg_ZQcVL4wXTBi7@ep-snowy-cherry-a1a6shf3-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
NEXT_PUBLIC_API_URL="http://localhost:4000"
NVIDIA_API_KEY="your_nvidia_api_key_here"
```

Create a `.env` file inside `AI_features/` for the Python service:

```
DATABASE_URL="postgresql://neondb_owner:npg_ZQcVL4wXTBi7@ep-snowy-cherry-a1a6shf3-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
NVIDIA_API_KEY="your_nvidia_api_key_here"
```

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
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

---

## How to Run (Crucial)

Three separate servers must be started in three different terminals:

### Terminal 1 — AI Service (Port 8000)

```bash
cd AI_features
source .venv/bin/activate  # If not already activated
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

---

## Project Structure

```
e-Amora/
├── AI_features/              # Python FastAI service
│   ├── main.py
│   ├── requirements.txt
│   ├── convert_data.py
│   ├── seed_db.py
│   └── data.json
│
├── backend/                  # Node.js/Express + Prisma
│   ├── src/
│   │   ├── index.ts          # Main server entry point
│   │   └── ...
│   ├── prisma/
│   │   └── schema.prisma
│   ├── package.json
│   └── migrations/
│
├── src/                      # Next.js frontend
│   ├── app/                  # App Router pages & layouts
│   ├── context/              # React CartContext, AuthContext
│   ├── components/           # shadcn/ui components
│   └── lib/                  # Helpers (formatPrice, formatDate, etc.)
│
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

## Learn More

- **Next.js**: https://nextjs.org/docs
- **Prisma ORM**: https://www.prisma.io/docs
- **FastAPI**: https://fastapi.tiangolo.com/
- **shadcn/ui**: https://ui.shadcn.com/
- **pgvector**: https://github.com/pgvector/pgvector