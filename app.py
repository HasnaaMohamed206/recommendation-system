from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
import pandas as pd
import numpy as np
import gdown
import os

app = Flask(__name__, static_folder='.', template_folder='.')
CORS(app)

# ============================================================
# GLOBAL VARIABLES FOR PREDICTION MODEL
# ============================================================

_kmeans_model = None
_scaler = None
_cluster_to_segment = {}

# ============================================================
# DATA LOADING - Connects to your notebook data
# ============================================================

def load_and_process_data():
    """
    Load data from Google Drive and process it.
    This function replicates your notebook preprocessing.
    """
    
    # Download data from Google Drive
    file_id = '1esY-i8CZ53Rb4YsH-PX2Pdotc181K6ta'
    url = f'https://drive.google.com/uc?id={file_id}'
    output = 'online_retail.csv'
    
    if not os.path.exists(output):
        print("Downloading data...")
        gdown.download(url, output, quiet=False)
    
    # Load data
    df = pd.read_csv(output, encoding='ISO-8859-1')
    
    # Basic cleaning (from your notebook)
    df = df.dropna(subset=['CustomerID'])
    df['CustomerID'] = df['CustomerID'].astype(int)
    df['InvoiceDate'] = pd.to_datetime(df['InvoiceDate'])
    df = df[df['Quantity'] > 0]
    df = df[df['UnitPrice'] > 0]
    df['Total_Price'] = df['Quantity'] * df['UnitPrice']
    
    return df


def calculate_rfm(df):
    snapshot_date = df['InvoiceDate'].max() + pd.Timedelta(days=1)
    
    rfm = df.groupby('CustomerID').agg({
        'InvoiceDate': lambda x: (snapshot_date - x.max()).days,  # Recency
        'InvoiceNo': 'nunique',                                   # Frequency
        'Total_Price': 'sum'                                      # Monetary
    }).reset_index()
    
    rfm.columns = ['CustomerID', 'Recency', 'Frequency', 'Monetary']
    
    return rfm


def perform_clustering(rfm):
    """
    Perform K-Means clustering on RFM data.
    Saves the model and scaler for prediction.
    """
    global _kmeans_model, _scaler, _cluster_to_segment
    
    from sklearn.preprocessing import StandardScaler
    from sklearn.cluster import KMeans
    
    # Scale data
    _scaler = StandardScaler()
    rfm_scaled = _scaler.fit_transform(rfm[['Recency', 'Frequency', 'Monetary']])
    
    # K-Means with 5 clusters
    _kmeans_model = KMeans(n_clusters=3, random_state=42, n_init=10)
    rfm['Cluster'] = _kmeans_model.fit_predict(rfm_scaled)
    
    # Map clusters to segment names based on monetary value
    cluster_stats = rfm.groupby('Cluster')['Monetary'].mean().sort_values(ascending=False)
    segment_names = ['High-value Customers' , 'Seasonal Customers' , 'Low-engagement Customers']
    
    for i, cluster_id in enumerate(cluster_stats.index):
        _cluster_to_segment[cluster_id] = segment_names[i]
    
    print("Prediction model initialized successfully!")
    
    return rfm


def get_segment_names(cluster_stats):
    """
    Assign meaningful names to clusters based on RFM characteristics.
    """
    segments = []
    colors = ['#10b981', '#f59e0b', '#ef4444']
    names = ['High-value Customers' , 'Seasonal Customers' , 'Low-engagement Customers']
    descriptions = [
        'Best customers - High spend & frequent purchases',
        'Regular customers with good spending',
        'Promising new customers',
        'Former customers needing re-engagement',
        'Inactive for a long time'
    ]
    
    # Sort clusters by monetary value (descending)
    sorted_clusters = cluster_stats.sort_values('Monetary', ascending=False).reset_index()
    
    for i, row in sorted_clusters.iterrows():
        segments.append({
            'name': names[i],
            'count': int(row['count']),
            'avgSpend': round(row['Monetary'], 2),
            'frequency': round(row['Frequency'], 1),
            'recency': round(row['Recency'], 0),
            'description': descriptions[i],
            'color': colors[i]
        })
    
    return segments


# Cache for processed data
_cached_data = None

def get_dashboard_data():
    """
    Main function to get all dashboard data.
    Uses caching to avoid reprocessing on each request.
    """
    global _cached_data
    
    if _cached_data is not None:
        return _cached_data
    
    try:
        # Load and process data
        df = load_and_process_data()
        
        # Calculate KPIs
        total_customers = df['CustomerID'].nunique()
        total_sales = df['Total_Price'].sum()
        total_transactions = df['InvoiceNo'].nunique()
        avg_order_value = df.groupby('InvoiceNo')['Total_Price'].sum().mean()
        
        # RFM Analysis
        rfm = calculate_rfm(df)
        rfm = perform_clustering(rfm)
        
        # Cluster statistics
        cluster_stats = rfm.groupby('Cluster').agg({
            'CustomerID': 'count',
            'Recency': 'mean',
            'Frequency': 'mean',
            'Monetary': 'mean'
        }).rename(columns={'CustomerID': 'count'})
        
        segments = get_segment_names(cluster_stats)
        
        # Sales by Country
        country_sales = df.groupby('Country')['Total_Price'].sum().sort_values(ascending=False)
        top_countries = country_sales.head(5)
        others = country_sales[5:].sum()
        
        country_data = [{'country': c, 'sales': round(s, 2), 'percentage': round(s/total_sales*100, 1)} 
                    for c, s in top_countries.items()]
        if others > 0:
            country_data.append({'country': 'Others', 'sales': round(others, 2), 
                                'percentage': round(others/total_sales*100, 1)})
        
        # Monthly Sales
        df['Month'] = df['InvoiceDate'].dt.to_period('M')
        monthly = df.groupby('Month')['Total_Price'].sum()
        month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        monthly_data = [{'month': month_names[i], 'sales': round(s, 2)} 
                        for i, s in enumerate(monthly.values[-12:])]
        
        # Top Products
        top_products = df.groupby('Description').agg({
            'Quantity': 'sum',
            'Total_Price': 'sum'
        }).sort_values('Total_Price', ascending=False).head(5)
        
        products_data = [{'name': name, 'quantity': int(row['Quantity']), 
                            'sales': round(row['Total_Price'], 2)}
                        for name, row in top_products.iterrows()]
        
        # Compile all data
        _cached_data = {
            'totalCustomers': total_customers,
            'totalSales': round(total_sales, 2),
            'avgOrderValue': round(avg_order_value, 2),
            'totalTransactions': total_transactions,
            'segments': segments,
            'countrySales': country_data,
            'monthlySales': monthly_data,
            'topProducts': products_data
        }
        
        return _cached_data
        
    except Exception as e:
        print(f"Error processing data: {e}")
        raise e


