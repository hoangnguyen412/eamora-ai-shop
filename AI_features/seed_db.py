import json
import os
import psycopg2
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL is None:
    print("LỖI: DATABASE_URL không được tìm thấy trong biến môi trường. Vui lòng kiểm tra file .env")
    exit(1)


def main():
    # Load model embedding
    model = SentenceTransformer('keepitreal/vietnamese-sbert')

    # Đọc data.json
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_path = os.path.join(script_dir, "data.json")
    with open(data_path, "r", encoding="utf-8") as f:
        products = json.load(f)

    # Kết nối PostgreSQL
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    # Tạo Shop mặc định nếu chưa có
    cur.execute(
        'INSERT INTO "Shop" ("id", "sellerId", "name", "description", "reputationScore") VALUES (%s, %s, %s, %s, %s) ON CONFLICT DO NOTHING',
        ("shop-default", "seller-default", "Default Shop", "Cửa hàng mặc định", 0),
    )
    conn.commit()

    # Tự động tạo Category từ data.json
    category_map = {}
    unique_categories = set(p["category"] for p in products)
    for cat_name in unique_categories:
        slug = cat_name.lower().replace(" ", "-")
        cur.execute(
            'INSERT INTO "Category" ("id", "name", "slug") VALUES (gen_random_uuid(), %s, %s) ON CONFLICT ("slug") DO NOTHING RETURNING "id"',
            (cat_name, slug),
        )
        row = cur.fetchone()
        if row:
            category_map[cat_name] = row[0]
        else:
            # Category đã tồn tại, lấy ID qua slug
            cur.execute('SELECT "id" FROM "Category" WHERE "slug" = %s', (slug,))
            row = cur.fetchone()
            if row:
                category_map[cat_name] = row[0]
    conn.commit()

    total = len(products)
    for idx, product in enumerate(products, 1):
        product_id = str(product["id"])

        # Tạo embedding từ name + description
        text = f"{product['name']} {product.get('description', '')}"
        embedding = model.encode(text)
        vector_str = "[" + ",".join(str(float(x)) for x in embedding) + "]"

        # Lấy categoryId từ category_map
        category_id = category_map.get(product["category"])

        # Chèn sản phẩm vào bảng Product (ON CONFLICT DO NOTHING)
        cur.execute(
            'INSERT INTO "Product" ("id", "categoryId", "name", "description", "basePrice") VALUES (%s, %s, %s, %s, %s) ON CONFLICT DO NOTHING',
            (product_id, category_id, product["name"], product.get("description", ""), product["price"]),
        )
        conn.commit()

        # Xóa embedding cũ (nếu có) rồi chèn mới
        cur.execute('DELETE FROM "Embedding" WHERE "productId" = %s', (product_id,))
        cur.execute(
            'INSERT INTO "Embedding" ("id", "productId", "vector") VALUES (gen_random_uuid(), %s, %s::vector)',
            (product_id, vector_str),
        )
        conn.commit()

        print(f"Embedded {idx}/{total}: {product['name']}")

    cur.close()
    conn.close()
    print(f"Hoàn thành: {total} sản phẩm đã được embed vào bảng Embedding.")


if __name__ == "__main__":
    main()