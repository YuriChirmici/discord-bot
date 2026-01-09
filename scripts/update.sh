#!/bin/sh
# Update script - run inside Docker container

echo "Pulling latest code from GitHub..."
git pull

echo "Installing dependencies..."
npm install --omit=dev

echo "Update complete! Restart the container to apply changes:"
echo "    docker compose restart"
