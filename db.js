const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
});

async function migrate() {
  // Drop old tables from previous Discord-based build
  await pool.query(`
    DROP TABLE IF EXISTS assessments CASCADE;
    DROP TABLE IF EXISTS duels CASCADE;
    DROP TABLE IF EXISTS combat_log CASCADE;
    DROP TABLE IF EXISTS zones CASCADE;
    DROP TABLE IF EXISTS quests CASCADE;
    DROP TABLE IF EXISTS inventory CASCADE;
    DROP TABLE IF EXISTS players CASCADE;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      class TEXT NOT NULL,
      level INT DEFAULT 1,
      xp INT DEFAULT 0,
      hp INT DEFAULT 100,
      max_hp INT DEFAULT 100,
      str INT DEFAULT 5,
      wit INT DEFAULT 5,
      dev INT DEFAULT 5,
      luck INT DEFAULT 5,
      favor INT DEFAULT 10,
      zone TEXT DEFAULT 'The Gallery',
      alive BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_seen TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id SERIAL PRIMARY KEY,
      player_id INT REFERENCES players(id) ON DELETE CASCADE,
      item TEXT NOT NULL,
      quantity INT DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS quests (
      id SERIAL PRIMARY KEY,
      player_id INT REFERENCES players(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      zone TEXT NOT NULL,
      type TEXT NOT NULL,
      target TEXT,
      target_count INT DEFAULT 1,
      progress INT DEFAULT 0,
      favor_reward INT DEFAULT 5,
      xp_reward INT DEFAULT 20,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour'
    );

    CREATE TABLE IF NOT EXISTS zones (
      name TEXT PRIMARY KEY,
      description TEXT,
      min_level INT DEFAULT 1,
      tier TEXT DEFAULT 'starter'
    );

    CREATE TABLE IF NOT EXISTS combat_log (
      id SERIAL PRIMARY KEY,
      player_id INT REFERENCES players(id) ON DELETE CASCADE,
      monster TEXT,
      result TEXT,
      damage_dealt INT DEFAULT 0,
      damage_taken INT DEFAULT 0,
      loot TEXT,
      xp_gained INT DEFAULT 0,
      favor_change INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS duels (
      id SERIAL PRIMARY KEY,
      challenger_id INT REFERENCES players(id) ON DELETE CASCADE,
      defender_id INT REFERENCES players(id) ON DELETE CASCADE,
      winner_id INT REFERENCES players(id) ON DELETE CASCADE,
      rounds INT DEFAULT 0,
      favor_stake INT DEFAULT 5,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS assessments (
      id SERIAL PRIMARY KEY,
      player_id INT REFERENCES players(id) ON DELETE CASCADE,
      assessment TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    INSERT INTO zones (name, description, min_level, tier) VALUES
      ('The Gallery', 'The starter halls. Dusty frames and minor annoyances.', 1, 'starter'),
      ('The Studio', 'Where real art happens. You are not real art.', 5, 'mid'),
      ('The Unfinished Canvas', 'Exile. A wasteland of abandoned sketches.', 1, 'exile'),
      ('The Vault', 'The Mistress''s inner sanctum. Only the worthy tread here.', 10, 'endgame')
    ON CONFLICT (name) DO NOTHING;
  `);
}

module.exports = { pool, migrate };
