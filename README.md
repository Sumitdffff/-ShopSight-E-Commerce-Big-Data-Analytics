# 🛒 ShopSight — E-Commerce Big Data Analytics

ShopSight is a Big Data Analytics project designed to analyze large-scale e-commerce data and generate meaningful business insights. It uses Python, Pandas, NumPy, and an interactive HTML/CSS/JavaScript dashboard to visualize sales performance, customer behavior, product trends, and regional insights.

## 📊 Features

| Module | Description |
|---|---|
| 📦 Data Generation | Generates synthetic e-commerce datasets with 150,000+ orders |
| 📈 Analysis Engine | Calculates KPIs, revenue, order statistics, and sales trends |
| 👥 Customer Analytics | Performs RFM segmentation and demographic analysis |
| 🛍️ Product Analytics | Identifies top-selling products and category performance |
| 🌍 Regional Analysis | Analyzes sales by city, state, and region |
| 💳 Payment Analytics | Analyzes payment methods and transaction distribution |
| 📊 Interactive Dashboard | Displays business insights through interactive charts |
| ⚙️ One-Click Launcher | Generates data, runs analysis, and opens the dashboard |

## 🧠 Big Data Concepts Used

- **Batch Processing:** Processes large datasets to calculate business metrics.
- **ETL Pipeline:** Extracts, transforms, and loads data for analysis.
- **Data Aggregation:** Groups and summarizes sales and order information.
- **RFM Segmentation:** Segments customers using Recency, Frequency, and Monetary value.
- **Time-Series Analysis:** Analyzes monthly and quarterly sales trends.
- **Data Visualization:** Presents analytical results using interactive charts.
- **Regional Analytics:** Identifies sales performance across different locations.

## 🛠️ Tech Stack

- **Python 3.10+** — Core programming language
- **Pandas** — Data manipulation and analysis
- **NumPy** — Numerical computations
- **Faker** — Synthetic data generation
- **PySpark** — Installed dependency for Big Data experimentation
- **PyArrow** — Columnar data processing support
- **HTML5 & CSS3** — Dashboard structure and styling
- **JavaScript** — Dashboard functionality
- **Chart.js** — Interactive charts and visualizations

## 🚀 Getting Started

### Prerequisites

- Python 3.10 or compatible version
- pip package manager
- A modern web browser

### 1. Clone the Repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd bda
```

Replace `<YOUR_GITHUB_REPOSITORY_URL>` with your actual GitHub repository URL.

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Run the Project

Run the one-click launcher:

```bash
python run.py
```

The launcher will:

1. Generate synthetic datasets if the required order dataset is missing.
2. Execute the Big Data analysis engine.
3. Save the analysis results in the dashboard directory.
4. Open the dashboard in your default browser.

### 4. Run Step by Step

Generate the datasets:

```bash
python data/generate_data.py
```

Run the analysis engine:

```bash
python src/analysis.py
```

Start a local web server:

```bash
python -m http.server 8080 --directory dashboard/
```

Open this URL in your browser:

`http://localhost:8080`

## 📁 Project Structure

```text
bda/
├── data/
│   ├── generate_data.py
│   ├── customers.csv
│   ├── products.csv
│   ├── orders.csv
│   └── order_items.csv
│
├── src/
│   └── analysis.py
│
├── dashboard/
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── data.js
│   └── analysis_results.json
│
├── run.py
├── requirements.txt
└── README.md
```

*Note: CSV datasets and generated analysis files are created when the project runs. Their presence depends on the files included in the repository.*

## 📈 Dashboard Sections

| Section | Description |
|---|---|
| Overview | Key performance indicators and order statistics |
| Sales Trends | Monthly and quarterly revenue analysis |
| Products | Top products and category performance |
| Regional | City-wise and region-wise sales insights |
| Customers | RFM segmentation and demographic analysis |
| Payments | Payment method distribution and revenue |

## 📦 Dataset Information

The project is designed to generate synthetic e-commerce data, including:

- **Customers:** Approximately 12,000 records
- **Products:** Approximately 500 products
- **Orders:** 150,000+ synthetic orders
- **Order Items:** Individual product line items

The generated dataset represents simulated e-commerce activity. It is intended for educational and analytical purposes, not as real customer or business data.

## 🔄 Data Processing Pipeline

```text
Synthetic Data Generation
          ↓
       CSV Files
          ↓
   Data Loading (Pandas)
          ↓
 Data Cleaning & Aggregation
          ↓
   KPI and Trend Analysis
          ↓
 JSON / JavaScript Output
          ↓
 Interactive Web Dashboard
```

## 🎓 Academic Applications

This project demonstrates practical applications of Big Data Analytics, including:

- Large-scale data processing
- Business intelligence and KPI analysis
- Customer segmentation
- Sales forecasting groundwork through time-series analysis
- Product performance evaluation
- Regional and demographic analysis
- Interactive data visualization

## 🔮 Future Enhancements

- Integration with real-time e-commerce data
- Advanced sales forecasting using machine learning
- Database integration with MySQL or MongoDB
- Cloud deployment and automated data pipelines
- Enhanced PySpark-based distributed processing
