// ---------------------------------------------------------------------------
// SQLite schema for Mochi AI, run idempotently from TypeScript on startup.
// Keeping migrations here (rather than in Rust) keeps the app TypeScript-first.
// Every statement uses IF NOT EXISTS so re-running is safe.
// ---------------------------------------------------------------------------

export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    display_name TEXT NOT NULL DEFAULT 'Friend',
    pet_type TEXT NOT NULL DEFAULT 'dog',
    level INTEGER NOT NULL DEFAULT 1,
    xp INTEGER NOT NULL DEFAULT 0,
    coins INTEGER NOT NULL DEFAULT 0,
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    last_active_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  `CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL DEFAULT 'medium',
    deadline TEXT,
    estimated_minutes INTEGER NOT NULL DEFAULT 30,
    status TEXT NOT NULL DEFAULT 'pending',
    scheduled_date TEXT,
    fixed_start TEXT,
    splittable INTEGER NOT NULL DEFAULT 1,
    tags TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
  );`,

  `CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_date ON tasks(scheduled_date);`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);`,

  `CREATE TABLE IF NOT EXISTS milestones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    estimated_minutes INTEGER NOT NULL DEFAULT 15,
    xp_reward INTEGER NOT NULL DEFAULT 10,
    completed_at TEXT
  );`,

  `CREATE INDEX IF NOT EXISTS idx_milestones_task ON milestones(task_id);`,

  `CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    available_start TEXT NOT NULL DEFAULT '09:00',
    available_end TEXT NOT NULL DEFAULT '20:00',
    ai_summary TEXT,
    generated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  `CREATE TABLE IF NOT EXISTS schedule_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    milestone_id INTEGER REFERENCES milestones(id) ON DELETE SET NULL,
    block_type TEXT NOT NULL DEFAULT 'task',
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled'
  );`,

  `CREATE INDEX IF NOT EXISTS idx_blocks_schedule ON schedule_blocks(schedule_id);`,

  `CREATE TABLE IF NOT EXISTS focus_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    duration_seconds INTEGER NOT NULL DEFAULT 0
  );`,

  `CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    completion_rate REAL NOT NULL DEFAULT 0,
    focus_minutes INTEGER NOT NULL DEFAULT 0,
    tasks_completed INTEGER NOT NULL DEFAULT 0,
    tasks_missed INTEGER NOT NULL DEFAULT 0,
    ai_summary TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  `CREATE TABLE IF NOT EXISTS pet_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    pet_type TEXT NOT NULL DEFAULT 'dog',
    current_emotion TEXT NOT NULL DEFAULT 'idle',
    growth_stage INTEGER NOT NULL DEFAULT 0,
    last_interaction_at TEXT
  );`,

  `CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    xp_reward INTEGER NOT NULL DEFAULT 0,
    coin_reward INTEGER NOT NULL DEFAULT 0,
    criteria TEXT
  );`,

  `CREATE TABLE IF NOT EXISTS user_achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    unlocked_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  `CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_type TEXT NOT NULL,
    name TEXT NOT NULL,
    cost INTEGER NOT NULL DEFAULT 0,
    owned INTEGER NOT NULL DEFAULT 0,
    equipped INTEGER NOT NULL DEFAULT 0
  );`,

  `CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    related_task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    scheduled_for TEXT NOT NULL,
    fired_at TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
  );`,

  `CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);`,

  `CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0,
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );`,
];

// Single-row tables get their initial row; settings get sensible defaults.
export const SEED_STATEMENTS: string[] = [
  `INSERT OR IGNORE INTO profile (id) VALUES (1);`,
  `INSERT OR IGNORE INTO pet_state (id) VALUES (1);`,
  `INSERT OR IGNORE INTO settings (key, value) VALUES ('theme', 'system');`,
  `INSERT OR IGNORE INTO settings (key, value) VALUES ('provider', 'gemini');`,
  `INSERT OR IGNORE INTO settings (key, value) VALUES ('defaultWorkStart', '09:00');`,
  `INSERT OR IGNORE INTO settings (key, value) VALUES ('defaultWorkEnd', '20:00');`,
  `INSERT OR IGNORE INTO settings (key, value) VALUES ('hideOnFullscreen', 'true');`,
  `INSERT OR IGNORE INTO settings (key, value) VALUES ('autostart', 'false');`,

  // Achievements catalog. Criteria is a JSON {metric, gte} evaluated in TS.
  achievement('first_steps', 'First Steps', 'Complete your first task', '🌱', 20, 5, 'tasks_completed', 1),
  achievement('getting_going', 'Getting Going', 'Complete 10 tasks', '🚀', 50, 20, 'tasks_completed', 10),
  achievement('centurion', 'Centurion', 'Complete 50 tasks', '🏆', 200, 100, 'tasks_completed', 50),
  achievement('on_a_roll', 'On a Roll', 'Reach a 3-day streak', '🔥', 30, 10, 'streak', 3),
  achievement('unstoppable', 'Unstoppable', 'Reach a 7-day streak', '⚡', 80, 40, 'streak', 7),
  achievement('dedicated', 'Dedicated', 'Reach a 30-day streak', '💎', 300, 150, 'streak', 30),
  achievement('rising_star', 'Rising Star', 'Reach level 5', '⭐', 0, 50, 'level', 5),
  achievement('pro', 'Pro', 'Reach level 10', '👑', 0, 100, 'level', 10),
];

function achievement(
  key: string,
  name: string,
  description: string,
  icon: string,
  xp: number,
  coin: number,
  metric: string,
  gte: number,
): string {
  const criteria = JSON.stringify({ metric, gte }).replace(/'/g, "''");
  return `INSERT OR IGNORE INTO achievements
    (key, name, description, icon, xp_reward, coin_reward, criteria)
    VALUES ('${key}', '${name}', '${description}', '${icon}', ${xp}, ${coin}, '${criteria}');`;
}

// Idempotent column-adds for DBs created before a column existed. SQLite has no
// "ADD COLUMN IF NOT EXISTS", so each runs in its own try/catch (see db/index.ts)
// and a "duplicate column" error is expected and ignored.
export const MIGRATION_STATEMENTS: string[] = [
  `ALTER TABLE tasks ADD COLUMN fixed_start TEXT;`,
  `ALTER TABLE tasks ADD COLUMN splittable INTEGER NOT NULL DEFAULT 1;`,
];
