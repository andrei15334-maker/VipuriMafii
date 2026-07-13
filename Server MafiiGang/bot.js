const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  StringSelectMenuBuilder, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  PermissionsBitField, 
  ChannelType 
} = require('discord.js');
const dotenv = require('dotenv');
const { readDb, writeDb } = require('./database');

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
    // GatewayIntentBits.GuildMembers — activeaza din: discord.com/developers > Bot > Privileged Gateway Intents > SERVER MEMBERS INTENT
  ],
  partials: [Partials.Channel, Partials.GuildMember, Partials.User]
});

// Register slash commands globally on startup and perform auto-setup
client.once('ready', async () => {
  console.log(`[DISCORD] Conectat ca ${client.user.tag}!`);
  
  try {
    await client.application.commands.set([
      {
        name: 'setup-server',
        description: 'Configurează serverul complet pentru managementul mafiilor (canale, roluri, etc.)',
        defaultMemberPermissions: PermissionsBitField.Flags.Administrator.toString()
      }
    ]);
    console.log('[DISCORD] Comenzi slash înregistrate cu succes.');
  } catch (err) {
    console.error('[DISCORD] Eroare la înregistrarea comenzilor slash:', err);
  }

  // Automatic setup on ready for target guild
  const targetGuildId = "1526274994353606726";
  try {
    const guild = await client.guilds.fetch(targetGuildId).catch(() => null);
    if (guild) {
      const db = readDb();
      let setupExists = false;
      if (db.settings.setupChannelId) {
        const setupChan = await guild.channels.fetch(db.settings.setupChannelId).catch(() => null);
        if (setupChan) setupExists = true;
      }
      
      if (!setupExists) {
        console.log(`[DISCORD] Se realizează configurarea automată pentru serverul: ${guild.name}...`);
        await performServerSetup(guild);
        console.log(`[DISCORD] Configurare automată finalizată cu succes.`);
      } else {
        console.log(`[DISCORD] Serverul ${guild.name} este deja configurat.`);
      }
    }
  } catch (err) {
    console.error(`[DISCORD] Eroare la configurarea automată a serverului pe startup:`, err.message);
  }
});

// Helper function to convert text to bold Unicode math sans-serif font
function toBoldUnicode(text) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const boldChars = '𝗔𝗕𝗖𝗗Ｅ𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤🇷𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶加快𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵';
  
  // Wait, let's fix the letters to make sure they are exactly right
  const mapping = {
    'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚', 'H': '𝗛', 'I': '𝗜', 'J': '𝗝',
    'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡', 'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧',
    'U': '𝗨', 'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭',
    'a': '𝗮', 'b': '𝗯', 'c': '𝗰', 'd': '𝗱', 'e': '𝗲', 'f': '𝗳', 'g': '𝗴', 'h': '𝗵', 'i': '𝗶', 'j': '𝗷',
    'k': '𝗸', 'l': '𝗹', 'm': '𝗺', 'n': '𝗻', 'o': '𝗼', 'p': '𝗽', 'q': '𝗾', 'r': '𝗿', 's': '𝘀', 't': '𝘁',
    'u': '𝘂', 'v': '𝘃', 'w': '𝘄', 'x': '𝘅', 'y': '𝘆', 'z': '𝘇',
    '0': '𝟬', '1': '𝟭', '2': '𝟮', '3': '𝟯', '4': '𝟰', '5': '𝟱', '6': '𝟲', '7': '𝟳', '8': '𝟴', '9': '𝟵'
  };
  
  return text.split('').map(c => mapping[c] || c).join('');
}

