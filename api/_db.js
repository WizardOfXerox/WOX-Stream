const fs = require('fs');
const path = require('path');
const os = require('os');

// Lightweight persistent JSON database for WOX-Stream Cloud Accounts & Watch History
const DB_FILE = path.join(os.tmpdir(), 'wox_stream_cloud_db.json');

function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initial = { users: [], history: [], collections: [], appointments: [] };
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
      return initial;
    }
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    return { users: [], history: [], collections: [], appointments: [] };
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (err) {}
}

module.exports = {
  readDb,
  writeDb
};
