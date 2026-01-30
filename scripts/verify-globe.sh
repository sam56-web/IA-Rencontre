#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd "$(dirname "$0")/.."

echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}       VÉRIFICATION GLOBE 3D - AI CONNECT${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"

ERRORS=0

# 1. Vérifier les colonnes de géolocalisation
echo -e "\n${YELLOW}[1/6] Vérification des colonnes de géolocalisation...${NC}"
COLS=$(docker compose exec -T postgres psql -U postgres -d aiconnect -t -c "
SELECT COUNT(*) FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('approximate_latitude', 'approximate_longitude');
" 2>/dev/null)
COLS=$(echo $COLS | tr -d ' ')
if [ "$COLS" = "2" ]; then
    echo -e "${GREEN}✓ Colonnes latitude/longitude présentes${NC}"
else
    echo -e "${RED}✗ Colonnes manquantes (trouvé: $COLS/2)${NC}"
    ERRORS=$((ERRORS + 1))
fi

# 2. Vérifier les données de test
echo -e "\n${YELLOW}[2/6] Vérification des profils avec coordonnées...${NC}"
docker compose exec -T postgres psql -U postgres -d aiconnect -c "
SELECT
    u.username,
    u.location_city,
    ROUND(u.approximate_latitude::numeric, 2) as lat,
    ROUND(u.approximate_longitude::numeric, 2) as lon
FROM users u
WHERE u.email LIKE '%@example.com'
ORDER BY u.username;
" 2>/dev/null

USERS_WITH_COORDS=$(docker compose exec -T postgres psql -U postgres -d aiconnect -t -c "
SELECT COUNT(*) FROM users WHERE approximate_latitude IS NOT NULL;
" 2>/dev/null)
USERS_WITH_COORDS=$(echo $USERS_WITH_COORDS | tr -d ' ')
if [ "$USERS_WITH_COORDS" -ge 5 ]; then
    echo -e "${GREEN}✓ $USERS_WITH_COORDS utilisateurs avec coordonnées${NC}"
else
    echo -e "${RED}✗ Seulement $USERS_WITH_COORDS utilisateurs avec coordonnées${NC}"
    ERRORS=$((ERRORS + 1))
fi

# 3. Obtenir un token
echo -e "\n${YELLOW}[3/6] Obtention d'un token d'authentification...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Test1234!"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
    echo -e "${GREEN}✓ Token obtenu: ${TOKEN:0:20}...${NC}"
else
    echo -e "${RED}✗ Impossible d'obtenir le token${NC}"
    echo "Réponse: $LOGIN_RESPONSE"
    ERRORS=$((ERRORS + 1))
fi

# 4. Tester l'API /globe/connections
echo -e "\n${YELLOW}[4/6] Test de l'API /api/globe/connections...${NC}"
if [ -n "$TOKEN" ]; then
    GLOBE_RESPONSE=$(curl -s http://localhost:3000/api/globe/connections \
      -H "Authorization: Bearer $TOKEN")

    if echo "$GLOBE_RESPONSE" | grep -q '"success":true'; then
        TOTAL=$(echo $GLOBE_RESPONSE | grep -o '"total":[0-9]*' | head -1 | cut -d':' -f2)
        ONLINE=$(echo $GLOBE_RESPONSE | grep -o '"online":[0-9]*' | head -1 | cut -d':' -f2)
        LOCAL=$(echo $GLOBE_RESPONSE | grep -o '"local":[0-9]*' | head -1 | cut -d':' -f2)
        echo -e "${GREEN}✓ API Globe fonctionnelle${NC}"
        echo "  • Total connexions: $TOTAL"
        echo "  • En ligne: $ONLINE"
        echo "  • Locaux (<200km): $LOCAL"
    else
        echo -e "${RED}✗ Erreur API Globe${NC}"
        echo "Réponse: $(echo $GLOBE_RESPONSE | head -c 200)"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}✗ Test ignoré (pas de token)${NC}"
    ERRORS=$((ERRORS + 1))
fi

# 5. Tester l'API /globe/connections/clustered
echo -e "\n${YELLOW}[5/6] Test de l'API /api/globe/connections/clustered...${NC}"
if [ -n "$TOKEN" ]; then
    CLUSTER_RESPONSE=$(curl -s "http://localhost:3000/api/globe/connections/clustered?maxDistance=500" \
      -H "Authorization: Bearer $TOKEN")

    if echo "$CLUSTER_RESPONSE" | grep -q '"success":true'; then
        ORIGINAL=$(echo $CLUSTER_RESPONSE | grep -o '"originalCount":[0-9]*' | cut -d':' -f2)
        CLUSTERED=$(echo $CLUSTER_RESPONSE | grep -o '"clusteredCount":[0-9]*' | cut -d':' -f2)
        echo -e "${GREEN}✓ API Clustering fonctionnelle${NC}"
        echo "  • Original: $ORIGINAL connexions"
        echo "  • Après clustering: $CLUSTERED connexions"
    else
        echo -e "${RED}✗ Erreur API Clustering${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}✗ Test ignoré (pas de token)${NC}"
fi

# 6. Tester l'API /globe/zone-stats
echo -e "\n${YELLOW}[6/6] Test de l'API /api/globe/zone-stats...${NC}"
if [ -n "$TOKEN" ]; then
    ZONE_RESPONSE=$(curl -s http://localhost:3000/api/globe/zone-stats \
      -H "Authorization: Bearer $TOKEN")

    if echo "$ZONE_RESPONSE" | grep -q '"success":true'; then
        WITHIN_50=$(echo $ZONE_RESPONSE | grep -o '"within_50km":"[0-9]*"' | cut -d'"' -f4 || echo "0")
        WITHIN_200=$(echo $ZONE_RESPONSE | grep -o '"within_200km":"[0-9]*"' | cut -d'"' -f4 || echo "0")
        echo -e "${GREEN}✓ API Zone Stats fonctionnelle${NC}"
        echo "  • Dans 50km: $WITHIN_50"
        echo "  • Dans 200km: $WITHIN_200"
    else
        echo -e "${RED}✗ Erreur API Zone Stats${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}✗ Test ignoré (pas de token)${NC}"
fi

# Résumé
echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ PHASE 1 GLOBE : TOUTES LES VÉRIFICATIONS PASSÉES${NC}"
    echo -e "${GREEN}  Prêt pour la Phase 2 (Frontend Three.js)${NC}"
else
    echo -e "${RED}✗ $ERRORS ERREUR(S) DÉTECTÉE(S)${NC}"
    echo ""
    echo "Actions suggérées:"
    echo "  1. docker compose exec backend npm run db:migrate"
    echo "  2. docker compose exec backend npm run db:seed"
    echo "  3. docker compose restart backend"
fi
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"

exit $ERRORS
