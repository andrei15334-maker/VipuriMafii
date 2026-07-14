const { Client, GatewayIntentBits } = require('discord.js');
const dotenv = require('dotenv');

dotenv.config({ path: 'c:/Users/andre/Desktop/Dunko/discord-bot/.env' });

const client = new Client({
  intents: [GatewayIntentBits.Guilds] // Only use Guilds intent
});

client.once('ready', async () => {
  console.log(`Connected as ${client.user.tag}`);
  const guildId = "1526274994353606726";
  
  try {
    const guild = await client.guilds.fetch(guildId);
    console.log(`\nGuild: ${guild.name}`);
    
    // Fetch roles
    const roles = await guild.roles.fetch();
    console.log('\n--- ROLES ---');
    for (const [id, r] of roles) {
      console.log(`- ${r.name} (${id}) [Color: ${r.hexColor}]`);
    }
  } catch (err) {
    console.error('Error:', err);
  }
  
  client.destroy();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
