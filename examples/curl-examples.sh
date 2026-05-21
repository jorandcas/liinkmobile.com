#!/bin/bash

# API DN Verification - Ejemplos cURL

BASE_URL="http://localhost:3000/api"

echo "╔══════════════════════════════════════════╗"
echo "║   API DN Verification - Ejemplos cURL   ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# 1. Health Check
echo "1. Health Check"
echo "─────────────────────────────────────"
curl -s "$BASE_URL/health" | json_pp 2>/dev/null || curl -s "$BASE_URL/health"
echo -e "\n"

# 2. Validación Individual (PROD)
echo "2. Validación Individual (PROD)"
echo "─────────────────────────────────────"
curl -X POST "$BASE_URL/validate/single" \
  -H "Content-Type: application/json" \
  -d '{"telefono":"9233250673","verificarEn":["PROD"]}' \
  | json_pp 2>/dev/null || curl -X POST "$BASE_URL/validate/single" \
  -H "Content-Type: application/json" \
  -d '{"telefono":"9233250673","verificarEn":["PROD"]}'
echo -e "\n"

# 3. Validación Simultánea (QA + PROD)
echo "3. Validación Simultánea (QA + PROD)"
echo "─────────────────────────────────────"
curl -X POST "$BASE_URL/validate/single" \
  -H "Content-Type: application/json" \
  -d '{"telefono":"9233250673","verificarEn":["QA","PROD"]}' \
  | json_pp 2>/dev/null || curl -X POST "$BASE_URL/validate/single" \
  -H "Content-Type: application/json" \
  -d '{"telefono":"9233250673","verificarEn":["QA","PROD"]}'
echo -e "\n"

# 4. Validación por Lotes
echo "4. Validación por Lotes"
echo "─────────────────────────────────────"
curl -X POST "$BASE_URL/validate/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "telefonos": ["9233250673", "9233250674", "9233250675"],
    "verificarEn": ["PROD"],
    "maxConcurrent": 3
  }' \
  | json_pp 2>/dev/null || curl -X POST "$BASE_URL/validate/batch" \
  -H "Content-Type: application/json" \
  -d '{"telefonos":["9233250673","9233250674","9233250675"],"verificarEn":["PROD"],"maxConcurrent":3}'
echo -e "\n"

# 5. Validación Masiva (CSV)
echo "5. Validación Masiva (CSV)"
echo "─────────────────────────────────────"
curl -X POST "$BASE_URL/validate/bulk" \
  -F "file=@./examples/telefonos.csv" \
  -F "verificarEn=[\"PROD\"]" \
  -F "maxConcurrent=10" \
  | json_pp 2>/dev/null || curl -X POST "$BASE_URL/validate/bulk" \
  -F "file=@./examples/telefonos.csv" \
  -F "verificarEn=[\"PROD\"]" \
  -F "maxConcurrent=10"
echo -e "\n"

echo "✓ Todos los ejemplos completados"
