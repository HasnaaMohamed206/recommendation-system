let dashboardData = null;

const API_BASE_URL = 'http://localhost:5500';

document.addEventListener('DOMContentLoaded', function() {
    fetchDashboardData();
});

async function fetchDashboardData() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/dashboard-data`);
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }
        dashboardData = await response.json();
        initializeDashboard();
    } catch (error) {
        console.error('Error fetching data from Flask API:', error);
        console.error('Make sure Flask is running on port 5500!');
        showError(error);
    }
}

function showError(error) {
    const mainContent = document.querySelector('.main-content');
    mainContent.innerHTML = `
        <div style="padding: 40px; text-align: center; color: #ef4444;">
            <h2>Error Loading Data</h2>
            <p>Failed to fetch data from Flask API.</p>
            <p style="color: #999; margin-top: 20px;">Make sure:</p>
            <ul style="text-align: left; display: inline-block; color: #999;">
                <li>Flask app is running (python app.py)</li>
                <li>Port 5500 is not blocked</li>
                <li>All files are in the same directory</li>
            </ul>
            <p style="margin-top: 20px; color: #999;">Error details: ${error.message}</p>
        </div>
    `;
}

function initializeDashboard() {
    setCurrentDate();
    updateKPIs();
    createClusterChart();
    createCountryChart();
    createRFMChart();
    createSalesChart();
    populateSegmentsTable();
    populateTopProducts();
}

function setCurrentDate() {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const date = new Date().toLocaleDateString('en-US', options);
    document.getElementById('current-date').textContent = date;
}

function updateKPIs() {
    animateCounter('total-customers', 0, dashboardData.totalCustomers, 2000, '', 0);
    animateCounter('total-sales', 0, dashboardData.totalSales / 1000000, 2000, 'M', 1, '$');
    animateCounter('avg-order', 0, dashboardData.avgOrderValue, 2000, '', 0, '$');
    animateCounter('total-transactions', 0, dashboardData.totalTransactions / 1000, 2000, 'K', 0);
}

function animateCounter(elementId, start, end, duration, suffix = '', decimals = 0, prefix = '') {
    const element = document.getElementById(elementId);
    const range = end - start;
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const current = start + (range * easeProgress);
        
        let formattedValue = current.toFixed(decimals);
        formattedValue = formattedValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        element.textContent = prefix + formattedValue + suffix;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

function createClusterChart() {
    const ctx = document.getElementById('clusterChart').getContext('2d');
    
    const data = {
        labels: dashboardData.segments.map(s => s.name),
        datasets: [{
            data: dashboardData.segments.map(s => s.count),
            backgroundColor: dashboardData.segments.map(s => s.color),
            borderColor: 'transparent',
            borderWidth: 0,
            hoverOffset: 8
        }]
    };
    
    new Chart(ctx, {
        type: 'doughnut',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#a0a0b0',
                        font: {
                            family: 'Inter',
                            size: 12
                        },
                        padding: 16,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: '#1c1c28',
                    titleFont: { family: 'Inter', size: 14 },
                    bodyFont: { family: 'Inter', size: 12 },
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.raw / total) * 100).toFixed(1);
                            return `${context.raw.toLocaleString()} customers (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function createCountryChart() {
    const ctx = document.getElementById('countryChart').getContext('2d');
    
    const data = {
        labels: dashboardData.countrySales.map(c => c.country),
        datasets: [{
            data: dashboardData.countrySales.map(c => c.sales),
            backgroundColor: [
                '#3b82f6',
                '#8b5cf6',
                '#ec4899',
                '#f59e0b',
                '#10b981',
                '#6b7280'
            ],
            borderRadius: 6,
            barThickness: 24
        }]
    };
    
    new Chart(ctx, {
        type: 'bar',
        data: data,
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1c1c28',
                    titleFont: { family: 'Inter', size: 14 },
                    bodyFont: { family: 'Inter', size: 12 },
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            return '$' + context.raw.toLocaleString();
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: '#2a2a3a', drawBorder: false },
                    ticks: {
                        color: '#6b6b7b',
                        font: { family: 'Inter', size: 11 },
                        callback: function(value) {
                            return '$' + (value / 1000000).toFixed(1) + 'M';
                        }
                    }
                },
                y: {
                    grid: { display: false },
                    ticks: {
                        color: '#a0a0b0',
                        font: { family: 'Inter', size: 12 }
                    }
                }
            }
        }
    });
}

