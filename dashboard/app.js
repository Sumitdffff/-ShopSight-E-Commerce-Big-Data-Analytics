/* ══════════════════════════════════════════════════════════════════════════
   ShopSight Analytics — Dashboard JavaScript
   Supports TWO modes:
     1. Sample Data  → loads analysis_results.json (from Python pipeline)
     2. My Data      → user enters records manually; analytics computed in-browser
   ══════════════════════════════════════════════════════════════════════════ */

'use strict';

// ─── Chart.js Global Defaults ─────────────────────────────────────────────
Chart.defaults.color           = '#8b90a0';
Chart.defaults.borderColor     = 'rgba(255,255,255,0.07)';
Chart.defaults.font.family     = 'Inter, sans-serif';
Chart.defaults.plugins.legend.display = false;
Chart.defaults.animation.duration     = 900;
Chart.defaults.animation.easing       = 'easeOutQuart';

// ─── Colour Palette ───────────────────────────────────────────────────────
const PALETTE = [
  '#6366f1','#f59e0b','#10b981','#ec4899','#3b82f6',
  '#a78bfa','#fb923c','#34d399','#f472b6','#60a5fa',
  '#fbbf24','#4ade80'
];
const GRADIENT_CONFIG = {
  indigo:  ['rgba(99,102,241,0.7)',  'rgba(99,102,241,0.05)'],
  amber:   ['rgba(245,158,11,0.7)',  'rgba(245,158,11,0.05)'],
  emerald: ['rgba(16,185,129,0.7)',  'rgba(16,185,129,0.05)'],
};

// ─── City → Region map ────────────────────────────────────────────────────
const CITY_REGION = {
  'Mumbai':'West','Delhi':'North','Bengaluru':'South','Hyderabad':'South',
  'Chennai':'South','Kolkata':'East','Pune':'West','Ahmedabad':'West',
  'Jaipur':'North','Surat':'West','Lucknow':'North','Indore':'Central',
  'Nagpur':'West','Bhopal':'Central','Patna':'East','Other':'Other',
};

// ─── App State ────────────────────────────────────────────────────────────
let DATA    = null;          // sample JSON from analysis.py
let CHARTS  = {};
let MODE    = 'sample';      // 'sample' | 'mydata'
let MY_RECORDS = [];         // user-entered records

const LS_KEY = 'shopsight_records';

// ─── Utilities ────────────────────────────────────────────────────────────
function fmt(n, dec = 0) {
  if (n == null || isNaN(n)) return '₹0';
  if (n >= 1e7) return '₹' + (n / 1e7).toFixed(1) + ' Cr';
  if (n >= 1e5) return '₹' + (n / 1e5).toFixed(1) + ' L';
  if (n >= 1e3) return '₹' + (n / 1e3).toFixed(1) + 'K';
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: dec });
}
function fmtNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString('en-IN');
}
function pct(n) { return n >= 0 ? `+${n}%` : `${n}%`; }

function makeGradient(ctx, colors) {
  const g = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
  g.addColorStop(0, colors[0]);
  g.addColorStop(1, colors[1]);
  return g;
}
function destroyChart(id) {
  if (CHARTS[id]) { CHARTS[id].destroy(); delete CHARTS[id]; }
}

// ─── Toast ────────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icon}</span><span>${msg}</span>`;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'slideOutRight 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

/* ══════════════════════════════════════════════════════════════════════════
   MODE SWITCHING
   ══════════════════════════════════════════════════════════════════════════ */
