"""One-time migration: seed multi-vendor listings.

This script is isolated from seed_db.py on purpose: seed_db.py truncates
Product / Category / Embedding, which would destroy embeddings. This script
only touches the Listing table (plus creating Seller Users + Shops if missing).

Strategy:
  1. Create 4 seller Users (role='seller') if they do not exist.
  2. Create 4 Shops linked to those sellers if they do not exist.
  3. TRUNCATE "Listing" CASCADE (clears Listings + dependent OrderItem/PriceHistory rows;
     Products, Categories, Embeddings, Users are kept intact).
  4. For each Product:
       - 90%  -> 1 listing at a random shop (each shop ~25%).
       - 10%  -> 2-3 listings across different shops with price variance ±5%.
  5. Commit once. Full rollback on any error.

Run:
    cd AI_features
    python migrate_multi_vendor.py

Requires DATABASE_URL in environment (.env) and psycopg2 installed.
"""

import hashlib
import json
import os
import random
import sys
import uuid

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL is None:
    print("LỖI: DATABASE_URL không được tìm thấy trong biến môi trường. Vui lòng kiểm tra file .env")
    sys.exit(1)

NUM_SELLERS = 4
MULTI_VENDOR_RATIO = 0.10      # ~10% of products get 2-3 shops
MULTI_VENDOR_SHOP_MIN = 2
MULTI_VENDOR_SHOP_MAX = 3
PRICE_VARIANCE = 0.05          # ±5%
STOCK_MIN = 20
STOCK_MAX = 100

SELLER_SEEDS = [
    {
        "email": "seller.thanhcong@e-amora.test",
        "password": "seller123",
        "name": "Thanh Công Mobile",
        "description": "Chuyên thiết bị di động chính hãng",
        "reputation_score": 4.9,
    },
    {
        "email": "seller.laptopworld@e-amora.test",
        "password": "seller123",
        "name": "Laptop World",
        "description": "Laptop gaming và văn phòng",
        "reputation_score": 4.7,
    },
    {
        "email": "seller.dienmayxanh@e-amora.test",
        "password": "seller123",
        "name": "Điện Máy Xanh",
        "description": "Hệ thống đại lý điện máy",
        "reputation_score": 4.8,
    },
    {
        "email": "seller.techhub@e-amora.test",
        "password": "seller123",
        "name": "Tech Hub",
        "description": "Phụ kiện công nghệ & gadget",
        "reputation_score": 4.6,
    },
]


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def ensure_sellers_and_shops(cur) -> list[dict]:
    """Create seller users + shops if missing. Returns list of shop dicts."""
    shops: list[dict] = []

    for seed in SELLER_SEEDS[:NUM_SELLERS]:
        # Create (or reuse) seller user
        cur.execute('SELECT "id" FROM "User" WHERE "email" = %s', (seed["email"],))
        row = cur.fetchone()
        if row:
            seller_id = row[0]
            print(f"  ↻ Seller đã tồn tại: {seed['email']} (id={seller_id})")
        else:
            seller_id = str(uuid.uuid4())
            cur.execute(
                'INSERT INTO "User" ("id", "email", "passwordHash", "role", "autoBuyEnabled") '
                'VALUES (%s, %s, %s, %s, %s)',
                (seller_id, seed["email"], hash_password(seed["password"]), "seller", False),
            )
            print(f"  + Tạo seller: {seed['email']} (id={seller_id})")

        # Create (or reuse) shop linked to seller
        cur.execute('SELECT "id" FROM "Shop" WHERE "sellerId" = %s ORDER BY "id" LIMIT 1', (seller_id,))
        row = cur.fetchone()
        if row:
            shop_id = row[0]
            print(f"  ↻ Shop đã tồn tại: {seed['name']} (id={shop_id})")
        else:
            shop_id = str(uuid.uuid4())
            cur.execute(
                'INSERT INTO "Shop" ("id", "sellerId", "name", "description", "reputationScore") '
                'VALUES (%s, %s, %s, %s, %s)',
                (
                    shop_id,
                    seller_id,
                    seed["name"],
                    seed["description"],
                    seed["reputation_score"],
                ),
            )
            print(f"  + Tạo shop: {seed['name']} (id={shop_id}, sellerId={seller_id})")

        shops.append(
            {
                "id": shop_id,
                "sellerId": seller_id,
                "name": seed["name"],
            }
        )

    return shops


def truncate_listings(cur) -> None:
    """Remove all Listing rows (CASCADE clears dependent OrderItem/PriceHistory)."""
    cur.execute('TRUNCATE TABLE "Listing" CASCADE')
    print("  Đã xóa toàn bộ Listing (CASCADE). Products/Categories/Embeddings/Users được giữ nguyên.")


