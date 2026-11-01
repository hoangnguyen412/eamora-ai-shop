#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
convert_data.py
Gộp mobile.csv và laptop.csv thành data.json cho hệ thống E-commerce.

Cách dùng:
    python convert_data.py
    python convert_data.py --mobile mobile.csv --laptops laptop.csv --output data.json
"""

import argparse
import json
import random
import re
import sys

import pandas as pd

PLACEHOLDER_IMG = "https://placehold.co/400x400?text=No+Image"
INR_TO_VND = 300
USD_TO_VND = 25000
MIN_MOBILE_PRICE_VND = 2_000_000   # giá điện thoại thấp hơn mức này bị coi là sai
MOBILE_PRICE_FIX_FACTOR = 10


# ----------------------------------------------------------------------------
# Hàm tiện ích
# ----------------------------------------------------------------------------
def read_csv_safe(path):
    """Đọc CSV với nhiều encoding dự phòng."""
    last_err = None
    for enc in ("utf-8", "utf-8-sig", "latin-1", "cp1252"):
        try:
            return pd.read_csv(path, encoding=enc)
        except UnicodeDecodeError as e:
            last_err = e
        except FileNotFoundError:
            print(f"[LỖI] Không tìm thấy file: {path}", file=sys.stderr)
            return pd.DataFrame()
        except Exception as e:  # file hỏng, rỗng...
            print(f"[LỖI] Không đọc được {path}: {e}", file=sys.stderr)
            return pd.DataFrame()
    print(f"[LỖI] Không đọc được {path}: {last_err}", file=sys.stderr)
    return pd.DataFrame()


def find_col(df, name):
    """Tìm cột không phân biệt hoa/thường và khoảng trắng thừa."""
    target = name.strip().lower()
    for c in df.columns:
        if str(c).strip().lower() == target:
            return c
    return None


def get_series(df, name):
    """Lấy cột theo tên; nếu không có trả về Series rỗng (NaN)."""
    col = find_col(df, name)
    if col is None:
        return pd.Series([None] * len(df), index=df.index, dtype=object)
    return df[col]


def clean_text(value):
    """Chuyển về chuỗi sạch; NaN/None/'nan' -> ''."""
    if value is None:
        return ""
    try:
        if pd.isna(value):
            return ""
    except (TypeError, ValueError):
        pass
    text = str(value).strip()
    if text.lower() in ("nan", "none", "null", "n/a", "na"):
        return ""
    return re.sub(r"\s+", " ", text)


def parse_price(value):
    """
    Chuyển giá (số hoặc chuỗi như '$1,499.99', '₹15,000', 'Rs. 15000')
    thành float. Lỗi/NaN -> 0.0.
    """
    if value is None:
        return 0.0
    try:
        if pd.isna(value):
            return 0.0
    except (TypeError, ValueError):
        pass
    if isinstance(value, (int, float)):
        return float(value)

    text = str(value).strip().replace("$", "").replace(",", "")
    # Nếu là khoảng giá "100 - 200" thì lấy số đầu tiên
    match = re.search(r"\d+(?:\.\d+)?", text)
    if not match:
        return 0.0
    try:
        return float(match.group())
    except ValueError:
        return 0.0


# Tên hiển thị chuẩn cho từng thương hiệu (key = chữ thường).
# Dùng để gộp mọi biến thể hoa/thường về cùng một giá trị duy nhất,
# tránh trùng lặp trong bộ lọc (VD: "DELL" vs "Dell", "LENOVO" vs "Lenovo").
CANONICAL_BRANDS = {
    "apple": "Apple",
    "dell": "Dell",
    "lenovo": "Lenovo",
    "asus": "Asus",
    "acer": "Acer",
    "hp": "HP",
    "msi": "MSI",
    "samsung": "Samsung",
    "microsoft": "Microsoft",
    "gigabyte": "Gigabyte",
    "xiaomi": "Xiaomi",
    "redmi": "Redmi",
    "oppo": "Oppo",
    "vivo": "Vivo",
    "realme": "Realme",
    "oneplus": "OnePlus",
    "motorola": "Motorola",
    "nokia": "Nokia",
    "sony": "Sony",
    "lg": "LG",
    "htc": "HTC",
    "google": "Google",
    "huawei": "Huawei",
    "honor": "Honor",
    "infinix": "Infinix",
    "other": "Other",
    "others": "Other",
}


def normalize_brand(brand):
    """
    Chuẩn hoá tên thương hiệu về một dạng hiển thị duy nhất (Title Case).
    - "apple" / "APPLE" / "Apple" -> "Apple"
    - "DELL" / "dell" -> "Dell"
    - "LENOVO" / "lenovo" -> "Lenovo"
    - "Oneplus" / "oneplus" -> "OnePlus"
    - Giữ viết hoa cho các từ viết tắt đã biết: "HP", "LG", "MSI", "HTC".
    """
    brand = clean_text(brand)
    if not brand:
        return ""
    key = brand.lower()
    if key in CANONICAL_BRANDS:
        return CANONICAL_BRANDS[key]
    # Fallback cho thương hiệu lạ: Title Case từng từ.
    return " ".join(w[:1].upper() + w[1:].lower() for w in brand.split())


def normalize_name(name, brand):
    """
    Nếu tên đã bắt đầu bằng tên hãng thì giữ nguyên,
    ngược lại ghép Brand + Name (VD: "Note 12 Pro" -> "Redmi Note 12 Pro").
    """
    name = clean_text(name)
    if not name:
        return ""
    if not brand:
        return name
    if name.lower().startswith(brand.lower()):
        return name
    return f"{brand} {name}"


_UNITS = r"(?:gb|tb|mb|mah|hz|mp)"


def fix_description_spacing(text):
    """
    Thêm dấu cách giữa các từ/số bị dính liền.
    VD: "storage128 gbram6" -> "storage 128 gb ram 6"
    """
    text = clean_text(text)
    if not text:
        return ""
    # đơn vị dính với chữ phía sau: "gbram" -> "gb ram" (tránh gbps, mbps, mpeg)
    text = re.sub(rf"(?i)\b({_UNITS})(?=[a-z]{{2,}})(?!ps\b|eg)", r"\1 ", text)
    text = re.sub(rf"(?i)(\d)({_UNITS})(?=[a-z]{{2,}})(?!ps\b|eg)", r"\1\2 ", text)
    # chữ (>= 2 ký tự) dính với số: "storage128" -> "storage 128"
    text = re.sub(r"(?<=[A-Za-z]{2})(?=\d)", " ", text)
    # số dính với chữ: "128gb" -> "128 gb" (giữ nguyên 3G/4G/5G)
    text = re.sub(r"(?<=\d)(?=[A-Za-z])(?![gG]\b)", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def clean_image(value):
    url = clean_text(value)
    return url if url else PLACEHOLDER_IMG


# ----------------------------------------------------------------------------
# Xử lý từng file
# ----------------------------------------------------------------------------
def process_mobile(path):
    df = read_csv_safe(path)
    if df.empty:
        return []

    names = get_series(df, "mobile_name")
    brands = get_series(df, "brand")
    prices = get_series(df, "price")
    corpus = get_series(df, "corpus")
    imgs = get_series(df, "imgURL")

    items = []
    valid_brand_set = {b.lower() for b in VALID_BRANDS}
    for i in df.index:
        raw_name = clean_text(names[i])
        if not raw_name:
            continue
        # Extract brand directly from CSV's brand column and normalize to Title Case
        raw_brand = clean_text(brands[i])
        brand = normalize_brand(raw_brand) if raw_brand else "Other"
        # Fallback to keyword extractor if brand is empty, "Others", or not in VALID_BRANDS
        if not brand or brand.lower() == "others" or brand.lower() not in valid_brand_set:
            brand = extract_brand(raw_name)
        # Use product name directly (truncated to 8 words), NO brand concatenation
        name = truncate_name(raw_name, max_words=8)
        price = round(parse_price(prices[i]) * INR_TO_VND)
        # Fix giá sai (quá rẻ): lặp nhân cho đến khi đạt ngưỡng tối thiểu
        while 0 < price < MIN_MOBILE_PRICE_VND:
            price *= MOBILE_PRICE_FIX_FACTOR
        if price <= 0:
            continue
        image_url = clean_image(imgs[i])
        description = fix_description_spacing(corpus[i])

        # Generate realistic data for new UI fields
        rating = round(random.uniform(3.8, 5.0), 1)
        review_count = random.randint(10, 500)
        original_price = round(price * random.uniform(1.1, 1.3) / 1000) * 1000
        discount_percent = int((original_price - price) / original_price * 100)
        tags = random.sample(
            ["Bán chạy", "Giá tốt", "Chính hãng", "Mới về", "Top 3 tháng"],
            random.randint(1, 2),
        )
        images = [image_url] * 3 if image_url != PLACEHOLDER_IMG else []
        specs = extract_specs(description)

        items.append({
            "name": name,
            "brand": brand,
            "category": "Điện thoại",
            "price": price,
            "description": description,
            "imageUrl": image_url,
            "thumbnailUrl": image_url,
            "images": images,
            "rating": rating,
            "reviewCount": review_count,
            "originalPrice": original_price,
            "discountPercent": discount_percent,
            "tags": tags,
            "specs": specs,
        })
    return items


# Danh sách các thương hiệu hợp lệ (dùng cho cả điện thoại và laptop)
VALID_BRANDS = [
    "Dell", "HP", "Lenovo", "Asus", "Acer", "Apple",
    "MSI", "Samsung", "Microsoft", "Gigabyte",
    "Xiaomi", "Redmi", "Oppo", "Vivo", "Realme", "OnePlus",
    "Motorola", "Nokia", "Sony", "LG", "HTC", "Google", "Huawei", "Honor"
]


def extract_brand(text):
    if not text:
        return "Other"

    t = str(text).lower()

    # Từ điển map từ khóa trong tên máy -> Tên hãng chuẩn
    brand_keywords = {
        "iphone": "Apple", "apple": "Apple", "macbook": "Apple",
        "samsung": "Samsung", "galaxy": "Samsung",
        "xiaomi": "Xiaomi", "redmi": "Redmi", "poco": "Xiaomi", "redmi note": "Xiaomi",
        "oppo": "Oppo", "reno": "Oppo", "find x": "Oppo", "f11": "Oppo", "a2": "Oppo",
        "vivo": "Vivo", "iqoo": "Vivo", "v23e": "Vivo",
        "realme": "Realme", "narzo": "Realme",
        "oneplus": "OnePlus", "nord": "OnePlus",
        "nokia": "Nokia",
        "motorola": "Motorola", "moto ": "Motorola",
        "huawei": "Huawei",
        "infinix": "Infinix", "hot ": "Infinix",
        "asus": "Asus", "zenfone": "Asus", "rog ": "Asus",
        "dell": "Dell", "inspiron": "Dell", "xps": "Dell",
        "hp": "HP", "pavilion": "HP", "omen": "HP",
        "lenovo": "Lenovo", "ideapad": "Lenovo", "thinkpad": "Lenovo", "legion": "Lenovo",
        "acer": "Acer", "aspire": "Acer", "predator": "Acer",
        "msi": "MSI",
        "gigabyte": "Gigabyte",
        "honor": "Honor",
        "microsoft": "Microsoft", "surface": "Microsoft",
        "lg": "LG", "sony": "Sony", "xperia": "Sony",
        "google": "Google", "pixel": "Google"
    }

    # Ưu tiên check các từ khóa dài trước (ví dụ "find x" trước "x")
    # Match theo ranh giới từ để tránh nhầm substring (VD: "vivo" trong "VivoBook"
    # không được coi là hãng Vivo; "Asus VivoBook" phải ra "Asus").
    for keyword, brand_name in sorted(brand_keywords.items(), key=lambda x: len(x[0]), reverse=True):
        kw = keyword.strip()
        if re.search(rf"(?<![a-z]){re.escape(kw)}(?![a-z])", t):
            return brand_name

    return "Other"


def truncate_name(name, max_words=8):
    """Cắt tên sản phẩm tối đa max_words từ, thêm "..." nếu bị cắt."""
    words = name.split()
    if len(words) > max_words:
        return " ".join(words[:max_words]) + "..."
    return name


def extract_specs(description):
    """
    Trích xuất thông số kỹ thuật cơ bản từ mô tả bằng regex.
    - RAM: tìm mẫu như "(\d+)\s*gb\s*ram"
    - Storage: tìm mẫu như "(\d+)\s*gb" hoặc "(\d+)\s*tb"
    Trả về dict: {"RAM": "8GB", "Storage": "128GB"}. Nếu không tìm thấy, trả về {}.
    """
    if not description:
        return {}

    text = description.lower()
    specs = {}

    # RAM: ví dụ "8gb ram", "8 gb ram"
    ram_match = re.search(r"(\d+)\s*gb\s*ram", text)
    if ram_match:
        specs["RAM"] = f"{ram_match.group(1)}GB"

    # Storage: ví dụ "128gb", "512 gb", "1tb", "1 tb"
    storage_match = re.search(r"(\d+)\s*(?:gb|tb)", text)
    if storage_match:
        unit = storage_match.group(0)[-2:].upper()
        specs["Storage"] = f"{storage_match.group(1)}{unit}"

    return specs


def get_laptop_brand(name, valid_brand_set):
    """
    Xác định brand laptop từ tên sản phẩm.
    - Ưu tiên từ đầu tiên của tên (match không phân biệt hoa/thường với VALID_BRANDS),
      tránh lỗi substring (VD: "Asus VivoBook" bị extract_brand gán nhầm thành "Vivo").
    - Fallback sang extract_brand nếu từ đầu không khớp brand hợp lệ.
    """
    if not name:
        return "Other"
    first_word = name.split()[0]
    if first_word.lower() in valid_brand_set:
        return normalize_brand(first_word)
    brand = extract_brand(name)
    if brand.lower() in valid_brand_set:
        return brand
    return "Other"


def process_laptops(path):
    """
    Xử lý file laptop.csv (dataset Amazon Laptops dạng mới).

    Ánh xạ cột:
      name        -> name (bỏ tiền tố "Laptop", truncate 8 từ)
      (từ tên)    -> brand (extract_brand)
      img         -> imageUrl (fallback PLACEHOLDER_IMG)
      price       -> price (đã là VNĐ, không nhân hệ số quy đổi)
      no_rates    -> reviewCount (default 0)
      rating_100  -> rating (chia 20 về thang 5 sao, round 1 chữ số)
      processor, storage, display, camera -> specs (lọc giá trị rỗng/NaN)
      processor + storage + display       -> description
    """
    df = read_csv_safe(path)
    if df.empty:
        return []

    names = get_series(df, "name")
    imgs = get_series(df, "img")
    prices = get_series(df, "price")
    no_rates = get_series(df, "no_rates")
    ratings = get_series(df, "rating_100")
    processors = get_series(df, "processor")
    storages = get_series(df, "storage")
    displays = get_series(df, "display")
    cameras = get_series(df, "camera")

    items = []
    for i in df.index:
        raw_name = clean_text(names[i])
        if not raw_name:
            continue
        # Bỏ tiền tố "Laptop" đầu tên (nếu có): "Laptop Asus ..." -> "Asus ..."
        name = re.sub(r"^laptop\b\s*", "", raw_name, flags=re.IGNORECASE).strip()
        if not name:
            continue
        name = truncate_name(name, max_words=8)

        # Brand: trích xuất trực tiếp từ tên bằng extract_brand
        brand = extract_brand(name)

        # Giá trong CSV đã là VNĐ (không nhân hệ số quy đổi như mobile)
        price = int(parse_price(prices[i]))
        if price <= 0:
            continue

        # rating_100: thang 0-100 -> chia 20 ra thang 5 sao (VD: 84 -> 4.2)
        raw_rating = ratings[i]
        try:
            rating = round(float(raw_rating) / 20, 1) if raw_rating is not None and not pd.isna(raw_rating) else 0.0
        except (TypeError, ValueError):
            rating = 0.0

        # Số lượt đánh giá, default 0
        raw_no_rates = no_rates[i]
        try:
            review_count = int(raw_no_rates) if raw_no_rates is not None and not pd.isna(raw_no_rates) else 0
        except (TypeError, ValueError):
            review_count = 0

        image_url = clean_image(imgs[i])

        # Specs từ các cột chuyên dụng, lọc bỏ giá trị rỗng/NaN
        specs = {}
        for key, col in (("CPU", processors),
                         ("RAM/Storage", storages),
                         ("Display", displays),
                         ("Camera", cameras)):
            val = clean_text(col[i])
            if val:
                specs[key] = val

        # Description từ processor + storage + display (ngữ liệu cho embedding search)
        desc_parts = [
            clean_text(processors[i]),
            clean_text(storages[i]),
            clean_text(displays[i]),
        ]
        description = " - ".join(p for p in desc_parts if p)

        # Generate realistic data (cùng phương pháp với process_mobile)
        original_price = round(price * random.uniform(1.1, 1.3) / 1000) * 1000
        discount_percent = int((original_price - price) / original_price * 100)
        tags = random.sample(
            ["Bán chạy", "Giá tốt", "Chính hãng", "Mới về", "Top 3 tháng"],
            random.randint(1, 2),
        )
        images = [image_url] * 3 if image_url != PLACEHOLDER_IMG else []

        items.append({
            "name": name,
            "brand": brand,
            "category": "Laptop",
            "price": price,
            "description": description,
            "imageUrl": image_url,
            "thumbnailUrl": image_url,
            "images": images,
            "rating": rating,
            "reviewCount": review_count,
            "originalPrice": original_price,
            "discountPercent": discount_percent,
            "tags": tags,
            "specs": specs,
        })
    return items


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Gộp CSV thành data.json")
    parser.add_argument("--mobile", default="mobile.csv")
    parser.add_argument("--laptops", default="laptop.csv")
    parser.add_argument("--output", default="data.json")
    args = parser.parse_args()

    mobiles = process_mobile(args.mobile)
    laptops = process_laptops(args.laptops)
    merged = mobiles + laptops

    # Sinh id tăng dần (chuỗi) sau khi đã lọc
    result = []
    for idx, item in enumerate(merged, start=1):
        result.append({
            "id": str(idx),
            "name": item["name"],
            "brand": item["brand"],
            "category": item["category"],
            "price": item["price"],
            "description": item["description"],
            "imageUrl": item["imageUrl"],
            "thumbnailUrl": item.get("thumbnailUrl", item["imageUrl"]),
            "images": item.get("images", []),
            "rating": item.get("rating", 0),
            "reviewCount": item.get("reviewCount", 0),
            "originalPrice": item.get("originalPrice", 0),
            "discountPercent": item.get("discountPercent", 0),
            "tags": item.get("tags", []),
            "specs": item.get("specs", {}),
        })

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"Điện thoại ({args.mobile}): {len(mobiles)} | Laptop ({args.laptops}): {len(laptops)} | "
          f"Tổng: {len(result)} -> {args.output}")


if __name__ == "__main__":
    main()