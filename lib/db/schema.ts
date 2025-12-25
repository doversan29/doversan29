import { pgTable, serial, text, timestamp, integer, real, jsonb, boolean } from 'drizzle-orm/pg-core';

// TABLA 1: Bankroll del Usuario
export const userBankroll = pgTable('user_bankroll', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().unique(), // Para multi-usuario futuro
  currentBalance: real('current_balance').notNull().default(100.0),
  initialInvestment: real('initial_investment').notNull().default(100.0),
  totalProfit: real('total_profit').notNull().default(0),
  roi: real('roi').notNull().default(0), // ROI en porcentaje
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// TABLA 2: Análisis de Partidos (Predicciones hechas)
export const matchAnalysis = pgTable('match_analysis', {
  id: serial('id').primaryKey(),
  fixtureId: integer('fixture_id').notNull().unique(), // ID del partido en API-Football
  homeTeam: text('home_team').notNull(),
  awayTeam: text('away_team').notNull(),
  leagueName: text('league_name').notNull(),
  matchDate: timestamp('match_date').notNull(),
  
  // Predicción realizada
  predictedOutcome: text('predicted_outcome').notNull(), // 'HOME', 'DRAW', 'AWAY'
  aiProbability: real('ai_probability').notNull(), // Probabilidad calculada (0-100)
  expectedGoalsHome: real('expected_goals_home').notNull(),
  expectedGoalsAway: real('expected_goals_away').notNull(),
  
  // Cuotas del mercado al momento de la predicción
  oddsHome: real('odds_home'),
  oddsDraw: real('odds_draw'),
  oddsAway: real('odds_away'),
  bookmaker: text('bookmaker'),
  
  // Metadata
  analysisReasoning: text('analysis_reasoning'), // Texto del "Expert Analysis"
  valueEdge: real('value_edge'), // % de ventaja detectada
  strategyUsed: text('strategy_used').notNull().default('poisson_basic'), // 'poisson_basic', 'monte_carlo', etc.
  
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// TABLA 3: Resultados de Apuestas
export const betOutcome = pgTable('bet_outcome', {
  id: serial('id').primaryKey(),
  analysisId: integer('analysis_id').notNull().references(() => matchAnalysis.id),
  
  // Estado de la apuesta
  status: text('status').notNull().default('pending'), // 'pending', 'won', 'lost', 'cancelled'
  stakeAmount: real('stake_amount').notNull(), // Monto apostado
  potentialReturn: real('potential_return'), // Ganancia potencial
  actualReturn: real('actual_return').default(0), // Ganancia real
  profitLoss: real('profit_loss').default(0), // P&L neto
  
  // Análisis post-partido
  actualResult: text('actual_result'), // 'HOME', 'DRAW', 'AWAY'
  actualScore: text('actual_score'), // "2-1"
  closingOdds: real('closing_odds'), // Cuota final antes del partido
  closingLineValue: real('closing_line_value'), // ¿Mejoramos vs cierre?
  
  // Forensics (para auto-tuning)
  expectedGoalsActual: real('expected_goals_actual'), // xG real del partido (si disponible)
  wasLucky: boolean('was_lucky').default(false), // xG alto pero perdió
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  settledAt: timestamp('settled_at')
});

// TABLA 4: Pesos del Sistema (Auto-Tuning)
export const systemWeights = pgTable('system_weights', {
  id: serial('id').primaryKey(),
  strategyName: text('strategy_name').notNull().unique(), // 'poisson_home_advantage', 'recent_form_weight', etc.
  currentWeight: real('current_weight').notNull().default(1.0), // Peso actual (0.0-1.0)
  
  // Métricas de performance
  totalBets: integer('total_bets').notNull().default(0),
  winRate: real('win_rate').notNull().default(0),
  avgEdge: real('avg_edge').notNull().default(0),
  roi: real('roi').notNull().default(0),
  
  // Control de ajuste
  lastAdjustment: timestamp('last_adjustment'),
  adjustmentReason: text('adjustment_reason'),
  
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Tipos TypeScript derivados
export type UserBankroll = typeof userBankroll.$inferSelect;
export type NewUserBankroll = typeof userBankroll.$inferInsert;

export type MatchAnalysis = typeof matchAnalysis.$inferSelect;
export type NewMatchAnalysis = typeof matchAnalysis.$inferInsert;

export type BetOutcome = typeof betOutcome.$inferSelect;
export type NewBetOutcome = typeof betOutcome.$inferInsert;

export type SystemWeight = typeof systemWeights.$inferSelect;
export type NewSystemWeight = typeof systemWeights.$inferInsert;
