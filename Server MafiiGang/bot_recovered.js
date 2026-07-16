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
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel, Partials.GuildMember, Partials.User]
});

// Register slash commands globally on startup
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
});

// Event Handler for Slash Commands and Interactions
client.on('interactionCreate', async (interaction) => {
  const db = readDb();
  
  // 1. Slash Commands
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'setup-server') {
      await interaction.deferReply({ ephemeral: true });
      
      const { guild } = interaction;
      
      try {
        // A. Create/Find global roles
        let managerRole = guild.roles.cache.find(r => r.name === 'Manager Mafii/Gang');
        if (!managerRole) {
          managerRole = await guild.roles.create({
            name: 'Manager Mafii/Gang',
            color: '#F1C40F', // Gold
            permissions: [PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.ManageRoles],
            reason: 'Sistem Management Mafii'
          });
        }
        
        let liderOficialaRole = guild.roles.cache.find(r => r.name === 'Lider Mafie Oficiala');
        if (!liderOficialaRole) {
          liderOficialaRole = await guild.roles.create({
            name: 'Lider Mafie Oficiala',
            color: '#FF0000', // Red
            reason: 'Sistem Management Mafii'
          });
        }
        
        let liderNeoficialaRole = guild.roles.cache.find(r => r.name === 'Lider Mafie Neoficiala');
        if (!liderNeoficialaRole) {
          liderNeoficialaRole = await guild.roles.create({
            name: 'Lider Mafie Neoficiala',
            color: '#990000', // Dark Red
            reason: 'Sistem Management Mafii'
          });
        }
        
        let liderGangRole = guild.roles.cache.find(r => r.name === 'Lider Gang');
        if (!liderGangRole) {
          liderGangRole = await guild.roles.create({
            name: 'Lider Gang',
            color: '#00FF00', // Green
            reason: 'Sistem Management Mafii'
          });
        }
        
        // B. Create categories
        // Category 1: Management Mafii (Hidden)
        let mgmtCategory = guild.channels.cache.find(c => c.name === '📢 MANAGEMENT MAFII' && c.type === ChannelType.GuildCategory);
        if (!mgmtCategory) {
          mgmtCategory = await guild.channels.create({
            name: '📢 MANAGEMENT MAFII',
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
              {
                id: guild.id, // @everyone
                deny: [PermissionsBitField.Flags.ViewChannel]
              },
              {
                id: managerRole.id,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
              }
            ]
          });
        }
        
        // Logs Channel
        let logsChannel = guild.channels.cache.find(c => c.name === 'logs-mafii' && c.type === ChannelType.GuildText);
        if (!logsChannel) {
          logsChannel = await guild.channels.create({
            name: 'logs-mafii',
            type: ChannelType.GuildText,
            parent: mgmtCategory.id
          });
        }
        
        // Category 2: Informații (Everyone sees, only staff writes)
        let infoCategory = guild.channels.cache.find(c => c.name === '📋 INFORMAȚII MAFII' && c.type === ChannelType.GuildCategory);
        if (!infoCategory) {
          infoCategory = await guild.channels.create({
            name: '📋 INFORMAȚII MAFII',
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
              }
            ]
          });
        }
        
        // Setup Channel
        let setupChannel = guild.channels.cache.find(c => c.name === 'înregistrare-mafii' && c.type === ChannelType.GuildText);
        if (!setupChannel) {
          setupChannel = await guild.channels.create({
            name: 'înregistrare-mafii',
            type: ChannelType.GuildText,
            parent: infoCategory.id
          });
        }
        
        // Category 3: Zone Mafii (Parent for mafia category creations)
        let zoneCategory = guild.channels.cache.find(c => c.name === '📁 ZONE MAFII' && c.type === ChannelType.GuildCategory);
        if (!zoneCategory) {
          zoneCategory = await guild.channels.create({
            name: '📁 ZONE MAFII',
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
              {
                id: guild.id, // @everyone
                deny: [PermissionsBitField.Flags.ViewChannel]
              },
              {
                id: managerRole.id,
                allow: [PermissionsBitField.Flags.ViewChannel]
              }
            ]
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
          .setColor('#FF0000') // Red theme
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
        
        // Save database settings
        db.settings = {
          guildId: guild.id,
          managerRoleId: managerRole.id,
          logsChannelId: logsChannel.id,
          setupChannelId: setupChannel.id,
          zoneCategoryId: zoneCategory.id
        };
        writeDb(db);
        
        await interaction.editReply({ content: 'Serverul a fost configurat cu succes! Categoriile, canalele și rolurile au fost create.' });
      } catch (err) {
        console.error('[DISCORD] Eroare la /setup-server:', err);
        await interaction.editReply({ content: 'A apărut o eroare la configurarea serverului. Verifică consola.' });
      }
    }
  }
  
  // 2. Button Interactions
  else if (interaction.isButton()) {
    if (interaction.customId === 'btn_create_mafia') {
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
        
      const row = new ActionRowBuilder().addComponents(nameInput);
      modal.addComponents(row);
      
      await interaction.showModal(modal);
    }
    
    else if (interaction.customId === 'select_mafia_join') {
      await interaction.deferReply({ ephemeral: true });
      
      const mafiaId = interaction.values[0];
      const mafia = db.mafias.find(m => m.id === mafiaId);
      
      if (!mafia) {
        return interaction.editReply({ content: '❌ Această mafie nu a mai fost găsită în baza de date.' });
      }
      
      // Check if user is already in this mafia
      if (mafia.members.includes(interaction.user.id)) {
        return interaction.editReply({ content: '❌ Faci deja parte din această mafie!' });
      }
      
      // Check if user is in any other mafia
      const inOther = db.mafias.find(m => m.members.includes(interaction.user.id));
      if (inOther) {
        return interaction.editReply({ content: `❌ Faci parte deja din altă mafie (**${inOther.name}**)! Trebuie să ieși din ea mai întâi.` });
      }
      
      try {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        
        // Add role
        await member.roles.add(mafia.roleId);
        
        // Update database
        mafia.members.push(interaction.user.id);
        writeDb(db);
        
        // Log to #logs-mafii
        const logChannel = interaction.guild.channels.cache.get(db.settings.logsChannelId);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle('👤 MEMBRU NOU')
            .setDescription(`Jucătorul <@${interaction.user.id}> s-a alăturat mafiei **${mafia.name}**.`)
            .setColor('#3498DB')
            .setTimestamp();
          await logChannel.send({ embeds: [logEmbed] });
        }
        
        await interaction.editReply({ content: `✅ Te-ai alăturat cu succes mafiei **${mafia.name}**!` });
      } catch (err) {
        console.error('[DISCORD] Eroare la alăturare mafie:', err);
        await interaction.editReply({ content: '❌ Nu s-a putut atribui rolul mafiei. Verifică permisiunile botului.' });
      }
    }
  }
  
  // 4. Modal Submit Interactions
  else if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('modal_create_mafia_')) {
      await interaction.deferReply({ ephemeral: true });
      
      const type = interaction.customId.replace('modal_create_mafia_', '');
      const mafiaName = interaction.fields.getTextInputValue('mafia_name').trim();
      
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
        
        const mafiaRole = await guild.roles.create({
          name: mafiaName,
          color: roleColor,
          reason: `Creare mafie: ${mafiaName}`
        });
        
        // Give Mafia Role to Creator
        const member = await guild.members.fetch(interaction.user.id);
        await member.roles.add(mafiaRole.id);
        
        // Give Leader Role to Creator
        let leaderRoleName = 'Lider Gang';
        if (type === 'oficiala') leaderRoleName = 'Lider Mafie Oficiala';
        if (type === 'neoficiala') leaderRoleName = 'Lider Mafie Neoficiala';
        
        const leaderRole = guild.roles.cache.find(r => r.name === leaderRoleName);
        if (leaderRole) {
          await member.roles.add(leaderRole.id);
        }
        
        // Create Mafia Category
        const cleanName = mafiaName.replace(/[^a-zA-Z0-9 ]/g, '').trim();
        const prefix = type === 'gang' ? ' GANG' : ' MAFIE';
        const category = await guild.channels.create({
          name: `[${prefix}] ${cleanName}`,
          type: ChannelType.GuildCategory,
          parent: zoneCategoryId,
          permissionOverwrites: [
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
          ]
        });
        
        // Create Channels in Category
        const chatChannel = await guild.channels.create({
          name: `💬│chat-${cleanName.toLowerCase().replace(/ /g, '-')}`,
          type: ChannelType.GuildText,
          parent: category.id
        });
        
        const tasksChannel = await guild.channels.create({
          name: `📋│task-uri-${cleanName.toLowerCase().replace(/ /g, '-')}`,
          type: ChannelType.GuildText,
          parent: category.id
        });
        
        const sanctionsChannel = await guild.channels.create({
          name: `⚠️│sancțiuni-${cleanName.toLowerCase().replace(/ /g, '-')}`,
          type: ChannelType.GuildText,
          parent: category.id
        });
        
        const voiceChannel = await guild.channels.create({
          name: `🔊│Vorbitor ${cleanName}`,
          type: ChannelType.GuildVoice,
          parent: category.id
        });
        
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
            voice: voiceChannel.id
          },
          ownerId: interaction.user.id,
          members: [interaction.user.id],
          tasks: [],
          sanctions: []
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
  if (!db.settings.guildId) return false;
  
  try {
    const guild = await client.guilds.fetch(db.settings.guildId);
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

// Export function to send log embeds from the Web Dashboard
async function sendLogEmbed(title, description, color = '#F1C40F') {
  const db = readDb();
  if (!db.settings.guildId || !db.settings.logsChannelId) return;
  
  try {
    const guild = await client.guilds.fetch(db.settings.guildId);
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

module.exports = {
  client,
  modifyMemberRole,
  sendLogEmbed,
  sendChannelMessage
};
