-- ============================================================================
-- Layer 1: Database Optimization (Neon pgvector)
-- Run these commands manually in Neon to optimize search performance.
-- ============================================================================

-- 1. Enable pg_trgm extension for trigram-based text search (GIN index support)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. HNSW index on Embedding.vector for cosine distance (vector search)
CREATE INDEX IF NOT EXISTS idx_embedding_hnsw
  ON "Embedding" USING hnsw (vector vector_cosine_ops);

-- 3. B-Tree index on Product."brand" (frequently filtered column)
CREATE INDEX IF NOT EXISTS idx_product_brand
  ON "Product" ("brand");

-- 4. B-Tree index on Product."basePrice" (frequently compliant column)
CREATE INDEX IF NOT EXISTS idx_product_baseprice
  ON "Product" ("basePrice");

-- 5. GIN index on Product."name" using pg_trgm for ILIKE/contains text search
CREATE INDEX IF NOT EXISTS idx_product_name_gin
  ON "Product" USING gin ("name" gin_trgm_ops);

-- 6. GIN index on Product."description" using pg_trgm for ILIKE/contains text search
CREATE INDEX IF NOT EXISTS idx_product_description_gin
  ON "Product" USING gin ("description" gin_trgm_ops);

-- Note: Product."categoryId" already has an index via @@index([categoryId]) in schema.prisma.
-- ============================================================================
