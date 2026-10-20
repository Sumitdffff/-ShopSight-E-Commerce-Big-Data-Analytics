"""
run.py — One-click launcher
  1. Generates synthetic dataset (if not present)
  2. Runs analysis engine
  3. Launches dashboard in browser
"""
import os, sys, subprocess, webbrowser, time

BASE_DIR      = os.path.dirname(os.path.abspath(__file__))
DATA_DIR      = os.path.join(BASE_DIR, "data")
ORDERS_FILE   = os.path.join(DATA_DIR, "orders.csv")
ANALYSIS_JSON = os.path.join(BASE_DIR, "dashboard", "analysis_results.json")
DASHBOARD     = os.path.join(BASE_DIR, "dashboard", "index.html")

def run(cmd, cwd=None):
    print(f"\n► {' '.join(cmd)}\n")
    result = subprocess.run(cmd, cwd=cwd or BASE_DIR)
    if result.returncode != 0:
        print(f"\n❌ Command failed: {' '.join(cmd)}")
        sys.exit(1)

def main():
    print("╔══════════════════════════════════════════════╗")
    print("║   ShopSight — E-Commerce Big Data Pipeline   ║")
    print("╚══════════════════════════════════════════════╝\n")

    python = sys.executable

    # Step 1: Generate data
    if not os.path.exists(ORDERS_FILE):
        print("📦 Step 1/2: Generating 150,000+ synthetic records...")
        run([python, os.path.join(DATA_DIR, "generate_data.py")])
    else:
        print(f"✅ Step 1/2: Dataset already exists — skipping generation")

    # Step 2: Run analysis
    print("\n🔬 Step 2/2: Running Big Data analysis...")
    run([python, os.path.join(BASE_DIR, "src", "analysis.py")])

    # Step 3: Open browser
    print(f"\n🌐 Opening dashboard...")
    webbrowser.open(f"file:///{DASHBOARD.replace(os.sep, '/')}")
    print("   Dashboard opened in your default browser!")
    print("\n✨ Done! If the dashboard shows an error, use a local server:")
    print("   python -m http.server 8080 --directory dashboard/")
    print("   Then open: http://localhost:8080")

if __name__ == "__main__":
    main()