// Helper function to perform complete guild setup (roles, categories, channels)
async function performServerSetup(guild) {
  const db = readDb();
  
  // A. Create/Find global roles with premium names dynamically generated
  const staffName = '👑 ' + toBoldUnicode('Manager Staff');
  let managerStaffRole = guild.roles.cache.find(r => r.name === 'Manager Staff' || r.name === staffName);
  if (!managerStaffRole) {
    managerStaffRole = await guild.roles.create({
      name: staffName,
      color: '#E74C3C', // Soft Red
      reason: 'Sistem Management Mafii - Super Admin'
    });
  }

  const managerName = '🛡️ ' + toBoldUnicode('Manager Mafii / Gang');
  let managerRole = guild.roles.cache.find(r => r.name === 'Manager Mafii/Gang' || r.name === managerName);
  if (!managerRole) {
    managerRole = await guild.roles.create({
      name: managerName,
      color: '#F1C40F', // Gold
      permissions: [PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.ManageRoles],
      reason: 'Sistem Management Mafii - Admin'
    });
  }
  
  const oficialName = '🔴 ' + toBoldUnicode('Lider Mafie Oficiala');
  let liderOficialaRole = guild.roles.cache.find(r => r.name === 'Lider Mafie Oficiala' || r.name === oficialName);
  if (!liderOficialaRole) {
    liderOficialaRole = await guild.roles.create({ name: oficialName, color: '#FF0000', reason: 'Sistem Management Mafii' });
  }

  const coOficialName = '🔺 ' + toBoldUnicode('Co-Lider Mafie Oficiala');
  let coLiderOficialaRole = guild.roles.cache.find(r => r.name === 'Co-Lider Mafie Oficiala' || r.name === coOficialName);
  if (!coLiderOficialaRole) {
    coLiderOficialaRole = await guild.roles.create({ name: coOficialName, color: '#C0392B', reason: 'Sistem Management Mafii' });
  }

  const neoficialName = '🟤 ' + toBoldUnicode('Lider Mafie Neoficiala');
  let liderNeoficialaRole = guild.roles.cache.find(r => r.name === 'Lider Mafie Neoficiala' || r.name === neoficialName);
  if (!liderNeoficialaRole) {
    liderNeoficialaRole = await guild.roles.create({ name: neoficialName, color: '#990000', reason: 'Sistem Management Mafii' });
  }

  const coNeoficialName = '🔻 ' + toBoldUnicode('Co-Lider Mafie Neoficiala');
  let coLiderNeoficialaRole = guild.roles.cache.find(r => r.name === 'Co-Lider Mafie Neoficiala' || r.name === coNeoficialName);
  if (!coLiderNeoficialaRole) {
    coLiderNeoficialaRole = await guild.roles.create({ name: coNeoficialName, color: '#6E2B2B', reason: 'Sistem Management Mafii' });
  }

  const gangName = '🟢 ' + toBoldUnicode('Lider Gang');
  let liderGangRole = guild.roles.cache.find(r => r.name === 'Lider Gang' || r.name === gangName);
  if (!liderGangRole) {
    liderGangRole = await guild.roles.create({ name: gangName, color: '#00FF00', reason: 'Sistem Management Mafii' });
  }

  const coGangName = '🟩 ' + toBoldUnicode('Co-Lider Gang');
  let coLiderGangRole = guild.roles.cache.find(r => r.name === 'Co-Lider Gang' || r.name === coGangName);
  if (!coLiderGangRole) {
    coLiderGangRole = await guild.roles.create({ name: coGangName, color: '#27AE60', reason: 'Sistem Management Mafii' });
  }

  // Create warning roles as well
  let av1 = guild.roles.cache.find(r => r.name === 'AV 1/3' || r.name === '⚠️ 𝗔𝗩 𝟭/𝟯');
  if (!av1) {
    av1 = await guild.roles.create({
      name: '⚠️ 𝗔𝗩 𝟭/𝟯',
      color: '#F1C40F',
      reason: 'Sistem Avertismente Mafii'
    });
  }

  let av2 = guild.roles.cache.find(r => r.name === 'AV 2/3' || r.name === '⚠️ 𝗔𝗩 𝟮/𝟯');
  if (!av2) {
    av2 = await guild.roles.create({
      name: '⚠️ 𝗔𝗩 𝟮/𝟯',
      color: '#E67E22',
      reason: 'Sistem Avertismente Mafii'
    });
  }

  let av3 = guild.roles.cache.find(r => r.name === 'AV 3/3' || r.name === '⚠️ 𝗔𝗩 𝟯/𝟯');
  if (!av3) {
    av3 = await guild.roles.create({
      name: '⚠️ 𝗔𝗩 𝟯/𝟯',
      color: '#E74C3C',
      reason: 'Sistem Avertismente Mafii'
    });
  }
  
  // B. Create categories with premium styles
  // Category 1: Management Mafii (Hidden)
  let mgmtCategory = guild.channels.cache.find(c => (c.name === '📢 MANAGEMENT MAFII' || c.name === '📢 𝗠𝗔𝗡𝗔𝗚𝗘𝗠𝗘𝗡𝗧 𝗠𝗔𝗙𝗜𝗜') && c.type === ChannelType.GuildCategory);
  if (!mgmtCategory) {
    mgmtCategory = await guild.channels.create({
      name: '📢 𝗠𝗔𝗡𝗔𝗚𝗘𝗠𝗘𝗡𝗧 𝗠𝗔𝗙𝗜𝗜',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: guild.id, // @everyone
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: managerRole.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
        },
        {
          id: managerStaffRole.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
        }
      ]
    });
  }
  
  // Logs Channel
  let logsChannel = guild.channels.cache.find(c => (c.name === 'logs-mafii' || c.name === '📰│𝗹𝗼𝗴𝘀-𝗺𝗮𝗳𝗶𝗶') && c.type === ChannelType.GuildText);
  if (!logsChannel) {
    logsChannel = await guild.channels.create({
      name: '📰│𝗹𝗼𝗴𝘀-𝗺𝗮𝗳𝗶𝗶',
      type: ChannelType.GuildText,
      parent: mgmtCategory.id
    });
  }
  
  // Category 2: Informații (Everyone sees, only staff writes)
  let infoCategory = guild.channels.cache.find(c => (c.name === '📋 INFORMAȚII MAFII' || c.name === '📋 𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗧𝗜𝗜 𝗠𝗔𝗙𝗜𝗜') && c.type === ChannelType.GuildCategory);
  if (!infoCategory) {
    infoCategory = await guild.channels.create({
      name: '📋 𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗧𝗜𝗜 𝗠𝗔𝗙𝗜𝗜',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: guild.id, // @everyone
          allow: [PermissionsBitField.Flags.ViewChannel],
          deny: [PermissionsBitField.Flags.SendMessages]
        },
        {
          id: managerRole.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
        },
        {
          id: managerStaffRole.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
        }
      ]
    });
  }
  
  // Setup Channel
  let setupChannel = guild.channels.cache.find(c => (c.name === 'înregistrare-mafii' || c.name === '📥│𝗶𝗻𝗿𝗲𝗴𝗶𝘀𝘁𝗿𝗮𝗿𝗲-𝗺𝗮𝗳𝗶𝗶') && c.type === ChannelType.GuildText);
  if (!setupChannel) {
    setupChannel = await guild.channels.create({
      name: '📥│𝗶𝗻𝗿𝗲𝗴𝗶𝘀𝘁𝗿𝗮𝗿𝗲-𝗺𝗮𝗳𝗶𝗶',
      type: ChannelType.GuildText,
      parent: infoCategory.id
    });
  }

  // Category 3: Global Mafia Zone (Visible to all mafia roles and managers)
  let globalCategory = guild.channels.cache.find(c => (c.name === '🌐 ZONĂ GLOBALĂ MAFII' || c.name === '🌐 𝗭𝗢𝗡𝗔 𝗚𝗟𝗢𝗕𝗔𝗟𝗔 𝗠𝗔𝗙𝗜𝗜') && c.type === ChannelType.GuildCategory);
  if (!globalCategory) {
    globalCategory = await guild.channels.create({
      name: '🌐 𝗭𝗢𝗡𝗔 𝗚𝗟𝗢𝗕𝗔𝗟𝗔 𝗠𝗔𝗙𝗜𝗜',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: guild.id, // @everyone
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: managerRole.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
        },
        {
          id: managerStaffRole.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
        }
      ]
    });
  }

  // Announcements Channel (Managers write, members read)
  let globalAnnounce = guild.channels.cache.find(c => (c.name === '📢│anunțuri-global' || c.name === '📢│𝗮𝗻𝘂𝗻𝘁𝘂𝗿𝗶-𝗴𝗹𝗼𝗯𝗮𝗹') && c.type === ChannelType.GuildText);
  if (!globalAnnounce) {
    globalAnnounce = await guild.channels.create({
      name: '📢│𝗮𝗻𝘂𝗻𝘁𝘂𝗿𝗶-𝗴𝗹𝗼𝗯𝗮𝗹',
      type: ChannelType.GuildText,
      parent: globalCategory.id,
      permissionOverwrites: [
        {
          id: guild.id, // @everyone
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: managerRole.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
        },
        {
          id: managerStaffRole.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
        }
      ]
    });
  }

  // Global Chat Channel (All write)
  let globalChat = guild.channels.cache.find(c => (c.name === '💬│chat-global' || c.name === '💬│𝗰𝗵𝗮𝘁-𝗴𝗹𝗼𝗯𝗮𝗹') && c.type === ChannelType.GuildText);
  if (!globalChat) {
    globalChat = await guild.channels.create({
      name: '💬│𝗰𝗵𝗮𝘁-𝗴𝗹𝗼𝗯𝗮𝗹',
      type: ChannelType.GuildText,
      parent: globalCategory.id
    });
  }

  // Global Voice Lobby
  let globalVoice = guild.channels.cache.find(c => (c.name === '🔊│Voice Global' || c.name === '🔊│𝗩𝗼𝗶𝗰𝗲 𝗚𝗹𝗼𝗯𝗮𝗹') && c.type === ChannelType.GuildVoice);
  if (!globalVoice) {
    globalVoice = await guild.channels.create({
      name: '🔊│𝗩𝗼𝗶𝗰𝗲 𝗚𝗹𝗼𝗯𝗮𝗹',
      type: ChannelType.GuildVoice,
      parent: globalCategory.id
    });
  }
  
  // Send Panel Embed
  const embed = new EmbedBuilder()
    .setTitle('⚔️ SISTEM MANAGEMENT MAFII & GANG-URI ⚔️')
    .setDescription(
      `Bun venit pe serverul **Vipuri Roleplay**!\n\n` +
      `Aici se gestionează toate facțiunile ilegale de pe server. Dacă dorești să înregistrezi o organizație nouă sau să te alături uneia deja existente, folosește butoanele de mai jos:\n\n` +
      `🔹 **Creează o Mafie / Gang**: Înregistrează o facțiune nouă. Va fi creat un rol dedicat și canale private în secțiunea mafiilor.\n` +
      `🔹 **Alătură-te unei Mafii**: Primește rolul unei mafii deja existente pentru a accesa canalele lor de chat și voice.`
    )
    .setColor('#FF0000')
    .setThumbnail(client.user.displayAvatarURL())
    .setFooter({ text: 'Vipuri Roleplay - Management Automatizat' })
    .setTimestamp();
    
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_create_mafia')
      .setLabel('Creează o Mafie / Gang')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('➕'),
    new ButtonBuilder()
      .setCustomId('btn_join_mafia')
      .setLabel('Alătură-te unei Mafii Existente')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('👥')
  );
  
  // Send or replace panel message
  await setupChannel.send({ embeds: [embed], components: [buttons] });

  // ══════════════════════════════════════════════════════════════
  // ROL VERIFICAT + CANAL VERIFICARE
  // ══════════════════════════════════════════════════════════════

  // Creeaza rolul "Verificat" daca nu exista
  let verificatRole = guild.roles.cache.find(r => r.name === '✅ Verificat');
  if (!verificatRole) {
    verificatRole = await guild.roles.create({
      name: '✅ Verificat',
      color: '#2ECC71',
      reason: 'Sistem Verificare Identitate FiveM'
    });
  }

  // Canal #verificare — vizibil de toata lumea (inclusiv cei fara roluri)
  let verificareChannel = guild.channels.cache.find(
    c => (c.name === 'verificare' || c.name === '🔐│verificare') && c.type === ChannelType.GuildText
  );
  if (!verificareChannel) {
    verificareChannel = await guild.channels.create({
      name: '🔐│verificare',
      type: ChannelType.GuildText,
      parent: infoCategory.id,
      permissionOverwrites: [
        {
          id: guild.id, // @everyone poate vedea si citi
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
          deny:  [PermissionsBitField.Flags.SendMessages]
        },
        {
          id: managerRole.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
        },
        {
          id: managerStaffRole.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
        }
      ]
    });
  }

  // Trimite embed-ul de verificare in canal (doar daca nu exista deja)
  const existingMsgs = await verificareChannel.messages.fetch({ limit: 10 }).catch(() => new Map());
  const hasVerifyMsg = [...existingMsgs.values()].some(m => m.author.id === client.user.id && m.components.length > 0);

  if (!hasVerifyMsg) {
    const verifyEmbed = new EmbedBuilder()
      .setTitle('🔐 VERIFICARE IDENTITATE — VIPURI ROLEPLAY')
      .setColor('#2ECC71')
      .setDescription(
        `Bun venit pe serverul **Vipuri Roleplay**! 👋\n\n` +
        `Înainte de a putea accesa canalele serverului și de a te **înregistra într-o mafie**, trebuie să îți verifici identitatea.\n\n` +
        `**Ce trebuie să faci:**\n` +
        `> 1️⃣ Apasă butonul **Verifică-te** de mai jos\n` +
        `> 2️⃣ Completează **Numele tău in-game** exact cum apare pe server\n` +
        `> 3️⃣ Completează **ID-ul tău de pe serverul FiveM** (numărul din joc)\n` +
        `> 4️⃣ Apasă **Submit** — nickname-ul tău va fi setat automat: \`Andrei | 5933\`\n\n` +
        `✅ Odată verificat, vei primi acces la server și te vei putea înregistra!`
      )
      .setFooter({ text: 'Vipuri Roleplay • Sistem Automat de Verificare' })
      .setTimestamp();

    const verifyBtn = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_verify_identity')
        .setLabel('🔐 Verifică-te')
        .setStyle(ButtonStyle.Success)
    );

    await verificareChannel.send({ embeds: [verifyEmbed], components: [verifyBtn] });
  }

  // Save database settings — including all role IDs
  db.settings = {
    guildId: guild.id,
    managerStaffRoleId: managerStaffRole.id,
    managerRoleId: managerRole.id,
    logsChannelId: logsChannel.id,
    setupChannelId: setupChannel.id,
    verificareChannelId: verificareChannel.id,
    verificatRoleId: verificatRole.id,
    zoneCategoryId: globalCategory.id,
    globalCategoryId: globalCategory.id,
    globalAnnouncementsChannelId: globalAnnounce.id,
    // Lider role IDs
    liderOficialaRoleId:      liderOficialaRole.id,
    liderNeoficialaRoleId:    liderNeoficialaRole.id,
    liderGangRoleId:          liderGangRole.id,
    // Co-Lider role IDs
    coLiderOficialaRoleId:    coLiderOficialaRole.id,
    coLiderNeoficialaRoleId:  coLiderNeoficialaRole.id,
    coLiderGangRoleId:        coLiderGangRole.id
  };
  writeDb(db);
}

