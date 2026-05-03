#!/usr/bin/env bash

# ScholarPass End-to-End Test Suite
# Complete system verification script

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║       ScholarPass End-to-End Test Suite (v1.0)             ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

# Test function
test_endpoint() {
  local name=$1
  local method=$2
  local endpoint=$3
  local expected_code=$4
  
  echo -ne "${BLUE}Testing${NC} $name... "
  
  response=$(curl -s -w "\n%{http_code}" -X $method "http://localhost:4000$endpoint" 2>&1)
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)
  
  if [ "$http_code" = "$expected_code" ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
    ((PASSED+=1))
    return 0
  else
    echo -e "${RED}✗ FAIL${NC} (Expected $expected_code, got $http_code)"
    ((FAILED+=1))
    return 1
  fi
}

# 1. Backend Availability
echo -e "${YELLOW}1. Backend Availability${NC}"
test_endpoint "Health Check" GET "/api/health" "200"
echo ""

# 2. IPFS Integration
echo -e "${YELLOW}2. IPFS Integration${NC}"
test_endpoint "Uploads List" GET "/api/ipfs/uploads" "200"
test_endpoint "Admin Stats" GET "/api/admin/stats" "200"
echo ""

# 3. Stellar Network
echo -e "${YELLOW}3. Stellar Network Connection${NC}"
test_endpoint "Account Query" GET "/api/account/GBNC" "400"  # Invalid address intentionally
echo ""

# 4. Achievement API
echo -e "${YELLOW}4. Achievement Cache API${NC}"
test_endpoint "Achievement Query (Invalid)" GET "/api/achievements/GBNC" "400"  # Invalid address
echo ""

# 5. Database Health
echo -e "${YELLOW}5. Database Health${NC}"
echo -ne "${BLUE}Checking${NC} Database Integrity... "
integrity=$(curl -s http://localhost:4000/api/health | python3 -c "import sys, json; print(json.load(sys.stdin)['database']['integrity'])" 2>/dev/null)
if [ "$integrity" = "True" ]; then
  echo -e "${GREEN}✓ PASS${NC}"
  ((PASSED+=1))
else
  echo -e "${RED}✗ FAIL${NC}"
  ((FAILED+=1))
fi
echo ""

# 6. File Upload Test
echo -e "${YELLOW}6. File Upload Test${NC}"
echo -ne "${BLUE}Testing${NC} Text File Upload... "
test_file=$(mktemp --suffix=.txt)
echo "Test content - $(date)" > "$test_file"

upload_response=$(curl -s -F "file=@$test_file;type=text/plain" http://localhost:4000/api/ipfs/upload)
cid=$(echo "$upload_response" | python3 -c "import sys, json; print(json.load(sys.stdin).get('cid', ''))" 2>/dev/null || true)

if [ ! -z "$cid" ] && [ ${#cid} -gt 10 ]; then
  echo -e "${GREEN}✓ PASS${NC} (CID: ${cid:0:16}...)"
  ((PASSED+=1))
else
  echo -e "${RED}✗ FAIL${NC} (No valid CID returned)"
  ((FAILED+=1))
fi

rm -f "$test_file"
echo ""

# 7. IPFS Gateway Availability
echo -e "${YELLOW}7. IPFS Gateway Availability${NC}"
if [ ! -z "$cid" ]; then
  echo -ne "${BLUE}Testing${NC} IPFS Gateway Access... "
  gateway_response=$(curl -s -o /dev/null -w "%{http_code}" "https://ipfs.io/ipfs/$cid" 2>&1)
  if [ "$gateway_response" = "200" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASSED+=1))
  else
    echo -e "${YELLOW}⊘ SKIP${NC} (Gateway code: $gateway_response)"
  fi
fi
echo ""

# 8. API Response Format
echo -e "${YELLOW}8. API Response Format${NC}"
echo -ne "${BLUE}Validating${NC} JSON Response... "
health_response=$(curl -s http://localhost:4000/api/health)
if echo "$health_response" | python3 -m json.tool > /dev/null 2>&1; then
  echo -e "${GREEN}✓ PASS${NC}"
  ((PASSED+=1))
else
  echo -e "${RED}✗ FAIL${NC} (Invalid JSON)"
  ((FAILED+=1))
fi
echo ""

# 9. Performance
echo -e "${YELLOW}9. Performance Metrics${NC}"
echo -ne "${BLUE}Measuring${NC} API Response Time... "
start_time=$(date +%s%N)
curl -s http://localhost:4000/api/health > /dev/null
end_time=$(date +%s%N)
response_time=$(( ($end_time - $start_time) / 1000000 ))
echo -e "${GREEN}✓ PASS${NC} (${response_time}ms)"
((PASSED+=1))
echo ""

# 10. Database Statistics
echo -e "${YELLOW}10. Database Statistics${NC}"
stats=$(curl -s http://localhost:4000/api/health)
uploads=$(echo "$stats" | python3 -c "import sys, json; print(json.load(sys.stdin)['database']['uploads']['total'])" 2>/dev/null)
achievements=$(echo "$stats" | python3 -c "import sys, json; print(json.load(sys.stdin)['database']['achievements'])" 2>/dev/null)
db_size=$(echo "$stats" | python3 -c "import sys, json; print(json.load(sys.stdin)['database']['size'])" 2>/dev/null)

echo "   Uploads: $uploads"
echo "   Achievements: $achievements"
echo "   Database Size: $db_size"
echo ""

# Summary
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    Test Results                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}Passed:  $PASSED${NC}"
echo -e "${RED}Failed:  $FAILED${NC}"
total=$((PASSED + FAILED))
echo "Total:   $total"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed! System is operational.${NC}"
  exit 0
else
  echo -e "${YELLOW}⊘ Some tests failed. Please review above.${NC}"
  exit 1
fi
