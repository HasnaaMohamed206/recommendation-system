document.addEventListener('DOMContentLoaded', function () {

    const dateElement = document.getElementById('current-date');

    const clusterMap = {
        0: 'High-value Customers',
        1: 'Seasonal Customers',
        2: 'Low-engagement Customers',
    };

    const form = document.getElementById('prediction-form');
    const resultSection = document.getElementById('result-section');
    const predictBtn = document.getElementById('predict-btn');

    const DEFAULT_CLUSTER = 'Low-engagement Customers';

    // Date
    if (dateElement) {
        const options = {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        };

        dateElement.textContent =
            new Date().toLocaleDateString('en-US', options);
    }

    // Form submit
    if (form) {

        form.addEventListener('submit', async function (e) {

            e.preventDefault();

            const recency =
                parseFloat(document.getElementById('recency').value);

            const frequency =
                parseFloat(document.getElementById('frequency').value);

            const monetary =
                parseFloat(document.getElementById('monetary').value);

            predictBtn.disabled = true;
            predictBtn.innerHTML = '<span>Predicting...</span>';

            try {

                const response = await fetch(
                    'http://localhost:5500/api/predict',
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            recency,
                            frequency,
                            monetary
                        })
                    }
                );

                if (!response.ok) {
                    throw new Error(`HTTP Error: ${response.status}`);
                }

                const data = await response.json();

                // =========================
                // SAFE CLUSTER PARSING
                // =========================
                const rawCluster = data.cluster ?? data.segment ?? data.prediction;
                const clusterId = Number.isFinite(Number(rawCluster))
                    ? Number(rawCluster)
                    : 2; // safe fallback → Low-engagement

                let clusterName =
                    clusterMap[clusterId] || DEFAULT_CLUSTER;

                // =========================
                // BUSINESS RULES OVERRIDE
                // (highest priority first)
                // =========================

                if (frequency > 10 && monetary > 1000 && recency < 30) {
                    clusterName = 'High-value Customers';
                }

                else if (recency > 60 && frequency < 3) {
                    clusterName = 'Low-engagement Customers';
                }

                displayResult(
                    clusterName,
                    data.confidence ?? 0.85
                );

            } catch (error) {

                console.error('Error calling prediction API:', error);
                showAPIError(error);
            }

            predictBtn.disabled = false;
            predictBtn.innerHTML = '<span>Predict Segment</span>';
        });
    }

    // Display result
    function displayResult(clusterName, confidence) {

        resultSection.style.display = 'block';

        resultSection.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });

        document.getElementById('segment-name')
            .textContent = clusterName;

        const confidencePercent =
            Math.round(confidence * 100);

        document.getElementById('confidence-value')
            .textContent = confidencePercent + '%';

        document.getElementById('confidence-fill')
            .style.width = confidencePercent + '%';

        const segmentIcon =
            document.getElementById('segment-icon');

        segmentIcon.className =
            'segment-icon ' + getClusterClass(clusterName);

        segmentIcon.innerHTML =
            getClusterEmoji(clusterName);

        document.getElementById('segment-description')
            .textContent =
            getClusterDescription(clusterName);

        const recommendationList =
            document.getElementById('recommendation-list');

        recommendationList.innerHTML = '';

        const recommendations =
            getRecommendations(clusterName);

        recommendations.forEach(rec => {
            const li = document.createElement('li');
            li.textContent = rec;
            recommendationList.appendChild(li);
        });

        // Display Product Recommendations
        displayProducts(clusterName);
    }

    // Error UI
    function showAPIError(error) {

        resultSection.style.display = 'block';

        resultSection.innerHTML = `
            <div style="padding: 30px; background: #1c1c28; border-radius: 12px; border: 1px solid #ef4444; text-align: center;">
                <h3 style="color: #ef4444; margin-bottom: 15px;">
                    API Error
                </h3>
                <p style="color: #999; margin-bottom: 15px;">
                    Failed to get prediction from Flask API.
                </p>
                <p style="color: #666; font-size: 0.9rem;">
                    Error: ${error.message}
                </p>
            </div>
        `;

        resultSection.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }

    // Helpers
    function getClusterClass(cluster) {

        const classes = {
            'High-value Customers': 'champions',
            'Seasonal Customers': 'potential',
            'Low-engagement Customers': 'at-risk'
        };

        return classes[cluster] || 'potential';
    }

    function getClusterEmoji(cluster) {

        const emojis = {
            'High-value Customers': '🏆',
            'Seasonal Customers': '⭐',
            'Low-engagement Customers': '⚠️'
        };

        return emojis[cluster] || '👤';
    }

    function getClusterDescription(cluster) {

        const descriptions = {
            'High-value Customers':
                'Premium customers with high loyalty and strong spending behavior.',
            'Seasonal Customers':
                'Customers who purchase occasionally and need engagement.',
            'Low-engagement Customers':
                'Customers with low activity who need re-engagement campaigns.'
        };

        return descriptions[cluster] ||
            'Customer cluster identified.';
    }

    function getRecommendations(cluster) {

        const recommendations = {
            'High-value Customers': [
                '🎁 Reward them with exclusive VIP perks and early access',
                '⭐ Create personalized loyalty rewards program',
                '🛍️ Offer premium products and special collections',
                '👥 Ask for referrals with referral bonuses',
                '📱 Send VIP-only deals and invitations'
            ],

            'Seasonal Customers': [
                '📧 Send personalized seasonal offers and reminders',
                '💳 Provide loyalty discounts and rewards points',
                '🎯 Engage through targeted email campaigns',
                '📱 Recommend trending products based on history',
                '🔔 Set up reminder campaigns for seasonal trends'
            ],

            'Low-engagement Customers': [
                '🎯 Launch strategic win-back campaigns',
                '💰 Offer special discounts to re-engage',
                '💬 Request customer feedback via surveys',
                '📧 Send personalized re-engagement emails',
                '🔍 Analyze why engagement dropped'
            ]
        };

        return recommendations[cluster] || [
            '📱 Engage with personalized marketing campaigns'
        ];
    }

    // Display Products
    function displayProducts(clusterName) {

        const productsSection =
            document.getElementById('products-section');

        const productsGrid =
            document.getElementById('products-grid');

        if (!productsSection || !productsGrid) {
            console.error("[v0] Products section or grid not found in DOM");
            return;
        }

        productsSection.classList.remove('hidden');
        productsGrid.innerHTML = '';

        const products = getProductsByCluster(clusterName);

        products.forEach(product => {
            const productCard =
                document.createElement('div');

            productCard.className = 'product-card';

            productCard.innerHTML = `
                <span class="product-icon">${product.icon}</span>
                <div class="product-name">${product.name}</div>
                <div class="product-description">${product.description}</div>
                <span class="product-badge ${product.badgeType}">${product.badge}</span>
            `;

            productsGrid.appendChild(productCard);
        });
    }

    function getProductsByCluster(cluster) {

        const products = {
            'High-value Customers': [
                {
                    icon: '👑',
                    name: 'VIP Membership',
                    description: 'Exclusive premium membership with lifetime benefits',
                    badge: 'Premium',
                    badgeType: 'premium'
                },
                {
                    icon: '💎',
                    name: 'Luxury Collection',
                    description: 'High-end premium products for elite customers',
                    badge: 'Exclusive',
                    badgeType: 'premium'
                },
                {
                    icon: '🎁',
                    name: 'Personal Shopper Service',
                    description: 'Dedicated shopping assistant for personalized experience',
                    badge: 'Premium',
                    badgeType: 'premium'
                },
                {
                    icon: '🌟',
                    name: 'Priority Support',
                    description: '24/7 dedicated customer support team',
                    badge: 'VIP Only',
                    badgeType: 'premium'
                },
                {
                    icon: '✈️',
                    name: 'Free Shipping Forever',
                    description: 'Unlimited free shipping on all orders',
                    badge: 'Premium',
                    badgeType: 'premium'
                },
                {
                    icon: '🎯',
                    name: 'Early Access Sales',
                    description: 'Get exclusive early access to new collections',
                    badge: 'Exclusive',
                    badgeType: 'premium'
                }
            ],

            'Seasonal Customers': [
                {
                    icon: '🎄',
                    name: 'Seasonal Bundles',
                    description: 'Special seasonal packages with great discounts',
                    badge: 'Limited Time',
                    badgeType: 'limited'
                },
                {
                    icon: '📦',
                    name: 'Gift Sets',
                    description: 'Curated gift collections for special occasions',
                    badge: 'Popular',
                    badgeType: 'popular'
                },
                {
                    icon: '💳',
                    name: 'Loyalty Points Program',
                    description: 'Earn points on every purchase to redeem rewards',
                    badge: 'Popular',
                    badgeType: 'popular'
                },
                {
                    icon: '🏷️',
                    name: 'Flash Sales',
                    description: 'Limited-time flash sales with up to 50% off',
                    badge: 'Limited Time',
                    badgeType: 'limited'
                },
                {
                    icon: '🎁',
                    name: 'Referral Rewards',
                    description: 'Share the love and earn rewards for referrals',
                    badge: 'Popular',
                    badgeType: 'popular'
                },
                {
                    icon: '🌈',
                    name: 'Trending Items',
                    description: 'Handpicked trending products just for you',
                    badge: 'Popular',
                    badgeType: 'popular'
                }
            ],

            'Low-engagement Customers': [
                {
                    icon: '🎉',
                    name: 'Welcome Back Offer',
                    description: '30% off on your next purchase - Come back to us!',
                    badge: 'Limited Time',
                    badgeType: 'limited'
                },
                {
                    icon: '💰',
                    name: 'Clearance Sale',
                    description: 'Huge discounts on selected items up to 70% off',
                    badge: 'Limited Time',
                    badgeType: 'limited'
                },
                {
                    icon: '📧',
                    name: 'Newsletter Signup',
                    description: 'Get exclusive deals sent directly to your inbox',
                    badge: 'Popular',
                    badgeType: 'popular'
                },
                {
                    icon: '🎯',
                    name: 'Personal Discount Code',
                    description: 'Special code just for you - 25% off everything',
                    badge: 'Limited Time',
                    badgeType: 'limited'
                },
                {
                    icon: '⭐',
                    name: 'Best Sellers Collection',
                    description: 'Our most popular items that everyone loves',
                    badge: 'Popular',
                    badgeType: 'popular'
                },
                {
                    icon: '🔥',
                    name: 'Hot Deals This Week',
                    description: 'Amazing deals updated every week',
                    badge: 'Limited Time',
                    badgeType: 'limited'
                }
            ]
        };

        return products[cluster] || [];
    }

});