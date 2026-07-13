const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.json');

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