// Event Handler for Slash Commands and Interactions
client.on('interactionCreate', async (interaction) => {
  const db = readDb();
  
  // 1. Slash Commands
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'setup-server') {
      await interaction.deferReply({ ephemeral: true });
      
      const { guild } = interaction;
      
      try {
        await performServerSetup(guild);
        await interaction.editReply({ content: 'Serverul a fost configurat cu succes! Categoriile, canalele și rolurile au fost create.' });
      } catch (err) {
        console.error('[DISCORD] Eroare la /setup-server:', err);
        await interaction.editReply({ content: 'A apărut o eroare la configurarea serverului. Verifică consola.' });
      }
    }
  }
  
  // 2. Button Interactions
  else if (interaction.isButton()) {

    // ══════════════════════════════════════════════════════════
    // BUTON VERIFICARE IDENTITATE
    // ══════════════════════════════════════════════════════════
    if (interaction.customId === 'btn_verify_identity') {
      // Daca e deja verificat, nu mai arata modalul
      const verificatRoleId = db.settings.verificatRoleId;
      if (verificatRoleId) {
        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (member && member.roles.cache.has(verificatRoleId)) {
          return interaction.reply({
            content: '✅ Ești deja verificat! Poți accesa canalele serverului.',
            ephemeral: true
          });
        }
      }

      // Arata modalul de verificare
      const modal = new ModalBuilder()
        .setCustomId('modal_verify_identity')
        .setTitle('🔐 Verificare Identitate — Vipuri Roleplay');

      const nameInput = new TextInputBuilder()
        .setCustomId('verify_ingame_name')
        .setLabel('Numele tău în joc (exact cum apare)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: Andrei Ionescu')
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(50);

      const idInput = new TextInputBuilder()
        .setCustomId('verify_fivem_id')
        .setLabel('ID-ul tău de pe serverul FiveM')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 5933  (numărul care apare în joc)')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(10);

      modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(idInput)
      );

      await interaction.showModal(modal);
      return;
    }

    if (interaction.customId === 'btn_create_mafia') {
      // Verifica daca e verificat
      if (db.settings.verificatRoleId) {
        const memberCheck = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (memberCheck && !memberCheck.roles.cache.has(db.settings.verificatRoleId)) {
          const verCh = db.settings.verificareChannelId ? `<#${db.settings.verificareChannelId}>` : 'canalul #verificare';
          return interaction.reply({
            content: `❌ **Nu ești verificat!**\nMergi mai întâi în ${verCh} și apasă butonul **Verifică-te** pentru a-ți înregistra identitatea.`,
            ephemeral: true
          });
        }
      }

      // Check if user already owns/is leader of a mafia in database
      const existing = db.mafias.find(m => m.ownerId === interaction.user.id);
      if (existing) {
        return interaction.reply({ content: `❌ Deții deja o mafie înregistrată: **${existing.name}**! Nu poți crea alta.`, ephemeral: true });
      }
      
      // Send select menu for Faction Type
      const typeMenu = new StringSelectMenuBuilder()
        .setCustomId('select_mafia_type')
        .setPlaceholder('Alege tipul facțiunii...')
        .addOptions([
          {
            label: 'Mafie Oficială',
            value: 'oficiala',
            description: 'Rol lider roșu și canale private.',
            emoji: '🔴'
          },
          {
            label: 'Mafie Neoficială',
            value: 'neoficiala',
            description: 'Rol lider roșu închis și canale private.',
            emoji: '🟤'
          },
          {
            label: 'Gang / Organizație',
            value: 'gang',
            description: 'Rol lider verde și canale private.',
            emoji: '🟢'
          }
        ]);
        
      const row = new ActionRowBuilder().addComponents(typeMenu);
      
      await interaction.reply({ 
        content: 'Selectează tipul facțiunii pe care dorești să o înființezi:', 
        components: [row], 
        ephemeral: true 
      });
    }
    
    else if (interaction.customId === 'btn_add_arrow') {
      const channel = interaction.channel;
      const categoryId = channel.parentId;
      
      const mafia = db.mafias.find(m => m.categoryId === categoryId);
      if (!mafia) {
        return interaction.reply({ content: '❌ Nu s-a putut găsi mafia asociată acestui canal.', ephemeral: true });
      }

      // ─── Verificare acces: doar Lider sau Co-Lider ───
      const memberRoles = interaction.member.roles.cache;
      const liderRoleIds = [
        db.settings.liderOficialaRoleId, db.settings.liderNeoficialaRoleId, db.settings.liderGangRoleId,
        db.settings.coLiderOficialaRoleId, db.settings.coLiderNeoficialaRoleId, db.settings.coLiderGangRoleId,
        db.settings.managerRoleId, db.settings.managerStaffRoleId
      ].filter(Boolean);

      const isLeaderOrCoLeader = liderRoleIds.some(id => memberRoles.has(id));
      if (!isLeaderOrCoLeader) {
        return interaction.reply({
          content: '❌ Doar **Liderii** și **Co-Liderii** pot adăuga săgeți oficiale!',
          ephemeral: true
        });
      }
      
      const modal = new ModalBuilder()
        .setCustomId(`modal_add_arrow_${mafia.id}`)
        .setTitle('🏹 Adaugă Săgeată Oficială');
        
      const nameInput = new TextInputBuilder()
        .setCustomId('arrow_name')
        .setLabel('Numele Săgeții (exact cum apare in-game)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: Andrei Ionescu')
        .setRequired(true)
        .setMaxLength(50);
        
      const idInput = new TextInputBuilder()
        .setCustomId('arrow_fivem_id')
        .setLabel('ID-ul Săgeții pe serverul FiveM')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 5933  (numărul din joc, nu Discord ID!)')
        .setRequired(true)
        .setMaxLength(10);
        
      const row1 = new ActionRowBuilder().addComponents(nameInput);
      const row2 = new ActionRowBuilder().addComponents(idInput);
      modal.addComponents(row1, row2);
      
      await interaction.showModal(modal);
    }
    
    else if (interaction.customId === 'btn_join_mafia') {
      if (db.mafias.length === 0) {
        return interaction.reply({ content: '❌ Nu există nicio mafie înregistrată momentan pe server.', ephemeral: true });
      }
      
      const options = db.mafias.map(m => ({
        label: m.name,
        value: m.id,
        description: `Tip: ${m.type.toUpperCase()}`,
        emoji: '⚔️'
      })).slice(0, 25); // Max 25 options in Discord select menu
      
      const joinMenu = new StringSelectMenuBuilder()
        .setCustomId('select_mafia_join')
        .setPlaceholder('Alege mafia din listă...')
        .addOptions(options);
        
      const row = new ActionRowBuilder().addComponents(joinMenu);
      
      await interaction.reply({
        content: 'Selectează mafia în care dorești să intri:',
        components: [row],
        ephemeral: true
      });
    }
  }
  
  // 3. String Select Menu Interactions
  else if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'select_mafia_type') {
      const type = interaction.values[0];
      
      // Open Modal for Faction Name
      const modal = new ModalBuilder()
        .setCustomId(`modal_create_mafia_${type}`)
        .setTitle(`Creare ${type.toUpperCase()}`);
        
      const nameInput = new TextInputBuilder()
        .setCustomId('mafia_name')
        .setLabel('Numele Mafiei / Gang-ului')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: Ballas, Cosa Nostra, Corleone...')
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(30);

      const colorInput = new TextInputBuilder()
        .setCustomId('mafia_color')
        .setLabel('Culoare Rol (Hex sau Nume, ex: #FF5733)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: #ff0000 sau rosu, verde, albastru...')
        .setRequired(false)
        .setMaxLength(20);
        
      const row1 = new ActionRowBuilder().addComponents(nameInput);
      const row2 = new ActionRowBuilder().addComponents(colorInput);
      modal.addComponents(row1, row2);
      
      await interaction.showModal(modal);
    }
    
    else if (interaction.customId === 'select_mafia_join') {
      const mafiaId = interaction.values[0];
      const mafia = db.mafias.find(m => m.id === mafiaId);
      
      if (!mafia) {
        return interaction.reply({ content: '❌ Această mafie nu a mai fost găsită în baza de date.', ephemeral: true });
      }

      // Verifica daca userul e verificat
      if (db.settings.verificatRoleId) {
        const memberCheck = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (memberCheck && !memberCheck.roles.cache.has(db.settings.verificatRoleId)) {
          const verCh = db.settings.verificareChannelId ? `<#${db.settings.verificareChannelId}>` : 'canalul #verificare';
          return interaction.reply({
            content: `❌ **Nu ești verificat!**\nTrebuie să treci mai întâi prin verificarea de identitate în ${verCh} înainte de a intra într-o mafie.`,
            ephemeral: true
          });
        }
      }
      
      // Check if user is already in this mafia
      if (mafia.members.includes(interaction.user.id)) {
        return interaction.reply({ content: '❌ Faci deja parte din această mafie!', ephemeral: true });
      }
      
      // Check if user is in any other mafia
      const inOther = db.mafias.find(m => m.members.includes(interaction.user.id));
      if (inOther) {
        return interaction.reply({ content: `❌ Faci parte deja din altă mafie (**${inOther.name}**)! Trebuie să ieși din ea mai întâi.`, ephemeral: true });
      }
      
      // ─── Show in-game verification modal before joining ───
      const joinModal = new ModalBuilder()
        .setCustomId(`modal_join_verify_${mafiaId}`)
        .setTitle(`🎮 Verificare Identitate — ${mafia.name}`);

      const nameInput = new TextInputBuilder()
        .setCustomId('ingame_name')
        .setLabel('Numele tău în joc (exact)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: Andrei Ionescu')
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(50);

      const fivemIdInput = new TextInputBuilder()
        .setCustomId('fivem_id')
        .setLabel('ID-ul tău pe serverul FiveM')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 5933  (numărul care apare în joc)')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(10);

      joinModal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(fivemIdInput)
      );

      await interaction.showModal(joinModal);
    }
  }
  
  else if (interaction.isModalSubmit()) {

    // ══════════════════════════════════════════════════════════
    // MODAL VERIFICARE IDENTITATE
    // ══════════════════════════════════════════════════════════
    if (interaction.customId === 'modal_verify_identity') {
      await interaction.deferReply({ ephemeral: true });

      const ingameName = interaction.fields.getTextInputValue('verify_ingame_name').trim();
      const fivemId    = interaction.fields.getTextInputValue('verify_fivem_id').trim();
      const newNickname = `${ingameName} | ${fivemId}`;

      const db = readDb();

      try {
        const member = await interaction.guild.members.fetch(interaction.user.id);

        // 1. Seteaza nickname-ul: "Andrei | 5933"
        try {
          await member.setNickname(newNickname);
        } catch (_) {
          // Esueaza daca userul e owner sau are roluri mai mari ca botul
        }

        // 2. Da rolul "Verificat"
        if (db.settings.verificatRoleId) {
          await member.roles.add(db.settings.verificatRoleId).catch(() => {});
        }

        // 3. Salveaza profilul in baza de date
        if (!db.profiles) db.profiles = {};
        db.profiles[interaction.user.id] = {
          ingameName,
          fivemId,
          nickname: newNickname,
          verifiedAt: new Date().toLocaleDateString('ro-RO')
        };
        writeDb(db);

        // 4. Log in canalul de logs
        const logChannel = interaction.guild.channels.cache.get(db.settings.logsChannelId);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle('🔐 VERIFICARE COMPLETATA')
            .setColor('#2ECC71')
            .setThumbnail(interaction.user.displayAvatarURL())
            .addFields(
              { name: 'Utilizator Discord', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: false },
              { name: 'Nickname setat',     value: `\`${newNickname}\``, inline: true },
              { name: 'Nume In-Game',       value: ingameName,           inline: true },
              { name: 'ID Server FiveM',    value: fivemId,              inline: true }
            )
            .setTimestamp();
          await logChannel.send({ embeds: [logEmbed] });
        }

        // 5. Confirmare pentru utilizator
        await interaction.editReply({
          content:
            `✅ **Verificare completă!**\n\n` +
            `🏷️ Nickname setat: \`${newNickname}\`\n` +
            `🎮 Nume in-game: **${ingameName}**\n` +
            `🔢 ID Server FiveM: **${fivemId}**\n\n` +
            `Acum poți accesa canalele serverului și te poți înregistra într-o mafie sau gang din canalul de înregistrare!`
        });

      } catch (err) {
        console.error('[DISCORD] Eroare la verificare identitate:', err);
        await interaction.editReply({ content: '❌ A apărut o eroare la verificare. Contactează un administrator.' });
      }
      return;
    }

    // ─── In-Game Verification modal on join ───────────────────
    if (interaction.customId.startsWith('modal_join_verify_')) {
      await interaction.deferReply({ ephemeral: true });
      const mafiaId    = interaction.customId.replace('modal_join_verify_', '');
      const ingameName = interaction.fields.getTextInputValue('ingame_name').trim();
      const fivemId    = interaction.fields.getTextInputValue('fivem_id').trim();

      // Nickname format: "Andrei | 5933"
      const newNickname = `${ingameName} | ${fivemId}`;
      
      const db = readDb();
      const mafia = db.mafias.find(m => m.id === mafiaId);
      if (!mafia) return interaction.editReply({ content: '❌ Mafia nu mai există.' });

      if (mafia.members.includes(interaction.user.id)) {
        return interaction.editReply({ content: '❌ Faci deja parte din această mafie!' });
      }
      const inOther = db.mafias.find(m => m.members.includes(interaction.user.id));
      if (inOther) {
        return interaction.editReply({ content: `❌ Ești deja în **${inOther.name}**! Ieși din ea mai întâi.` });
      }

      try {
        const member = await interaction.guild.members.fetch(interaction.user.id);

        // Add faction role
        await member.roles.add(mafia.roleId);

        // Set nickname: "Andrei | 5933"
        try {
          await member.setNickname(newNickname);
        } catch (_) { /* Fails if user is server owner or has higher perms */ }

        // Save profile
        if (!db.profiles) db.profiles = {};
        db.profiles[interaction.user.id] = {
          ingameName,
          fivemId,
          nickname: newNickname,
          updatedAt: new Date().toLocaleDateString('ro-RO')
        };

        // Add to faction
        mafia.members.push(interaction.user.id);
        writeDb(db);

        // Log
        const logChannel = interaction.guild.channels.cache.get(db.settings.logsChannelId);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle('👤 MEMBRU NOU')
            .setColor('#3498DB')
            .addFields(
              { name: 'Jucător Discord', value: `<@${interaction.user.id}>`, inline: true },
              { name: 'Facțiune', value: mafia.name, inline: true },
              { name: 'Nume In-Game', value: ingameName, inline: true },
              { name: 'ID CFX', value: cfxId, inline: true }
            )
            .setTimestamp();
          await logChannel.send({ embeds: [logEmbed] });
        }

        await interaction.editReply({
          content: `✅ Te-ai alăturat mafiei **${mafia.name}**!\n🎮 Profil înregistrat: **${ingameName}** (CFX: ${cfxId})\nNickname-ul tău pe Discord a fost actualizat automat.`
        });
      } catch (err) {
        console.error('[DISCORD] Eroare la join + verificare:', err);
        await interaction.editReply({ content: '❌ Eroare la alăturare. Verifică permisiunile botului.' });
      }
    }


    if (interaction.customId.startsWith('modal_add_arrow_')) {
      await interaction.deferReply({ ephemeral: true });
      
      const mafiaId = interaction.customId.replace('modal_add_arrow_', '');
      const arrowName = interaction.fields.getTextInputValue('arrow_name').trim();
      const arrowFivemId = interaction.fields.getTextInputValue('arrow_fivem_id').trim();
      
      const db = readDb();
      const mafia = db.mafias.find(m => m.id === mafiaId);
      if (!mafia) {
        return interaction.editReply({ content: '❌ Mafia nu a mai fost găsită.' });
      }
      
      if (!mafia.arrows) mafia.arrows = [];
      
      const exists = mafia.arrows.find(a => a.fivemId === arrowFivemId);
      if (exists) {
        return interaction.editReply({ content: `❌ Săgeata cu ID-ul FiveM **${arrowFivemId}** este deja înregistrată!` });
      }
      
      const newArrow = {
        id: `arrow_${Date.now()}`,
        name: arrowName,
        fivemId: arrowFivemId,
        addedBy: interaction.user.username,
        createdAt: new Date().toLocaleDateString('ro-RO')
      };
      
      mafia.arrows.push(newArrow);
      writeDb(db);
      
      // Update channels list message
      const arrowsChannelId = mafia.channels.arrows;
      if (arrowsChannelId) {
        const channel = await interaction.guild.channels.fetch(arrowsChannelId).catch(() => null);
        if (channel) {
          const listEmbed = new EmbedBuilder()
            .setTitle('🏹 LISTĂ SĂGEȚI OFICIALE')
            .setColor(0xD35400)
            .setDescription(
              mafia.arrows.map((a, idx) => `**${idx + 1}.** ${a.name} (ID: **${a.fivemId}**) - Adăugat de: **${a.addedBy}** la ${a.createdAt}`).join('\n') || 'Nicio săgeată înregistrată momentan.'
            )
            .setTimestamp();
            
          const messages = await channel.messages.fetch({ limit: 10 }).catch(() => []);
          const listMsg = messages.find(m => m.embeds[0]?.title === '🏹 LISTĂ SĂGEȚI OFICIALE');
          if (listMsg) {
            await listMsg.edit({ embeds: [listEmbed] });
          } else {
            await channel.send({ embeds: [listEmbed] });
          }
        }
      }
      
      await interaction.editReply({ content: `✅ Săgeata **${arrowName}** (ID FiveM: ${arrowFivemId}) a fost înregistrată cu succes!` });
      
      // Send log
      await sendLogEmbed(
        '🏹 SĂGEATĂ OFICIALĂ ADĂUGATĂ',
        `Membru **${interaction.user.username}** a adăugat săgeata **${arrowName}** (ID FiveM: **${arrowFivemId}**) în facțiunea **${mafia.name}**.`,
        '#D35400'
      );
    }
    
    else if (interaction.customId.startsWith('modal_create_mafia_')) {
      await interaction.deferReply({ ephemeral: true });
      
      const type = interaction.customId.replace('modal_create_mafia_', '');
      const mafiaName = interaction.fields.getTextInputValue('mafia_name').trim();
      const rawColor = interaction.fields.getTextInputValue('mafia_color')?.trim() || '';
      
      // Check case-insensitive duplication
      const exists = db.mafias.find(m => m.name.toLowerCase() === mafiaName.toLowerCase());
      if (exists) {
        return interaction.editReply({ content: `❌ O mafie cu numele **${mafiaName}** există deja pe server!` });
      }
      
      const { guild } = interaction;
      const managerRoleId = db.settings.managerRoleId;
      const zoneCategoryId = db.settings.zoneCategoryId;
      
      if (!managerRoleId || !zoneCategoryId) {
        return interaction.editReply({ content: '❌ Configurația serverului nu este completă. Un administrator trebuie să ruleze `/setup-server` din nou.' });
      }
      
      try {
        // Create Mafia Role
        let roleColor = '#95A5A6'; // Default Grey
        if (type === 'oficiala') roleColor = '#FF3333';
        if (type === 'neoficiala') roleColor = '#A93226';
        if (type === 'gang') roleColor = '#2ECC71';
        
        // Parse custom color if provided
        if (rawColor) {
          let hex = rawColor;
          if (hex.match(/^[0-9A-Fa-f]{6}$/)) {
            hex = '#' + hex;
          }
          
          const colorMap = {
            'rosu': '#FF0000',
            'roșu': '#FF0000',
            'verde': '#00FF00',
            'albastru': '#0000FF',
            'galben': '#FFFF00',
            'mov': '#800080',
            'portocaliu': '#FFA500',
            'roz': '#FFC0CB',
            'alb': '#FFFFFF',
            'negru': '#000000',
            'gri': '#808080',
            'cyan': '#00FFFF',
            'magenta': '#FF00FF'
          };
          
          const cleanColor = hex.toLowerCase();
          if (colorMap[cleanColor]) {
            roleColor = colorMap[cleanColor];
          } else if (hex.startsWith('#') && hex.match(/^#[0-9A-Fa-f]{6}$/)) {
            roleColor = hex;
          }
        }
        
        let rolePrefix = '💀│';
        if (type === 'oficiala') rolePrefix = '🔴│';
        if (type === 'neoficiala') rolePrefix = '🟤│';
        if (type === 'gang') rolePrefix = '🟢│';
        
        const mafiaRole = await guild.roles.create({
          name: `${rolePrefix}${mafiaName}`,
          color: roleColor,
          reason: `Creare mafie: ${mafiaName}`
        });
        
        // Give Mafia Role to Creator
        const member = await guild.members.fetch(interaction.user.id);
        await member.roles.add(mafiaRole.id);
        
        // Give Leader Role to Creator — use ID from settings (saved at /setup-server)
        const leaderRoleIdMap = {
          'oficiala':   db.settings.liderOficialaRoleId,
          'neoficiala': db.settings.liderNeoficialaRoleId,
          'gang':       db.settings.liderGangRoleId
        };
        const leaderRoleId = leaderRoleIdMap[type];

        if (leaderRoleId) {
          try {
            await member.roles.add(leaderRoleId);
            console.log(`[DISCORD] ✅ Rol lider "${type}" acordat lui ${interaction.user.tag}`);
          } catch (roleErr) {
            console.error(`[DISCORD] ❌ Nu s-a putut acorda rolul de lider: ${roleErr.message}`);
          }
        } else {
          // Fallback: cauta dupa ID direct in cache dupa orice varianta de nume
          const fallbackRole = guild.roles.cache.find(r =>
            r.name.toLowerCase().includes('lider') &&
            (
              (type === 'oficiala'   && r.name.toLowerCase().includes('oficial')) ||
              (type === 'neoficiala' && r.name.toLowerCase().includes('neof')) ||
              (type === 'gang'       && r.name.toLowerCase().includes('gang'))
            )
          );
          if (fallbackRole) {
            await member.roles.add(fallbackRole.id).catch(e => console.error('[DISCORD] Fallback role error:', e.message));
            console.log(`[DISCORD] ✅ Rol lider gasit prin fallback: "${fallbackRole.name}"`);
          } else {
            console.warn(`[DISCORD] ⚠️ Rolul de lider pentru "${type}" nu a fost gasit! Ruleaza /setup-server din nou pentru a salva ID-urile.`);
          }
        }
        
        // Create Mafia Category Permissions Overwrites
        const overwrites = [
          {
            id: guild.id, // @everyone
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: mafiaRole.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel, 
              PermissionsBitField.Flags.SendMessages, 
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.Connect,
              PermissionsBitField.Flags.Speak
            ]
          },
          {
            id: managerRoleId,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.ManageChannels,
              PermissionsBitField.Flags.ManageMessages
            ]
          }
        ];
        
        const managerStaffRoleId = db.settings.managerStaffRoleId;
        if (managerStaffRoleId) {
          overwrites.push({
            id: managerStaffRoleId,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.ManageChannels,
              PermissionsBitField.Flags.ManageMessages
            ]
          });
        }
        
        // Create Mafia Category with premium Unicode font
        const cleanName = mafiaName.replace(/[^a-zA-Z0-9 ]/g, '').trim();
        const boldPrefix = type === 'gang' ? ' 🔫 𝗚𝗔𝗡𝗚 ' : ' ⚔️ 𝗠𝗔𝗙𝗜𝗘 ';
        const category = await guild.channels.create({
          name: `[${boldPrefix}] ${toBoldUnicode(cleanName.toUpperCase())}`,
          type: ChannelType.GuildCategory,
          permissionOverwrites: overwrites
        });
        
        // Create Channels in Category with explicit overwrites and premium Unicode names
        const chatChannel = await guild.channels.create({
          name: `💬│𝗰𝗵𝗮𝘁-${cleanName.toLowerCase().replace(/ /g, '-')}`,
          type: ChannelType.GuildText,
          parent: category.id,
          permissionOverwrites: overwrites
        });
        
        const tasksChannel = await guild.channels.create({
          name: `📋│𝘁𝗮𝘀𝗸-𝘂𝗿𝗶-${cleanName.toLowerCase().replace(/ /g, '-')}`,
          type: ChannelType.GuildText,
          parent: category.id,
          permissionOverwrites: overwrites
        });
        
        const sanctionsChannel = await guild.channels.create({
          name: `⚠️│𝘀𝗮𝗻𝗰𝘁𝗶𝘂𝗻𝗶-${cleanName.toLowerCase().replace(/ /g, '-')}`,
          type: ChannelType.GuildText,
          parent: category.id,
          permissionOverwrites: overwrites
        });
        
        const voiceChannel = await guild.channels.create({
          name: `🔊│𝗩𝗼𝗶𝗰𝗲 𝗟𝗼𝗯𝗯𝘆`,
          type: ChannelType.GuildVoice,
          parent: category.id,
          permissionOverwrites: overwrites
        });
        
        let arrowsChannelId = null;
        if (type !== 'gang') {
          const arrowsChannel = await guild.channels.create({
            name: `🏹│𝘀𝗮𝗴𝗲𝘁𝗶-𝗼𝗳𝗶𝗰𝗶𝗮𝗹𝗲`,
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites: overwrites
          });
          arrowsChannelId = arrowsChannel.id;
          
          const embedMsg = new EmbedBuilder()
            .setTitle('🏹 SISTEM SĂGEȚI OFICIALE')
            .setColor(0xD35400)
            .setDescription(
              `Acest canal este destinat înregistrării săgeților oficiale ale mafiei **${mafiaName}**.\n\n` +
              `Apasă pe butonul de mai jos pentru a înregistra o săgeată oficială cu ID și nume în baza de date.`
            );
            
          const btn = new ButtonBuilder()
            .setCustomId('btn_add_arrow')
            .setLabel('➕ Adaugă Săgeată')
            .setStyle(ButtonStyle.Primary);
            
          const row = new ActionRowBuilder().addComponents(btn);
          await arrowsChannel.send({ embeds: [embedMsg], components: [row] });
          
          const listEmbed = new EmbedBuilder()
            .setTitle('🏹 LISTĂ SĂGEȚI OFICIALE')
            .setColor(0xD35400)
            .setDescription('Nicio săgeată înregistrată momentan.')
            .setTimestamp();
          await arrowsChannel.send({ embeds: [listEmbed] });
        }

        // Allow this mafia role to see the Global Category and Announcements Channel
        const globalCatId = db.settings.globalCategoryId;
        if (globalCatId) {
          const globalCat = await guild.channels.fetch(globalCatId).catch(() => null);
          if (globalCat) {
            await globalCat.permissionOverwrites.create(mafiaRole.id, {
              ViewChannel: true
            });
          }
        }
        
        const globalAnnounceId = db.settings.globalAnnouncementsChannelId;
        if (globalAnnounceId) {
          const globalAnnounce = await guild.channels.fetch(globalAnnounceId).catch(() => null);
          if (globalAnnounce) {
            await globalAnnounce.permissionOverwrites.create(mafiaRole.id, {
              ViewChannel: true,
              SendMessages: false, // Read-only announcements
              ReadMessageHistory: true
            });
          }
        }
        
        // Add to Database
        const mafiaId = `mafia_${Date.now()}`;
        const newMafia = {
          id: mafiaId,
          name: mafiaName,
          type: type,
          roleId: mafiaRole.id,
          categoryId: category.id,
          channels: {
            chat: chatChannel.id,
            tasks: tasksChannel.id,
            sanctions: sanctionsChannel.id,
            voice: voiceChannel.id,
            arrows: arrowsChannelId
          },
          ownerId: interaction.user.id,
          members: [interaction.user.id],
          tasks: [],
          sanctions: [],
        };
        
        db.mafias.push(newMafia);
        writeDb(db);
        
        // Send Log to Logs Channel
        const logChannel = guild.channels.cache.get(db.settings.logsChannelId);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle('🆕 FACȚIUNE ÎNREGISTRATĂ')
            .setDescription(`A fost creată o nouă organizație pe server!`)
            .addFields([
              { name: 'Nume', value: mafiaName, inline: true },
              { name: 'Tip', value: type.toUpperCase(), inline: true },
              { name: 'Fondator / Lider', value: `<@${interaction.user.id}>`, inline: true },
              { name: 'Rol Discord', value: `<@&${mafiaRole.id}>`, inline: true },
              { name: 'Categorie', value: category.name, inline: true }
            ])
            .setColor('#2ECC71') // Green success log
            .setTimestamp();
          await logChannel.send({ embeds: [logEmbed] });
        }
        
        await interaction.editReply({ 
          content: `✅ Facțiunea **${mafiaName}** a fost înregistrată cu succes! Rolul, categoria și canalele tale private au fost create.` 
        });
      } catch (err) {
        console.error('[DISCORD] Eroare la crearea mafiei:', err);
        await interaction.editReply({ content: '❌ A apărut o eroare la crearea canalelor sau rolurilor. Verifică permisiunile botului.' });
      }
    }
  }
});

