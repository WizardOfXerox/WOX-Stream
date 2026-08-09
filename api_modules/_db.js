const fs = require('fs');
const path = require('path');
const os = require('os');
const { getSql, initNeonTables, hasNeon } = require('./_pg');

// Lightweight persistent JSON database for WOX-Stream Cloud Accounts & Watch History
const LOCAL_DB_DIR = path.join(__dirname, '..', 'data');
const LOCAL_DB_FILE = path.join(LOCAL_DB_DIR, 'wox_stream_db.json');
const TMP_DB_FILE = path.join(os.tmpdir(), 'wox_stream_cloud_db.json');

function getDbFilePath() {
  try {
    if (!fs.existsSync(LOCAL_DB_DIR)) {
      fs.mkdirSync(LOCAL_DB_DIR, { recursive: true });
    }
    return LOCAL_DB_FILE;
  } catch (_) {
    return TMP_DB_FILE;
  }
}

function readDb() {
  const filePath = getDbFilePath();
  try {
    if (!fs.existsSync(filePath)) {
      const initial = { users: [], history: [], collections: [], appointments: [] };
      fs.writeFileSync(filePath, JSON.stringify(initial, null, 2));
      return initial;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    return { users: [], history: [], collections: [], appointments: [] };
  }
}

function writeDb(data) {
  const filePath = getDbFilePath();
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {}
}

module.exports = {
  readDb,
  writeDb,
  getSql,
  initNeonTables,
  hasNeon
};
