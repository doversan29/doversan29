#!/bin/bash

# Script de configuración de BetPredict v2.0
# Este script crea el archivo .env.local con las credenciales reales

cat > .env.local << 'EOF'
# API-Football (Existing)
API_FOOTBALL_KEY=5ffa5e98d6c14df81acba1a6f318e30d
API_FOOTBALL_BASE_URL=https://v3.football.api-football.com

# Supabase Database
NEXT_PUBLIC_SUPABASE_URL=https://zpvpyizifptdtlhiflru.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_Y7XwpNI1s2lm54XZwzD69A_ZxqqJ8-L

# IMPORTANTE: Reemplaza [PASSWORD] con tu password real de Supabase
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.zpvpyizifptdtlhiflru.supabase.co:5432/postgres

# Telegram Bot
TELEGRAM_BOT_TOKEN=8446993306:AAGSsUP0gsre9qKKD_0ReI1tUx1M9ZUdKyg
TELEGRAM_WEBHOOK_SECRET=betpredict_v2_webhook_secret_2025
TELEGRAM_CHAT_ID=1310719106

# Next.js
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF

echo "✅ Archivo .env.local creado"
echo "⚠️  IMPORTANTE: Edita .env.local y reemplaza [PASSWORD] con tu password de Supabase"
