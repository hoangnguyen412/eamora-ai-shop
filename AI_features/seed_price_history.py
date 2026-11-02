import os
import random
import uuid
from datetime import datetime, timedelta
from dotenv import load_dotenv
import psycopg2

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL is None:
    print("LOI: DATABASE_URL khong duoc tim thay trong bien moi truong")
    exit(1)

# Product can co theo dong gia: giam sau ~20% o 3 ngay gan nhat de tao Deal
DEAL_PROBABILITY = 0.5
DEAL_DAYS = 3
DEAL_RATIO = 0.80  # giam 20% so voi basePrice


def main():
    random.seed(42)
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    # Lay cac product co listing (stock > 0) de co PriceHistory lien ket qua Listing
    cur.execute(
        '''
        SELECT p."id", p."basePrice", l."id"
        FROM "Product" p
        JOIN "Listing" l ON l."productId" = p."id"
        WHERE l."stock" > 0
        ORDER BY p."id"
        LIMIT 200
        '''
    )
    rows = cur.fetchall()
    print(f"Co {len(rows)} product co listing se duoc seed PriceHistory.")

    now = datetime.now()
    total_inserted = 0

    # Xoa du lieu cu de chay lai duoc (idempotent)
    cur.execute('DELETE FROM "PriceHistory"')
    print(f"Da xoa {cur.rowcount} dong PriceHistory cu.")

    for product_id, base_price, listing_id in rows:
        base_price = float(base_price)
        for day_offset in range(30, 0, -1):  # 30 ngay qua den hom qua
            recorded_at = now - timedelta(days=day_offset)

            # Dot giam gia sau o cac ngay gan nhat
            is_deal_day = day_offset <= DEAL_DAYS and random.random() < DEAL_PROBABILITY
            if is_deal_day:
                price = base_price * DEAL_RATIO
            else:
                variation = random.uniform(-0.15, 0.15)
                price = base_price * (1.0 + variation)

            price = round(price, 2)

            cur.execute(
                'INSERT INTO "PriceHistory" ("id", "listingId", "price", "recordedAt") VALUES (%s, %s, %s, %s)',
                (str(uuid.uuid4()), listing_id, price, recorded_at),
            )
            total_inserted += 1

    conn.commit()
    cur.close()
    conn.close()
    print(f"Da insert {total_inserted} dong PriceHistory cho {len(rows)} product.")


if __name__ == "__main__":
    main()