// Export helper function to add/remove roles from the Web Dashboard
async function modifyMemberRole(userId, roleId, action) {
  const db = readDb();
  const guildId = db.settings.guildId || "1526274994353606726";
  
  try {
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId);
    
    if (action === 'add') {
      await member.roles.add(roleId);
    } else if (action === 'remove') {
      await member.roles.remove(roleId);
    }
    return true;
  } catch (err) {
    console.error(`[DISCORD] Eroare la modificarea rolului pentru ${userId}:`, err);
    return false;
  }
}

// Export helper to apply warning roles
async function applyWarningRoles(userId, count) {
  const db = readDb();
  const guildId = db.settings.guildId || "1526274994353606726";
  
  try {
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId);

    // Fetch or create warning roles
    let av1 = guild.roles.cache.find(r => r.name === 'AV 1/3');
    if (!av1) {
      av1 = await guild.roles.create({
        name: 'AV 1/3',
        color: '#F1C40F',
        reason: 'Sistem Avertismente Mafii'
      });
    }

    let av2 = guild.roles.cache.find(r => r.name === 'AV 2/3');
    if (!av2) {
      av2 = await guild.roles.create({
        name: 'AV 2/3',
        color: '#E67E22',
        reason: 'Sistem Avertismente Mafii'
      });
    }

    let av3 = guild.roles.cache.find(r => r.name === 'AV 3/3');
    if (!av3) {
      av3 = await guild.roles.create({
        name: 'AV 3/3',
        color: '#E74C3C',
        reason: 'Sistem Avertismente Mafii'
      });
    }

    // Toggle warning roles
    if (count === 1) {
      await member.roles.add(av1.id);
      await member.roles.remove(av2.id).catch(() => null);
      await member.roles.remove(av3.id).catch(() => null);
    } else if (count === 2) {
      await member.roles.add(av2.id);
      await member.roles.remove(av1.id).catch(() => null);
      await member.roles.remove(av3.id).catch(() => null);
    } else if (count >= 3) {
      await member.roles.add(av3.id);
      await member.roles.remove(av1.id).catch(() => null);
      await member.roles.remove(av2.id).catch(() => null);
    } else {
      await member.roles.remove(av1.id).catch(() => null);
      await member.roles.remove(av2.id).catch(() => null);
      await member.roles.remove(av3.id).catch(() => null);
    }
    return true;
  } catch (err) {
    console.error(`[DISCORD] Eroare la aplicarea rolurilor de avertisment pentru ${userId}:`, err);
    return false;
  }
}

