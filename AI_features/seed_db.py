import json
import os
import random
import urllib.parse
import psycopg2
import psycopg2.extras
import uuid
import hashlib
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL is None:
    print("LỖI: DATABASE_URL không được tìm thấy trong biến môi trường. Vui lòng kiểm tra file .env")
    exit(1)

CACHE_FILE = "embeddings_cache.json"

def get_hash(text):
    return hashlib.md5(text.encode('utf-8')).hexdigest()

def load_cache():
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def save_cache(cache):
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False)

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_path = os.path.join(script_dir, "data.json")
    with open(data_path, "r", encoding="utf-8") as f:
        products = json.load(f)

    cache = load_cache()
    product_texts = []
    texts_to_encode = []
    indices_to_encode = []

    # 1. Chuẩn bị dữ liệu và kiểm tra Cache
    for idx, product in enumerate(products):
        text = f"{product['name']} {product.get('description', '')}"
        product_texts.append(text)
        text_hash = get_hash(text)

        if text_hash not in cache:
            texts_to_encode.append(text)
            indices_to_encode.append(idx)

    # 2. Sinh Embedding theo Lô (Batch) cho các sản phẩm chưa có trong cache
    if texts_to_encode:
        print(f"Đang tạo embedding cho {len(texts_to_encode)} sản phẩm mới...")
        model = SentenceTransformer('keepitreal/vietnamese-sbert')
        embeddings = model.encode(texts_to_encode, batch_size=64, show_progress_bar=True)

        for i, emb in enumerate(embeddings):
            original_idx = indices_to_encode[i]
            text_hash = get_hash(product_texts[original_idx])
            cache[text_hash] = [float(x) for x in emb]

        save_cache(cache)
    else:
        print("Tất cả embedding đã có sẵn trong cache, bỏ qua bước gọi model.")

    # 3. Kết nối Database và chuẩn bị Bulk Insert
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    try:
        print("Đang dọn dẹp Database cũ...")
        cur.execute('TRUNCATE TABLE "Embedding", "Product", "Category" CASCADE')

        # Insert Category
        category_map = {
            "Điện thoại": "cat-phone",
            "Laptop": "cat-laptop",
        }
        category_data = [(cat_id, cat_name, cat_name.lower().replace(" ", "-")) for cat_name, cat_id in category_map.items()]
        psycopg2.extras.execute_values(
            cur,
            'INSERT INTO "Category" ("id", "name", "slug") VALUES %s ON CONFLICT ("id") DO NOTHING',
            category_data
        )

        # Lấy (hoặc tạo) một Shop để gắn Listing. Shop không bị TRUNCATE ở trên.
        cur.execute('SELECT "id" FROM "Shop" ORDER BY "id" LIMIT 1')
        shop_row = cur.fetchone()
        if shop_row:
            shop_id = shop_row[0]
        else:
            shop_id = str(uuid.uuid4())
            cur.execute(
                'INSERT INTO "Shop" ("id", "sellerId", "name", "description", "reputationScore") '
                'VALUES (%s, %s, %s, %s, %s)',
                (shop_id, "system-seed", "E-Amora Official", "Shop mặc định do seed tạo", 4.8),
            )

        total = len(products)
        print(f"Bắt đầu chuẩn bị dữ liệu chèn cho {total} sản phẩm...")

        products_data = []
        embeddings_data = []
        listings_data = []

        for idx, product in enumerate(products):
            product_id = str(product["id"])
            text_hash = get_hash(product_texts[idx])

            vector_list = cache[text_hash]
            vector_str = "[" + ",".join(str(x) for x in vector_list) + "]"

            category_id = category_map.get(product["category"])
            image_url = product.get("imageUrl") or f"https://placehold.co/400x400?text={urllib.parse.quote(product['name'])}"

            products_data.append((
                product_id,
                category_id,
                product["name"],
                product.get("description", ""),
                product["price"],
                image_url,
                product.get("brand", "")
            ))

            # Mỗi sản phẩm có 1 Listing với stock ngẫu nhiên 20..100
            listings_data.append((
                str(uuid.uuid4()),
                product_id,
                shop_id,
                product["price"],
                random.randint(20, 100),
            ))

            embedding_id = str(uuid.uuid4())
            embeddings_data.append((
                embedding_id,
                product_id,
                vector_str
            ))

        # Bulk Insert Product
        print("Đang thực hiện bulk insert vào bảng Product...")
        psycopg2.extras.execute_values(
            cur,
            'INSERT INTO "Product" ("id", "categoryId", "name", "description", "basePrice", "imageUrl", "brand") VALUES %s',
            products_data
        )

        # Bulk Insert Listing (stock ngẫu nhiên 20..100) để sản phẩm không bị "hết hàng"
        print("Đang thực hiện bulk insert vào bảng Listing...")
        psycopg2.extras.execute_values(
            cur,
            'INSERT INTO "Listing" ("id", "productId", "shopId", "price", "stock") VALUES %s',
            listings_data
        )

        # Bulk Insert Embedding với template ép kiểu ::vector
        print("Đang thực hiện bulk insert vào bảng Embedding...")
        psycopg2.extras.execute_values(
            cur,
            'INSERT INTO "Embedding" ("id", "productId", "vector") VALUES %s',
            embeddings_data,
            template="(%s, %s, %s::vector)"
        )

        # 4. Quản lý Transaction: Chỉ commit một lần ở cuối
        conn.commit()
        print(f"✅ Hoàn tất: {total} sản phẩm đã được nạp vào Database siêu tốc!")

    except Exception as e:
        conn.rollback()
        print(f"❌ Có lỗi xảy ra, đã rollback transaction: {e}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()
