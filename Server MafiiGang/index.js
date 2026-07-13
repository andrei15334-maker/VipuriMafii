const dotenv = require('dotenv');
const { client } = require('./bot');
const { startWebserver } = require('./server');

dotenv.config();

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error('[ERROARE] DISCORD_TOKEN lipsește din fișierul .env!');
  process.exit(1);
}

console.log('[SISTEM] Se inițializează conectarea botului la Discord...');
client.login(TOKEN).then(() => {
  console.log('[SISTEM] Botul s-a conectat cu succes! Se pornește serverul Web...');
  startWebserver();
}).catch(err => {
  console.error('[SISTEM] Eroare la conectarea botului Discord:', err.message);
  console.error('[SISTEM] Verifică dacă token-ul din fișierul .env este corect și activ.');
  process.exit(1);
});
