#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
convert_data.py
Gộp mobile.csv và amazon_laptops.csv thành data.json cho hệ thống E-commerce.

Cách dùng:
    python convert_data.py
    python convert_data.py --mobile mobile.csv --laptops amazon_laptops.csv --output data.json
"""

import argparse
import json
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


def normalize_brand(brand):
    """
    Viết hoa chữ cái đầu của brand.
    - "apple" -> "Apple", "redmi" -> "Redmi", "samsung" -> "Samsung"
    - Brand đã có chữ hoa (HP, OnePlus, iQOO...) thì chỉ đảm bảo ký tự đầu được viết hoa.
    """
    brand = clean_text(brand)
    if not brand:
        return ""
    if brand.islower():
        return " ".join(w[:1].upper() + w[1:] for w in brand.split(" "))
    return brand[:1].upper() + brand[1:]


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
        # Fix giá sai (quá rẻ): < 2.000.000 VNĐ thì nhân thêm 10 lần
        if 0 < price < MIN_MOBILE_PRICE_VND:
            price *= MOBILE_PRICE_FIX_FACTOR
        if price <= 0:
            continue
        image_url = clean_image(imgs[i])
        items.append({
            "name": name,
            "brand": brand,
            "category": "Điện thoại",
            "price": price,
            "description": fix_description_spacing(corpus[i]),
            "imageUrl": image_url,
            "thumbnailUrl": image_url,
            "images": [image_url] if image_url != PLACEHOLDER_IMG else [],
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
        "microsoft": "Microsoft", "surface": "Microsoft",
        "lg": "LG", "sony": "Sony", "xperia": "Sony",
        "google": "Google", "pixel": "Google"
    }

    # Ưu tiên check các từ khóa dài trước (ví dụ "find x" trước "x")
    for keyword, brand_name in sorted(brand_keywords.items(), key=lambda x: len(x[0]), reverse=True):
        if keyword in t:
            return brand_name

    return "Other"


def truncate_name(name, max_words=8):
    """Cắt tên sản phẩm tối đa max_words từ, thêm "..." nếu bị cắt."""
    words = name.split()
    if len(words) > max_words:
        return " ".join(words[:max_words]) + "..."
    return name


def process_laptops(path):
    df = read_csv_safe(path)
    if df.empty:
        return []

    titles = get_series(df, "Title")
    brands = get_series(df, "Brand")
    prices = get_series(df, "Price")
    imgs = get_series(df, "Image URL")
    rams = get_series(df, "RAM")  # có thể không tồn tại -> toàn NaN

    items = []
    valid_brand_set = {b.lower() for b in VALID_BRANDS}
    for i in df.index:
        title = clean_text(titles[i])
        if not title:
            continue
        price = round(parse_price(prices[i]) * USD_TO_VND)
        if price <= 0:
            continue
        # Extract brand directly from CSV's Brand column
        raw_brand = clean_text(brands[i])
        brand = normalize_brand(raw_brand) if raw_brand else "Other"
        # Fallback to keyword extractor if brand is empty, "Others", or not in VALID_BRANDS
        if not brand or brand.lower() == "others" or brand.lower() not in valid_brand_set:
            brand = extract_brand(title)
        # Final fallback: if still no valid brand, use first word of title if it matches known brand
        if brand.lower() == "other":
            first_word = title.split()[0] if title.split() else "Other"
            if first_word.lower() in valid_brand_set:
                brand = first_word[:1].upper() + first_word[1:].lower()
        # Use product title directly (truncated to 8 words), NO brand concatenation
        name = truncate_name(title, max_words=8)
        ram = clean_text(rams[i])
        description = fix_description_spacing(
            f"{title} - Thương hiệu: {brand}. Cấu hình: {ram}"
        )
        image_url = clean_image(imgs[i])
        items.append({
            "name": name,
            "brand": brand,
            "category": "Laptop",
            "price": price,
            "description": description,
            "imageUrl": image_url,
            "thumbnailUrl": image_url,
            "images": [image_url] if image_url != PLACEHOLDER_IMG else [],
        })
    return items


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Gộp CSV thành data.json")
    parser.add_argument("--mobile", default="mobile.csv")
    parser.add_argument("--laptops", default="amazon_laptops.csv")
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
        })

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"Điện thoại: {len(mobiles)} | Laptop: {len(laptops)} | "
          f"Tổng: {len(result)} -> {args.output}")


if __name__ == "__main__":
    main()
