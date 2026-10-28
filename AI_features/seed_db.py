import json
import os
import psycopg2
from sentence_transformers import SentenceTransformer

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/eamora")


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

    total = len(products)
    for idx, product in enumerate(products, 1):
        # Tạo embedding từ name + description
        text = f"{product['name']} {product.get('description', '')}"
        embedding = model.encode(text)
        vector_str = "[" + ",".join(str(float(x)) for x in embedding) + "]"

        # Xóa embedding cũ (nếu có) rồi chèn mới
        cur.execute("DELETE FROM \"Embedding\" WHERE productId = %s", (product["id"],))
        cur.execute(
            "INSERT INTO \"Embedding\" (id, productId, vector) VALUES (gen_random_uuid(), %s, %s::vector)",
            (product["id"], vector_str),
        )
        conn.commit()

        print(f"Embedded {idx}/{total}: {product['name']}")

    cur.close()
    conn.close()
    print(f"Hoàn thành: {total} sản phẩm đã được embed vào bảng Embedding.")


if __name__ == "__main__":
    main()