# BetPredict v2.0 🎯

Sistema autónomo de predicción deportiva con IA, detección de value bets y bot de Telegram interactivo.

## 🚀 Features

- **Monte Carlo Simulation**: 1,000+ simulaciones por partido
- **Value Bet Detection**: Edge >10% automático
- **Kelly Criterion**: Cálculo inteligente de stakes
- **Telegram Bot**: Notificaciones interactivas
- **Auto-Tuning**: Sistema de pesos auto-ajustable
- **Supabase**: Base de datos PostgreSQL en la nube

## 🛠️ Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS 4.0
- Supabase (PostgreSQL + Drizzle ORM)
- API-Football
- Telegram Bot API

## 📦 Installation

```bash
npm install
cp .env.template .env.local
# Completar variables en .env.local
npm run db:push
npm run init:db
npm run dev
```

## 🎯 Deployment

Ver `DEPLOY_MANUAL.md` para instrucciones completas.

## 📊 Testing

```bash
npm run test-system  # Tests de Monte Carlo + Kelly
npm run dev         # Dev server
```

## 📄 License

MIT
