const { Client, GatewayIntentBits } = require('discord.js');
const dotenv = require('dotenv');

dotenv.config({ path: 'c:/Users/andre/Desktop/Dunko/discord-bot/.env' });

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.once('ready', async () => {
  console.log(`Connected as ${client.user.tag}`);
  const guildId = "1526274994353606726";
  
  try {
    const guild = await client.guilds.fetch(guildId);
    console.log(`\nGuild: ${guild.name}`);
    
    // Fetch all members
    await guild.members.fetch();
    
    // 1. Inspect Velora Role (1526487077372563527)
    const veloraRole = guild.roles.cache.get('1526487077372563527');
    if (veloraRole) {
      console.log(`\nVelora Role Members:`);
      veloraRole.members.forEach(m => {
        console.log(`- ${m.user.tag} (${m.user.id}) [Nickname: ${m.nickname}]`);
      });
    }

    // 2. Inspect Black Angel Role (1526508711860768848)
    const blackAngelRole = guild.roles.cache.get('1526508711860768848');
    if (blackAngelRole) {
      console.log(`\nBlack Angel Role Members:`);
      blackAngelRole.members.forEach(m => {
        console.log(`- ${m.user.tag} (${m.user.id}) [Nickname: ${m.nickname}]`);
      });
    }

  } catch (err) {
    console.error('Error:', err);
  }
  
  client.destroy();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
