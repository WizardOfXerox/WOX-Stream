/**
 * Neon Serverless Postgres Client for WOX-Stream
 * Native cloud scaling for Users, Watch History, Watchlist & Appointments.
 */

const { neon } = require('@neondatabase/serverless');

const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || '';

let sql = null;

if (DATABASE_URL) {
  try {
    sql = neon(DATABASE_URL);
  } catch (err) {
    console.error('Neon DB Connection Init Error:', err.message);
  }
}

let isInitialized = false;

async function initNeonTables() {
  if (!sql) return false;
  if (isInitialized) return true;

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS wox_users (
        id VARCHAR(100) PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(200) UNIQUE NOT NULL,
        salt VARCHAR(100) NOT NULL,
        password_hash VARCHAR(200) NOT NULL,
        avatar TEXT,
        created_at BIGINT NOT NULL
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS wox_history (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        media_id VARCHAR(100) NOT NULL,
        title TEXT NOT NULL,
        cover TEXT,
        episode_id VARCHAR(100),
        episode_name TEXT,
        progress INT DEFAULT 0,
        duration INT DEFAULT 0,
        timestamp BIGINT NOT NULL
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS wox_collections (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        media_id VARCHAR(100) NOT NULL,
        category INT DEFAULT 1,
        title TEXT NOT NULL,
        cover TEXT,
        score VARCHAR(20),
        timestamp BIGINT NOT NULL
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS wox_appointments (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        media_id VARCHAR(100) NOT NULL,
        title TEXT NOT NULL,
        cover TEXT,
        timestamp BIGINT NOT NULL
      );
    `;

    isInitialized = true;
    console.log('⚡ Neon Serverless Postgres tables ready!');
    return true;
  } catch (err) {
    console.error('Failed to initialize Neon Postgres tables:', err.message);
    return false;
  }
}

module.exports = {
  getSql: () => sql,
  initNeonTables,
  hasNeon: () => !!DATABASE_URL && !!sql
};
