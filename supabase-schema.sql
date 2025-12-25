-- BetPredict v2.0 - Database Schema
-- Ejecuta este script directamente en el SQL Editor de Supabase

-- Tabla 1: Bankroll del Usuario
CREATE TABLE IF NOT EXISTS user_bankroll (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  current_balance REAL NOT NULL DEFAULT 100.0,
  initial_investment REAL NOT NULL DEFAULT 100.0,
  total_profit REAL NOT NULL DEFAULT 0,
  roi REAL NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Tabla 2: Análisis de Partidos
CREATE TABLE IF NOT EXISTS match_analysis (
  id SERIAL PRIMARY KEY,
  fixture_id INTEGER NOT NULL UNIQUE,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  league_name TEXT NOT NULL,
  match_date TIMESTAMP NOT NULL,
  
  predicted_outcome TEXT NOT NULL,
  ai_probability REAL NOT NULL,
  expected_goals_home REAL NOT NULL,
  expected_goals_away REAL NOT NULL,
  
  odds_home REAL,
  odds_draw REAL,
  odds_away REAL,
  bookmaker TEXT,
  
  analysis_reasoning TEXT,
  value_edge REAL,
  strategy_used TEXT NOT NULL DEFAULT 'poisson_basic',
  
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Tabla 3: Resultados de Apuestas
CREATE TABLE IF NOT EXISTS bet_outcome (
  id SERIAL PRIMARY KEY,
  analysis_id INTEGER NOT NULL REFERENCES match_analysis(id),
  
  status TEXT NOT NULL DEFAULT 'pending',
  stake_amount REAL NOT NULL,
  potential_return REAL,
  actual_return REAL DEFAULT 0,
  profit_loss REAL DEFAULT 0,
  
  actual_result TEXT,
  actual_score TEXT,
  closing_odds REAL,
  closing_line_value REAL,
  
  expected_goals_actual REAL,
  was_lucky BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  settled_at TIMESTAMP
);

-- Tabla 4: Pesos del Sistema
CREATE TABLE IF NOT EXISTS system_weights (
  id SERIAL PRIMARY KEY,
  strategy_name TEXT NOT NULL UNIQUE,
  current_weight REAL NOT NULL DEFAULT 1.0,
  
  total_bets INTEGER NOT NULL DEFAULT 0,
  win_rate REAL NOT NULL DEFAULT 0,
  avg_edge REAL NOT NULL DEFAULT 0,
  roi REAL NOT NULL DEFAULT 0,
  
  last_adjustment TIMESTAMP,
  adjustment_reason TEXT,
  
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_match_analysis_fixture ON match_analysis(fixture_id);
CREATE INDEX IF NOT EXISTS idx_bet_outcome_status ON bet_outcome(status);
CREATE INDEX IF NOT EXISTS idx_bet_outcome_analysis ON bet_outcome(analysis_id);

-- Insertar bankroll inicial
INSERT INTO user_bankroll (user_id, current_balance, initial_investment)
VALUES ('default', 100.0, 100.0)
ON CONFLICT (user_id) DO NOTHING;

-- Insertar pesos iniciales del sistema
INSERT INTO system_weights (strategy_name, current_weight) VALUES
  ('poisson_basic', 1.0),
  ('monte_carlo', 1.0),
  ('home_advantage', 1.0),
  ('recent_form', 1.0),
  ('h2h_history', 1.0)
ON CONFLICT (strategy_name) DO NOTHING;

-- ✅ Script completado
