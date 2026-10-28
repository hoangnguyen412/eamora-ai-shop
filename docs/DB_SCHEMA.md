# DATABASE SCHEMA CONTRACT

## 1. Core Entities
- **User**: id, email, password_hash, role (buyer/seller), created_at
- **Shop**: id, seller_id, name, description, reputation_score
- **Category**: id, name, slug
- **Product**: id, category_id, name, description, specs (JSONB), base_price
- **Listing**: id, product_id, shop_id, price, stock, condition, created_at
- **Order / OrderItem**: id, buyer_id, total_amount, status, shipping_info (JSONB), payment_method, created_at; order items snapshot listing price and quantity
- **Review**: id, product_id, user_id, rating, comment, is_fake (boolean)
- **Interaction**: id, user_id, product_id, action (view/click/cart/buy), created_at

## 2. AI & Agent Entities
- **SearchSession / SearchClick**: session query/filter JSONB and ordered product click events, with optional user ownership
- **ChatMessage**: id, session_id, role (user/assistant), content, retrieved_products (JSONB)
- **Embedding**: id, product_id, vector (vector 768), updated_at
- **Watchlist**: id, user_id, product_id, target_price, status (active/bought/cancelled)
- **PriceHistory**: id, listing_id, price, recorded_at