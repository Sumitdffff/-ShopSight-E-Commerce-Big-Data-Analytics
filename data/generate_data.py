"""
E-Commerce Synthetic Dataset Generator
Generates 150,000+ realistic records with:
  - Seasonal sales patterns
  - Regional distribution (India cities)
  - Product categories with realistic pricing
  - Customer RFM segments
"""
import sys
import io
# Fix Windows console encoding
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import pandas as pd
import numpy as np
import os
import json
from datetime import datetime, timedelta
import random

random.seed(42)
np.random.seed(42)

# ─── Configuration ────────────────────────────────────────────────────────────
OUTPUT_DIR = os.path.join(os.path.dirname(__file__))
N_CUSTOMERS  = 12_000
N_PRODUCTS   = 500
N_ORDERS     = 150_000
START_DATE   = datetime(2022, 1, 1)
END_DATE     = datetime(2024, 12, 31)

# ─── Reference Data ───────────────────────────────────────────────────────────
CITIES = [
    ("Mumbai", "Maharashtra", "West"),
    ("Delhi", "Delhi", "North"),
    ("Bengaluru", "Karnataka", "South"),
    ("Hyderabad", "Telangana", "South"),
    ("Chennai", "Tamil Nadu", "South"),
    ("Kolkata", "West Bengal", "East"),
    ("Pune", "Maharashtra", "West"),
    ("Ahmedabad", "Gujarat", "West"),
    ("Jaipur", "Rajasthan", "North"),
    ("Surat", "Gujarat", "West"),
    ("Lucknow", "Uttar Pradesh", "North"),
    ("Kanpur", "Uttar Pradesh", "North"),
    ("Nagpur", "Maharashtra", "West"),
    ("Indore", "Madhya Pradesh", "Central"),
    ("Bhopal", "Madhya Pradesh", "Central"),
    ("Patna", "Bihar", "East"),
    ("Ludhiana", "Punjab", "North"),
    ("Agra", "Uttar Pradesh", "North"),
    ("Nashik", "Maharashtra", "West"),
    ("Vadodara", "Gujarat", "West"),
]

CITY_WEIGHTS = [0.12, 0.14, 0.10, 0.07, 0.06, 0.06, 0.06, 0.05,
                0.04, 0.04, 0.03, 0.03, 0.03, 0.03, 0.02, 0.02,
                0.02, 0.02, 0.02, 0.04]

CATEGORIES = {
    "Electronics":     {"price_range": (500, 80000),  "weight": 0.22},
    "Fashion":         {"price_range": (200, 8000),   "weight": 0.25},
    "Home & Kitchen":  {"price_range": (150, 15000),  "weight": 0.15},
    "Books":           {"price_range": (100, 2000),   "weight": 0.08},
    "Sports":          {"price_range": (300, 20000),  "weight": 0.07},
    "Beauty":          {"price_range": (100, 5000),   "weight": 0.09},
    "Grocery":         {"price_range": (50, 3000),    "weight": 0.10},
    "Toys":            {"price_range": (150, 6000),   "weight": 0.04},
}

PAYMENT_METHODS = ["UPI", "Credit Card", "Debit Card", "Net Banking", "COD", "Wallet"]
PAYMENT_WEIGHTS = [0.35, 0.20, 0.18, 0.10, 0.12, 0.05]

ORDER_STATUS   = ["Delivered", "Shipped", "Returned", "Cancelled"]
STATUS_WEIGHTS = [0.75, 0.10, 0.08, 0.07]

PRODUCT_NAMES = {
    "Electronics":    ["Smartphone", "Laptop", "Tablet", "Headphones", "Smart TV",
                       "Camera", "Smartwatch", "Bluetooth Speaker", "Power Bank", "Router"],
    "Fashion":        ["Kurta", "Jeans", "T-Shirt", "Saree", "Sneakers", "Formal Shirt",
                       "Ethnic Dress", "Leggings", "Jacket", "Hoodie"],
    "Home & Kitchen": ["Pressure Cooker", "Mixer Grinder", "Bedsheet Set", "Pillow",
                       "Wall Clock", "Curtains", "Storage Box", "Cookware Set", "LED Lamp", "Air Purifier"],
    "Books":          ["Fiction Novel", "Self-Help Book", "UPSC Guide", "JEE Prep Book",
                       "Cook Book", "Children Story", "History Book", "Science Encyclopedia"],
    "Sports":         ["Cricket Bat", "Yoga Mat", "Dumbbells", "Football", "Badminton Racket",
                       "Cycling Gloves", "Running Shoes", "Resistance Bands"],
    "Beauty":         ["Face Serum", "Sunscreen SPF 50", "Lipstick", "Foundation",
                       "Hair Oil", "Shampoo", "Face Wash", "Moisturizer"],
    "Grocery":        ["Organic Rice 5kg", "Dal 1kg", "Cooking Oil 5L", "Masala Kit",
                       "Dry Fruits Assorted", "Green Tea", "Protein Powder", "Honey"],
    "Toys":           ["LEGO Set", "Remote Car", "Board Game", "Puzzle 1000pc",
                       "Action Figure", "Soft Toy", "Building Blocks"],
}

# ─── Generators ───────────────────────────────────────────────────────────────

def generate_customers():
    """Generate customer master data."""
    print("  Generating customers...")
    cities_sample = random.choices(CITIES, weights=CITY_WEIGHTS, k=N_CUSTOMERS)
    customers = []
    for i in range(N_CUSTOMERS):
        city, state, region = cities_sample[i]
        age = int(np.random.normal(34, 10))
        age = max(18, min(70, age))
        customers.append({
            "customer_id":  f"CUST{i+1:05d}",
            "city":         city,
            "state":        state,
            "region":       region,
            "age":          age,
            "gender":       random.choice(["Male", "Female"]),
            "join_date":    (START_DATE + timedelta(days=random.randint(0, 365))).strftime("%Y-%m-%d"),
        })
    return pd.DataFrame(customers)