def build_listings(products: list[dict], shops: list[dict]) -> list[tuple]:
    """Build listing rows for every product.

    90% -> 1 random shop; 10% -> 2-3 shops with ±5% price variance.
    """
    listings: list[tuple] = []
    multi_count = 0
    single_count = 0

    shop_ids = [s["id"] for s in shops]

    for product in products:
        product_id = str(product["id"])
        base_price = float(product["price"])

        if random.random() < MULTI_VENDOR_RATIO:
            # Multi-vendor: 2-3 distinct shops
            k = random.randint(MULTI_VENDOR_SHOP_MIN, MULTI_VENDOR_SHOP_MAX)
            chosen_shops = random.sample(shop_ids, k)
            for shop_id in chosen_shops:
                variance = 1.0 + random.uniform(-PRICE_VARIANCE, PRICE_VARIANCE)
                price = round(base_price * variance, 2)
                stock = random.randint(STOCK_MIN, STOCK_MAX)
                listings.append((str(uuid.uuid4()), product_id, shop_id, price, stock))
            multi_count += 1
        else:
            # Single vendor: 1 random shop
            shop_id = random.choice(shop_ids)
            price = round(base_price, 2)
            stock = random.randint(STOCK_MIN, STOCK_MAX)
            listings.append((str(uuid.uuid4()), product_id, shop_id, price, stock))
            single_count += 1

    print(f"  Kế hoạch: {single_count} sản phẩm 1 shop, {multi_count} sản phẩm đa shop (tổng {len(listings)} listings).")
    return listings


def insert_listings(cur, listings: list[tuple]) -> None:
    if not listings:
        print("  Không có listing nào để chèn.")
        return
    psycopg2.extras.execute_values(
        cur,
        'INSERT INTO "Listing" ("id", "productId", "shopId", "price", "stock") VALUES %s',
        listings,
        page_size=500,
    )
    print(f"  Đã chèn {len(listings)} listings vào bảng Listing.")


def print_verification(cur) -> None:
    cur.execute('SELECT COUNT(*) AS total FROM "Listing"')
    total = cur.fetchone()[0]
    print(f"\n=== KẾT QUẢ VERIFICATION ===")
    print(f"Tổng Listing: {total}")

    cur.execute(
        'SELECT s."name" AS shop, COUNT(l.id) AS so_listing '
        'FROM "Shop" s LEFT JOIN "Listing" l ON l."shopId" = s.id '
        'GROUP BY s."name" ORDER BY so_listing DESC'
    )
    print("\nPhân bố listings theo shop:")
    for shop, count in cur.fetchall():
        print(f"  - {shop}: {count}")

    cur.execute(
        'SELECT p."name" AS product, COUNT(l.id) AS so_shop '
        'FROM "Product" p JOIN "Listing" l ON l."productId" = p.id '
        'GROUP BY p."name" HAVING COUNT(l.id) > 1 '
        'ORDER BY so_shop DESC, p."name" LIMIT 20'
    )
    print("\nTop sản phẩm có nhiều shop (offers > 1):")
    rows = cur.fetchall()
    for product, count in rows:
        print(f"  - {product}: {count} shop")
    if not rows:
        print("  (không có sản phẩm nào > 1 shop)")

    cur.execute(
        'SELECT COUNT(*) FROM "Product" p JOIN "Listing" l ON l."productId" = p.id '
        'GROUP BY p.id HAVING COUNT(l.id) > 1'
    )
    multi_products = len(cur.fetchall())
    print(f"\nTổng sản phẩm có nhiều hơn 1 shop: {multi_products}")


def main() -> None:
    print("=== BẮT ĐẦU MIGRATION MULTI-VENDOR ===\n")

    # Load product list only to know product ids & base prices (data not modified)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_path = os.path.join(script_dir, "data.json")
    with open(data_path, "r", encoding="utf-8") as f:
        products = json.load(f)

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    try:
        # 1. Sellers + Shops
        print("Bước 1: Đảm bảo seller users và shops tồn tại...")
        shops = ensure_sellers_and_shops(cur)
        if len(shops) < 2:
            print("LỖI: Cần ít nhất 2 shop để thực hiện đa nhà bán. Dừng lại.")
            sys.exit(1)

        # 2. Truncate Listing only
        print("\nBước 2: Xóa Listing cũ...")
        truncate_listings(cur)

        # 3. Build + insert listings
        print("\nBước 3: Xây dựng và chèn listings mới...")
        listings = build_listings(products, shops)
        insert_listings(cur, listings)

        # 4. Commit
        conn.commit()
        print("\n✅ Đã commit transaction.")

        # 5. Verification
        print_verification(cur)

    except Exception as e:
        conn.rollback()
        print(f"\n❌ Lỗi xảy ra, đã rollback toàn bộ transaction: {e}")
        sys.exit(1)
    finally:
        cur.close()
        conn.close()

    print("\n=== HOÀN TẤT MIGRATION MULTI-VENDOR ===")


if __name__ == "__main__":
    main()
