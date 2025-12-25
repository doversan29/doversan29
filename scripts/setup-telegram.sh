#!/bin/bash

# Script para configurar el webhook de Telegram
# Reemplaza https://tu-dominio.com con tu URL de Vercel después del deploy

BOT_TOKEN="8446993306:AAGSsUP0gsre9qKKD_0ReI1tUx1M9ZUdKyg"
WEBHOOK_URL="https://tu-dominio.vercel.app/api/telegram"  # Cambiar después del deploy
SECRET_TOKEN="betpredict_v2_webhook_secret_2025"

echo "🤖 Configurando webhook de Telegram..."
echo ""

# Configurar webhook
RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"${WEBHOOK_URL}\",
    \"secret_token\": \"${SECRET_TOKEN}\",
    \"allowed_updates\": [\"message\", \"callback_query\"]
  }")

echo "$RESPONSE" | jq '.'

# Verificar configuración
echo ""
echo "📊 Verificando webhook..."
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" | jq '.'

echo ""
echo "✅ Configuración completada"
echo ""
echo "⚠️  IMPORTANTE:"
echo "   1. Actualiza WEBHOOK_URL cuando despliegues a Vercel"
echo "   2. Vuelve a ejecutar este script después del deploy"
echo ""
echo "🧪 Prueba tu bot enviando: /start"
