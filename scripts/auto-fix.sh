#!/bin/bash
# Auto-Fix Script for AI-Connect
# Usage: ./scripts/auto-fix.sh

set -e
cd "$(dirname "$0")/.."

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "========================================"
echo "   AI-CONNECT AUTO-FIX"
echo "========================================"
echo ""

# Function to check if service is healthy
check_service() {
    local service=$1
    local url=$2
    local expected=$3

    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    if [ "$STATUS" = "$expected" ]; then
        return 0
    else
        return 1
    fi
}

# 1. Check and restart Docker if needed
echo -e "${BLUE}[1/8]${NC} Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo "  Docker not responding. Please start Docker manually."
    exit 1
fi
echo -e "  ${GREEN}Docker OK${NC}"

# 2. Check for stopped containers and restart them
echo -e "${BLUE}[2/8]${NC} Checking containers..."
STOPPED=$(docker compose ps --filter "status=exited" --format "{{.Name}}" 2>/dev/null | wc -l || echo "0")
if [ "$STOPPED" -gt 0 ]; then
    echo "  Found $STOPPED stopped container(s). Restarting..."
    docker compose up -d
    sleep 5
fi
echo -e "  ${GREEN}Containers running${NC}"

# 3. Check PostgreSQL
echo -e "${BLUE}[3/8]${NC} Checking PostgreSQL..."
if ! docker compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
    echo "  PostgreSQL not ready. Restarting..."
    docker compose restart postgres
    sleep 10
fi
echo -e "  ${GREEN}PostgreSQL OK${NC}"

# 4. Check Redis
echo -e "${BLUE}[4/8]${NC} Checking Redis..."
if ! docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
    echo "  Redis not responding. Restarting..."
    docker compose restart redis
    sleep 5
fi
echo -e "  ${GREEN}Redis OK${NC}"

# 5. Clear rate limiter (restart backend)
echo -e "${BLUE}[5/8]${NC} Checking rate limiter..."
RATE_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null || echo "000")
if [ "$RATE_CHECK" = "429" ]; then
    echo "  Rate limiter blocking requests. Restarting backend..."
    docker compose restart backend
    sleep 8
fi
echo -e "  ${GREEN}Rate limiter OK${NC}"

# 6. Check backend health
echo -e "${BLUE}[6/8]${NC} Checking backend..."
RETRIES=3
for i in $(seq 1 $RETRIES); do
    if check_service "backend" "http://localhost:3000/health" "200"; then
        break
    fi
    if [ $i -lt $RETRIES ]; then
        echo "  Backend not responding (attempt $i/$RETRIES). Restarting..."
        docker compose restart backend
        sleep 10
    else
        echo -e "  ${RED}Backend failed after $RETRIES attempts${NC}"
        echo "  Showing recent backend logs:"
        docker compose logs backend --tail=20
        exit 1
    fi
done
echo -e "  ${GREEN}Backend OK${NC}"

# 7. Check frontend
echo -e "${BLUE}[7/8]${NC} Checking frontend..."
RETRIES=3
for i in $(seq 1 $RETRIES); do
    if check_service "frontend" "http://localhost:5173" "200"; then
        break
    fi
    if [ $i -lt $RETRIES ]; then
        echo "  Frontend not responding (attempt $i/$RETRIES). Restarting..."
        docker compose restart frontend
        sleep 10
    else
        echo -e "  ${RED}Frontend failed after $RETRIES attempts${NC}"
        echo "  Showing recent frontend logs:"
        docker compose logs frontend --tail=20
        exit 1
    fi
done
echo -e "  ${GREEN}Frontend OK${NC}"

# 8. Final verification
echo -e "${BLUE}[8/8]${NC} Final verification..."
sleep 2

ALL_OK=true

if ! check_service "backend" "http://localhost:3000/health" "200"; then
    echo -e "  ${RED}Backend still not responding${NC}"
    ALL_OK=false
fi

if ! check_service "frontend" "http://localhost:5173" "200"; then
    echo -e "  ${RED}Frontend still not responding${NC}"
    ALL_OK=false
fi

echo ""
echo "========================================"
if [ "$ALL_OK" = true ]; then
    echo -e "${GREEN}AUTO-FIX COMPLETED SUCCESSFULLY${NC}"
    echo ""
    echo "Services available at:"
    echo "  Frontend: http://localhost:5173"
    echo "  Backend:  http://localhost:3000"
    exit 0
else
    echo -e "${RED}SOME ISSUES COULD NOT BE FIXED${NC}"
    echo "Please check the logs manually:"
    echo "  docker compose logs backend --tail=50"
    echo "  docker compose logs frontend --tail=50"
    exit 1
fi