function switchMode(mode) {
  MODE = mode;
  document.getElementById('btnSample').classList.toggle('active', mode === 'sample');
  document.getElementById('btnMyData').classList.toggle('active', mode === 'mydata');
  document.body.classList.toggle('mydata-mode', mode === 'mydata');

  const label = document.getElementById('topbar-mode-label');

  if (mode === 'sample') {
    label.textContent = 'Sample Data Mode · Big Data Analysis · Python';
    if (DATA) {
      renderAll();
    } else {
      loadData();
    }
  } else {
    label.textContent = 'My Data Mode · Live Analysis · Enter Your Records';
    // Show entry section first
    activateSection('entry');
    // If already has records, auto-analyze
    if (MY_RECORDS.length > 0) {
      analyzeMyData();
    } else {
      // Still show dashboard shell
      document.getElementById('loadingOverlay').style.display = 'none';
      document.getElementById('errorOverlay').classList.add('hidden');
      document.getElementById('dashboardBody').style.display = 'flex';
    }
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   SAMPLE DATA — Load from analysis_results.json
   ══════════════════════════════════════════════════════════════════════════ */
async function loadData() {
  document.getElementById('loadingOverlay').style.display = 'flex';
  document.getElementById('errorOverlay').classList.add('hidden');
  document.getElementById('dashboardBody').style.display  = 'none';

  // 1. Use data embedded by data.js (works when opened as file://)
  if (window.__PRELOADED_DATA__) {
    DATA = window.__PRELOADED_DATA__;
    renderAll();
    return;
  }

  // 2. Fallback: fetch via HTTP (works when served by a local server)
  try {
    const res = await fetch('./analysis_results.json?t=' + Date.now());
    if (!res.ok) throw new Error('File not found');
    DATA = await res.json();
    renderAll();
  } catch (e) {
    document.getElementById('loadingOverlay').style.display = 'none';
    document.getElementById('errorOverlay').classList.remove('hidden');
    console.error('Load error:', e);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   DATA ENTRY — localStorage persistence
   ══════════════════════════════════════════════════════════════════════════ */
function loadStoredRecords() {
  try {
    MY_RECORDS = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch { MY_RECORDS = []; }
  refreshEntryUI();
}

function saveRecords() {
  localStorage.setItem(LS_KEY, JSON.stringify(MY_RECORDS));
}

function addRecord(e) {
  e.preventDefault();
  const g  = id => document.getElementById(id).value.trim();
  const gn = id => parseFloat(document.getElementById(id).value) || 0;

  const customer = g('f-customer');
  const date     = g('f-date');
  const city     = g('f-city');
  const product  = g('f-product');
  const category = g('f-category');
  const qty      = parseInt(gn('f-qty')) || 1;
  const price    = gn('f-price');
  const payment  = g('f-payment');
  const status   = g('f-status');
  const gender   = g('f-gender');
  const age      = parseInt(gn('f-age')) || 28;

  if (!customer || !date || !city || !product || !category || !price || !payment) {
    showToast('Please fill in all required fields', 'error');
    return;
  }

  const record = {
    id:         Date.now(),
    customer,
    date,
    city,
    region:     CITY_REGION[city] || 'Other',
    product,
    category,
    qty,
    unit_price: price,
    amount:     Math.round(price * qty * 100) / 100,
    payment,
    status,
    gender,
    age,
  };

  MY_RECORDS.push(record);
  saveRecords();
  refreshEntryUI();

  // Reset form fields (keep defaults)
  document.getElementById('f-customer').value = '';
  document.getElementById('f-product').value  = '';
  document.getElementById('f-price').value    = '';
  document.getElementById('f-qty').value      = '1';
  document.getElementById('f-date').focus();

  showToast(`Record added! (${MY_RECORDS.length} total)`);
}

function deleteRecord(id) {
  MY_RECORDS = MY_RECORDS.filter(r => r.id !== id);
  saveRecords();
  refreshEntryUI();
  showToast('Record deleted', 'error');
  // Re-analyze if in mydata mode and still has records
  if (MODE === 'mydata' && MY_RECORDS.length > 0) analyzeMyData();
}

function clearAllRecords() {
  if (!MY_RECORDS.length) { showToast('No records to clear', 'error'); return; }
  if (!confirm(`Delete all ${MY_RECORDS.length} records?`)) return;
  MY_RECORDS = [];
  saveRecords();
  refreshEntryUI();
  showToast('All records cleared');
}

function loadSampleEntries() {
  const samples = [
    { customer:'Rahul Sharma',  date:'2024-01-15', city:'Mumbai',    product:'Samsung Galaxy S24',  category:'Electronics',   qty:1, unit_price:75000, payment:'UPI',         status:'Delivered', gender:'Male',   age:28 },
    { customer:'Priya Singh',   date:'2024-01-22', city:'Delhi',     product:'Nike Running Shoes',  category:'Sports',        qty:2, unit_price:8500,  payment:'Credit Card', status:'Delivered', gender:'Female', age:24 },
    { customer:'Amit Patel',    date:'2024-02-03', city:'Bengaluru', product:'MacBook Air M3',      category:'Electronics',   qty:1, unit_price:115000,payment:'Net Banking', status:'Delivered', gender:'Male',   age:32 },
    { customer:'Sneha Reddy',   date:'2024-02-14', city:'Hyderabad', product:'Silk Saree',          category:'Fashion',       qty:3, unit_price:4500,  payment:'UPI',         status:'Delivered', gender:'Female', age:35 },
    { customer:'Vikram Nair',   date:'2024-02-28', city:'Chennai',   product:'Pressure Cooker 5L',  category:'Home & Kitchen',qty:1, unit_price:3200,  payment:'Debit Card',  status:'Shipped',   gender:'Male',   age:41 },
    { customer:'Meera Joshi',   date:'2024-03-10', city:'Pune',      product:'Yoga Mat Pro',        category:'Sports',        qty:2, unit_price:2800,  payment:'Wallet',      status:'Delivered', gender:'Female', age:29 },
    { customer:'Rohan Gupta',   date:'2024-03-18', city:'Kolkata',   product:'JEE Prep Bundle',     category:'Books',         qty:4, unit_price:1200,  payment:'COD',         status:'Delivered', gender:'Male',   age:19 },
    { customer:'Ananya Das',    date:'2024-04-05', city:'Ahmedabad', product:'Face Serum Vitamin C', category:'Beauty',       qty:2, unit_price:1800,  payment:'UPI',         status:'Returned',  gender:'Female', age:26 },
    { customer:'Suresh Kumar',  date:'2024-04-20', city:'Jaipur',    product:'Smart TV 55"',        category:'Electronics',   qty:1, unit_price:55000, payment:'Credit Card', status:'Delivered', gender:'Male',   age:48 },
    { customer:'Divya Menon',   date:'2024-05-08', city:'Mumbai',    product:'Organic Rice 10kg',   category:'Grocery',       qty:3, unit_price:950,   payment:'UPI',         status:'Delivered', gender:'Female', age:33 },
    { customer:'Kartik Roy',    date:'2024-05-19', city:'Delhi',     product:'Bluetooth Headphones',category:'Electronics',   qty:1, unit_price:18000, payment:'Debit Card',  status:'Cancelled', gender:'Male',   age:22 },
    { customer:'Pooja Sharma',  date:'2024-06-01', city:'Bengaluru', product:'LEGO City Set',       category:'Toys',          qty:2, unit_price:5500,  payment:'Credit Card', status:'Delivered', gender:'Female', age:30 },
    { customer:'Arun Mishra',   date:'2024-06-14', city:'Lucknow',   product:'Dumbbell Set 20kg',   category:'Sports',        qty:1, unit_price:4200,  payment:'COD',         status:'Delivered', gender:'Male',   age:37 },
    { customer:'Kavya Iyer',    date:'2024-07-04', city:'Chennai',   product:'Ethnic Kurta Set',    category:'Fashion',       qty:3, unit_price:2200,  payment:'UPI',         status:'Delivered', gender:'Female', age:27 },
    { customer:'Nikhil Verma',  date:'2024-07-22', city:'Indore',    product:'Air Purifier 360',    category:'Home & Kitchen',qty:1, unit_price:12000, payment:'Net Banking', status:'Delivered', gender:'Male',   age:44 },
  ];

  samples.forEach(s => {
    MY_RECORDS.push({
      id:         Date.now() + Math.random(),
      region:     CITY_REGION[s.city] || 'Other',
      amount:     Math.round(s.unit_price * s.qty * 100) / 100,
      ...s,
    });
  });
  saveRecords();
  refreshEntryUI();
  showToast(`${samples.length} sample records loaded!`);
}

function refreshEntryUI() {
  const n = MY_RECORDS.length;
  document.getElementById('entry-record-count').textContent = `${n} record${n !== 1 ? 's' : ''} entered`;
  document.getElementById('sidebar-record-count').textContent =
    MODE === 'mydata' ? `${n} manual records` : `${DATA ? (DATA.dataset_info.total_orders/1000).toFixed(0)+'K' : '?'} records`;

  const analyzeBtn = document.getElementById('analyzeBtn');
  const hint       = document.getElementById('entryHint');
  analyzeBtn.disabled = n === 0;
  hint.textContent = n === 0
    ? 'Add at least 1 record to analyze'
    : `${n} record${n !== 1 ? 's' : ''} ready — click Analyze!`;

  // Update count badge
  const badge = document.getElementById('recordCountBadge');
  if (badge) badge.textContent = n;

  // Show/hide table
  const tableCard = document.getElementById('recordsTableCard');
  tableCard.style.display = n > 0 ? 'block' : 'none';

  // Render table
  renderRecordsTable();
}

function renderRecordsTable() {
  const tbody = document.getElementById('recordsTableBody');
  if (!tbody) return;
  tbody.innerHTML = MY_RECORDS.slice().reverse().map((r, idx) => {
    const total = (r.amount || r.unit_price * r.qty).toLocaleString('en-IN');
    return `
    <tr>
      <td>${MY_RECORDS.length - idx}</td>
      <td class="highlight">${r.customer}</td>
      <td>${r.date}</td>
      <td>${r.city}</td>
      <td>${r.product}</td>
      <td><span class="category-pill">${r.category}</span></td>
      <td>${r.qty}</td>
      <td class="highlight">₹${total}</td>
      <td>${r.payment}</td>
      <td><span class="status-pill status-${r.status}">${r.status}</span></td>
      <td><button class="del-btn" onclick="deleteRecord(${r.id})" title="Delete">✕</button></td>
    </tr>`;
  }).join('');
}

/* ══════════════════════════════════════════════════════════════════════════
   MY DATA ANALYTICS — Compute from MY_RECORDS
   ══════════════════════════════════════════════════════════════════════════ */
function analyzeMyData() {
  if (MY_RECORDS.length === 0) { showToast('No records to analyze!', 'error'); return; }

  // Build a DATA object in same shape as the JSON
  const D = computeMyDataAnalytics(MY_RECORDS);
  DATA = D;
  renderAll();
  activateSection('overview');
  showToast(`Analyzed ${MY_RECORDS.length} records!`);
}

function computeMyDataAnalytics(records) {
  const delivered = records.filter(r => r.status === 'Delivered');
  const totalRev  = delivered.reduce((s, r) => s + r.amount, 0);
  const totalOrd  = records.length;
  const delOrd    = delivered.length;
  const custSet   = new Set(records.map(r => r.customer));
  const totalQty  = records.reduce((s, r) => s + r.qty, 0);
  const aov       = delOrd ? totalRev / delOrd : 0;
  const returnRate = records.filter(r => r.status === 'Returned').length / totalOrd * 100;
  const cancelRate = records.filter(r => r.status === 'Cancelled').length / totalOrd * 100;

  // Monthly trend
  const monthMap = {};
  records.forEach(r => {
    const ym = r.date.slice(0, 7);
    if (!monthMap[ym]) monthMap[ym] = { revenue: 0, orders: 0 };
    if (r.status === 'Delivered') monthMap[ym].revenue += r.amount;
    monthMap[ym].orders++;
  });
  const sortedMonths = Object.keys(monthMap).sort();
  const monthLabels  = sortedMonths.map(m => {
    const [y, mo] = m.split('-');
    return new Date(+y, +mo - 1).toLocaleString('en-IN', { month: 'short', year: '2-digit' });
  });

  // MoM growth
  let momGrowth = 0;
  if (sortedMonths.length >= 2) {
    const last = monthMap[sortedMonths[sortedMonths.length - 1]].revenue;
    const prev = monthMap[sortedMonths[sortedMonths.length - 2]].revenue;
    momGrowth = prev ? Math.round(((last - prev) / prev) * 10000) / 100 : 0;
  }

  // Category
  const catMap = {};
  records.filter(r => r.status === 'Delivered').forEach(r => {
    if (!catMap[r.category]) catMap[r.category] = { revenue: 0, units: 0 };
    catMap[r.category].revenue += r.amount;
    catMap[r.category].units   += r.qty;
  });
  const catSorted = Object.entries(catMap).sort((a, b) => b[1].revenue - a[1].revenue);

  // Products (group by product name)
  const prodMap = {};
  records.filter(r => r.status === 'Delivered').forEach(r => {
    if (!prodMap[r.product]) prodMap[r.product] = { revenue: 0, units: 0, category: r.category };
    prodMap[r.product].revenue += r.amount;
    prodMap[r.product].units   += r.qty;
  });
  const prodSorted = Object.entries(prodMap).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 10);

  // Regional - cities
  const cityMap = {};
  records.filter(r => r.status === 'Delivered').forEach(r => {
    if (!cityMap[r.city]) cityMap[r.city] = { revenue: 0, orders: 0, region: r.region, customers: new Set() };
    cityMap[r.city].revenue += r.amount;
    cityMap[r.city].orders++;
    cityMap[r.city].customers.add(r.customer);
  });
  const citySorted = Object.entries(cityMap).sort((a, b) => b[1].revenue - a[1].revenue);

  // Regional - regions
  const regMap = {};
  records.filter(r => r.status === 'Delivered').forEach(r => {
    if (!regMap[r.region]) regMap[r.region] = { revenue: 0, orders: 0 };
    regMap[r.region].revenue += r.amount;
    regMap[r.region].orders++;
  });
  const regSorted = Object.entries(regMap).sort((a, b) => b[1].revenue - a[1].revenue);

  // Payment
  const pmMap = {};
  records.filter(r => r.status === 'Delivered').forEach(r => {
    if (!pmMap[r.payment]) pmMap[r.payment] = { count: 0, revenue: 0 };
    pmMap[r.payment].count++;
    pmMap[r.payment].revenue += r.amount;
  });
  const pmSorted = Object.entries(pmMap).sort((a, b) => b[1].count - a[1].count);

  // Status
  const stMap = {};
  records.forEach(r => { stMap[r.status] = (stMap[r.status] || 0) + 1; });

  // Quarterly
  const qMap = {};
  records.filter(r => r.status === 'Delivered').forEach(r => {
    const d = new Date(r.date);
    const q = `${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}`;
    if (!qMap[q]) qMap[q] = { revenue: 0, orders: 0 };
    qMap[q].revenue += r.amount;
    qMap[q].orders++;
  });
  const qSorted = Object.keys(qMap).sort();

  // Age groups
  const ageBins = [['18-24', 18, 25], ['25-34', 25, 35], ['35-44', 35, 45], ['45-54', 45, 55], ['55+', 55, 100]];
  const ageMap  = {};
  ageBins.forEach(([lbl]) => { ageMap[lbl] = { revenue: 0, orders: 0 }; });
  records.filter(r => r.status === 'Delivered').forEach(r => {
    const bin = ageBins.find(([, lo, hi]) => r.age >= lo && r.age < hi);
    if (bin) { ageMap[bin[0]].revenue += r.amount; ageMap[bin[0]].orders++; }
  });

  // Gender
  const genMap = {};
  records.filter(r => r.status === 'Delivered').forEach(r => {
    if (!genMap[r.gender]) genMap[r.gender] = { revenue: 0 };
    genMap[r.gender].revenue += r.amount;
  });

  // Simple RFM
  const custRecords = {};
  delivered.forEach(r => {
    if (!custRecords[r.customer]) custRecords[r.customer] = { last: r.date, freq: 0, monetary: 0 };
    custRecords[r.customer].freq++;
    custRecords[r.customer].monetary += r.amount;
    if (r.date > custRecords[r.customer].last) custRecords[r.customer].last = r.date;
  });
  const segCounts = { Champions: 0, 'Loyal Customers': 0, 'Potential Loyalists': 0, 'At Risk': 0, Lost: 0 };
  const segMoney  = { Champions: 0, 'Loyal Customers': 0, 'Potential Loyalists': 0, 'At Risk': 0, Lost: 0 };
  Object.values(custRecords).forEach(c => {
    const score = c.freq >= 5 ? 'Champions' : c.freq >= 3 ? 'Loyal Customers' : c.freq >= 2 ? 'Potential Loyalists' : c.monetary >= aov ? 'At Risk' : 'Lost';
    segCounts[score]++;
    segMoney[score] += c.monetary;
  });
  const rfmLabels = Object.keys(segCounts).filter(k => segCounts[k] > 0);
  const rfmCusts  = rfmLabels.map(k => segCounts[k]);
  const rfmAvg    = rfmLabels.map(k => segCounts[k] ? Math.round(segMoney[k] / segCounts[k]) : 0);

  // Assemble final DATA shape
  return {
    generated_at: new Date().toLocaleString('en-IN'),
    dataset_info: {
      total_customers: custSet.size,
      total_products:  new Set(records.map(r => r.product)).size,
      total_orders:    totalOrd,
      total_items:     totalQty,
      date_range: {
        start: records.map(r => r.date).sort()[0] || '—',
        end:   records.map(r => r.date).sort().reverse()[0] || '—',
      },
    },
    kpis: {
      total_revenue:    Math.round(totalRev * 100) / 100,
      total_orders:     delOrd,
      unique_customers: custSet.size,
      avg_order_value:  Math.round(aov * 100) / 100,
      total_items_sold: totalQty,
      mom_growth:       momGrowth,
      return_rate:      Math.round(returnRate * 100) / 100,
      cancellation_rate: Math.round(cancelRate * 100) / 100,
    },
    monthly_trend: {
      labels:  monthLabels,
      revenue: sortedMonths.map(m => Math.round(monthMap[m].revenue * 100) / 100),
      orders:  sortedMonths.map(m => monthMap[m].orders),
    },
    category: {
      labels:  catSorted.map(([k]) => k),
      revenue: catSorted.map(([, v]) => Math.round(v.revenue * 100) / 100),
      units:   catSorted.map(([, v]) => v.units),
      profit:  catSorted.map(([, v]) => Math.round(v.revenue * 0.38 * 100) / 100), // ~38% margin estimate
    },
    top_products: {
      labels:   prodSorted.map(([k]) => k),
      revenue:  prodSorted.map(([, v]) => Math.round(v.revenue * 100) / 100),
      units:    prodSorted.map(([, v]) => v.units),
      category: prodSorted.map(([, v]) => v.category),
      rating:   prodSorted.map(() => (Math.random() * 1.5 + 3.5).toFixed(1)),
    },
    regional: {
      cities: {
        labels:    citySorted.map(([k]) => k),
        states:    citySorted.map(([k]) => k),
        regions:   citySorted.map(([, v]) => v.region),
        revenue:   citySorted.map(([, v]) => Math.round(v.revenue * 100) / 100),
        orders:    citySorted.map(([, v]) => v.orders),
        customers: citySorted.map(([, v]) => v.customers.size),
      },
      regions: {
        labels:  regSorted.map(([k]) => k),
        revenue: regSorted.map(([, v]) => Math.round(v.revenue * 100) / 100),
        orders:  regSorted.map(([, v]) => v.orders),
      },
    },
    payment_methods: {
      labels:  pmSorted.map(([k]) => k),
      count:   pmSorted.map(([, v]) => v.count),
      revenue: pmSorted.map(([, v]) => Math.round(v.revenue * 100) / 100),
    },
    rfm: {
      labels:       rfmLabels,
      customers:    rfmCusts,
      avg_monetary: rfmAvg,
      total_segments: rfmLabels.length,
    },
    quarterly: {
      labels:  qSorted,
      revenue: qSorted.map(q => Math.round(qMap[q].revenue * 100) / 100),
      orders:  qSorted.map(q => qMap[q].orders),
    },
    demographics: {
      age: {
        labels:  ageBins.map(([l]) => l),
        revenue: ageBins.map(([l]) => Math.round((ageMap[l]?.revenue || 0) * 100) / 100),
        orders:  ageBins.map(([l]) => ageMap[l]?.orders || 0),
      },
      gender: {
        labels:  Object.keys(genMap),
        revenue: Object.values(genMap).map(v => Math.round(v.revenue * 100) / 100),
      },
    },
    order_status: {
      labels: Object.keys(stMap),
      counts: Object.values(stMap),
    },
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   RENDER ALL CHARTS
   ══════════════════════════════════════════════════════════════════════════ */
function renderAll() {
  if (!DATA) return;
  renderMeta();
  renderKPIs();
  renderStatusChart();
  renderQuarterlyChart();
  renderMonthlyChart();
  renderCategoryDonut();
  renderCategoryBar();
  renderTopProducts();
  renderProductsTable();
  renderRegionChart();
  renderCityChart();
  renderCityCards();
  renderRFMChart();
  renderAgeChart();
  renderGenderChart();
  renderRFMTable();
  renderPaymentCharts();
  setupNav();

  document.getElementById('loadingOverlay').style.display = 'none';
  document.getElementById('dashboardBody').style.display  = 'flex';

  document.querySelectorAll('.kpi-card').forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    setTimeout(() => {
      el.style.transition = 'opacity 0.45s ease, transform 0.45s ease';
      el.style.opacity    = '1';
      el.style.transform  = 'translateY(0)';
    }, i * 90);
  });
}

// ─── Meta ─────────────────────────────────────────────────────────────────
function renderMeta() {
  const di = DATA.dataset_info;
  const dr = di.date_range;
  document.getElementById('generated-at').textContent =
    MODE === 'mydata'
      ? `My Data · ${di.total_orders} records · Analyzed: ${DATA.generated_at}`
      : `Generated: ${DATA.generated_at}`;
  document.getElementById('date-range-badge').textContent =
    `📅 ${dr.start} → ${dr.end}`;
  document.getElementById('sidebar-record-count').textContent =
    MODE === 'mydata'
      ? `${MY_RECORDS.length} manual records`
      : `${(di.total_orders / 1000).toFixed(0)}K records`;
}

// ─── KPIs ─────────────────────────────────────────────────────────────────
function renderKPIs() {
  const k = DATA.kpis;
  document.getElementById('kpi-revenue').textContent  = fmt(k.total_revenue);
  const momEl = document.getElementById('kpi-mom');
  momEl.textContent = pct(k.mom_growth) + ' vs last month';
  momEl.className   = 'kpi-trend ' + (k.mom_growth >= 0 ? 'positive' : 'negative');
  document.getElementById('kpi-orders').textContent   = fmtNum(k.total_orders);
  document.getElementById('kpi-items').textContent    = fmtNum(k.total_items_sold) + ' items sold';
  document.getElementById('kpi-customers').textContent= fmtNum(k.unique_customers);
  document.getElementById('kpi-aov').textContent      = fmt(k.avg_order_value, 0);
  document.getElementById('kpi-return').textContent   = k.return_rate + '%';
  document.getElementById('kpi-cancel').textContent   = k.cancellation_rate + '% cancellation';
}

// ─── Order Status ──────────────────────────────────────────────────────────
function renderStatusChart() {
  destroyChart('status');
  const d = DATA.order_status;
  CHARTS.status = new Chart(document.getElementById('statusChart').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: d.labels,
      datasets: [{ data: d.counts, backgroundColor: ['#10b981','#3b82f6','#f59e0b','#f43f5e'], borderWidth: 2, borderColor: '#191c25' }]
    },
    options: {
      cutout: '68%',
      plugins: {
        legend: { display: true, position: 'right', labels: { padding: 14, boxWidth: 12, font: { size: 11 } } },
        tooltip: { callbacks: { label: c => ` ${c.label}: ${c.raw.toLocaleString('en-IN')} orders` } }
      }
    }
  });
}

// ─── Quarterly ────────────────────────────────────────────────────────────
function renderQuarterlyChart() {
  destroyChart('quarterly');
  const d = DATA.quarterly;
  if (!d.labels.length) return;
  CHARTS.quarterly = new Chart(document.getElementById('quarterlyChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: d.labels,
      datasets: [{ data: d.revenue, backgroundColor: PALETTE.map(c => c + 'cc'), borderRadius: 6, borderSkipped: false }]
    },
    options: {
      plugins: { tooltip: { callbacks: { label: c => fmt(c.raw) } } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { callback: v => fmt(v) } }
      }
    }
  });
}

