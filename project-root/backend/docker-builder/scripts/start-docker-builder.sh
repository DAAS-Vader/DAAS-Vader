#!/bin/bash

# DAAS Docker Builder Service Startup Script
# This script starts the Docker Builder Service with proper initialization

set -e

echo "🐳 Starting DAAS Docker Builder Service..."

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed or not in PATH"
    exit 1
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo "❌ Docker daemon is not running"
    exit 1
fi

echo "✅ Docker daemon is available"

# Create build directory if it doesn't exist
BUILD_DIR=${DOCKER_BUILD_DIR:-/tmp/docker-builds}
mkdir -p "$BUILD_DIR"
echo "✅ Build directory ready: $BUILD_DIR"

# Check if we're running inside Docker
if [ -f /.dockerenv ]; then
    echo "🔧 Running inside Docker container"

    # Wait for Docker-in-Docker to be ready
    echo "⏳ Waiting for Docker-in-Docker to be ready..."
    timeout=30
    while [ $timeout -gt 0 ]; do
        if docker info &> /dev/null; then
            echo "✅ Docker-in-Docker is ready"
            break
        fi
        echo "⏳ Waiting for Docker daemon... ($timeout seconds remaining)"
        sleep 1
        timeout=$((timeout - 1))
    done

    if [ $timeout -eq 0 ]; then
        echo "❌ Docker-in-Docker failed to start within 30 seconds"
        exit 1
    fi
else
    echo "🖥️  Running on host system"
fi

# Test Docker functionality
echo "🔍 Testing Docker functionality..."
if docker run --rm hello-world &> /dev/null; then
    echo "✅ Docker is working correctly"
else
    echo "❌ Docker test failed"
    exit 1
fi

# Set default environment variables if not set
export NODE_ENV=${NODE_ENV:-development}
export PORT=${PORT:-3001}
export DOCKER_BUILD_DIR=${DOCKER_BUILD_DIR:-/tmp/docker-builds}
export MAX_CONCURRENT_BUILDS=${MAX_CONCURRENT_BUILDS:-3}
export BUILD_TIMEOUT=${BUILD_TIMEOUT:-600}

echo "🔧 Configuration:"
echo "  NODE_ENV: $NODE_ENV"
echo "  PORT: $PORT"
echo "  BUILD_DIR: $DOCKER_BUILD_DIR"
echo "  MAX_CONCURRENT_BUILDS: $MAX_CONCURRENT_BUILDS"
echo "  BUILD_TIMEOUT: ${BUILD_TIMEOUT}s"

# Start the Node.js application
echo "🚀 Starting Docker Builder Service..."

if [ "$NODE_ENV" = "development" ]; then
    # Development mode with file watching
    if command -v npm &> /dev/null; then
        npm run dev
    else
        node dist/dockerBuilderApp.js
    fi
else
    # Production mode
    node dist/dockerBuilderApp.js
fi