# 🛍️ E-Amora: AI-Driven B2C Marketplace

## 📖 Overview
A highly scalable, decoupled e-commerce platform featuring real-time semantic search, an autonomous shopping assistant (RAG), and a Price Monitor Agent.

## 🏗️ Architecture & Tech Stack
- **Frontend (`/src`)**: Next.js 14 (App Router), React, Tailwind CSS, shadcn/ui.
- **Backend (`/backend`)**: Node.js, Express, Prisma ORM (Port 4000).
- **AI Service (`/AI_features`)**: Python 3.11, FastAPI, Sentence-Transformers (Port 8000).
- **Database**: PostgreSQL hosted on Neon Cloud with `pgvector` extension.

## 🚀 Prerequisites
- Node.js (v18+)
- Python (v3.11+)
- Git

## ⚙️ Environment Variables
You need to create `.env` files in specific directories:
1. In `/backend/.env` and `/AI_features/.env`:
   `DATABASE_URL="your_postgresql_neon_url"`
2. In `/AI_features/.env` (for Chatbot RAG):
   `NVIDIA_API_KEY="your_nvidia_nim_api_key"`

## 🛠️ How to Run Locally

### 1. AI Service (FastAPI)
```bash
cd AI_features
# Create and activate virtual environment
python -m venv venv
# Windows: venv\Scripts\activate | Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
# Seed the database with initial products & embeddings (Run only once)
python seed_db.py 
# Start the AI server
uvicorn main:app --reload
API Docs available at: http://localhost:8000/docs
```

### 2. Backend (Express + Prisma)
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
API Docs available at: http://localhost:4000/docs
```

### 3. Frontend (Next.js)
```bash
# In the root directory
npm install
npm run dev
Web App available at: http://localhost:3000
```

## 👥 Team Members & Roles
M1: Frontend Developer

M2: Backend Developer

M3: AI Engineer & Fullstack AI

M4: DevOps & Data Engineer