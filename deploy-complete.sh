#!/bin/bash

echo "🚀 BetPredict v2.0 - Script de Deployment Completo"
echo "=================================================="
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# PASO 1: Verificar que Supabase esté configurado
echo "📊 PASO 1: Verificando Supabase..."
echo ""
echo "${YELLOW}⚠️  ACCIÓN MANUAL REQUERIDA:${NC}"
echo "1. Abre: https://supabase.com/dashboard/project/zpvpyizifptdtlhiflru/editor"
echo "2. SQL Editor → New Query"
echo "3. Copia el contenido de: supabase-schema.sql"
echo "4. Ejecuta el script (RUN)"
echo ""
read -p "Presiona ENTER cuando hayas completado este paso..."
echo "${GREEN}✅ Supabase configurado${NC}"
echo ""

# PASO 2: Instalar Vercel CLI si no existe
echo "📦 PASO 2: Verificando Vercel CLI..."
if ! command -v vercel &> /dev/null; then
    echo "${YELLOW}Instalando Vercel CLI...${NC}"
    npm install -g vercel
fi
echo "${GREEN}✅ Vercel CLI listo${NC}"
echo ""

# PASO 3: Login a Vercel
echo "🔐 PASO 3: Login a Vercel..."
vercel login
echo ""

# PASO 4: Deploy
echo "🚀 PASO 4: Desplegando a Vercel..."
echo "${YELLOW}Configurando variables de entorno...${NC}"
echo ""

# Extraer variables del .env.local
export $(grep -v '^#' .env.local | xargs)

# Deploy con variables
vercel --prod \
  -e API_FOOTBALL_KEY="$API_FOOTBALL_KEY" \
  -e NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -e DATABASE_URL="$DATABASE_URL" \
  -e TELEGRAM_BOT_TOKEN="$TELEGRAM_BOT_TOKEN" \
  -e TELEGRAM_WEBHOOK_SECRET="$TELEGRAM_WEBHOOK_SECRET" \
  -e TELEGRAM_CHAT_ID="$TELEGRAM_CHAT_ID"

echo ""
echo "${GREEN}✅ Deploy completado${NC}"
echo ""

# PASO 5: Obtener URL y configurar webhook
echo "🤖 PASO 5: Configurando Telegram Webhook..."
echo ""
read -p "Pega aquí tu URL de Vercel (ej: https://betpredict-xxx.vercel.app): " VERCEL_URL

# Configurar webhook
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"${VERCEL_URL}/api/telegram\",
    \"secret_token\": \"${TELEGRAM_WEBHOOK_SECRET}\"
  }"

echo ""
echo ""
echo "${GREEN}✅ Webhook configurado${NC}"
echo ""

# Verificación final
echo "🧪 VERIFICACIÓN FINAL:"
echo "=================================================="
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo" | jq '.'

echo ""
echo "🎉 ${GREEN}DEPLOYMENT COMPLETADO${NC}"
echo ""
echo "📝 Próximos pasos:"
echo "  1. Abre Telegram y busca tu bot"
echo "  2. Envía: /start"
echo "  3. Abre: ${VERCEL_URL}"
echo ""
