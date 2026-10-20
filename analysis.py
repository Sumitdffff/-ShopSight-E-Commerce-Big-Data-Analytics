"""
Big Data Analysis Engine
Processes the e-commerce dataset using Pandas (with PySpark-style operations)
and exports a single analysis_results.json for the dashboard.
"""

import pandas as pd
import numpy as np
import json
import os
import sys
from datetime import datetime

# ??? Paths ????????????????????????????????????????????????????????????????????
SRC_DIR       = os.path.dirname(os.path.abspath(__file__))
BASE_DIR      = os.path.dirname(SRC_DIR)  # project root
DATA_DIR      = os.path.join(BASE_DIR, "data")
DASHBOARD_DIR = os.path.join(BASE_DIR, "dashboard")
OUTPUT_JSON   = os.path.join(DASHBOARD_DIR, "analysis_results.json")
OUTPUT_JS     = os.path.join(DASHBOARD_DIR, "data.js")

# ??? Load Data ????????????????????????????????????????????????????????????????

def load_data():
    print("[>] Loading datasets...")
    customers  = pd.read_csv(os.path.join(DATA_DIR, "customers.csv"))
    products   = pd.read_csv(os.path.join(DATA_DIR, "products.csv"))
    orders     = pd.read_csv(os.path.join(DATA_DIR, "orders.csv"), parse_dates=["order_date"])
    items      = pd.read_csv(os.path.join(DATA_DIR, "order_items.csv"))
    print(f"   [OK] Customers:   {len(customers):,}")
    print(f"   [OK] Products:    {len(products):,}")
    print(f"   [OK] Orders:      {len(orders):,}")
    print(f"   [OK] Order items: {len(items):,}")
    return customers, products, orders, items


# ??? Analysis Functions ???????????????????????????????????????????????????????

def compute_kpis(orders, customers, items, products):
    """High-level KPIs."""
    print("\n[**] Computing KPIs...")
    delivered = orders[orders["status"] == "Delivered"]

    total_revenue     = delivered["order_total"].sum()
    total_orders      = len(delivered)
    unique_customers  = delivered["customer_id"].nunique()
    avg_order_value   = delivered["order_total"].mean()
    total_items_sold  = items[items["order_id"].isin(delivered["order_id"])]["quantity"].sum()

    # MoM revenue (last 2 full months)
    orders_copy = orders.copy()
    orders_copy["ym"] = orders_copy["order_date"].dt.to_period("M")
    monthly = (delivered.copy()
               .assign(ym=lambda df: df["order_date"].dt.to_period("M"))
               .groupby("ym")["order_total"].sum())
    mom_growth = 0.0
    if len(monthly) >= 2:
        last  = float(monthly.iloc[-1])
        prev  = float(monthly.iloc[-2])
        mom_growth = round(((last - prev) / prev) * 100, 2) if prev else 0.0

    return {
        "total_revenue":    round(total_revenue, 2),
        "total_orders":     total_orders,
        "unique_customers": unique_customers,
        "avg_order_value":  round(avg_order_value, 2),
        "total_items_sold": int(total_items_sold),
        "mom_growth":       mom_growth,
        "return_rate":      round(len(orders[orders["status"] == "Returned"]) / len(orders) * 100, 2),
        "cancellation_rate": round(len(orders[orders["status"] == "Cancelled"]) / len(orders) * 100, 2),
    }


def monthly_revenue_trend(orders):
    """Monthly revenue for line chart."""
    print("   -> Monthly revenue trend...")
    delivered = orders[orders["status"] == "Delivered"].copy()
    delivered["year_month"] = delivered["order_date"].dt.strftime("%b %Y")
    delivered["sort_key"]   = delivered["order_date"].dt.to_period("M")
    monthly = (delivered.groupby(["sort_key", "year_month"])["order_total"]
               .agg(revenue="sum", orders="count")
               .reset_index()
               .sort_values("sort_key"))
    return {
        "labels":  monthly["year_month"].tolist(),
        "revenue": [round(v, 2) for v in monthly["revenue"].tolist()],
        "orders":  monthly["orders"].tolist(),
    }


def category_breakdown(orders, items, products):
    """Revenue per category for donut/bar chart."""
    print("   -> Category breakdown...")
    delivered = orders[orders["status"] == "Delivered"]
    di        = items[items["order_id"].isin(delivered["order_id"])]
    merged    = di.merge(products[["product_id", "category", "cost"]], on="product_id")
    cat       = (merged.groupby("category")
                 .agg(revenue=("line_total", "sum"),
                      units=("quantity", "sum"),
                      profit=pd.NamedAgg("line_total", lambda x: x.sum()))  # placeholder
                 .reset_index()
                 .sort_values("revenue", ascending=False))

    # Recalculate profit = revenue - cost*qty
    merged["profit"] = merged["line_total"] - merged["cost"] * merged["quantity"]
    profit_by_cat    = merged.groupby("category")["profit"].sum().reset_index()
    cat = cat.merge(profit_by_cat, on="category")
    cat = cat.rename(columns={"profit_y": "profit"}).drop(columns=["profit_x"], errors="ignore")

    return {
        "labels":  cat["category"].tolist(),
        "revenue": [round(v, 2) for v in cat["revenue"].tolist()],
        "units":   [int(v) for v in cat["units"].tolist()],
        "profit":  [round(v, 2) for v in cat["profit"].tolist()],
    }