def generate_products():
    """Generate product catalog."""
    print("  Generating products...")
    category_names = list(CATEGORIES.keys())
    cat_weights    = [CATEGORIES[c]["weight"] for c in category_names]
    products       = []
    prod_id        = 1
    for cat in category_names:
        cat_cfg    = CATEGORIES[cat]
        n_prod     = max(10, int(N_PRODUCTS * cat_cfg["weight"]))
        names_pool = PRODUCT_NAMES[cat]
        lo, hi     = cat_cfg["price_range"]
        for j in range(n_prod):
            name  = f"{random.choice(names_pool)} {random.choice(['Pro', 'Lite', 'Max', 'Plus', 'SE', ''])}"
            price = round(random.uniform(lo, hi), 2)
            products.append({
                "product_id":   f"PROD{prod_id:04d}",
                "product_name": name.strip(),
                "category":     cat,
                "price":        price,
                "cost":         round(price * random.uniform(0.45, 0.72), 2),
                "brand":        random.choice(["TrueValue", "ZenBrand", "PrimePick", "NovaLine", "SwiftBuy"]),
                "rating":       round(random.uniform(3.0, 5.0), 1),
            })
            prod_id += 1
    return pd.DataFrame(products)


def seasonal_weight(date: datetime) -> float:
    """Return a demand multiplier based on month/day (Indian festival seasons)."""
    month = date.month
    day   = date.day
    # Diwali (Oct-Nov), New Year (Jan), Summer sales (Jun), Dussehra (Oct)
    multipliers = {1: 1.4, 2: 0.9, 3: 1.0, 4: 1.1, 5: 1.0, 6: 1.3,
                   7: 0.9, 8: 1.1, 9: 1.0, 10: 1.6, 11: 1.8, 12: 1.5}
    return multipliers.get(month, 1.0)


def generate_orders(customers: pd.DataFrame, products: pd.DataFrame):
    """Generate order + order-items records."""
    print("  Generating orders (this may take ~30 sec)...")
    total_days = (END_DATE - START_DATE).days
    date_pool  = [START_DATE + timedelta(days=d) for d in range(total_days + 1)]
    # Weighted date selection (more orders in festive months)
    date_weights = [seasonal_weight(d) for d in date_pool]
    date_weights_arr = np.array(date_weights)
    date_weights_arr /= date_weights_arr.sum()

    customer_ids = customers["customer_id"].tolist()
    product_rows = products.to_dict("records")

    orders      = []
    order_items = []

    for i in range(N_ORDERS):
        order_date = random.choices(date_pool, weights=date_weights_arr, k=1)[0]
        customer   = random.choice(customer_ids)
        n_items    = random.choices([1, 2, 3, 4, 5], weights=[0.50, 0.25, 0.13, 0.07, 0.05])[0]
        chosen_prods = random.sample(product_rows, min(n_items, len(product_rows)))

        order_total  = 0.0
        discount     = round(random.choices([0, 5, 10, 15, 20], weights=[0.4, 0.2, 0.2, 0.1, 0.1])[0], 2)
        for prod in chosen_prods:
            qty  = random.randint(1, 4)
            unit = prod["price"] * (1 - discount / 100)
            line = round(unit * qty, 2)
            order_total += line
            order_items.append({
                "order_id":   f"ORD{i+1:07d}",
                "product_id": prod["product_id"],
                "quantity":   qty,
                "unit_price": round(unit, 2),
                "line_total": line,
            })

        orders.append({
            "order_id":       f"ORD{i+1:07d}",
            "customer_id":    customer,
            "order_date":     order_date.strftime("%Y-%m-%d"),
            "order_month":    order_date.strftime("%Y-%m"),
            "order_year":     order_date.year,
            "order_quarter":  f"Q{(order_date.month - 1)//3 + 1}-{order_date.year}",
            "order_total":    round(order_total, 2),
            "discount_pct":   discount,
            "payment_method": random.choices(PAYMENT_METHODS, weights=PAYMENT_WEIGHTS)[0],
            "status":         random.choices(ORDER_STATUS, weights=STATUS_WEIGHTS)[0],
        })

        if i % 20000 == 0:
            print(f"    ... {i}/{N_ORDERS} orders generated")

    return pd.DataFrame(orders), pd.DataFrame(order_items)


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print("[BDA] E-Commerce Dataset Generator")
    print("=" * 40)

    customers  = generate_customers()
    products   = generate_products()
    orders, items = generate_orders(customers, products)

    # Save CSVs
    customers_path = os.path.join(OUTPUT_DIR, "customers.csv")
    products_path  = os.path.join(OUTPUT_DIR, "products.csv")
    orders_path    = os.path.join(OUTPUT_DIR, "orders.csv")
    items_path     = os.path.join(OUTPUT_DIR, "order_items.csv")

    print("\n  Saving CSVs...")
    customers.to_csv(customers_path, index=False)
    products.to_csv(products_path,   index=False)
    orders.to_csv(orders_path,       index=False)
    items.to_csv(items_path,         index=False)

    print(f"\n[OK] Dataset saved to: {OUTPUT_DIR}")
    print(f"   Customers:   {len(customers):,}")
    print(f"   Products:    {len(products):,}")
    print(f"   Orders:      {len(orders):,}")
    print(f"   Order items: {len(items):,}")
    print(f"   Date range:  {orders['order_date'].min()} -> {orders['order_date'].max()}")


if __name__ == "__main__":
    main()