# ============================================================
# ROUTES
# ============================================================

@app.route('/')
@app.route('/index.html')
def index():
    """Serve the main dashboard page."""
    return send_from_directory('.', 'index.html')


@app.route('/style.css')
def styles():
    """Serve CSS file."""
    return send_from_directory('.', 'style.css')


@app.route('/script.js')
def script():
    """Serve JavaScript file."""
    return send_from_directory('.', 'script.js')


@app.route('/prediction.html')
def prediction_page():
    """Serve the prediction page."""
    return send_from_directory('.', 'prediction.html')


@app.route('/prediction.css')
def prediction_styles():
    """Serve prediction CSS file."""
    return send_from_directory('.', 'prediction.css')


@app.route('/prediction.js')
def prediction_script():
    """Serve prediction JavaScript file."""
    return send_from_directory('.', 'prediction.js')


@app.route('/api/dashboard-data')
def dashboard_data():
    """API endpoint - All dashboard data."""
    data = get_dashboard_data()
    return jsonify(data)


@app.route('/api/segments')
def segments():
    """API endpoint - Customer segments only."""
    data = get_dashboard_data()
    return jsonify(data['segments'])


@app.route('/api/sales')
def sales():
    """API endpoint - Sales data."""
    data = get_dashboard_data()
    return jsonify({
        'monthly': data['monthlySales'],
        'byCountry': data['countrySales']
    })


@app.route('/api/products')
def products():
    """API endpoint - Top products."""
    data = get_dashboard_data()
    return jsonify(data['topProducts'])


@app.route('/api/kpis')
def kpis():
    """API endpoint - KPIs only."""
    data = get_dashboard_data()
    return jsonify({
        'totalCustomers': data['totalCustomers'],
        'totalSales': data['totalSales'],
        'avgOrderValue': data['avgOrderValue'],
        'totalTransactions': data['totalTransactions']
    })


# ============================================================
# PREDICTION API
# ============================================================

@app.route('/api/predict', methods=['POST'])
def predict_segment():
    """
    API endpoint for predicting customer segment.
    
    Input JSON:
    {
        "recency": 30,
        "frequency": 15,
        "monetary": 1500
    }
    
    Output JSON:
    {
        "segment": "Champions",
        "confidence": 0.92,
        "cluster": 0
    }
    """
    global _kmeans_model, _scaler, _cluster_to_segment
    
    if _kmeans_model is None:
        get_dashboard_data()
    
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    recency = data.get('recency')
    frequency = data.get('frequency')
    monetary = data.get('monetary')
    
    if recency is None or frequency is None or monetary is None:
        return jsonify({'error': 'Missing required fields: recency, frequency, monetary'}), 400
    
    try:
        input_data = np.array([[float(recency), float(frequency), float(monetary)]])
        
        input_scaled = _scaler.transform(input_data)
        
        cluster = _kmeans_model.predict(input_scaled)[0]
        
        # =====================================================
        # BUSINESS SCORE LOGIC
        # =====================================================

        score = (
            (frequency * 0.4) +
            (monetary * 0.01) -
            (recency * 0.3)
        )

        if recency > 90 or frequency <= 10:
            segment = 'Low-engagement Customers'
            confidence = 0.90

        elif frequency >= 35 and monetary >= 3000 and recency <= 50:
            segment = 'High-value Customers'
            confidence = 0.95

        else:
            segment = 'Seasonal Customers'
            confidence = 0.85

        confidence += min(score / 1000, 0.04)

        confidence = round(min(max(confidence, 0.60), 0.99), 2)
        
        return jsonify({
            'segment': segment,
            'confidence': confidence,
            'cluster': int(cluster)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================================
# MAIN
# ============================================================

if __name__ == '__main__':
    print("\n" + "=" * 60)
    print("  Customer Segmentation Dashboard")
    print("=" * 60)
    print("\n  Dashboard running at: http://localhost:5500")
    print("\n  Pages:")
    print("    /                  - Main Dashboard")
    print("    /prediction.html   - Customer Prediction")
    print("\n  API Endpoints:")
    print("    GET  /api/dashboard-data  - All dashboard data")
    print("    GET  /api/segments        - Customer segments")
    print("    GET  /api/sales           - Sales data")
    print("    GET  /api/products        - Top products")
    print("    GET  /api/kpis            - KPIs")
    print("    POST /api/predict         - Predict customer segment")
    print("\n" + "=" * 60 + "\n")
    
    app.run(debug=True, port=5500)