def top_products(orders, items, products, n=10):
    """Top N products by revenue."""
    print("   -> Top products...")
    delivered = orders[orders["status"] == "Delivered"]
    di        = items[items["order_id"].isin(delivered["order_id"])]
    merged    = di.merge(products[["product_id", "product_name", "category", "rating"]], on="product_id")
    top       = (merged.groupby(["product_id", "product_name", "category", "rating"])
                 .agg(revenue=("line_total", "sum"),
                      units=("quantity", "sum"))
                 .reset_index()
                 .sort_values("revenue", ascending=False)
                 .head(n))
    return {
        "labels":   top["product_name"].tolist(),
        "revenue":  [round(v, 2) for v in top["revenue"].tolist()],
        "units":    [int(v) for v in top["units"].tolist()],
        "category": top["category"].tolist(),
        "rating":   top["rating"].tolist(),
    }


def regional_analysis(orders, customers):
    """Revenue by city/region."""
    print("   -> Regional analysis...")
    delivered = orders[orders["status"] == "Delivered"]
    merged    = delivered.merge(customers[["customer_id", "city", "state", "region"]], on="customer_id")

    by_city = (merged.groupby(["city", "state", "region"])
               .agg(revenue=("order_total", "sum"),
                    orders=("order_id", "count"),
                    customers=("customer_id", "nunique"))
               .reset_index()
               .sort_values("revenue", ascending=False)
               .head(15))

    by_region = (merged.groupby("region")
                 .agg(revenue=("order_total", "sum"),
                      orders=("order_id", "count"))
                 .reset_index()
                 .sort_values("revenue", ascending=False))

    return {
        "cities": {
            "labels":    by_city["city"].tolist(),
            "states":    by_city["state"].tolist(),
            "regions":   by_city["region"].tolist(),
            "revenue":   [round(v, 2) for v in by_city["revenue"].tolist()],
            "orders":    by_city["orders"].tolist(),
            "customers": by_city["customers"].tolist(),
        },
        "regions": {
            "labels":  by_region["region"].tolist(),
            "revenue": [round(v, 2) for v in by_region["revenue"].tolist()],
            "orders":  by_region["orders"].tolist(),
        },
    }


def payment_method_analysis(orders):
    """Payment method distribution."""
    print("   -> Payment methods...")
    delivered = orders[orders["status"] == "Delivered"]
    pm        = (delivered.groupby("payment_method")
                 .agg(count=("order_id", "count"),
                      revenue=("order_total", "sum"))
                 .reset_index()
                 .sort_values("count", ascending=False))
    return {
        "labels":  pm["payment_method"].tolist(),
        "count":   pm["count"].tolist(),
        "revenue": [round(v, 2) for v in pm["revenue"].tolist()],
    }


def rfm_segmentation(orders, customers):
    """RFM customer segmentation."""
    print("   -> RFM segmentation...")
    delivered    = orders[orders["status"] == "Delivered"].copy()
    snapshot_date = delivered["order_date"].max() + pd.Timedelta(days=1)

    rfm = (delivered.groupby("customer_id")
           .agg(
               recency=("order_date",   lambda x: (snapshot_date - x.max()).days),
               frequency=("order_id",  "count"),
               monetary=("order_total", "sum"),
           )
           .reset_index())

    # Score 1-5 (higher = better for F & M, lower = better for R)
    rfm["r_score"] = pd.qcut(rfm["recency"],   5, labels=[5, 4, 3, 2, 1])
    rfm["f_score"] = pd.qcut(rfm["frequency"].rank(method="first"), 5, labels=[1, 2, 3, 4, 5])
    rfm["m_score"] = pd.qcut(rfm["monetary"],  5, labels=[1, 2, 3, 4, 5])
    rfm["rfm_score"] = (rfm["r_score"].astype(int) +
                        rfm["f_score"].astype(int) +
                        rfm["m_score"].astype(int))

    def segment(score):
        if score >= 12: return "Champions"
        elif score >= 9: return "Loyal Customers"
        elif score >= 7: return "Potential Loyalists"
        elif score >= 5: return "At Risk"
        else: return "Lost"

    rfm["segment"] = rfm["rfm_score"].apply(segment)
    seg_summary = (rfm.groupby("segment")
                   .agg(customers=("customer_id", "count"),
                        avg_monetary=("monetary", "mean"))
                   .reset_index()
                   .sort_values("customers", ascending=False))

    return {
        "labels":        seg_summary["segment"].tolist(),
        "customers":     seg_summary["customers"].tolist(),
        "avg_monetary":  [round(v, 2) for v in seg_summary["avg_monetary"].tolist()],
        "total_segments": len(rfm["segment"].unique()),
    }


