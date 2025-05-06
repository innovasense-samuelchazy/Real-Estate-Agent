#!/bin/bash

# This script sets up necessary environment variables in Vercel
# Run it with: bash vercel-env-setup.sh

echo "Setting up environment variables for Vercel deployment..."

# Make sure Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Ensure user is logged in
vercel login

# Set environment variables
echo "Setting NEXT_PUBLIC_ENABLE_FALLBACK=true to ensure fallback works in production"
vercel env add NEXT_PUBLIC_ENABLE_FALLBACK production

echo "Setting WEBHOOK_URL to your n8n webhook endpoint"
vercel env add WEBHOOK_URL production

echo "Setting up environment variables complete!"
echo "Now redeploy your application with: vercel --prod" 