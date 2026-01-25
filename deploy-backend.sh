#!/bin/bash

# Backend Deployment Script for Ramadan Booking System
# This script prepares and deploys the backend to Heroku

echo "🚀 Preparing backend for deployment..."

cd backend

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found! Please create it from .env.example"
    echo "Run: cp .env.example .env"
    echo "Then edit .env with your production values"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Run setup to create admin user (optional, can be done after deployment)
echo "👤 Setting up admin user..."
npm run setup

echo "✅ Backend prepared for deployment!"
echo ""
echo "📋 Deployment Options:"
echo ""
echo "🌐 Heroku Deployment (Recommended):"
echo "1. Install Heroku CLI: https://devcenter.heroku.com/articles/heroku-cli"
echo "2. Login: heroku login"
echo "3. Create app: heroku create your-app-name"
echo "4. Set environment variables:"
echo "   heroku config:set MONGODB_URI='your-mongodb-atlas-connection-string'"
echo "   heroku config:set JWT_SECRET='your-super-secret-key'"
echo "   heroku config:set NODE_ENV='production'"
echo "5. Deploy: git push heroku main"
echo ""
echo "🐙 Railway Deployment:"
echo "1. Go to: https://railway.app"
echo "2. Connect your GitHub repository"
echo "3. Add environment variables in Railway dashboard"
echo "4. Deploy automatically"
echo ""
echo "☁️ DigitalOcean App Platform:"
echo "1. Go to: https://cloud.digitalocean.com/apps"
echo "2. Create new app from GitHub repository"
echo "3. Configure environment variables"
echo "4. Deploy"
echo ""
echo "🔧 Required Environment Variables:"
echo "- MONGODB_URI: Your MongoDB connection string"
echo "- JWT_SECRET: A secure random string"
echo "- NODE_ENV: 'production'"
echo "- FRONTEND_URL: Your frontend URL (e.g., https://yourusername.github.io/repo)"
echo ""
echo "📊 MongoDB Setup (MongoDB Atlas - Free):"
echo "1. Go to: https://cloud.mongodb.com"
echo "2. Create free cluster"
echo "3. Create database user"
echo "4. Get connection string"
echo "5. Whitelist your IP (0.0.0.0/0 for production)"