// ─── Monthly Trend ────────────────────────────────────────────────────────
function renderMonthlyChart() {
  destroyChart('monthly');
  const d   = DATA.monthly_trend;
  if (!d.labels.length) return;
  const ctx = document.getElementById('monthlyChart').getContext('2d');
  CHARTS.monthly = new Chart(ctx, {
    type: 'line',
    data: {
      labels: d.labels,
      datasets: [
        { label: 'Revenue', data: d.revenue, borderColor: '#6366f1', backgroundColor: makeGradient(ctx, GRADIENT_CONFIG.indigo), fill: true, tension: 0.42, pointRadius: 4, pointHoverRadius: 7, borderWidth: 2.5, yAxisID: 'y' },
        { label: 'Orders',  data: d.orders,  borderColor: '#f59e0b', backgroundColor: makeGradient(ctx, GRADIENT_CONFIG.amber),  fill: true, tension: 0.42, pointRadius: 4, pointHoverRadius: 7, borderWidth: 2,   yAxisID: 'y1' }
      ]
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      plugins: { tooltip: { callbacks: { label: c => c.datasetIndex === 0 ? ` Revenue: ${fmt(c.raw)}` : ` Orders: ${c.raw.toLocaleString('en-IN')}` } } },
      scales: {
        x:  { grid: { display: false }, ticks: { maxTicksLimit: 12, font: { size: 10 }, maxRotation: 45 } },
        y:  { position: 'left',  grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { callback: v => fmt(v) } },
        y1: { position: 'right', grid: { display: false }, ticks: { callback: v => fmtNum(v) } }
      }
    }
  });
}

