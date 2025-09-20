#!/bin/bash

# Production Readiness Check Script
set -e

echo "🔍 DAAS Vader Backend Production Readiness Check"
echo "================================================"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

CHECKS_PASSED=0
CHECKS_FAILED=0
WARNINGS=0

# Function to check if a condition is met
check() {
    local name="$1"
    local condition="$2"
    local recommendation="$3"
    local level="${4:-error}" # error, warning

    printf "%-50s" "$name"

    if eval "$condition"; then
        echo -e "${GREEN}✓${NC}"
        ((CHECKS_PASSED++))
    else
        if [ "$level" = "warning" ]; then
            echo -e "${YELLOW}⚠${NC}"
            ((WARNINGS++))
            [ -n "$recommendation" ] && echo "  → $recommendation"
        else
            echo -e "${RED}✗${NC}"
            ((CHECKS_FAILED++))
            [ -n "$recommendation" ] && echo "  → $recommendation"
        fi
    fi
}

echo -e "\n🔐 Environment & Security Checks"
echo "=================================="

# Environment checks
check "NODE_ENV is set to production" \
      "[ \"\$NODE_ENV\" = \"production\" ]" \
      "Set NODE_ENV=production in environment"

check "Production .env file exists" \
      "[ -f .env.production ]" \
      "Create .env.production file with production values"

check "Development admin token disabled" \
      "[ \"\$(grep 'DEV_ADMIN_TOKEN=disabled' .env.production 2>/dev/null)\" ]" \
      "Set DEV_ADMIN_TOKEN=disabled-in-production in .env.production"

check "Session secret is set and strong" \
      "[ -n \"\$SESSION_SECRET\" ] && [ \${#SESSION_SECRET} -ge 32 ]" \
      "Set a strong SESSION_SECRET (32+ characters)" \
      "warning"

check "SSL/TLS certificates exist" \
      "[ -f certs/cert.pem ] && [ -f certs/key.pem ]" \
      "Generate SSL certificates for HTTPS" \
      "warning"

echo -e "\n🔧 Dependencies & Build Checks"
echo "=============================="

# Dependency checks
check "Node.js version >= 18" \
      "node -v | cut -d'v' -f2 | cut -d'.' -f1 | awk '{print (\$1 >= 18)}' | grep -q 1" \
      "Update Node.js to version 18 or higher"

check "TypeScript compiles without errors" \
      "npm run type-check > /dev/null 2>&1" \
      "Fix TypeScript compilation errors"

check "No high severity npm vulnerabilities" \
      "npm audit --audit-level high --silent" \
      "Run 'npm audit fix' to resolve vulnerabilities"

check "Production build succeeds" \
      "npm run build > /dev/null 2>&1" \
      "Fix build errors"

echo -e "\n🗄️ Database & External Services"
echo "==============================="

# Service configuration checks
check "Database URL is configured" \
      "[ -n \"\$DATABASE_URL\" ]" \
      "Configure DATABASE_URL in production environment"

check "Sui RPC URL uses mainnet" \
      "echo \"\$SUI_RPC_URL\" | grep -q 'mainnet'" \
      "Set SUI_RPC_URL to mainnet endpoint for production"

check "Seal service configuration exists" \
      "[ -n \"\$SEAL_PACKAGE_ID\" ] && [ -n \"\$SEAL_REGISTRY_ID\" ]" \
      "Configure Seal v2 contract IDs for mainnet"

check "Key server admin key is set" \
      "[ -n \"\$KEY_SERVER_ADMIN_KEY\" ] && [ \"\$KEY_SERVER_ADMIN_KEY\" != \"dev-admin-private-key\" ]" \
      "Set production KEY_SERVER_ADMIN_KEY"

echo -e "\n📊 Monitoring & Alerting"
echo "======================="

# Monitoring checks
check "Log directory is writable" \
      "[ -w logs ] || mkdir -p logs" \
      "Create logs directory with write permissions"

check "Alert webhook is configured" \
      "[ -n \"\$ALERT_WEBHOOK_URL\" ]" \
      "Configure alert webhook for notifications" \
      "warning"

check "Email alerts configured" \
      "[ -n \"\$ALERT_EMAIL_SMTP\" ]" \
      "Configure email alerts for monitoring" \
      "warning"

echo -e "\n🔒 Security Configuration"
echo "========================"

# Security checks
check "TEE security level is maximum" \
      "[ \"\$TEE_SECURITY_LEVEL\" = \"maximum\" ]" \
      "Set TEE_SECURITY_LEVEL=maximum for production"

check "Rate limiting is configured" \
      "[ -n \"\$RATE_LIMIT_PER_MINUTE\" ] && [ \"\$RATE_LIMIT_PER_MINUTE\" -le 100 ]" \
      "Configure appropriate rate limiting"

check "CORS origins are restricted" \
      "[ -n \"\$ALLOWED_ORIGINS\" ]" \
      "Set ALLOWED_ORIGINS to restrict CORS access"

check "API keys are configured" \
      "[ -n \"\$API_KEYS\" ]" \
      "Configure API_KEYS for external access" \
      "warning"

echo -e "\n🐳 Docker & Deployment"
echo "====================="

# Docker checks
check "Dockerfile exists and is valid" \
      "[ -f Dockerfile ] && docker build -t daas-test . > /dev/null 2>&1" \
      "Fix Dockerfile issues"

check "Docker Compose production config exists" \
      "[ -f docker-compose.prod.yml ]" \
      "Create docker-compose.prod.yml for production deployment" \
      "warning"

check "Health check endpoint responds" \
      "curl -s http://localhost:3000/api/monitoring/health > /dev/null" \
      "Ensure health check endpoint is accessible" \
      "warning"

echo -e "\n📋 Summary"
echo "=========="

echo -e "Checks passed: ${GREEN}$CHECKS_PASSED${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo -e "Checks failed: ${RED}$CHECKS_FAILED${NC}"

if [ $CHECKS_FAILED -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "\n${GREEN}🎉 All checks passed! Ready for production deployment.${NC}"
    else
        echo -e "\n${YELLOW}⚠️  Production ready with warnings. Consider addressing warnings for optimal security.${NC}"
    fi
    exit 0
else
    echo -e "\n${RED}❌ Production readiness check failed. Please fix the issues above before deploying.${NC}"
    exit 1
fi