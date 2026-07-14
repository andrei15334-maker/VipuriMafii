const { Client, GatewayIntentBits } = require('discord.js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: 'c:/Users/andre/Desktop/Dunko/discord-bot/.env' });

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
  console.log(`Connected as ${client.user.tag}`);
  const guildId = "1526274994353606726";
  
  try {
    const guild = await client.guilds.fetch(guildId);
    console.log(`\nGuild: ${guild.name} (${guild.id})`);
    
    const channels = await guild.channels.fetch();
    const categories = channels.filter(c => c.type === 4); // Category channels
    
    console.log('\n--- CATEGORIES AND CHANNELS ---');
    for (const [catId, cat] of categories) {
      console.log(`\nCategory: [${cat.name}] (${cat.id})`);
      const children = channels.filter(c => c.parentId === catId);
      for (const [childId, child] of children) {
        console.log(`  - #${child.name} (${child.id}) [Type: ${child.type}]`);
      }
    }
    
    console.log('\n--- CHANNELS WITHOUT CATEGORY ---');
    const noCategory = channels.filter(c => !c.parentId && c.type !== 4);
    for (const [childId, child] of noCategory) {
      console.log(`  - #${child.name} (${child.id}) [Type: ${child.type}]`);
    }
    
    // Read local database
    const dbPath = 'c:/Users/andre/Desktop/Dunko/discord-bot/database.json';
    if (fs.existsSync(dbPath)) {
      const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      console.log('\n--- DATABASE MAFIAS ---');
      console.log(JSON.stringify(db.mafias, null, 2));
    } else {
      console.log('\nDatabase file not found at: ' + dbPath);
    }
    
  } catch (err) {
    console.error('Error fetching guild channels:', err);
  }
  
  client.destroy();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