function createRFMChart() {
    const ctx = document.getElementById('rfmChart').getContext('2d');
    
    const normalizedData = dashboardData.segments.slice(0, 4).map(segment => ({
        label: segment.name,
        data: [
            100 - (segment.recency / 180 * 100),
            (segment.frequency / 30 * 100),
            (segment.avgSpend / 2500 * 100)
        ],
        color: segment.color
    }));
    
    const data = {
        labels: ['Recency', 'Frequency', 'Monetary'],
        datasets: normalizedData.map(d => ({
            label: d.label,
            data: d.data,
            backgroundColor: d.color + '30',
            borderColor: d.color,
            borderWidth: 2,
            pointBackgroundColor: d.color,
            pointBorderColor: '#fff',
            pointBorderWidth: 1,
            pointRadius: 4
        }))
    };
    
    new Chart(ctx, {
        type: 'radar',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#a0a0b0',
                        font: { family: 'Inter', size: 11 },
                        padding: 16,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: '#1c1c28',
                    titleFont: { family: 'Inter', size: 14 },
                    bodyFont: { family: 'Inter', size: 12 },
                    padding: 12,
                    cornerRadius: 8
                }
            },
            scales: {
                r: {
                    angleLines: { color: '#2a2a3a' },
                    grid: { color: '#2a2a3a' },
                    pointLabels: {
                        color: '#a0a0b0',
                        font: { family: 'Inter', size: 11 }
                    },
                    ticks: {
                        color: '#6b6b7b',
                        backdropColor: 'transparent',
                        font: { size: 10 }
                    },
                    suggestedMin: 0,
                    suggestedMax: 100
                }
            }
        }
    });
}

function createSalesChart() {
    const ctx = document.getElementById('salesChart').getContext('2d');
    
    const gradient = ctx.createLinearGradient(0, 0, 0, 280);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
    
    const data = {
        labels: dashboardData.monthlySales.map(m => m.month),
        datasets: [{
            label: 'Sales',
            data: dashboardData.monthlySales.map(m => m.sales),
            fill: true,
            backgroundColor: gradient,
            borderColor: '#3b82f6',
            borderWidth: 3,
            tension: 0.4,
            pointBackgroundColor: '#3b82f6',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
        }]
    };
    
    new Chart(ctx, {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1c1c28',
                    titleFont: { family: 'Inter', size: 14 },
                    bodyFont: { family: 'Inter', size: 12 },
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            return '$' + context.raw.toLocaleString();
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: '#6b6b7b',
                        font: { family: 'Inter', size: 11 }
                    }
                },
                y: {
                    grid: { color: '#2a2a3a', drawBorder: false },
                    ticks: {
                        color: '#6b6b7b',
                        font: { family: 'Inter', size: 11 },
                        callback: function(value) {
                            return '$' + (value / 1000) + 'K';
                        }
                    }
                }
            }
        }
    });
}

function populateSegmentsTable() {
    const tbody = document.getElementById('segments-table');
    
    const segmentClasses = {
        'Champions': 'champions',
        'Loyal Customers': 'loyal',
        'Potential Loyalists': 'potential',
        'At Risk': 'at-risk',
        'Lost': 'lost'
    };
    
    tbody.innerHTML = dashboardData.segments.map(segment => `
        <tr>
            <td>
                <span class="segment-badge ${segmentClasses[segment.name] || 'potential'}">
                    <span class="legend-dot" style="background-color: ${segment.color}; width: 8px; height: 8px; border-radius: 50%; display: inline-block;"></span>
                    ${segment.name}
                </span>
            </td>
            <td style="font-weight: 600; color: #fff;">${segment.count.toLocaleString()}</td>
            <td>$${segment.avgSpend.toLocaleString()}</td>
            <td>${segment.frequency.toFixed(1)}x</td>
            <td>${segment.recency} days</td>
            <td style="font-size: 0.75rem;">${segment.description}</td>
        </tr>
    `).join('');
}

function populateTopProducts() {
    const container = document.getElementById('top-products');
    
    container.innerHTML = dashboardData.topProducts.map((product, index) => `
        <div class="product-item">
            <div class="product-rank">${index + 1}</div>
            <div class="product-name">${product.name}</div>
            <div class="product-sales">$${product.sales.toLocaleString()}</div>
            <div class="product-quantity">${product.quantity.toLocaleString()} units</div>
        </div>
    `).join('');
}

function exportData() {
    const csvContent = generateCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'customer_segments.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function generateCSV() {
    const headers = ['Segment', 'Customers', 'Avg Spend', 'Frequency', 'Recency (days)', 'Description'];
    const rows = dashboardData.segments.map(s => [
        s.name,
        s.count,
        s.avgSpend,
        s.frequency,
        s.recency,
        s.description
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
}