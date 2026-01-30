#!/bin/bash
# Health Check Script for AI-Connect
# Usage: ./scripts/health-check.sh

set -e
cd "$(dirname "$0")/.."

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

echo "========================================"
echo "   AI-CONNECT HEALTH CHECK"
echo "========================================"
echo ""

# 1. Check Docker daemon
echo -n "1. Docker daemon... "
if docker info > /dev/null 2>&1; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC}"
    ERRORS=$((ERRORS + 1))
fi

# 2. Check containers running
echo -n "2. Docker containers... "
CONTAINERS=$(docker compose ps --format json 2>/dev/null | jq -s 'length' 2>/dev/null || echo "0")
if [ "$CONTAINERS" -ge 4 ]; then
    echo -e "${GREEN}OK${NC} ($CONTAINERS containers)"
else
    echo -e "${RED}FAILED${NC} (expected 4, found $CONTAINERS)"
    ERRORS=$((ERRORS + 1))
fi

# 3. Check PostgreSQL
echo -n "3. PostgreSQL... "
if docker compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC}"
    ERRORS=$((ERRORS + 1))
fi

# 4. Check Redis
echo -n "4. Redis... "
if docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC}"
    ERRORS=$((ERRORS + 1))
fi

# 5. Check Backend health endpoint
echo -n "5. Backend health... "
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null || echo "000")
if [ "$BACKEND_STATUS" = "200" ]; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC} (HTTP $BACKEND_STATUS)"
    ERRORS=$((ERRORS + 1))
fi

# 6. Check Frontend
echo -n "6. Frontend... "
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 2>/dev/null || echo "000")
if [ "$FRONTEND_STATUS" = "200" ]; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC} (HTTP $FRONTEND_STATUS)"
    ERRORS=$((ERRORS + 1))
fi

# 7. Check Backend API (discovery endpoint)
echo -n "7. Backend API... "
API_RESPONSE=$(curl -s http://localhost:3000/health 2>/dev/null)
if echo "$API_RESPONSE" | grep -q '"status":"ok"'; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${YELLOW}WARNING${NC} (health endpoint responded but unexpected format)"
fi

# 8. Check for rate limiting
echo -n "8. Rate limiter... "
for i in {1..3}; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null || echo "000")
    if [ "$STATUS" = "429" ]; then
        echo -e "${RED}BLOCKED${NC} (429 Too Many Requests)"
        ERRORS=$((ERRORS + 1))
        break
    fi
done
if [ "$STATUS" != "429" ]; then
    echo -e "${GREEN}OK${NC}"
fi

# 9. Check recent backend logs for errors
echo -n "9. Backend errors... "
ERROR_COUNT=$(docker compose logs backend --tail=50 2>/dev/null | grep -ci "error\|exception\|fatal" 2>/dev/null | tr -d '\n' || echo "0")
ERROR_COUNT=${ERROR_COUNT:-0}
if [ "$ERROR_COUNT" -eq 0 ] 2>/dev/null; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${YELLOW}WARNING${NC} ($ERROR_COUNT errors in recent logs)"
fi

# 10. Check frontend build errors
echo -n "10. Frontend errors... "
FE_ERROR_COUNT=$(docker compose logs frontend --tail=50 2>/dev/null | grep -ci "error\|failed" 2>/dev/null | tr -d '\n' || echo "0")
FE_ERROR_COUNT=${FE_ERROR_COUNT:-0}
if [ "$FE_ERROR_COUNT" -eq 0 ] 2>/dev/null; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${YELLOW}WARNING${NC} ($FE_ERROR_COUNT errors in recent logs)"
fi

echo ""
echo "========================================"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}ALL CHECKS PASSED${NC}"
    exit 0
else
    echo -e "${RED}$ERRORS CHECK(S) FAILED${NC}"
    echo "Run ./scripts/auto-fix.sh to attempt automatic repair"
    exit 1
fi
