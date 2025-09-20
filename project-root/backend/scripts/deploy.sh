#!/bin/bash

# DAAS Vader Backend Deployment Script
set -e

ENVIRONMENT=${1:-development}
BUILD_VERSION=${2:-latest}

echo "🚀 Starting DAAS Vader Backend deployment for $ENVIRONMENT environment"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check dependencies
check_dependencies() {
    log_info "Checking dependencies..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed or not in PATH"
        exit 1
    fi

    log_info "Dependencies check passed"
}

# Environment validation
validate_environment() {
    log_info "Validating environment: $ENVIRONMENT"

    case $ENVIRONMENT in
        development|staging|production)
            ;;
        *)
            log_error "Invalid environment: $ENVIRONMENT. Must be one of: development, staging, production"
            exit 1
            ;;
    esac

    # Check environment file exists
    if [ ! -f ".env.$ENVIRONMENT" ]; then
        log_error "Environment file .env.$ENVIRONMENT not found"
        exit 1
    fi

    log_info "Environment validation passed"
}

# Pre-deployment checks
pre_deployment_checks() {
    log_info "Running pre-deployment checks..."

    # Check if TypeScript compiles
    log_info "Running TypeScript compilation check..."
    npm run type-check

    # Check if tests pass (if in development)
    if [ "$ENVIRONMENT" = "development" ]; then
        log_info "Running tests..."
        npm test -- --passWithNoTests
    fi

    # Security scan (basic)
    log_info "Running basic security scan..."
    npm audit --audit-level moderate || log_warn "Some security issues found, review npm audit output"

    log_info "Pre-deployment checks completed"
}

# Build Docker image
build_image() {
    log_info "Building Docker image..."

    IMAGE_NAME="daas-vader-backend:$BUILD_VERSION"

    docker build \
        --target production \
        --build-arg NODE_ENV=$ENVIRONMENT \
        --tag $IMAGE_NAME \
        .

    log_info "Docker image built: $IMAGE_NAME"
}

# Deploy with Docker Compose
deploy_with_compose() {
    log_info "Deploying with Docker Compose..."

    # Copy environment file
    cp ".env.$ENVIRONMENT" .env

    # Deploy based on environment
    case $ENVIRONMENT in
        development)
            docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
            ;;
        staging)
            docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d
            ;;
        production)
            docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
            ;;
    esac

    log_info "Deployment completed"
}

# Health check
health_check() {
    log_info "Performing health check..."

    # Wait for service to be ready
    sleep 10

    # Check health endpoint
    MAX_ATTEMPTS=30
    ATTEMPT=1

    while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
        if curl -f http://localhost:3000/api/monitoring/health &> /dev/null; then
            log_info "Health check passed"
            return 0
        fi

        log_warn "Health check attempt $ATTEMPT/$MAX_ATTEMPTS failed, retrying in 5 seconds..."
        sleep 5
        ATTEMPT=$((ATTEMPT + 1))
    done

    log_error "Health check failed after $MAX_ATTEMPTS attempts"
    return 1
}

# Post-deployment tasks
post_deployment() {
    log_info "Running post-deployment tasks..."

    # Show running containers
    docker-compose ps

    # Show logs
    log_info "Recent container logs:"
    docker-compose logs --tail=50 daas-backend

    # Display deployment info
    log_info "Deployment Summary:"
    echo "  Environment: $ENVIRONMENT"
    echo "  Version: $BUILD_VERSION"
    echo "  Time: $(date)"
    echo "  Health Check: http://localhost:3000/api/monitoring/health"

    log_info "Post-deployment tasks completed"
}

# Rollback function
rollback() {
    log_warn "Rolling back deployment..."

    # Stop current containers
    docker-compose down

    # You can implement more sophisticated rollback logic here
    # For example, deploy previous version from registry

    log_info "Rollback completed"
}

# Main deployment flow
main() {
    log_info "DAAS Vader Backend Deployment Started"
    log_info "Environment: $ENVIRONMENT"
    log_info "Build Version: $BUILD_VERSION"

    # Deployment steps
    check_dependencies
    validate_environment

    if [ "$ENVIRONMENT" != "production" ]; then
        pre_deployment_checks
    fi

    build_image
    deploy_with_compose

    if health_check; then
        post_deployment
        log_info "🎉 Deployment completed successfully!"
    else
        log_error "🚨 Deployment failed health check"
        if [ "$ENVIRONMENT" = "production" ]; then
            rollback
        fi
        exit 1
    fi
}

# Handle script arguments
case "${1:-}" in
    -h|--help)
        echo "DAAS Vader Backend Deployment Script"
        echo ""
        echo "Usage: $0 [ENVIRONMENT] [BUILD_VERSION]"
        echo ""
        echo "ENVIRONMENT: development (default), staging, production"
        echo "BUILD_VERSION: Docker image tag (default: latest)"
        echo ""
        echo "Examples:"
        echo "  $0                          # Deploy development with latest"
        echo "  $0 production v1.2.0        # Deploy production with v1.2.0"
        echo "  $0 staging                  # Deploy staging with latest"
        exit 0
        ;;
    rollback)
        rollback
        exit 0
        ;;
    *)
        main
        ;;
esac