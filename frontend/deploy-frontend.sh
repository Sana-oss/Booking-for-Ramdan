#!/bin/bash

# Frontend Deployment Script for Ramadan Booking System
# This script prepares and deploys the frontend to GitHub Pages

echo "🚀 Preparing frontend for deployment..."

# Create dist directory
mkdir -p dist

# Copy all frontend files
cp -r *.html *.css *.js i18n.js dist/

# Copy assets if they exist
if [ -d "assets" ]; then
    cp -r assets dist/
fi

# Update API base URL for production
echo "🔧 Updating API configuration for production..."

# Create production config
cat > dist/config.js << 'EOF'
// Production Configuration
const CONFIG = {
  API_BASE_URL: 'https://your-backend-url.herokuapp.com' // Replace with your actual backend URL
};
EOF

# Update storage.js to use production API
sed -i 's|http://localhost:5000|https://your-backend-url.herokuapp.com|g' dist/storage.js

echo "✅ Frontend prepared for deployment!"
echo ""
echo "📋 Next steps:"
echo "1. Replace 'your-backend-url.herokuapp.com' in dist/config.js with your actual backend URL"
echo "2. Commit and push the dist/ folder to GitHub"
echo "3. Enable GitHub Pages in repository settings"
echo "4. Your site will be available at: https://yourusername.github.io/repository-name"
echo ""
echo "🎯 Alternative: Upload the dist/ folder contents to any web hosting service"