// ─── Category Donut ───────────────────────────────────────────────────────
function renderCategoryDonut() {
  destroyChart('catDonut');
  const d = DATA.category;
  if (!d.labels.length) return;
  CHARTS.catDonut = new Chart(document.getElementById('categoryDonutChart').getContext('2d'), {
    type: 'doughnut',
    data: { labels: d.labels, datasets: [{ data: d.revenue, backgroundColor: PALETTE, borderWidth: 2, borderColor: '#191c25' }] },
    options: {
      cutout: '62%',
      plugins: {
        legend: { display: true, position: 'right', labels: { padding: 12, boxWidth: 12, font: { size: 11 } } },
        tooltip: { callbacks: { label: c => { const t = d.revenue.reduce((a,b)=>a+b,0); return ` ${c.label}: ${fmt(c.raw)} (${((c.raw/t)*100).toFixed(1)}%)`; } } }
      }
    }
  });
}

// ─── Category Bar ─────────────────────────────────────────────────────────
function renderCategoryBar() {
  destroyChart('catBar');
  const d = DATA.category;
  if (!d.labels.length) return;
  CHARTS.catBar = new Chart(document.getElementById('categoryBarChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: d.labels,
      datasets: [
        { label: 'Revenue', data: d.revenue, backgroundColor: '#6366f1cc', borderRadius: 5, borderSkipped: false },
        { label: 'Profit',  data: d.profit,  backgroundColor: '#10b981cc', borderRadius: 5, borderSkipped: false }
      ]
    },
    options: {
      plugins: { legend: { display: true, labels: { padding: 14, boxWidth: 12, font: { size: 11 } } }, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${fmt(c.raw)}` } } },
      scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { callback: v => fmt(v) } } }
    }
  });
}

// ─── Top Products ─────────────────────────────────────────────────────────
function renderTopProducts() {
  destroyChart('topProds');
  const d = DATA.top_products;
  if (!d.labels.length) return;
  CHARTS.topProds = new Chart(document.getElementById('topProductsChart').getContext('2d'), {
    type: 'bar',
    data: { labels: d.labels, datasets: [{ data: d.revenue, backgroundColor: PALETTE.map(c => c + 'dd'), borderRadius: 6, borderSkipped: false }] },
    options: {
      indexAxis: 'y',
      plugins: { tooltip: { callbacks: { label: c => ` Revenue: ${fmt(c.raw)}` } } },
      scales: { x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { callback: v => fmt(v) } }, y: { grid: { display: false } } }
    }
  });
}

// ─── Products Table ───────────────────────────────────────────────────────
function renderProductsTable() {
  const d = DATA.top_products;
  document.getElementById('productsTableBody').innerHTML = d.labels.map((name, i) => `
    <tr>
      <td>${i + 1}</td>
      <td class="highlight">${name}</td>
      <td><span class="category-pill">${d.category[i]}</span></td>
      <td class="highlight">${fmt(d.revenue[i])}</td>
      <td>${d.units[i].toLocaleString('en-IN')}</td>
    </tr>
  `).join('');
}

// ─── Regional ─────────────────────────────────────────────────────────────
function renderRegionChart() {
  destroyChart('region');
  const d = DATA.regional.regions;
  if (!d.labels.length) return;
  CHARTS.region = new Chart(document.getElementById('regionChart').getContext('2d'), {
    type: 'polarArea',
    data: { labels: d.labels, datasets: [{ data: d.revenue, backgroundColor: PALETTE.slice(0, d.labels.length).map(c => c + 'cc'), borderWidth: 2, borderColor: '#191c25' }] },
    options: {
      plugins: { legend: { display: true, position: 'right', labels: { padding: 12, boxWidth: 12, font: { size: 11 } } }, tooltip: { callbacks: { label: c => ` ${c.label}: ${fmt(c.raw)}` } } },
      scales: { r: { grid: { color: 'rgba(255,255,255,0.07)' }, ticks: { display: false } } }
    }
  });
}

function renderCityChart() {
  destroyChart('city');
  const d = DATA.regional.cities;
  if (!d.labels.length) return;
  CHARTS.city = new Chart(document.getElementById('cityChart').getContext('2d'), {
    type: 'bar',
    data: { labels: d.labels.slice(0, 10), datasets: [{ data: d.revenue.slice(0, 10), backgroundColor: PALETTE.map(c => c + 'cc'), borderRadius: 6, borderSkipped: false }] },
    options: {
      indexAxis: 'y',
      plugins: { tooltip: { callbacks: { label: c => ` ${fmt(c.raw)}` } } },
      scales: { x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { callback: v => fmt(v) } }, y: { grid: { display: false } } }
    }
  });
}

function renderCityCards() {
  const d = DATA.regional.cities;
  document.getElementById('cityCardsGrid').innerHTML = d.labels.slice(0, 10).map((city, i) => `
    <div class="city-card animate-in">
      <div class="city-rank">#${i + 1} City</div>
      <div class="city-name">${city}</div>
      <div class="city-state">${d.regions[i]} Region</div>
      <div class="city-revenue">${fmt(d.revenue[i])}</div>
      <div class="city-orders">${d.orders[i].toLocaleString('en-IN')} orders · ${d.customers[i].toLocaleString('en-IN')} customers</div>
    </div>
  `).join('');
}

// ─── RFM ──────────────────────────────────────────────────────────────────
function renderRFMChart() {
  destroyChart('rfm');
  const d = DATA.rfm;
  if (!d.labels.length) return;
  CHARTS.rfm = new Chart(document.getElementById('rfmChart').getContext('2d'), {
    type: 'doughnut',
    data: { labels: d.labels, datasets: [{ data: d.customers, backgroundColor: ['#6366f1','#10b981','#f59e0b','#ec4899','#3b82f6'], borderWidth: 2, borderColor: '#191c25' }] },
    options: {
      cutout: '60%',
      plugins: {
        legend: { display: true, position: 'right', labels: { padding: 12, boxWidth: 12, font: { size: 11 } } },
        tooltip: { callbacks: { label: c => { const total = d.customers.reduce((a,b)=>a+b,0); return ` ${c.label}: ${c.raw.toLocaleString()} (${((c.raw/total)*100).toFixed(1)}%)`; } } }
      }
    }
  });
}

// ─── Age / Gender ─────────────────────────────────────────────────────────
function renderAgeChart() {
  destroyChart('age');
  const d = DATA.demographics.age;
  const ctx = document.getElementById('ageChart').getContext('2d');
  CHARTS.age = new Chart(ctx, {
    type: 'bar',
    data: { labels: d.labels, datasets: [{ data: d.revenue, backgroundColor: makeGradient(ctx, GRADIENT_CONFIG.emerald), borderRadius: 8, borderSkipped: false }] },
    options: {
      plugins: { tooltip: { callbacks: { label: c => ` ${fmt(c.raw)}` } } },
      scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { callback: v => fmt(v) } } }
    }
  });
}

function renderGenderChart() {
  destroyChart('gender');
  const d = DATA.demographics.gender;
  if (!d.labels.length) return;
  CHARTS.gender = new Chart(document.getElementById('genderChart').getContext('2d'), {
    type: 'doughnut',
    data: { labels: d.labels, datasets: [{ data: d.revenue, backgroundColor: ['#6366f1','#ec4899'], borderWidth: 2, borderColor: '#191c25' }] },
    options: {
      cutout: '65%',
      plugins: {
        legend: { display: true, position: 'right', labels: { padding: 14, boxWidth: 12, font: { size: 12 } } },
        tooltip: { callbacks: { label: c => ` ${c.label}: ${fmt(c.raw)}` } }
      }
    }
  });
}

// ─── RFM Table ────────────────────────────────────────────────────────────
function renderRFMTable() {
  const d = DATA.rfm;
  const total = d.customers.reduce((a, b) => a + b, 0);
  const colors = ['#a5b4fc','#34d399','#fbbf24','#f472b6','#60a5fa'];
  document.getElementById('rfmTableBody').innerHTML = d.labels.map((seg, i) => `
    <tr>
      <td style="color:${colors[i]};font-weight:600">${seg}</td>
      <td class="highlight">${d.customers[i].toLocaleString('en-IN')}</td>
      <td>${fmt(d.avg_monetary[i])}</td>
      <td>
        <div style="background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden;height:6px;width:100%;min-width:80px">
          <div style="background:${colors[i]};height:100%;width:${((d.customers[i]/total)*100).toFixed(1)}%;border-radius:4px"></div>
        </div>
        <span style="font-size:0.72rem;color:var(--text-muted)">${((d.customers[i]/total)*100).toFixed(1)}%</span>
      </td>
    </tr>
  `).join('');
}

// ─── Payment Charts ───────────────────────────────────────────────────────
function renderPaymentCharts() {
  destroyChart('pmOrders'); destroyChart('pmRevenue');
  const d = DATA.payment_methods;
  if (!d.labels.length) return;

  CHARTS.pmOrders = new Chart(document.getElementById('paymentOrdersChart').getContext('2d'), {
    type: 'bar',
    data: { labels: d.labels, datasets: [{ data: d.count, backgroundColor: PALETTE.map(c => c + 'cc'), borderRadius: 7, borderSkipped: false }] },
    options: {
      plugins: { tooltip: { callbacks: { label: c => ` ${c.raw.toLocaleString('en-IN')} orders` } } },
      scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { callback: v => fmtNum(v) } } }
    }
  });

  CHARTS.pmRevenue = new Chart(document.getElementById('paymentRevenueChart').getContext('2d'), {
    type: 'doughnut',
    data: { labels: d.labels, datasets: [{ data: d.revenue, backgroundColor: PALETTE.slice(0, d.labels.length), borderWidth: 2, borderColor: '#191c25' }] },
    options: {
      cutout: '58%',
      plugins: {
        legend: { display: true, position: 'right', labels: { padding: 12, boxWidth: 12, font: { size: 11 } } },
        tooltip: { callbacks: { label: c => ` ${c.label}: ${fmt(c.raw)}` } }
      }
    }
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   SIDEBAR NAVIGATION
   ══════════════════════════════════════════════════════════════════════════ */
const SECTION_MAP = {
  entry:    'section-entry',
  overview: 'section-overview',
  sales:    'section-sales',
  products: 'section-products',
  regional: 'section-regional',
  customers:'section-customers',
  payments: 'section-payments',
};

function setupNav() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      activateSection(item.dataset.section);
    });
  });
}

function activateSection(sec) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const active = document.querySelector(`[data-section="${sec}"]`);
  if (active) active.classList.add('active');
  Object.entries(SECTION_MAP).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (el) el.style.display = (key === sec) ? 'flex' : 'none';
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
  // Set default date to today
  document.getElementById('f-date').value = new Date().toISOString().split('T')[0];

  // Load stored records from localStorage
  loadStoredRecords();

  // Default: sample data mode
  loadData();
});