def quarterly_comparison(orders):
    """Quarter over quarter performance."""
    print("   -> Quarterly comparison...")
    delivered = orders[orders["status"] == "Delivered"].copy()
    delivered["quarter"] = (delivered["order_date"].dt.year.astype(str) + " " +
                            delivered["order_date"].dt.quarter.apply(lambda q: f"Q{q}"))
    qtr = (delivered.groupby("quarter")
           .agg(revenue=("order_total", "sum"),
                orders=("order_id", "count"))
           .reset_index()
           .sort_values("quarter"))
    return {
        "labels":  qtr["quarter"].tolist(),
        "revenue": [round(v, 2) for v in qtr["revenue"].tolist()],
        "orders":  qtr["orders"].tolist(),
    }


def age_gender_analysis(orders, customers):
    """Demographic breakdown."""
    print("   -> Age & gender analysis...")
    delivered = orders[orders["status"] == "Delivered"]
    merged    = delivered.merge(customers[["customer_id", "age", "gender"]], on="customer_id")

    # Age buckets
    bins   = [18, 25, 35, 45, 55, 70]
    labels = ["18-24", "25-34", "35-44", "45-54", "55+"]
    merged["age_group"] = pd.cut(merged["age"], bins=bins, labels=labels, right=False)

    age = (merged.groupby("age_group", observed=True)
           .agg(revenue=("order_total", "sum"),
                orders=("order_id", "count"))
           .reset_index())

    gender = (merged.groupby("gender")
              .agg(revenue=("order_total", "sum"),
                   orders=("order_id", "count"))
              .reset_index())

    return {
        "age": {
            "labels":  [str(l) for l in age["age_group"].tolist()],
            "revenue": [round(v, 2) for v in age["revenue"].tolist()],
            "orders":  age["orders"].tolist(),
        },
        "gender": {
            "labels":  gender["gender"].tolist(),
            "revenue": [round(v, 2) for v in gender["revenue"].tolist()],
        },
    }


def order_status_summary(orders):
    """Order status breakdown."""
    status = (orders.groupby("status")
              .agg(count=("order_id", "count"))
              .reset_index())
    return {
        "labels": status["status"].tolist(),
        "counts": status["count"].tolist(),
    }


# ??? Main ?????????????????????????????????????????????????????????????????????

def main():
    print("=" * 50)
    print(" ? E-Commerce Big Data Analysis Engine")
    print("=" * 50)

    # Check if data exists
    for fname in ["customers.csv", "products.csv", "orders.csv", "order_items.csv"]:
        if not os.path.exists(os.path.join(DATA_DIR, fname)):
            print(f"\n[ERROR] Missing file: {fname}")
            print("   Run: python data/generate_data.py first!")
            sys.exit(1)

    customers, products, orders, items = load_data()
    os.makedirs(DASHBOARD_DIR, exist_ok=True)

    results = {
        "generated_at":    datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "dataset_info": {
            "total_customers": len(customers),
            "total_products":  len(products),
            "total_orders":    len(orders),
            "total_items":     len(items),
            "date_range": {
                "start": str(orders["order_date"].min().date()),
                "end":   str(orders["order_date"].max().date()),
            },
        },
        "kpis":              compute_kpis(orders, customers, items, products),
        "monthly_trend":     monthly_revenue_trend(orders),
        "category":          category_breakdown(orders, items, products),
        "top_products":      top_products(orders, items, products),
        "regional":          regional_analysis(orders, customers),
        "payment_methods":   payment_method_analysis(orders),
        "rfm":               rfm_segmentation(orders, customers),
        "quarterly":         quarterly_comparison(orders),
        "demographics":      age_gender_analysis(orders, customers),
        "order_status":      order_status_summary(orders),
    }

    with open(OUTPUT_JSON, "w") as f:
        json.dump(results, f, indent=2)

    # Also write a JS file so the dashboard loads without a local server
    with open(OUTPUT_JS, "w") as f:
        f.write("/* Auto-generated by analysis.py — do not edit manually */\n")
        f.write("window.__PRELOADED_DATA__ = ")
        json.dump(results, f)
        f.write(";\n")

    print(f"\n[OK] Analysis complete!")
    print(f"   Results saved -> {OUTPUT_JSON}")
    print(f"\n[STATS] Key Metrics:")
    k = results["kpis"]
    print(f"   Total Revenue    : ?{k['total_revenue']:,.2f}")
    print(f"   Total Orders     : {k['total_orders']:,}")
    print(f"   Unique Customers : {k['unique_customers']:,}")
    print(f"   Avg Order Value  : ?{k['avg_order_value']:,.2f}")
    print(f"   MoM Growth       : {k['mom_growth']}%")
    print(f"\n[WEB] Open dashboard/index.html in your browser!")


if __name__ == "__main__":
    main()