// Export function to send log embeds from the Web Dashboard
async function sendLogEmbed(title, description, color = '#F1C40F') {
  const db = readDb();
  const guildId = db.settings.guildId || "1526274994353606726";
  if (!db.settings.logsChannelId) return;
  
  try {
    const guild = await client.guilds.fetch(guildId);
    const logChannel = guild.channels.cache.get(db.settings.logsChannelId);
    
    if (logChannel) {
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.error('[DISCORD] Eroare la trimiterea log-ului din dashboard:', err);
  }
}

// Export function to update channel list messages (like task notifications)
async function sendChannelMessage(channelId, content, embedObj = null) {
  try {
    const channel = await client.channels.fetch(channelId);
    if (channel) {
      if (embedObj) {
        const embed = new EmbedBuilder(embedObj);
        await channel.send({ content, embeds: [embed] });
      } else {
        await channel.send(content);
      }
      return true;
    }
  } catch (err) {
    console.error(`[DISCORD] Eroare la trimiterea mesajului pe canalul ${channelId}:`, err);
  }
  return false;
}

// Export helper to update Faction details on Discord
async function updateDiscordFaction(roleId, categoryId, channels, oldName, newName, oldType, newType) {
  const db = readDb();
  const guildId = db.settings.guildId || "1526274994353606726";
  
  try {
    const guild = await client.guilds.fetch(guildId);
    
    // 1. Rename Discord Role & Color
    const role = await guild.roles.fetch(roleId);
    if (role) {
      const updates = {};
      let rolePrefix = '💀│';
      if (newType === 'oficiala') rolePrefix = '🔴│';
      if (newType === 'neoficiala') rolePrefix = '🟤│';
      if (newType === 'gang') rolePrefix = '🟢│';
      
      if (oldName !== newName || oldType !== newType) {
        updates.name = `${rolePrefix}${newName}`;
      }
      
      if (oldType !== newType) {
        let roleColor = '#95A5A6';
        if (newType === 'oficiala') roleColor = '#FF3333';
        if (newType === 'neoficiala') roleColor = '#A93226';
        if (newType === 'gang') roleColor = '#2ECC71';
        updates.color = roleColor;
      }
      
      if (Object.keys(updates).length > 0) {
        await role.edit(updates);
      }
    }
    
    // 2. Rename Category
    const category = await guild.channels.fetch(categoryId);
    if (category) {
      const cleanName = newName.replace(/[^a-zA-Z0-9 ]/g, '').trim();
      const boldPrefix = newType === 'gang' ? ' 🔫 𝗚𝗔𝗡𝗚 ' : ' ⚔️ 𝗠𝗔𝗙Ｉ𝗘 ';
      await category.setName(`[${boldPrefix}] ${toBoldUnicode(cleanName.toUpperCase())}`);
    }
    
    // 3. Rename channels
    const cleanNameLower = newName.replace(/[^a-zA-Z0-9 ]/g, '').trim().toLowerCase().replace(/ /g, '-');
    if (channels.chat) {
      const chatChan = await guild.channels.fetch(channels.chat).catch(() => null);
      if (chatChan) await chatChan.setName(`💬│𝗰𝗵𝗮𝘁-${cleanNameLower}`);
    }
    if (channels.tasks) {
      const tasksChan = await guild.channels.fetch(channels.tasks).catch(() => null);
      if (tasksChan) await tasksChan.setName(`📋│𝘁𝗮𝘀𝗸-𝘂𝗿𝗶-${cleanNameLower}`);
    }
    if (channels.sanctions) {
      const sanctionsChan = await guild.channels.fetch(channels.sanctions).catch(() => null);
      if (sanctionsChan) await sanctionsChan.setName(`⚠️│𝘀𝗮𝗻𝗰𝘁𝗶𝘂𝗻𝗶-${cleanNameLower}`);
    }
    if (channels.voice) {
      const voiceChan = await guild.channels.fetch(channels.voice).catch(() => null);
      if (voiceChan) await voiceChan.setName(`🔊│𝗩𝗼𝗶𝗰𝗲 𝗟𝗼𝗯𝗯𝘆`);
    }
    if (channels.arrows) {
      const arrowsChan = await guild.channels.fetch(channels.arrows).catch(() => null);
      if (arrowsChan) await arrowsChan.setName(`🏹│𝘀𝗮𝗴𝗲𝘁𝗶-𝗼𝗳𝗶𝗰𝗶𝗮𝗹𝗲`);
    }

    // Handle gang <-> mafia transition for arrows channel
    if (newType !== 'gang' && !channels.arrows) {
      const arrowsChan = await guild.channels.create({
        name: `🏹│𝘀𝗮𝗴𝗲𝘁𝗶-𝗼𝗳𝗶𝗰𝗶𝗮𝗹𝗲`,
        type: ChannelType.GuildText,
        parent: categoryId,
        permissionOverwrites: category.permissionOverwrites.cache
      });
      channels.arrows = arrowsChan.id;
      
      const embedMsg = new EmbedBuilder()
        .setTitle('🏹 SISTEM SĂGEȚI OFICIALE')
        .setColor(0xD35400)
        .setDescription(
          `Acest canal este destinat înregistrării săgeților oficiale ale mafiei **${newName}**.\n\n` +
          `Apasă pe butonul de mai jos pentru a înregistra o săgeată oficială.`
        );
      const btn = new ButtonBuilder()
        .setCustomId('btn_add_arrow')
        .setLabel('➕ Adaugă Săgeată')
        .setStyle(ButtonStyle.Primary);
      const row = new ActionRowBuilder().addComponents(btn);
      await arrowsChan.send({ embeds: [embedMsg], components: [row] });
      
      const listEmbed = new EmbedBuilder()
        .setTitle('🏹 LISTĂ SĂGEȚI OFICIALE')
        .setColor(0xD35400)
        .setDescription('Nicio săgeată înregistrată momentan.')
        .setTimestamp();
      await arrowsChan.send({ embeds: [listEmbed] });
    } else if (newType === 'gang' && channels.arrows) {
      const arrowsChan = await guild.channels.fetch(channels.arrows).catch(() => null);
      if (arrowsChan) await arrowsChan.delete().catch(() => null);
      delete channels.arrows;
    }
    
    return true;
  } catch (err) {
    console.error('[DISCORD] Eroare la actualizarea facțiunii pe Discord:', err);
    return false;
  }
}

// Export helper to delete Faction details on Discord
async function deleteDiscordFaction(roleId, categoryId, channels) {
  const db = readDb();
  const guildId = db.settings.guildId || "1526274994353606726";
  
  try {
    const guild = await client.guilds.fetch(guildId);
    
    // Delete Channels
    if (channels.chat) {
      const chatChan = await guild.channels.fetch(channels.chat).catch(() => null);
      if (chatChan) await chatChan.delete().catch(() => null);
    }
    if (channels.tasks) {
      const tasksChan = await guild.channels.fetch(channels.tasks).catch(() => null);
      if (tasksChan) await tasksChan.delete().catch(() => null);
    }
    if (channels.sanctions) {
      const sanctionsChan = await guild.channels.fetch(channels.sanctions).catch(() => null);
      if (sanctionsChan) await sanctionsChan.delete().catch(() => null);
    }
    if (channels.voice) {
      const voiceChan = await guild.channels.fetch(channels.voice).catch(() => null);
      if (voiceChan) await voiceChan.delete().catch(() => null);
    }
    if (channels.arrows) {
      const arrowsChan = await guild.channels.fetch(channels.arrows).catch(() => null);
      if (arrowsChan) await arrowsChan.delete().catch(() => null);
    }
    
    // Delete Category
    const category = await guild.channels.fetch(categoryId).catch(() => null);
    if (category) await category.delete().catch(() => null);
    
    // Delete Role
    const role = await guild.roles.fetch(roleId).catch(() => null);
    if (role) await role.delete().catch(() => null);
    
    return true;
  } catch (err) {
    console.error('[DISCORD] Eroare la ștergerea facțiunii pe Discord:', err);
    return false;
  }
}

// Export helper to sync Faction Leader role on Discord
async function syncDiscordLeader(oldLeaderId, newLeaderId, factionType) {
  const db = readDb();
  const guildId = db.settings.guildId || "1526274994353606726";
  
  try {
    const guild = await client.guilds.fetch(guildId);
    
    let leaderRoleName = '🟢 ' + toBoldUnicode('Lider Gang');
    if (factionType === 'oficiala') leaderRoleName = '🔴 ' + toBoldUnicode('Lider Mafie Oficiala');
    if (factionType === 'neoficiala') leaderRoleName = '🟤 ' + toBoldUnicode('Lider Mafie Neoficiala');
    
    const leaderRole = guild.roles.cache.find(r => r.name === leaderRoleName);
    if (!leaderRole) return false;
    
    // Remove from old leader
    if (oldLeaderId) {
      const oldMember = await guild.members.fetch(oldLeaderId).catch(() => null);
      if (oldMember) {
        await oldMember.roles.remove(leaderRole.id).catch(() => null);
      }
    }
    
    // Add to new leader
    if (newLeaderId) {
      const newMember = await guild.members.fetch(newLeaderId).catch(() => null);
      if (newMember) {
        await newMember.roles.add(leaderRole.id).catch(() => null);
      }
    }
    return true;
  } catch (err) {
    console.error('[DISCORD] Eroare la sincronizarea liderului facțiunii:', err);
    return false;
  }
}

module.exports = {
  client,
  modifyMemberRole,
  applyWarningRoles,
  sendLogEmbed,
  sendChannelMessage,
  updateDiscordFaction,
  deleteDiscordFaction,
  syncDiscordLeader
};
