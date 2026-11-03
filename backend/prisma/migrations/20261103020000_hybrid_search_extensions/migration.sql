-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Tạo wrapper function IMMUTABLE cho unaccent
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$
  SELECT public.unaccent('public.unaccent', $1);
$$;

-- 2. Indexes cho FTS và Trigram (Dùng immutable_unaccent)
CREATE INDEX idx_product_fts ON "Product" 
  USING GIN (to_tsvector('simple', immutable_unaccent(coalesce("name",'') || ' ' || coalesce("description",'') || ' ' || coalesce("brand",''))));

CREATE INDEX idx_product_trgm_name ON "Product" USING GIN ("name" gin_trgm_ops);
CREATE INDEX idx_product_trgm_brand ON "Product" USING GIN ("brand" gin_trgm_ops);

-- 3. HNSW index cho vector (nếu chưa có)
CREATE INDEX IF NOT EXISTS idx_embedding_vector_hnsw ON "Embedding" USING hnsw (vector vector_cosine_ops);
