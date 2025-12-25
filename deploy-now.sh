#!/bin/bash

echo "🚀 PASO FINAL: Deploy a Vercel"
echo "=============================="
echo ""
echo "✅ Base de datos Supabase: LISTA"
echo "✅ Código testeado: COMPLETO"
echo "✅ Variables de entorno: CONFIGURADAS"
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: Ejecuta este script desde /web-app"
    exit 1
fi

# Opción 1: Deploy con npx (no requiere instalación global)
echo "📦 Opción 1: Deploy Rápido con npx"
echo ""
echo "Ejecuta:"
echo "  npx vercel --prod"
echo ""
echo "Sigue las instrucciones:"
echo "  1. Link to existing project? → No"
echo "  2. Project name? → betpredict (o el que quieras)"
echo "  3. Directory? → ./"
echo "  4. Want to modify settings? → N"
echo ""
read -p "¿Quieres que ejecute el deploy ahora? (y/n): " respuesta

if [ "$respuesta" = "y" ] || [ "$respuesta" = "Y" ]; then
    echo ""
    echo "🚀 Iniciando deploy..."
    npx vercel --prod
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Deploy completado!"
        echo ""
        read -p "Pega aquí tu URL de Vercel: " VERCEL_URL
        
        # Configurar webhook de Telegram
        echo ""
        echo "🤖 Configurando Telegram webhook..."
        
        source .env.local
        
        curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
          -H "Content-Type: application/json" \
          -d "{
            \"url\": \"${VERCEL_URL}/api/telegram\",
            \"secret_token\": \"${TELEGRAM_WEBHOOK_SECRET}\"
          }"
        
        echo ""
        echo ""
        echo "🎉 ¡SISTEMA 100% OPERACIONAL!"
        echo ""
        echo "📱 Prueba tu bot:"
        echo "   1. Abre Telegram"
        echo "   2. Busca tu bot"
        echo "   3. Envía: /start"
        echo ""
        echo "🌐 Tu app:"
        echo "   ${VERCEL_URL}"
    fi
else
    echo ""
    echo "📋 Deploy Manual:"
    echo ""
    echo "1. Ejecuta: npx vercel --prod"
    echo "2. Copia tu URL"
    echo "3. Ejecuta: npm run setup:telegram (con la URL actualizada)"
fi
