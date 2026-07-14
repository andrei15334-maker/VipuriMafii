const { Client, GatewayIntentBits } = require('discord.js');
const dotenv = require('dotenv');

dotenv.config({ path: 'c:/Users/andre/Desktop/Dunko/discord-bot/.env' });

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
  console.log(`Connected as ${client.user.tag}`);
  const guildId = "1526274994353606726";
  
  try {
    const guild = await client.guilds.fetch(guildId);
    console.log(`Guild: ${guild.name}`);
    
    // Check if we can fetch role members
    const veloraRole = guild.roles.cache.get('1526487077372563527');
    if (veloraRole) {
      console.log(`Velora role members in cache count: ${veloraRole.members.size}`);
      veloraRole.members.forEach(m => {
        console.log(`- ${m.user.username} (${m.id})`);
      });
    }

    const blackAngelRole = guild.roles.cache.get('1526508711860768848');
    if (blackAngelRole) {
      console.log(`Black Angel role members in cache count: ${blackAngelRole.members.size}`);
      blackAngelRole.members.forEach(m => {
        console.log(`- ${m.user.username} (${m.id})`);
      });
    }
  } catch (err) {
    console.error('Error:', err);
  }
  
  client.destroy();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
