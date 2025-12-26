import { pgTable, serial, text, timestamp, integer, real, jsonb, boolean } from 'drizzle-orm/pg-core';

// TABLA 1: Bankroll del Usuario
export const userBankroll = pgTable('user_bankroll', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().unique(), // Para multi-usuario futuro
  currentBalance: real('current_balance').notNull().default(100.0),
  initialInvestment: real('initial_investment').notNull().default(100.0),
  totalProfit: real('total_profit').notNull().default(0),
  roi: real('roi').notNull().default(0), // ROI en porcentaje

  // Risk Settings (v2.1)
  kellyFraction: real('kelly_fraction').default(0.25), // Quarter Kelly by default
  maxStakePercentage: real('max_stake_percentage').default(0.025), // 2.5% max per bet

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
  isTrap: boolean('is_trap').default(false), // Flag for suspicious market lines (v2.5)

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
  closingLineValue: real('closing_line_value'), // ¿Mejoramos vs cierre? (Legacy, mantendremos para backward compat)

  // v2.1 CLV Tracking
  oddsRecommended: real('odds_recommended'), // La cuota cuando lanzamos el pick
  oddsClosing: real('odds_closing'), // La cuota oficial de cierre (Pinnacle/Exchange)
  clvPercentage: real('clv_percentage'), // (Recommended / Closing) - 1

  // Forensics (para auto-tuning)
  expectedGoalsActual: real('expected_goals_actual'), // xG real del partido (si disponible)
  wasLucky: boolean('was_lucky').default(false), // xG alto pero perdió

  calibratedAt: timestamp('calibrated_at'), // Fecha en que se usó para entrenar el modelo (v2.1)

  // v3.0 Interactive Strategy
  betType: text('bet_type'), // 'MONEYLINE', 'GOALS', 'CORNERS', 'PARLAY'
  selectedOdds: real('selected_odds'), // La cuota exacta confirmada por el usuario

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

// --- v2.1 Extensions ---

// TABLA 5: Calibración del Modelo
export const modelCalibration = pgTable('model_calibration', {
  // Composite Key in logic: leagueId + bucket
  id: serial('id').primaryKey(),
  leagueId: integer('league_id').notNull(),
  probabilityBucket: real('probability_bucket').notNull(), // 0.55, 0.60, 0.65, etc.

  totalPredictions: integer('total_predictions').default(0),
  correctPredictions: integer('correct_predictions').default(0),
  actualAccuracy: real('actual_accuracy').default(0), // Win Rate real en este bucket

  lastUpdated: timestamp('last_updated').defaultNow()
});

// TABLA 6: Team Flags (Scouting Automático)
export const teamFlags = pgTable('team_flags', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').notNull(),
  fixtureId: integer('fixture_id').notNull(),

  isRotationSquad: boolean('is_rotation_squad').default(false),
  missingKeyPlayer: boolean('missing_key_player').default(false),
  fatigueAlert: boolean('fatigue_alert').default(false),

  source: text('source'), // "manual", "api-pro", "scraper"
  updatedAt: timestamp('updated_at').defaultNow()
});

export const systemLogs = pgTable('system_logs', {
  id: serial('id').primaryKey(),
  level: text('level').notNull(), // 'INFO', 'WARN', 'ERROR', 'CRITICAL'
  message: text('message').notNull(),
  meta: jsonb('meta'), // Additional context
  timestamp: timestamp('timestamp').defaultNow().notNull()
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

export type ModelCalibration = typeof modelCalibration.$inferSelect;
export type NewModelCalibration = typeof modelCalibration.$inferInsert;

export type TeamFlags = typeof teamFlags.$inferSelect;
export type NewTeamFlags = typeof teamFlags.$inferInsert;

export type SystemLog = typeof systemLogs.$inferSelect;
export type NewSystemLog = typeof systemLogs.$inferInsert;
