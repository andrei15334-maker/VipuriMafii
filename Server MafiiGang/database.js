const fs = require('fs');
const path = require('path');

const dbPathLocal = path.join(__dirname, 'database.json');
let dbPath = dbPathLocal;

// On Render, if a persistent disk is mounted at /data, use it and migrate local DB on first boot
const persistentDir = '/data';
const persistentDbPath = '/data/database.json';

if (fs.existsSync(persistentDir)) {
  dbPath = persistentDbPath;
  if (!fs.existsSync(persistentDbPath) && fs.existsSync(dbPathLocal)) {
    try {
      fs.copyFileSync(dbPathLocal, persistentDbPath);
      console.log('[DATABASE] Successfully migrated local database.json to persistent disk at /data/database.json');
    } catch (err) {
      console.error('[DATABASE] Failed to copy local database to persistent disk:', err.message);
    }
  }
}

function readDb() {
  try {
    if (!fs.existsSync(dbPath)) {
      const initial = {
        mafias: [],
        settings: {
          guildId: "",
          managerRoleId: "",
          logsChannelId: "",
          setupChannelId: ""
        }
      };
      fs.writeFileSync(dbPath, JSON.stringify(initial, null, 2));
      return initial;
    }
    const data = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading database:', err);
    return { mafias: [], settings: {} };
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error writing database:', err);
  }
}

module.exports = {
  readDb,
  writeDb
};
