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
    GatewayIntentBits.GuildPresences
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
      // ─── STARTUP CLEANUP FOR DUPLICATE VERIFICATION CHANNELS ───
      await guild.channels.fetch().catch(() => null);
      const verifyChannels = guild.channels.cache.filter(c => c.name.toLowerCase().includes('verificare') && c.type === ChannelType.GuildText);
      if (verifyChannels.size > 1) {
        const sortedVerify = [...verifyChannels.values()].sort((a, b) => a.id.localeCompare(b.id));
        // Keep the oldest, delete the rest
        for (let i = 1; i < sortedVerify.length; i++) {
          await sortedVerify[i].delete().catch(() => null);
          console.log(`[STARTUP CLEANUP] Deleted duplicate verification channel: ${sortedVerify[i].name} (${sortedVerify[i].id})`);
        }
      }

      console.log(`[DISCORD] Se realizează configurarea/verificarea automată pentru serverul: ${guild.name}...`);
      await performServerSetup(guild);
      console.log(`[DISCORD] Configurare automată finalizată cu succes.`);

      const db = readDb();

      // Create/Ensure Faction Warning roles exist on startup
      try {
        const warningRolesSpecs = [
          { name: '⚠️ Mafia AV 1/2', color: '#F1C40F' },
          { name: '⚠️ Mafia AV 2/2', color: '#F1C40F' },
          { name: '⚠️ Mafia Warn 1/3', color: '#E67E22' },
          { name: '⚠️ Mafia Warn 2/3', color: '#E67E22' },
          { name: '⚠️ Mafia Warn 3/3', color: '#E74C3C' },
          { name: '⚠️ Gang AV 1/2', color: '#2ECC71' },
          { name: '⚠️ Gang AV 2/2', color: '#2ECC71' },
          { name: '⚠️ Gang Warn 1/3', color: '#3498DB' },
          { name: '⚠️ Gang Warn 2/3', color: '#3498DB' },
          { name: '⚠️ Gang Warn 3/3', color: '#9B59B6' }
        ];

        for (const roleSpec of warningRolesSpecs) {
          let role = guild.roles.cache.find(r => r.name === roleSpec.name);
          if (!role) {
            await guild.roles.create({
              name: roleSpec.name,
              color: roleSpec.color,
              reason: 'Sistem Avertismente Facțiuni'
            }).catch(() => null);
          }
        }
      } catch (roleErr) {
        console.error('[DISCORD] Eroare la crearea rolurilor detaliate de avertisment pe startup:', roleErr.message);
      }

      // Loop through all existing mafias to ensure they have correct channel names, invoiri channel, and hoisted roles
      let updatedDb = false;
      for (const mafia of db.mafias) {
        // Ensure existing role is hoisted (displayed separately)
        if (mafia.roleId) {
          try {
            const role = await guild.roles.fetch(mafia.roleId).catch(() => null);
            if (role && !role.hoist) {
              await role.setHoist(true, `Sincronizare afisare separata`).catch(() => null);
              console.log(`[DISCORD] Rolul facțiunii ${mafia.name} a fost setat să se afișeze separat (hoist).`);
            }
          } catch (roleErr) {
            console.error(`[DISCORD] Nu s-a putut face hoist pe rolul ${mafia.name}:`, roleErr.message);
          }
        }

        // Rename categories and channels for existing mafias to match premium names
        if (mafia.categoryId) {
          try {
            const category = await guild.channels.fetch(mafia.categoryId).catch(() => null);
            if (category) {
              let boldPrefix = ' ⚔️ 𝗠𝗔𝗙𝗜𝗘 ';
              if (mafia.type === 'oficiala') {
                boldPrefix = ' 🔴 𝗠𝗔𝗙𝗜𝗘 𝗢𝗙𝗜𝗖𝗜𝗔𝗟𝗔 ';
              } else if (mafia.type === 'neoficiala') {
                boldPrefix = ' 🟤 𝗠𝗔𝗙𝗜𝗘 𝗡𝗘𝗢𝗙𝗜𝗖𝗜𝗔𝗟𝗔 ';
              } else if (mafia.type === 'gang') {
                boldPrefix = ' 🔫 𝗚𝗔𝗡𝗚 ';
              }

              const expectedCatName = "[" + boldPrefix + "] " + toBoldUnicode(mafia.name.toUpperCase());
              if (category.name !== expectedCatName) {
                await category.setName(expectedCatName).catch(() => null);
                console.log(`[DISCORD] Redesigned category name for ${mafia.name} to ${expectedCatName}`);
              }

              const cleanNameLower = mafia.name.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/ /g, '-');

              // Map of channel key to expected name
              const channelNamesMap = {
                chat: "💬│𝗰𝗵𝗮𝘁-" + cleanNameLower,
                tasks: "📋│𝘁𝗮𝘀𝗸-𝘂𝗿𝗶-" + cleanNameLower,
                sanctions: "⚠️│𝘀𝗮𝗻𝗰𝘁𝗶𝘂𝗻𝗶-" + cleanNameLower,
                invoiri: "📝│𝗶𝗻𝘃𝗼𝗶𝗿𝗶-" + cleanNameLower,
                arrows: "🏹│𝘀𝗮𝗴𝗲𝘁𝗶-𝗼𝗳𝗶𝗰𝗶𝗮𝗹𝗲"
              };

              for (const [key, expectedName] of Object.entries(channelNamesMap)) {
                const chanId = mafia.channels[key];
                if (chanId) {
                  const chan = await guild.channels.fetch(chanId).catch(() => null);
                  if (chan && chan.name !== expectedName) {
                    await chan.setName(expectedName).catch(() => null);
                    console.log(`[DISCORD] Redesigned channel name to ${expectedName} for ${mafia.name}`);
                  }
                }
              }
            }
          } catch (renameErr) {
            console.error(`[DISCORD] Failed to rename category or channels for ${mafia.name}:`, renameErr.message);
          }
        }

        if (!mafia.channels.invoiri) {
          console.log(`[DISCORD] Creare canal invoiri lipsa pentru mafia existenta: ${mafia.name}...`);
          try {
            const category = await guild.channels.fetch(mafia.categoryId).catch(() => null);
            if (category) {
              const managerRoleId = db.settings.managerRoleId;
              const managerStaffRoleId = db.settings.managerStaffRoleId;
              
              const overwrites = [
                {
                  id: guild.id, // @everyone
                  deny: [PermissionsBitField.Flags.ViewChannel]
                },
                {
                  id: mafia.roleId,
                  allow: [
                    PermissionsBitField.Flags.ViewChannel, 
                    PermissionsBitField.Flags.SendMessages, 
                    PermissionsBitField.Flags.ReadMessageHistory,
                    PermissionsBitField.Flags.Connect,
                    PermissionsBitField.Flags.Speak
                  ]
                }
              ];
              
              if (managerRoleId) {
                overwrites.push({
                  id: managerRoleId,
                  allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ReadMessageHistory,
                    PermissionsBitField.Flags.ManageChannels,
                    PermissionsBitField.Flags.ManageMessages
                  ]
                });
              }
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
              
              const cleanName = mafia.name.replace(/[^a-zA-Z0-9 ]/g, '').trim();
              const invoiriChannel = await guild.channels.create({
                name: `📝│𝗶𝗻𝘃𝗼𝗶𝗿𝗶-${cleanName.toLowerCase().replace(/ /g, '-')}`,
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: overwrites
              });
              
              mafia.channels.invoiri = invoiriChannel.id;
              updatedDb = true;
              console.log(`[DISCORD] Canal invoiri creat cu succes pentru ${mafia.name}!`);
            }
          } catch (createErr) {
            console.error(`[DISCORD] Nu s-a putut crea canalul de invoiri pentru mafia ${mafia.name}:`, createErr.message);
          }
        }
      }
      
      if (updatedDb) {
        writeDb(db);
      }

      // Ensure all mafias have Lider & Membri settings channels
      try {
        await ensureFactionsHaveSettings(guild);
        await ensureSindicatAccess(guild);
      } catch (err) {
        console.error('[STARTUP] Failed to run startup ensured settings/access:', err.message);
      }

      // Startup Sync: Sync Faction Members with Discord Roles
      try {
        console.log('[DISCORD] Se realizează sincronizarea membrilor facțiunilor cu Discord...');
        let dbChanged = false;
        
        // Fetch all members to ensure cache is populated
        await guild.members.fetch().catch(() => null);

        db.mafias.forEach(mafia => {
          if (!mafia.roleId) return;
          
          // Get all members who have this role on Discord
          const roleMembers = guild.members.cache
            .filter(m => m.roles.cache.has(mafia.roleId))
            .map(m => m.id);
            
          // Merge with owner and co-leaders to make sure they are included
          const desiredMembers = Array.from(new Set([
            ...roleMembers,
            mafia.ownerId,
            ...(mafia.coLeaders || [])
          ].filter(Boolean)));
          
          // Check if they are different
          const currentSet = new Set(mafia.members || []);
          const desiredSet = new Set(desiredMembers);
          
          let different = currentSet.size !== desiredSet.size;
          if (!different) {
            for (let mId of currentSet) {
              if (!desiredSet.has(mId)) {
                different = true;
                break;
              }
            }
          }
          
          if (different) {
            mafia.members = desiredMembers;
            dbChanged = true;
            console.log(`[DISCORD STARTUP SYNC] Sincronizat membri pentru facțiunea ${mafia.name}. Membri noi: ${desiredMembers.length}`);
          }
        });
        
        if (dbChanged) {
          writeDb(db);
        }
      } catch (syncErr) {
        console.error('[DISCORD STARTUP SYNC] Eroare la sincronizare startup:', syncErr.message);
      }
    }
  } catch (err) {
    console.error(`[DISCORD] Eroare la configurarea automată a serverului pe startup:`, err.message);
  }
});

// Real-time Discord role sync event listener
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  try {
    const db = readDb();
    let dbChanged = false;
    
    // Check all mafias
    db.mafias.forEach(mafia => {
      if (!mafia.roleId) return;
      
      const hadRole = oldMember.roles.cache.has(mafia.roleId);
      const hasRole = newMember.roles.cache.has(mafia.roleId);
      
      if (!hadRole && hasRole) {
        // Role added
        if (!mafia.members.includes(newMember.id)) {
          mafia.members.push(newMember.id);
          dbChanged = true;
          console.log(`[DISCORD REALTIME SYNC] Membru adăugat: ${newMember.user.tag} (${newMember.id}) -> ${mafia.name}`);
        }
      } else if (hadRole && !hasRole) {
        // Role removed
        const idx = mafia.members.indexOf(newMember.id);
        if (idx !== -1) {
          mafia.members.splice(idx, 1);
          dbChanged = true;
          console.log(`[DISCORD REALTIME SYNC] Membru eliminat: ${newMember.user.tag} (${newMember.id}) <- ${mafia.name}`);
        }
      }
    });
    
    if (dbChanged) {
      writeDb(db);
    }
  } catch (err) {
    console.error('[DISCORD REALTIME SYNC] Eroare in guildMemberUpdate:', err);
  }
});

client.on('guildMemberRemove', async (member) => {
  try {
    const db = readDb();
    let dbChanged = false;
    db.mafias.forEach(mafia => {
      const idx = mafia.members.indexOf(member.id);
      if (idx !== -1) {
        mafia.members.splice(idx, 1);
        dbChanged = true;
        console.log(`[DISCORD REALTIME SYNC] Membru plecat de pe server: ${member.user.tag} (${member.id}) <- ${mafia.name}`);
      }
    });
    if (dbChanged) {
      writeDb(db);
    }
  } catch (err) {
    console.error('[DISCORD REALTIME SYNC] Eroare in guildMemberRemove:', err);
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
  
  // Fetch all roles and channels to populate cache
  await guild.roles.fetch().catch(() => null);
  await guild.channels.fetch().catch(() => null);
  
  // A. Create/Find global roles
  const staffName = '👑 ' + toBoldUnicode('Manager Staff');
  let managerStaffRole = guild.roles.cache.find(r => r.name === 'Manager Staff' || r.name === staffName);
  if (!managerStaffRole) {
    managerStaffRole = await guild.roles.create({
      name: staffName,
      color: '#E74C3C',
      reason: 'Sistem Management Mafii - Super Admin'
    });
  }

  const managerName = '🛡️ ' + toBoldUnicode('Manager Mafii / Gang');
  let managerRole = guild.roles.cache.find(r => r.name === 'Manager/Staff' || r.name === 'Manager Mafii/Gang' || r.name === managerName);
  if (!managerRole) {
    managerRole = await guild.roles.create({
      name: managerName,
      color: '#F1C40F',
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

  // Create warning roles
  let av1 = guild.roles.cache.find(r => r.name === 'AV 1/3' || r.name === '⚠️ 𝗔𝗩 𝟭/𝟯');
  if (!av1) av1 = await guild.roles.create({ name: '⚠️ 𝗔𝗩 𝟭/𝟯', color: '#F1C40F', reason: 'Sistem Avertismente Mafii' });

  let av2 = guild.roles.cache.find(r => r.name === 'AV 2/3' || r.name === '⚠️ 𝗔𝗩 𝟮/𝟯');
  if (!av2) av2 = await guild.roles.create({ name: '⚠️ 𝗔𝗩 𝟮/𝟯', color: '#E67E22', reason: 'Sistem Avertismente Mafii' });

  let av3 = guild.roles.cache.find(r => r.name === 'AV 3/3' || r.name === '⚠️ 𝗔𝗩 𝟯/𝟯');
  if (!av3) av3 = await guild.roles.create({ name: '⚠️ 𝗔𝗩 𝟯/𝟯', color: '#E74C3C', reason: 'Sistem Avertismente Mafii' });

  let verificatRole = guild.roles.cache.find(r => r.name === '✅ Verificat');
  if (!verificatRole) verificatRole = await guild.roles.create({ name: '✅ Verificat', color: '#2ECC71', reason: 'Sistem Verificare' });

  // SINDICAT ROLES
  const sindicatLiderName = '👑 ' + toBoldUnicode('Lider Sindicat');
  let liderSindicatRole = guild.roles.cache.find(r => r.name === 'Lider Sindicat' || r.name === sindicatLiderName);
  if (!liderSindicatRole) liderSindicatRole = await guild.roles.create({ name: sindicatLiderName, color: '#9B59B6', reason: 'Sistem Sindicat' });

  const sindicatCoLiderName = '⚔️ ' + toBoldUnicode('Co-Lider Sindicat');
  let coLiderSindicatRole = guild.roles.cache.find(r => r.name === 'Co-Lider Sindicat' || r.name === sindicatCoLiderName);
  if (!coLiderSindicatRole) coLiderSindicatRole = await guild.roles.create({ name: sindicatCoLiderName, color: '#8E44AD', reason: 'Sistem Sindicat' });

  const sindicatMembruName = '⚜️ ' + toBoldUnicode('Membru Sindicat');
  let membruSindicatRole = guild.roles.cache.find(r => r.name === 'Membru Sindicat' || r.name === sindicatMembruName);
  if (!membruSindicatRole) membruSindicatRole = await guild.roles.create({ name: sindicatMembruName, color: '#3498DB', reason: 'Sistem Sindicat' });

  // B. Create categories with premium styles
  let mgmtCategory = guild.channels.cache.find(c => (c.name === '📢 MANAGEMENT MAFII' || c.name === '📢 𝗠𝗔𝗡𝗔𝗚𝗘𝗠𝗘𝗡𝗧 𝗠𝗔𝗙𝗜𝗜') && c.type === ChannelType.GuildCategory);
  if (!mgmtCategory) {
    mgmtCategory = await guild.channels.create({
      name: '📢 𝗠𝗔𝗡𝗔𝗚𝗘𝗠𝗘𝗡𝗧 𝗠𝗔𝗙𝗜𝗜',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: managerRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: managerStaffRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
      ]
    });
  }

  let infoCategory = guild.channels.cache.find(c => (c.name === '📋 INFORMATII MAFII' || c.name === '📋 🇮🇳🇫🇴🇷🇲🇦🇹🇮🇮 🇲🇦🇫🇮🇮' || c.name === '📋 𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗧𝗜𝗜 𝗠𝗔𝗙𝗜𝗜') && c.type === ChannelType.GuildCategory);
  if (!infoCategory) {
    infoCategory = await guild.channels.create({
      name: '📋 𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗧𝗜𝗜 𝗠𝗔𝗙𝗜𝗜',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: verificatRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory], deny: [PermissionsBitField.Flags.SendMessages] },
        { id: managerRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: managerStaffRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
      ]
    });
  }

  // Blacklist Channel (Only Lideri/CoLideri and managers see, managers write)
  let blacklistChannel = guild.channels.cache.find(c => (c.name === 'blacklist-mafii' || c.name === '📋│𝗯𝗹𝗮𝗰𝗸𝗹𝗶𝘀𝘁-𝗺𝗮𝗳𝗶𝗶') && c.type === ChannelType.GuildText);
  if (!blacklistChannel) {
    const blacklistOverwrites = [
      { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: managerRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
      { id: managerStaffRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
    ];
    
    // Fetch and resolve Faction leader roles to grant view access
    const liderOficial = guild.roles.cache.find(r => r.name.includes('Lider Mafie Oficiala'));
    const coLiderOficial = guild.roles.cache.find(r => r.name.includes('Co-Lider Mafie Oficiala'));
    const liderNeoficial = guild.roles.cache.find(r => r.name.includes('Lider Mafie Neoficiala'));
    const coLiderNeoficial = guild.roles.cache.find(r => r.name.includes('Co-Lider Mafie Neoficiala'));
    const liderGang = guild.roles.cache.find(r => r.name.includes('Lider Gang'));
    const coLiderGang = guild.roles.cache.find(r => r.name.includes('Co-Lider Gang'));

    if (liderOficial) blacklistOverwrites.push({ id: liderOficial.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory], deny: [PermissionsBitField.Flags.SendMessages] });
    if (coLiderOficial) blacklistOverwrites.push({ id: coLiderOficial.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory], deny: [PermissionsBitField.Flags.SendMessages] });
    if (liderNeoficial) blacklistOverwrites.push({ id: liderNeoficial.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory], deny: [PermissionsBitField.Flags.SendMessages] });
    if (coLiderNeoficial) blacklistOverwrites.push({ id: coLiderNeoficial.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory], deny: [PermissionsBitField.Flags.SendMessages] });
    if (liderGang) blacklistOverwrites.push({ id: liderGang.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory], deny: [PermissionsBitField.Flags.SendMessages] });
    if (coLiderGang) blacklistOverwrites.push({ id: coLiderGang.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory], deny: [PermissionsBitField.Flags.SendMessages] });

    blacklistChannel = await guild.channels.create({
      name: '📋│𝗯𝗹𝗮𝗰𝗸𝗹𝗶𝘀𝘁-𝗺𝗮𝗳𝗶𝗶',
      type: ChannelType.GuildText,
      parent: infoCategory.id,
      permissionOverwrites: blacklistOverwrites
    });
  }

  // Populate Blacklist Panel
  const blEmbed = new EmbedBuilder()
    .setTitle('📋 LISTĂ NEAGRĂ (BLACKLIST) FACȚIUNI')
    .setDescription(
      `Aici este stocată lista persoanelor interzise în toate organizațiile ilegale de pe server.\n\n` +
      `Această listă poate fi vizualizată DOAR de Liderii și Co-Liderii mafiilor.\n\n` +
      `➕ **Adaugă**: Adaugă un jucător pe Blacklist (Manager only).\n` +
      `➖ **Șterge**: Șterge un jucător de pe Blacklist (Manager only).\n` +
      `📋 **Vezi Blacklist**: Afișează lista completă a jucătorilor blocați.`
    )
    .setColor('#C0392B')
    .setTimestamp();
  const blRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_blacklist_add').setLabel('➕ Adaugă').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('btn_blacklist_remove').setLabel('➖ Șterge').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('btn_blacklist_view').setLabel('📋 Vezi Blacklist').setStyle(ButtonStyle.Secondary)
  );
  await refreshStaticPanel(blacklistChannel, blEmbed, [blRow]);

  // Setup Channel
  let setupChannel = guild.channels.cache.find(c => (c.name === 'înregistrare-mafii' || c.name === '📥│𝗶𝗻𝗿𝗲𝗴𝗶𝘀𝘁𝗿𝗮𝗿𝗲-𝗺𝗮𝗳𝗶𝗶') && c.type === ChannelType.GuildText);
  if (!setupChannel) {
    setupChannel = await guild.channels.create({
      name: '📥│𝗶𝗻𝗿𝗲𝗴𝗶𝘀𝘁𝗿𝗮𝗿𝗲-𝗺𝗮𝗳𝗶𝗶',
      type: ChannelType.GuildText,
      parent: infoCategory.id
    });
  }

  const setupEmbed = new EmbedBuilder()
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
  const setupRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_create_faction').setLabel('🔹 Creează o Mafie / Gang').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('btn_join_faction').setLabel('🔹 Alătură-te unei Mafii').setStyle(ButtonStyle.Success)
  );
  await refreshStaticPanel(setupChannel, setupEmbed, [setupRow]);

  // Verificare Channel
  let verificareChannel = guild.channels.cache.find(c => (c.name === 'verificare' || c.name === '🔓│𝘃𝗲𝗿𝗶𝗳𝗶𝗰𝗮𝗿𝗲') && c.type === ChannelType.GuildText);
  if (!verificareChannel) {
    verificareChannel = await guild.channels.create({
      name: '🔓│𝘃𝗲𝗿𝗶𝗳𝗶𝗰𝗮𝗿𝗲',
      type: ChannelType.GuildText,
      parent: infoCategory.id,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: managerRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: managerStaffRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
      ]
    });
  }

  const verifyEmbed = new EmbedBuilder()
    .setTitle('🔐 SECȚIUNE DE VERIFICARE IDENTITATE')
    .setDescription(
      `Pentru a primi acces la canalele mafiilor de pe Discord, trebuie să îți asociezi contul de FiveM cu profilul de Discord.\n\n` +
      `Apasă pe butonul de mai jos pentru a începe procesul de verificare.\n\n` +
      `*Dacă întâmpini dificultăți, contactează un Manager sau deschide un Tichet de Asistență.*`
    )
    .setColor('#2ECC71')
    .setTimestamp();
  const verifyRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_start_verification').setLabel('🔐 Porneste Verificarea').setStyle(ButtonStyle.Success)
  );
  await refreshStaticPanel(verificareChannel, verifyEmbed, [verifyRow]);

  // Category 3: Zona Globala Mafii
  let globalCategory = guild.channels.cache.find(c => (c.name === 'ZONE GLOBALA MAFII' || c.name === '🌐 𝗭𝗢𝗡𝗔 𝗚𝗟𝗢𝗕𝗔𝗟𝗔 🇲🇦🇫🇮🇮' || c.name === '🌐 𝗭𝗢𝗡𝗔 𝗚𝗟𝗢𝗕𝗔𝗟𝗔 𝗠𝗔𝗙𝗜𝗜') && c.type === ChannelType.GuildCategory);
  if (!globalCategory) {
    globalCategory = await guild.channels.create({
      name: '🌐 𝗭𝗢𝗡𝗔 𝗚𝗟𝗢𝗕𝗔𝗟𝗔 🇲🇦🇫🇮🇮',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: verificatRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: managerRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: managerStaffRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
      ]
    });
  }

  // Global Anunturi
  let anunturiChannel = guild.channels.cache.find(c => (c.name === 'anunturi-global' || c.name === '📢│𝗮𝗻𝘂𝗻𝘁𝘂𝗿𝗶-𝗴𝗹𝗼𝗯𝗮𝗹') && c.type === ChannelType.GuildText);
  if (!anunturiChannel) {
    anunturiChannel = await guild.channels.create({
      name: '📢│𝗮𝗻𝘂𝗻𝘁𝘂𝗿𝗶-𝗴𝗹𝗼𝗯𝗮𝗹',
      type: ChannelType.GuildText,
      parent: globalCategory.id,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: verificatRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory], deny: [PermissionsBitField.Flags.SendMessages] },
        { id: managerRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: managerStaffRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
      ]
    });
  }

  // Global Chat
  let chatChannel = guild.channels.cache.find(c => (c.name === 'chat-global' || c.name === '💬│𝗰𝗵𝗮𝘁-𝗴𝗹𝗼𝗯𝗮𝗹') && c.type === ChannelType.GuildText);
  if (!chatChannel) {
    chatChannel = await guild.channels.create({
      name: '💬│𝗰𝗵𝗮𝘁-𝗴𝗹𝗼𝗯𝗮𝗹',
      type: ChannelType.GuildText,
      parent: globalCategory.id
    });
  }

  // Suggestions Channel
  let suggestionsChannel = guild.channels.cache.find(c => (c.name === 'sugestii' || c.name === '💡│𝘀𝘂𝗴𝗲𝘀𝘁𝗶𝗶') && c.type === ChannelType.GuildText);
  if (!suggestionsChannel) {
    suggestionsChannel = await guild.channels.create({
      name: '💡│𝘀𝘂𝗴𝗲𝘀𝘁𝗶𝗶',
      type: ChannelType.GuildText,
      parent: globalCategory.id
    });
  }

  // Global Grade Channel
  let gradeChannel = guild.channels.cache.find(c => (c.name === 'grade-mafii' || c.name === '📰│𝗴𝗿𝗮𝗱𝗲-𝗺𝗮𝗳𝗶𝗶') && c.type === ChannelType.GuildText);
  if (!gradeChannel) {
    gradeChannel = await guild.channels.create({
      name: '📰│𝗴𝗿𝗮𝗱𝗲-𝗺𝗮𝗳𝗶𝗶',
      type: ChannelType.GuildText,
      parent: globalCategory.id,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: verificatRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory], deny: [PermissionsBitField.Flags.SendMessages] },
        { id: managerRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: managerStaffRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
      ]
    });
  }

  // Complaints Channel (Public, button to create complaint)
  let complaintsChannel = guild.channels.cache.find(c => (c.name === 'reclamatii-lideri' || c.name === '🎫│𝗿𝗲𝗰𝗹𝗮𝗺𝗮𝘁𝗶𝗶-𝗹𝗶𝗱𝗲𝗿𝗶') && c.type === ChannelType.GuildText);
  if (!complaintsChannel) {
    complaintsChannel = await guild.channels.create({
      name: '🎫│𝗿𝗲𝗰𝗹𝗮𝗺𝗮𝘁𝗶𝗶-𝗹𝗶𝗱𝗲𝗿𝗶',
      type: ChannelType.GuildText,
      parent: globalCategory.id,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: verificatRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory], deny: [PermissionsBitField.Flags.SendMessages] },
        { id: managerRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: managerStaffRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
      ]
    });
  }
  const compEmbed = new EmbedBuilder()
    .setTitle('🎫 RECLAMAȚII CONDUCERE (LIDERI MAFIE)')
    .setDescription(
      `Acest canal este destinat raportării abaterilor grave comise de Liderii sau Co-Liderii organizațiilor de pe server.\n\n` +
      `Dacă ai dovezi concrete (video/poze), apasă pe butonul de mai jos pentru a depune o reclamație oficială.\n\n` +
      `⚠️ **Atenție:** Reclamațiile false sau nefondate sunt pedepsite administrativ!`
    )
    .setColor('#F39C12')
    .setTimestamp();
  const compRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_complaint_create').setLabel('🎫 Creează Reclamație Lider').setStyle(ButtonStyle.Primary)
  );
  await refreshStaticPanel(complaintsChannel, compEmbed, [compRow]);

  // Support/Tickets request channel (Public)
  let supportRequestChannel = guild.channels.cache.find(c => (c.name === 'cereri-suport' || c.name === '🎫│𝗰𝗲𝗿𝗲𝗿𝗶-𝘀𝘂𝗽𝗼𝗿𝘁') && c.type === ChannelType.GuildText);
  if (!supportRequestChannel) {
    supportRequestChannel = await guild.channels.create({
      name: '🎫│𝗰𝗲𝗿𝗲𝗿𝗶-𝘀𝘂𝗽𝗼𝗿𝘁',
      type: ChannelType.GuildText,
      parent: globalCategory.id,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: verificatRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory], deny: [PermissionsBitField.Flags.SendMessages] },
        { id: managerRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: managerStaffRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
      ]
    });
  }
  const ticketRequestEmbed = new EmbedBuilder()
    .setTitle('🎫 ASISTENȚĂ ȘI TICHETE SUPORT')
    .setDescription(
      `Dorești să iei legătura cu Managementul Mafiilor / Gang-urilor?\n\n` +
      `Apasă pe butonul de mai jos pentru a deschide un tichet privat. Un canal personal de asistență va fi creat special pentru tine, unde vei putea discuta cu staff-ul.\n\n` +
      `🛡️ **Disponibil pentru:** întrebări regulament, raportări erori, reclamații, cereri permisiuni.`
    )
    .setColor('#3498DB')
    .setTimestamp();
  const ticketRequestRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_ticket_create').setLabel('🎫 Deschide Ticket').setStyle(ButtonStyle.Primary)
  );
  await refreshStaticPanel(supportRequestChannel, ticketRequestEmbed, [ticketRequestRow]);

  // Global Voice Lobby
  let globalVoice = guild.channels.cache.find(c => (c.name === '🔊│Voice Global' || c.name === '🔊│𝗩𝗼𝗶𝗰𝗲 𝗚𝗹𝗼𝗯𝗮𝗹') && c.type === ChannelType.GuildVoice);
  if (!globalVoice) {
    globalVoice = await guild.channels.create({
      name: '🔊│𝗩𝗼𝗶𝗰𝗲 𝗚𝗹𝗼𝗯𝗮𝗹',
      type: ChannelType.GuildVoice,
      parent: globalCategory.id
    });
  }
  
  // Category 4: SINDICAT
  let sindicatCategory = guild.channels.cache.find(c => (c.name === '👑 SINDICAT' || c.name === '👑 𝘀𝗶𝗻𝗱𝗶𝗰𝗮𝘁' || c.name === '👑 𝗦𝗜𝗡𝗗𝗜𝗖𝗔𝗧') && c.type === ChannelType.GuildCategory);
  if (!sindicatCategory) {
    sindicatCategory = await guild.channels.create({
      name: '👑 𝗦𝗜𝗡𝗗𝗜𝗖𝗔𝗧',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: verificatRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: managerRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: managerStaffRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
      ]
    });
  }

  // Chat IC Sindicat
  let chatIcSindicat = guild.channels.cache.find(c => (c.name === 'chat-ic-sindicat' || c.name === '💬│𝗰𝗵𝗮𝘁-𝗶𝗰-𝘀𝗶𝗻𝗱𝗶𝗰𝗮𝘁') && c.type === ChannelType.GuildText);
  if (!chatIcSindicat) {
    chatIcSindicat = await guild.channels.create({
      name: '💬│𝗰𝗵𝗮𝘁-𝗶𝗰-𝘀𝗶𝗻𝗱𝗶𝗰𝗮𝘁',
      type: ChannelType.GuildText,
      parent: sindicatCategory.id
    });
  }

  // Anunturi Sindicat
  let anunturiSindicat = guild.channels.cache.find(c => (c.name === 'anunturi-sindicat' || c.name === '📢│𝗮𝗻𝘂𝗻𝘁𝘂𝗿𝗶-𝘀𝗶𝗻𝗱𝗶𝗰𝗮𝘁') && c.type === ChannelType.GuildText);
  if (!anunturiSindicat) {
    anunturiSindicat = await guild.channels.create({
      name: '📢│𝗮𝗻𝘂𝗻𝘁𝘂𝗿𝗶-𝘀𝗶𝗻𝗱𝗶𝗰𝗮𝘁',
      type: ChannelType.GuildText,
      parent: sindicatCategory.id,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: verificatRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory], deny: [PermissionsBitField.Flags.SendMessages] },
        { id: membruSindicatRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: coLiderSindicatRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: liderSindicatRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: managerRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: managerStaffRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
      ]
    });
  }

  // Chat Lideri Sindicat
  let chatLideriSindicat = guild.channels.cache.find(c => (c.name === 'chat-lideri-sindicat' || c.name === '👑│𝗰𝗵𝗮𝘁-𝗹𝗶𝗱𝗲𝗿𝗶-𝘀𝗶𝗻𝗱𝗶𝗰𝗮𝘁') && c.type === ChannelType.GuildText);
  if (!chatLideriSindicat) {
    chatLideriSindicat = await guild.channels.create({
      name: '👑│𝗰𝗵𝗮𝘁-𝗹𝗶𝗱𝗲𝗿𝗶-𝘀𝗶𝗻𝗱𝗶𝗰𝗮𝘁',
      type: ChannelType.GuildText,
      parent: sindicatCategory.id,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: coLiderSindicatRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: liderSindicatRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: managerRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: managerStaffRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
      ]
    });
  }

  // Alliances Sindicat Channel (Read-only for normal, write for Sindicat Lider)
  let alliancesChannel = guild.channels.cache.find(c => (c.name === 'aliante-sindicat' || c.name === '🤝│𝗮𝗹𝗶𝗮𝗻𝘁𝗲-𝘀𝗶𝗻𝗱𝗶𝗰𝗮𝘁') && c.type === ChannelType.GuildText);
  if (!alliancesChannel) {
    alliancesChannel = await guild.channels.create({
      name: '🤝│𝗮𝗹𝗶𝗮𝗻𝘁𝗲-𝘀𝗶𝗻𝗱𝗶𝗰𝗮𝘁',
      type: ChannelType.GuildText,
      parent: sindicatCategory.id,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: verificatRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory], deny: [PermissionsBitField.Flags.SendMessages] },
        { id: managerRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: managerStaffRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
      ]
    });
  }

  // Zone Licitatii Sindicat Channel
  let zoneLicitatiiChannel = guild.channels.cache.find(c => (c.name === 'zone-licitatii' || c.name === '🗺️│𝘇𝗼𝗻𝗲-𝗹𝗶𝗰𝗶𝘁𝗮𝘁𝗶𝗶') && c.type === ChannelType.GuildText);
  if (!zoneLicitatiiChannel) {
    zoneLicitatiiChannel = await guild.channels.create({
      name: '🗺️│𝘇𝗼𝗻𝗲-𝗹𝗶𝗰𝗶𝘁𝗮𝘁𝗶𝗶',
      type: ChannelType.GuildText,
      parent: sindicatCategory.id,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: managerRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: managerStaffRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: liderSindicatRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: coLiderSindicatRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: membruSindicatRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
      ]
    });
  }

  // Settings Sindicat
  let settingsSindicat = guild.channels.cache.find(c => (c.name === 'settings-sindicat' || c.name === '⚙️│𝘀𝗲𝘁𝘁𝗶𝗻𝗴𝘀-𝘀𝗶𝗻𝗱𝗶𝗰𝗮𝘁') && c.type === ChannelType.GuildText);
  if (!settingsSindicat) {
    settingsSindicat = await guild.channels.create({
      name: '⚙️│𝘀𝗲𝘁𝘁𝗶𝗻𝗴𝘀-𝘀𝗶𝗻𝗱𝗶𝗰𝗮𝘁',
      type: ChannelType.GuildText,
      parent: sindicatCategory.id,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: liderSindicatRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: managerRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: managerStaffRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
      ]
    });
  }

  // Populate Sindicat Settings Panel
  const sindicatSettingsEmbed = new EmbedBuilder()
    .setTitle('⚙️ PANOU CONTROL SINDICAT')
    .setDescription(
      `Bun venit în panoul de control al Sindicatului!\n\n` +
      `De aici poți adăuga sau elimina membri în Sindicat direct din Discord:\n\n` +
      `⚜️ **Adaugă Membru**: Oferă rolul de Membru Sindicat unui jucător.\n` +
      `⚔️ **Adaugă Co-Lider**: Oferă rolul de Co-Lider Sindicat unui jucător.\n` +
      `❌ **Elimină Membru**: Retrage toate rolurile de Sindicat ale unui jucător.\n` +
      `🤝 **Alianțe**: Adaugă sau elimină alianțe oficiale în Sindicat.\n` +
      `🗺️ **Zone Licitație**: Înregistrează zonele pe care se licitează.`
    )
    .setColor('#8E44AD')
    .setTimestamp();
  const sindicatRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_sindicat_add_membru').setLabel('⚜️ Adaugă Membru').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('btn_sindicat_add_colider').setLabel('⚔️ Adaugă Co-Lider').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('btn_sindicat_remove_member').setLabel('❌ Elimină Membru').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('btn_sindicat_manage_alliances').setLabel('🤝 Alianțe').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('btn_sindicat_add_zone').setLabel('🗺️ Zone').setStyle(ButtonStyle.Secondary)
  );
  await refreshStaticPanel(settingsSindicat, sindicatSettingsEmbed, [sindicatRow]);

  // Category 5: Manager Mafii/Gang
  let managerCategory = guild.channels.cache.find(c => (c.name === '🛡️│MANAGEMENT MAFII-GANG' || c.name === '🛡️│🇲🇦🇳🇦🇬🇪🇲🇪🇳🇹  🇲🇦🇫🇮🇮-🇬🇦🇳🇬' || c.name === '🛡️│𝗠𝗔𝗡𝗔𝗚𝗘𝗠𝗘𝗡𝗧 🇲🇦🇫🇮🇮-🇬🇦🇳🇬' || c.name === '🛡️│𝗠𝗔𝗡𝗔𝗚𝗘𝗠𝗘𝗡𝗧 𝗠𝗔𝗙𝗜𝗜-𝗚𝗔𝗡𝗚') && c.type === ChannelType.GuildCategory);
  if (!managerCategory) {
    managerCategory = await guild.channels.create({
      name: '🛡️│𝗠𝗔𝗡𝗔𝗚𝗘𝗠𝗘𝗡𝗧 𝗠𝗔𝗙𝗜𝗜-𝗚𝗔𝗡𝗚',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: managerRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: managerStaffRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
      ]
    });
  }

  // Verdicts/Complaints Manager Channel (Private manager complaints resolutions channel)
  let verdictsComplaintsChannel = guild.channels.cache.find(c => (c.name === 'verdicte-reclamatii' || c.name === '🎫│𝘃𝗲𝗿𝗱𝗶𝗰𝘁𝗲-𝗿𝗲𝗰𝗹𝗮𝗺𝗮𝘁𝗶𝗶') && c.type === ChannelType.GuildText);
  if (!verdictsComplaintsChannel) {
    verdictsComplaintsChannel = await guild.channels.create({
      name: '🎫│𝘃𝗲𝗿𝗱𝗶𝗰𝘁𝗲-𝗿𝗲𝗰𝗹𝗮𝗺𝗮𝘁𝗶𝗶',
      type: ChannelType.GuildText,
      parent: managerCategory.id,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: managerRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: managerStaffRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
      ]
    });
  }

  // Tickets Log Channel (Private manager ticket log channel)
  let ticketsLogChannel = guild.channels.cache.find(c => (c.name === 'log-tickete' || c.name === '🎫│𝗹𝗼𝗴-𝘁𝗶𝗰𝗵𝗲𝘁𝗲') && c.type === ChannelType.GuildText);
  if (!ticketsLogChannel) {
    ticketsLogChannel = await guild.channels.create({
      name: '🎫│𝗹𝗼𝗴-𝘁𝗶𝗰𝗵𝗲𝘁𝗲',
      type: ChannelType.GuildText,
      parent: managerCategory.id,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: managerRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: managerStaffRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
      ]
    });
  }

  // Active Tickets Category
  let ticketCategory = guild.channels.cache.find(c => (c.name === '🎫│TICHETE SUPORT' || c.name === '🎫│𝗧𝗜🇨🇭𝗘𝗧𝗘 𝗦𝗨𝗣𝗢𝗥𝗧' || c.name === '🎫│𝗧𝗜𝗖𝗛𝗘𝗧𝗘 𝗦𝗨𝗣𝗢𝗥𝗧') && c.type === ChannelType.GuildCategory);
  if (!ticketCategory) {
    ticketCategory = await guild.channels.create({
      name: '🎫│𝗧𝗜𝗖𝗛𝗘𝗧𝗘 𝗦𝗨𝗣𝗢𝗥𝗧',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: managerRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: managerStaffRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
      ]
    });
  }

  let manageChannel = guild.channels.cache.find(c => (c.name === 'manage-mafii' || c.name === '⚙️│𝗺𝗮𝗻𝗮𝗴𝗲-𝗺𝗮𝗳𝗶𝗶') && c.type === ChannelType.GuildText);
  if (!manageChannel) {
    manageChannel = await guild.channels.create({
      name: '⚙️│𝗺𝗮𝗻𝗮𝗴𝗲-𝗺𝗮𝗳𝗶𝗶',
      type: ChannelType.GuildText,
      parent: managerCategory.id,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: managerRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: managerStaffRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
      ]
    });
  }

  // Populate Manager Settings Panel
  const managerSettingsEmbed = new EmbedBuilder()
    .setTitle('🛡️ PANOU DE CONTROL MANAGEMENT')
    .setDescription(
      `Bun venit în panoul administrativ pentru Mafiile și Gang-urile serverului!\n\n` +
      `Folosește de control butoanele de mai jos pentru a gestiona facțiunile:\n\n` +
      `🗑️ **Șterge o Mafie**: Șterge complet o facțiune (rol, canale, categorie, date db).\n` +
      `🔄 **Modifică Tipul**: Schimbă tipul facțiunii (Oficială / Neoficială / Gang).\n` +
      `⚠️ **Sancționează**: Aplică avertismente (AV / Warn) direct pe Discord.\n` +
      `👑 **Schimbă Liderul**: Înlocuiește liderul unei facțiuni și actualizează rolurile.`
    )
    .setColor('#F1C40F')
    .setTimestamp();
  const managerRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_manager_delete_mafia').setLabel('🗑️ Șterge o Mafie').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('btn_manager_change_type').setLabel('🔄 Modifică Tipul').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('btn_manager_sanction_mafia').setLabel('⚠️ Sancționează o Mafie').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_manager_change_leader').setLabel('👑 Schimbă Liderul').setStyle(ButtonStyle.Success)
  );
  await refreshStaticPanel(manageChannel, managerSettingsEmbed, [managerRow]);

  // Update DB Settings
  db.settings = {
    ...db.settings,
    guildId:                  guild.id,
    managerRoleId:            managerRole.id,
    managerStaffRoleId:       managerStaffRole.id,
    liderOficialaRoleId:      liderOficialaRole.id,
    coLiderOficialaRoleId:    coLiderOficialaRole.id,
    liderNeoficialaRoleId:    liderNeoficialaRole.id,
    coLiderNeoficialaRoleId:  coLiderNeoficialaRole.id,
    liderGangRoleId:          liderGangRole.id,
    coLiderGangRoleId:        coLiderGangRole.id,
    setupChannelId:           setupChannel.id,
    verificareChannelId:      verificareChannel.id,
    sindicatCategoryId:       sindicatCategory.id,
    sindicatLiderRoleId:      liderSindicatRole.id,
    sindicatCoLiderRoleId:    coLiderSindicatRole.id,
    sindicatMembruRoleId:     membruSindicatRole.id,
    gradeChannelId:           gradeChannel.id,
    managerCategoryId:        managerCategory.id,
    manageChannelId:          manageChannel.id,
    blacklistChannelId:       blacklistChannel.id,
    complaintsChannelId:      complaintsChannel.id,
    verdictsComplaintsChannelId: verdictsComplaintsChannel.id,
    supportRequestChannelId:  supportRequestChannel.id,
    ticketsLogChannelId:      ticketsLogChannel.id,
    ticketCategoryId:         ticketCategory.id,
    alliancesChannelId:       alliancesChannel.id,
    zoneLicitatiiChannelId:   zoneLicitatiiChannel.id,
    verificatRoleId:          verificatRole.id
  };

  // Initialize default auction zones if not present or outdated
  const defaultZones = [
    { id: 'zone_groove', name: 'Groove Street', owner: 'Disponibil', price: '0$', status: 'Disponibil', details: 'Pregătită pentru licitație.', updatedAt: 'Niciodată' },
    { id: 'zone_vespucci', name: 'Vespucci', owner: 'Disponibil', price: '0$', status: 'Disponibil', details: 'Pregătită pentru licitație.', updatedAt: 'Niciodată' },
    { id: 'zone_vinewood', name: 'Vinewood', owner: 'Disponibil', price: '0$', status: 'Disponibil', details: 'Pregătită pentru licitație.', updatedAt: 'Niciodată' },
    { id: 'zone_mirror', name: 'Mirror', owner: 'Disponibil', price: '0$', status: 'Disponibil', details: 'Pregătită pentru licitație.', updatedAt: 'Niciodată' },
    { id: 'zone_cocaina_plantatie', name: 'Cocaina (Plantație)', owner: 'Disponibil', price: '0$', status: 'Disponibil', details: 'Pregătită pentru licitație.', updatedAt: 'Niciodată' },
    { id: 'zone_cocaina_procesare', name: 'Cocaina (Procesare)', owner: 'Disponibil', price: '0$', status: 'Disponibil', details: 'Pregătită pentru licitație.', updatedAt: 'Niciodată' },
    { id: 'zone_marijuana_plantatie', name: 'Marijuana (Plantație)', owner: 'Disponibil', price: '0$', status: 'Disponibil', details: 'Pregătită pentru licitație.', updatedAt: 'Niciodată' },
    { id: 'zone_marijuana_procesare', name: 'Marijuana (Procesare)', owner: 'Disponibil', price: '0$', status: 'Disponibil', details: 'Pregătită pentru licitație.', updatedAt: 'Niciodată' },
    { id: 'zone_tigari', name: 'Procesare Țigări', owner: 'Disponibil', price: '0$', status: 'Disponibil', details: 'Pregătită pentru licitație.', updatedAt: 'Niciodată' },
    { id: 'zone_mdma', name: 'Procesare MDMA', owner: 'Disponibil', price: '0$', status: 'Disponibil', details: 'Pregătită pentru licitație.', updatedAt: 'Niciodată' }
  ];

  if (!db.auction_zones || db.auction_zones.length === 0 || !db.auction_zones.some(z => z.id === 'zone_groove')) {
    db.auction_zones = defaultZones;
  }

  writeDb(db);

  // Sync Sindicat channels embeds on setup
  try {
    await ensureSindicatAlliancesEmbed(guild);
    await ensureSindicatZonesEmbed(guild);
  } catch (err) {
    console.error('[SETUP] Failed to sync Sindicat embeds:', err.message);
  }
}

client.on('error', (err) => {
  console.error('[DISCORD CLIENT ERROR]', err.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason?.message || reason);
});

client.on('interactionCreate', async (interaction) => {
  const db = readDb();
  try {

  // 1. Chat Input Commands
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
    if (interaction.customId.startsWith('reply_ticket_')) {
      const targetUserId = interaction.customId.replace('reply_ticket_', '');
      
      const modal = new ModalBuilder()
        .setCustomId(`reply_modal_${targetUserId}`)
        .setTitle('Răspunde la Tichet');

      const responseInput = new TextInputBuilder()
        .setCustomId('reply_text')
        .setLabel('Răspunsul tău')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Scrie aici răspunsul sau rezolvarea problemei...')
        .setRequired(true)
        .setMinLength(5)
        .setMaxLength(1000);

      const actionRow = new ActionRowBuilder().addComponents(responseInput);
      modal.addComponents(actionRow);

      await interaction.showModal(modal);
      return;
    }

    // ══════════════════════════════════════════════════════════
    // BUTOANE ACCEPTARE/REFUZARE INVITATIE (DM INTERACTION)
    // ══════════════════════════════════════════════════════════
    if (interaction.customId.startsWith('invite:accept:') || interaction.customId.startsWith('invite:decline:')) {
      const parts = interaction.customId.split(':'); // [invite, accept/decline, mafiaId, userId]
      const action = parts[1];
      const mafiaId = parts[2];
      const userId = parts[3];

      if (interaction.user.id !== userId) {
        return interaction.reply({ content: '❌ Nu poți interacționa cu această invitație.', ephemeral: true });
      }

      const mafia = db.mafias.find(m => m.id === mafiaId);
      if (!mafia) {
        return interaction.reply({ content: '❌ Această facțiune nu mai există în baza de date.', ephemeral: true });
      }

      if (action === 'accept') {
        const isBlacklisted = (db.blacklist || []).some(b => b.userId === userId);
        if (isBlacklisted) {
          return interaction.reply({ content: '❌ Nu te poți alătura acestei facțiuni deoarece ești pe Blacklist!', ephemeral: true });
        }

        if (!mafia.members.includes(userId)) {
          mafia.members.push(userId);
          writeDb(db);

          try {
            const guildId = db.settings.guildId || "1526274994353606726";
            const guild = await client.guilds.fetch(guildId);
            const member = await guild.members.fetch(userId);

            await member.roles.add(mafia.roleId);

            const globalRoleId = "1526283703360163921";
            await member.roles.add(globalRoleId).catch(() => null);

            const gradeChannel = guild.channels.cache.get(db.settings.gradeChannelId);
            if (gradeChannel) {
              const embed = new EmbedBuilder()
                .setTitle('📥 ALĂTURARE FACȚIUNE')
                .setDescription(`👤 <@${userId}> (**${member.user.username}**) s-a alăturat facțiunii **${mafia.name}**!`)
                .setColor(0x2ECC71)
                .setTimestamp();
              await gradeChannel.send({ embeds: [embed] });
            }

            await member.send(`✅ Ai acceptat invitația de a te alătura facțiunii **${mafia.name}**! Rolurile și accesul la canale ți-au fost acordate.`).catch(() => null);
            await interaction.reply({ content: `✅ Ai acceptat invitația de a te alătura facțiunii **${mafia.name}**!`, ephemeral: true });
          } catch (err) {
            console.error('[INVITE ACCEPT ERROR]', err);
            await interaction.reply({ content: '❌ A apărut o eroare la oferirea rolurilor de Discord. Contactează conducerea.', ephemeral: true });
          }
        } else {
          await interaction.reply({ content: '❌ Faci deja parte din această facțiune!', ephemeral: true });
        }
      } else {
        await interaction.reply({ content: `❌ Ai refuzat invitația de a te alătura facțiunii **${mafia.name}**.`, ephemeral: true });
        
        try {
          const mafia = db.mafias.find(m => m.id === mafiaId);
          const ownerUser = await client.users.fetch(mafia.ownerId).catch(() => null);
          if (ownerUser) {
            await ownerUser.send(`📢 Jucătorul **${interaction.user.tag}** a refuzat invitația de a se alătura facțiunii **${mafia.name}**.`).catch(() => null);
          }
        } catch (err) {
          // Ignore
        }
      }
      return;
    }

    if (interaction.customId === 'btn_create_faction') {
      const existing = db.mafias.find(m => m.ownerId === interaction.user.id);
      if (existing) {
        return interaction.reply({ content: `❌ Deții deja o mafie înregistrată: **${existing.name}**! Nu poți crea alta.`, ephemeral: true });
      }
      
      const typeMenu = new StringSelectMenuBuilder()
        .setCustomId('select_mafia_type')
        .setPlaceholder('Alege tipul facțiunii...')
        .addOptions([
          { label: 'Mafie Oficială', value: 'oficiala', description: 'Rol lider roșu și canale private.', emoji: '🔴' },
          { label: 'Mafie Neoficială', value: 'neoficiala', description: 'Rol lider roșu închis și canale private.', emoji: '🟤' },
          { label: 'Gang / Organizație', value: 'gang', description: 'Rol lider verde și canale private.', emoji: '🟢' }
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
      const isLeader = mafia.ownerId === interaction.user.id;
      const isCoLeader = mafia.coLeaders && mafia.coLeaders.includes(interaction.user.id);
      if (!isLeader && !isCoLeader) {
        return interaction.reply({
          content: '❌ Doar **Liderii** și **Co-Liderii** acestei facțiuni pot adăuga săgeți oficiale!',
          ephemeral: true
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`modal_add_arrow_${mafia.id}`)
        .setTitle('🏹 Adaugă Săgeată Oficială');
        
      const nameInput = new TextInputBuilder()
        .setCustomId('arrow_name')
        .setLabel('Numele Săgeții')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Andrei Ionescu')
        .setRequired(true)
        .setMaxLength(50);
        
      const idInput = new TextInputBuilder()
        .setCustomId('arrow_fivem_id')
        .setLabel('ID-ul Săgeții (numărul din joc)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('5933')
        .setRequired(true)
        .setMaxLength(10);
        
      const row1 = new ActionRowBuilder().addComponents(nameInput);
      const row2 = new ActionRowBuilder().addComponents(idInput);
      modal.addComponents(row1, row2);
      await interaction.showModal(modal);
    }
    
    else if (interaction.customId === 'btn_join_faction') {
      if (db.mafias.length === 0) {
        return interaction.reply({ content: '❌ Nu există nicio mafie înregistrată momentan pe server.', ephemeral: true });
      }
      
      const options = db.mafias.map(m => ({
        label: m.name,
        value: m.id,
        description: `Tip: ${m.type.toUpperCase()}`,
        emoji: '⚔️'
      })).slice(0, 25);
      
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

    // ─── START VERIFICATION BUTTON ───
    else if (interaction.customId === 'btn_start_verification') {
      const modal = new ModalBuilder()
        .setCustomId('modal_verify_identity')
        .setTitle('🔐 Verificare Identitate');

      const nameInput = new TextInputBuilder()
        .setCustomId('verify_ingame_name')
        .setLabel('Nume In-Game (exact, ex: Andrei Ionescu)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Andrei Ionescu')
        .setRequired(true);

      const idInput = new TextInputBuilder()
        .setCustomId('verify_fivem_id')
        .setLabel('ID Server FiveM')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 5933')
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(idInput)
      );
      await interaction.showModal(modal);
    }

    // ─── TICKET CREATE BUTTON ───
    else if (interaction.customId === 'btn_ticket_create') {
      const modal = new ModalBuilder()
        .setCustomId('modal_ticket_create')
        .setTitle('🎫 Deschidere Tichet Suport');

      const subjectInput = new TextInputBuilder()
        .setCustomId('ticket_subject')
        .setLabel('Subiectul / Problema ta')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Descrie pe scurt cu ce te putem ajuta...')
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(subjectInput));
      await interaction.showModal(modal);
    }

    // ─── TICKET CLAIM BUTTON ───
    else if (interaction.customId.startsWith('btn_ticket_claim_')) {
      const parts = interaction.customId.replace('btn_ticket_claim_', '').split('_');
      const ticketId = parts[0];
      const channelId = parts[1];

      const managerRoleId = db.settings.managerRoleId;
      const managerStaffRoleId = db.settings.managerStaffRoleId;
      const hasManager = interaction.member.roles.cache.has(managerRoleId) || interaction.member.roles.cache.has(managerStaffRoleId);
      if (!hasManager) {
        return interaction.reply({ content: '❌ Doar Managerii pot prelua tichetele de suport!', ephemeral: true });
      }

      const oldEmbed = interaction.message.embeds[0];
      const updatedEmbed = EmbedBuilder.from(oldEmbed)
        .setTitle(`🎫 TICHET SUPORT PRELUAT`)
        .setColor('#2ECC71')
        .addFields({ name: 'Preluat de', value: `${interaction.user.tag}` });

      await interaction.message.edit({ embeds: [updatedEmbed], components: [] }).catch(() => null);

      const ticketChan = await interaction.guild.channels.fetch(channelId).catch(() => null);
      if (ticketChan) {
        await ticketChan.send({ content: `👤 Managerul **${interaction.user.tag}** a preluat acest tichet și te va asista în cel mai scurt timp!` }).catch(() => null);
        await ticketChan.permissionOverwrites.create(interaction.user.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true
        }).catch(() => null);
      }

      await interaction.reply({ content: '✅ Ai preluat tichetul cu succes!', ephemeral: true });
    }

    // ─── TICKET CLOSE BUTTON ───
    else if (interaction.customId.startsWith('btn_ticket_close_')) {
      const ticketId = interaction.customId.replace('btn_ticket_close_', '');
      await interaction.reply({ content: '🔒 Acest tichet va fi închis și șters în 5 secunde...' });
      
      setTimeout(async () => {
        try {
          await interaction.channel.delete().catch(() => null);

          const ticketsLogChanId = db.settings.ticketsLogChannelId;
          if (ticketsLogChanId) {
            const logChan = await interaction.guild.channels.fetch(ticketsLogChanId).catch(() => null);
            if (logChan) {
              const messages = await logChan.messages.fetch({ limit: 50 }).catch(() => new Map());
              const targetMsg = [...messages.values()].find(m => m.embeds[0]?.footer?.text?.includes(ticketId));
              if (targetMsg) {
                const oldEmbed = targetMsg.embeds[0];
                const updatedEmbed = EmbedBuilder.from(oldEmbed)
                  .setTitle(`🎫 TICHET SUPORT ÎNCHIS`)
                  .setColor('#7F8C8D')
                  .addFields({ name: 'Închis la', value: new Date().toLocaleString('ro-RO') });
                await targetMsg.edit({ embeds: [updatedEmbed], components: [] }).catch(() => null);
              }
            }
          }
        } catch (err) {
          console.error('[TICKET CLOSE ERROR]', err);
        }
      }, 5000);
    }

    // ─── COMPLAINT RESOLUTION BUTTONS ───
    else if (interaction.customId.startsWith('btn_complaint_approve_') || interaction.customId.startsWith('btn_complaint_reject_')) {
      const isApproved = interaction.customId.startsWith('btn_complaint_approve_');
      const complaintId = interaction.customId.replace(isApproved ? 'btn_complaint_approve_' : 'btn_complaint_reject_', '');
      
      const managerRoleId = db.settings.managerRoleId;
      const managerStaffRoleId = db.settings.managerStaffRoleId;
      const hasManager = interaction.member.roles.cache.has(managerRoleId) || interaction.member.roles.cache.has(managerStaffRoleId);
      if (!hasManager) {
        return interaction.reply({ content: '❌ Doar Managerii pot soluționa reclamațiile!', ephemeral: true });
      }

      const statusText = isApproved ? 'aprobata' : 'respinsa';
      const modal = new ModalBuilder()
        .setCustomId(`modal_complaint_verdict_${complaintId}_${statusText}`)
        .setTitle(`Soluționare Reclamație Lider — ${isApproved ? 'APROBĂ' : 'RESPINGE'}`);

      const verdictInput = new TextInputBuilder()
        .setCustomId('verdict_text')
        .setLabel('Motivare / Detalii Verdict')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Ex: Liderul primește Avertisment Verbal 1/2 pentru limbaj / Reclamație nefondată...')
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(verdictInput));
      await interaction.showModal(modal);
    }

    // ─── COMPLAINT CREATE BUTTON ───
    else if (interaction.customId === 'btn_complaint_create') {
      const modal = new ModalBuilder()
        .setCustomId('modal_complaint_create')
        .setTitle('🎫 Depunere Reclamație Lider');

      const targetInput = new TextInputBuilder()
        .setCustomId('complaint_target')
        .setLabel('Mafia / Liderul reclamat (Nume/Facțiune)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: Ballas / Liderul Andrei')
        .setRequired(true);

      const complainantInput = new TextInputBuilder()
        .setCustomId('complaint_complainant')
        .setLabel('Numele tău in-game')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: Mihai Popescu')
        .setRequired(true);

      const reasonInput = new TextInputBuilder()
        .setCustomId('complaint_reason')
        .setLabel('Motivul reclamației')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Descrie detaliat ce regulament a încălcat liderul...')
        .setRequired(true);

      const evidenceInput = new TextInputBuilder()
        .setCustomId('complaint_evidence')
        .setLabel('Dovezi (Link-uri YouTube, Imgur, etc.)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: https://youtube.com/watch?v=...')
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(targetInput),
        new ActionRowBuilder().addComponents(complainantInput),
        new ActionRowBuilder().addComponents(reasonInput),
        new ActionRowBuilder().addComponents(evidenceInput)
      );
      await interaction.showModal(modal);
    }

    // ─── BLACKLIST ADD BUTTON ───
    else if (interaction.customId === 'btn_blacklist_add') {
      const managerRoleId = db.settings.managerRoleId;
      const managerStaffRoleId = db.settings.managerStaffRoleId;
      const hasManager = interaction.member.roles.cache.has(managerRoleId) || interaction.member.roles.cache.has(managerStaffRoleId);
      if (!hasManager) {
        return interaction.reply({ content: '❌ Doar Managerii pot adăuga pe cineva pe Blacklist!', ephemeral: true });
      }

      const modal = new ModalBuilder()
        .setCustomId('modal_blacklist_add')
        .setTitle('➕ Adaugă pe Faction Blacklist');

      const idInput = new TextInputBuilder()
        .setCustomId('bl_user_id')
        .setLabel('Discord User ID (snowflake)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 811954484955709491')
        .setRequired(true);

      const nameInput = new TextInputBuilder()
        .setCustomId('bl_ingame_name')
        .setLabel('Nume in-game')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: Ionut Vasile')
        .setRequired(true);

      const reasonInput = new TextInputBuilder()
        .setCustomId('bl_reason')
        .setLabel('Motivul blocării')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Ex: Neprezentare la war-uri, comportament toxic...')
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(idInput),
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(reasonInput)
      );
      await interaction.showModal(modal);
    }

    // ─── BLACKLIST REMOVE BUTTON ───
    else if (interaction.customId === 'btn_blacklist_remove') {
      const managerRoleId = db.settings.managerRoleId;
      const managerStaffRoleId = db.settings.managerStaffRoleId;
      const hasManager = interaction.member.roles.cache.has(managerRoleId) || interaction.member.roles.cache.has(managerStaffRoleId);
      if (!hasManager) {
        return interaction.reply({ content: '❌ Doar Managerii pot șterge de pe Blacklist!', ephemeral: true });
      }

      const blList = db.blacklist || [];
      if (blList.length === 0) {
        return interaction.reply({ content: '❌ Blacklist-ul este gol.', ephemeral: true });
      }

      const select = new StringSelectMenuBuilder()
        .setCustomId('select_blacklist_remove')
        .setPlaceholder('Alege utilizatorul de șters...')
        .addOptions(blList.map(u => ({ label: u.ingameName + " (" + u.userId + ")", value: u.userId, description: "Motiv: " + u.reason.slice(0, 50) })).slice(0, 25));
      
      const row = new ActionRowBuilder().addComponents(select);
      await interaction.reply({ content: 'Selectează persoana pe care vrei s-o **elimini** de pe Blacklist:', components: [row], ephemeral: true });
    }

    // ─── BLACKLIST VIEW BUTTON ───
    else if (interaction.customId === 'btn_blacklist_view') {
      const blList = db.blacklist || [];
      if (blList.length === 0) {
        return interaction.reply({ content: '📋 **Faction Blacklist este gol!** Nimeni nu este înregistrat momentan pe lista neagră.', ephemeral: true });
      }

      const listEmbed = new EmbedBuilder()
        .setTitle('📋 LISTĂ JUCĂTORI PE BLACKLIST (NEAGRĂ) MAFII')
        .setDescription(
          blList.map((u, idx) => "**" + (idx + 1) + ".** <@" + u.userId + "> (" + u.userId + ")\n> 🎮 *In-game:* **" + u.ingameName + "**\n> 📝 *Motiv:* " + u.reason + "\n> 👤 *Adăugat de:* " + u.addedBy + " la " + u.addedAt).join('\n\n')
        )
        .setColor('#C0392B')
        .setTimestamp();

      return interaction.reply({ embeds: [listEmbed], ephemeral: true });
    }

    // ─── SINDICAT: MANAGE ALLIANCES ───
    else if (interaction.customId === 'btn_sindicat_manage_alliances') {
      const isSindicatLider = interaction.member.roles.cache.has(db.settings.sindicatLiderRoleId);
      if (!isSindicatLider) {
        return interaction.reply({ content: '❌ Doar **Liderul Sindicat** poate gestiona alianțele!', ephemeral: true });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_alliance_add').setLabel('➕ Adaugă Alianță').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('btn_alliance_remove').setLabel('➖ Șterge Alianță').setStyle(ButtonStyle.Danger)
      );

      await interaction.reply({ content: 'Gestionează alianțele din cadrul Sindicatului:', components: [row], ephemeral: true });
    }

    // ─── SINDICAT: ADD ALLIANCE BUTTON ───
    else if (interaction.customId === 'btn_alliance_add') {
      const modal = new ModalBuilder()
        .setCustomId('modal_alliance_add')
        .setTitle('➕ Adăugare Alianță Sindicat');

      const org1Input = new TextInputBuilder()
        .setCustomId('org_1')
        .setLabel('Nume Organizație 1')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: Ballas')
        .setRequired(true);

      const org2Input = new TextInputBuilder()
        .setCustomId('org_2')
        .setLabel('Nume Organizație 2')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: Velora')
        .setRequired(true);

      const detailsInput = new TextInputBuilder()
        .setCustomId('alliance_details')
        .setLabel('Detalii Alianță / Pact')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Ex: Alianță defensivă totală / Pact de neagresiune (NAP) pe 30 zile...')
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(org1Input),
        new ActionRowBuilder().addComponents(org2Input),
        new ActionRowBuilder().addComponents(detailsInput)
      );
      await interaction.showModal(modal);
    }

    // ─── SINDICAT: REMOVE ALLIANCE BUTTON ───
    else if (interaction.customId === 'btn_alliance_remove') {
      const alliances = db.alliances || [];
      if (alliances.length === 0) {
        return interaction.reply({ content: '❌ Nu există nicio alianță înregistrată.', ephemeral: true });
      }

      const select = new StringSelectMenuBuilder()
        .setCustomId('select_alliance_remove')
        .setPlaceholder('Alege alianța de șters...')
        .addOptions(alliances.map(a => ({ label: a.org1 + " 🤝 " + a.org2, value: a.id, description: a.details.slice(0, 50) })).slice(0, 25));

      const row = new ActionRowBuilder().addComponents(select);
      await interaction.reply({ content: 'Selectează alianța pe care dorești să o **elimini**:', components: [row], ephemeral: true });
    }

    // ─── SINDICAT: MANAGE AUCTION ZONES BUTTON ───
    else if (interaction.customId === 'btn_sindicat_manage_zones') {
      const isAuthorized = interaction.member.roles.cache.has(db.settings.managerRoleId) || 
                            interaction.member.roles.cache.has(db.settings.managerStaffRoleId) || 
                            interaction.member.roles.cache.has(db.settings.sindicatLiderRoleId) || 
                            interaction.member.roles.cache.has(db.settings.sindicatCoLiderRoleId);
      if (!isAuthorized) {
        return interaction.reply({ content: '❌ Doar managerii sau liderii/co-liderii Sindicatului pot modifica zonele!', ephemeral: true });
      }

      const zones = db.auction_zones || [];
      if (zones.length === 0) {
        return interaction.reply({ content: '❌ Nu există nicio zonă de licitație configurată în baza de date.', ephemeral: true });
      }

      const select = new StringSelectMenuBuilder()
        .setCustomId('select_sindicat_manage_zone_choose')
        .setPlaceholder('Alege zona...')
        .addOptions(zones.map(z => ({ label: z.name, value: z.id, description: `Deținător: ${z.owner || 'Disponibil'} | Preț: ${z.price || '0$'}` })).slice(0, 25));
      
      const row = new ActionRowBuilder().addComponents(select);
      await interaction.reply({ content: 'Selectează zona pe care dorești să o **actualizezi / modifici**:', components: [row], ephemeral: true });
    }

    // ─── FACTIONS ARROWS: REMOVE ARROW BUTTON ───
    else if (interaction.customId === 'btn_remove_arrow') {
      const mafia = db.mafias.find(m => m.channels.arrows === interaction.channel.id);
      if (!mafia) return interaction.reply({ content: '❌ Canal invalid sau facțiune negăsită.', ephemeral: true });

      const isLeader = mafia.ownerId === interaction.user.id;
      const isCoLeader = mafia.coLeaders && mafia.coLeaders.includes(interaction.user.id);
      if (!isLeader && !isCoLeader) {
        return interaction.reply({ content: '❌ Doar Liderii și Co-Liderii pot șterge săgeți!', ephemeral: true });
      }

      const arrowsList = mafia.arrows || [];
      if (arrowsList.length === 0) {
        return interaction.reply({ content: '❌ Nu există nicio săgeată înregistrată pentru facțiunea ta.', ephemeral: true });
      }

      const select = new StringSelectMenuBuilder()
        .setCustomId("select_arrow_remove_" + mafia.id)
        .setPlaceholder('Alege săgeata de șters...')
        .addOptions(arrowsList.map(a => ({ label: a.name + " (ID: " + a.fivemId + ")", value: a.id, description: "Adăugat de: " + a.addedBy })).slice(0, 25));

      const row = new ActionRowBuilder().addComponents(select);
      await interaction.reply({ content: 'Selectează săgeata pe care dorești să o **ștergi**:', components: [row], ephemeral: true });
    }

    // ─── LIDER SETTINGS: AFISARE MEMBRII ───
    else if (interaction.customId.startsWith('btn_show_members_')) {
      const mafiaId = interaction.customId.replace('btn_show_members_', '');
      const mafia = db.mafias.find(m => m.id === mafiaId);
      if (!mafia) return interaction.reply({ content: '❌ Această facțiune nu există.', ephemeral: true });

      const guild = interaction.guild;
      try {
        await interaction.deferReply({ ephemeral: true });
        const roleObj = await guild.roles.fetch(mafia.roleId).catch(() => null);
        if (!roleObj) {
          return interaction.editReply({ content: '❌ Rolul facțiunii nu a fost găsit pe Discord.' });
        }

        const members = roleObj.members;
        if (members.size === 0) {
          return interaction.editReply({ content: `👥 **Membrii facțiunii ${mafia.name}:**\nNiciun membru nu are în prezent acest rol pe Discord.` });
        }

        const coLiderRoleIds = [db.settings.coLiderOficialaRoleId, db.settings.coLiderNeoficialaRoleId, db.settings.coLiderGangRoleId].filter(Boolean);

        const list = members.map(m => {
          let badge = '👤 Membru';
          if (m.id === mafia.ownerId) {
            badge = '👑 Lider';
          } else if (coLiderRoleIds.some(rid => m.roles.cache.has(rid))) {
            badge = '👥 Co-Lider';
          }
          return `- <@${m.id}> (**${m.user.username}**) | Nickname: *${m.nickname || 'Fără'}* [${badge}]`;
        }).join('\n');

        const embed = new EmbedBuilder()
          .setTitle(`👥 MEMBRII FACȚIUNII ${mafia.name.toUpperCase()}`)
          .setDescription(`Iată lista completă a membrilor care dețin rolul facțiunii:\n\n${list}`)
          .setColor('#3498DB')
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('[SHOW MEMBERS ERROR]', err);
        await interaction.editReply({ content: '❌ Eroare la citirea membrilor din Discord.' });
      }
    }

    // ─── LIDER SETTINGS: INVITĂ MEMBRU ───
    else if (interaction.customId.startsWith('btn_invite_member_')) {
      const mafiaId = interaction.customId.replace('btn_invite_member_', '');
      const mafia = db.mafias.find(m => m.id === mafiaId);
      if (!mafia) return interaction.reply({ content: '❌ Această facțiune nu există.', ephemeral: true });

      const modal = new ModalBuilder()
        .setCustomId("modal_invite_member_" + mafiaId)
        .setTitle("📥 Invitată Membru — " + mafia.name.slice(0, 20));

      const idInput = new TextInputBuilder()
        .setCustomId('user_discord_id')
        .setLabel('Discord User ID al celui pe care-l inviți')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 811954484955709491')
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(idInput));
      await interaction.showModal(modal);
    }

    // ─── LIDER SETTINGS: SETEAZĂ CO-LIDER ───
    else if (interaction.customId.startsWith('btn_set_colider_')) {
      const mafiaId = interaction.customId.replace('btn_set_colider_', '');
      const mafia = db.mafias.find(m => m.id === mafiaId);
      if (!mafia) return interaction.reply({ content: '❌ Această facțiune nu există.', ephemeral: true });

      const guild = interaction.guild;
      const roleMembers = guild.members.cache.filter(m => m.roles.cache.has(mafia.roleId) && m.id !== mafia.ownerId);

      if (roleMembers.size === 0) {
        return interaction.reply({ content: '❌ Nu există alți membri în facțiunea ta pe care să-i poți pune Co-Lider.', ephemeral: true });
      }

      const options = roleMembers.map(m => ({
        label: m.user.username,
        value: m.id,
        description: "Setează ca Co-Lider în " + mafia.name
      })).slice(0, 25);

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("select_set_colider_" + mafiaId)
        .setPlaceholder('Alege membrul din listă...')
        .addOptions(options);

      const row = new ActionRowBuilder().addComponents(selectMenu);
      await interaction.reply({ content: 'Alege membrul pe care dorești să-l setezi drept **Co-Lider**:', components: [row], ephemeral: true });
    }

    // ─── LIDER SETTINGS: DEMITE CO-LIDER ───
    else if (interaction.customId.startsWith('btn_demote_colider_')) {
      const mafiaId = interaction.customId.replace('btn_demote_colider_', '');
      const mafia = db.mafias.find(m => m.id === mafiaId);
      if (!mafia) return interaction.reply({ content: '❌ Această facțiune nu există.', ephemeral: true });

      const isLeader = mafia.ownerId === interaction.user.id;
      if (!isLeader) {
        return interaction.reply({ content: '❌ Doar Liderul principal poate demite un Co-Lider!', ephemeral: true });
      }

      const coLeaders = mafia.coLeaders || [];
      if (coLeaders.length === 0) {
        return interaction.reply({ content: '❌ Facțiunea ta nu are niciun Co-Lider setat.', ephemeral: true });
      }

      const guild = interaction.guild;
      const options = [];
      for (const coLiderId of coLeaders) {
        const member = await guild.members.fetch(coLiderId).catch(() => null);
        options.push({
          label: member ? member.user.username : coLiderId,
          value: coLiderId,
          description: "Demite Co-Liderul din facțiunea " + mafia.name
        });
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("select_demote_colider_" + mafiaId)
        .setPlaceholder('Alege Co-Liderul de demis...')
        .addOptions(options);

      const row = new ActionRowBuilder().addComponents(selectMenu);
      await interaction.reply({ content: 'Selectează Co-Liderul pe care dorești să-l **demiți** înapoi la gradul de membru:', components: [row], ephemeral: true });
    }

    // ─── LIDER SETTINGS: EXCLUDE MEMBRU ───
    else if (interaction.customId.startsWith('btn_remove_member_')) {
      const mafiaId = interaction.customId.replace('btn_remove_member_', '');
      const mafia = db.mafias.find(m => m.id === mafiaId);
      if (!mafia) return interaction.reply({ content: '❌ Această facțiune nu există.', ephemeral: true });

      const isLeader = mafia.ownerId === interaction.user.id;
      if (!isLeader) {
        return interaction.reply({ content: '❌ Doar Liderul principal poate exclude membri!', ephemeral: true });
      }

      const otherMembers = (mafia.members || []).filter(id => id !== mafia.ownerId);
      if (otherMembers.length === 0) {
        return interaction.reply({ content: '❌ Facțiunea ta nu are alți membri înregistrați pe Discord.', ephemeral: true });
      }

      const guild = interaction.guild;
      const options = [];
      for (const memberId of otherMembers) {
        const member = await guild.members.fetch(memberId).catch(() => null);
        options.push({
          label: member ? member.user.username : memberId,
          value: memberId,
          description: "Exclude membrul din facțiunea " + mafia.name
        });
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("select_remove_member_" + mafiaId)
        .setPlaceholder('Alege membrul de exclus...')
        .addOptions(options.slice(0, 25));

      const row = new ActionRowBuilder().addComponents(selectMenu);
      await interaction.reply({ content: 'Selectează membrul pe care dorești să-l **excluzi (demiți)** din facțiune:', components: [row], ephemeral: true });
    }

    // ─── MEMBRI SETTINGS: SCHIMBĂ NUME ───
    else if (interaction.customId.startsWith('btn_change_ingame_name_')) {
      const mafiaId = interaction.customId.replace('btn_change_ingame_name_', '');
      const mafia = db.mafias.find(m => m.id === mafiaId);
      if (!mafia) return interaction.reply({ content: '❌ Această facțiune nu există.', ephemeral: true });

      const modal = new ModalBuilder()
        .setCustomId("modal_change_name_" + mafiaId)
        .setTitle('📝 Schimbare Nume In-Game');

      const nameInput = new TextInputBuilder()
        .setCustomId('new_ingame_name')
        .setLabel('Noul nume in-game (exact)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: Vasile Popescu')
        .setRequired(true);

      const idInput = new TextInputBuilder()
        .setCustomId('fivem_id')
        .setLabel('ID-ul tău FiveM')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 5933')
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(idInput)
      );
      await interaction.showModal(modal);
    }

    // ─── MEMBRI SETTINGS: DEMISIONEAZĂ ───
    else if (interaction.customId.startsWith('btn_resign_')) {
      const mafiaId = interaction.customId.replace('btn_resign_', '');
      const mafia = db.mafias.find(m => m.id === mafiaId);
      if (!mafia) return interaction.reply({ content: '❌ Această facțiune nu există.', ephemeral: true });

      if (!mafia.members.includes(interaction.user.id)) {
        return interaction.reply({ content: '❌ Nu faci parte din această facțiune!', ephemeral: true });
      }

      if (mafia.ownerId === interaction.user.id) {
        return interaction.reply({ content: '❌ Liderul/Proprietarul facțiunii nu poate demisiona! Trebuie să transferi mafia sau să ceri unui manager să o șteargă.', ephemeral: true });
      }

      const guild = interaction.guild;
      try {
        const member = await guild.members.fetch(interaction.user.id);
        
        await member.roles.remove(mafia.roleId).catch(() => null);
        const globalRoleId = "1526283703360163921";
        await member.roles.remove(globalRoleId).catch(() => null);
        
        const coLiderRoleIdMap = {
          'oficiala':   db.settings.coLiderOficialaRoleId,
          'neoficiala': db.settings.coLiderNeoficialaRoleId,
          'gang':       db.settings.coLiderGangRoleId
        };
        const coLiderRoleId = coLiderRoleIdMap[mafia.type];
        if (coLiderRoleId) {
          await member.roles.remove(coLiderRoleId).catch(() => null);
        }

        mafia.members = mafia.members.filter(id => id !== interaction.user.id);
        if (mafia.coLeaders) {
          mafia.coLeaders = mafia.coLeaders.filter(id => id !== interaction.user.id);
        }
        writeDb(db);

        const gradeChannel = guild.channels.cache.get(db.settings.gradeChannelId);
        if (gradeChannel) {
          const embed = new EmbedBuilder()
            .setTitle('👋 DEMISIE FACȚIUNE')
            .setDescription("👤 <@" + interaction.user.id + "> (**" + interaction.user.username + "**) a demisionat din facțiunea **" + mafia.name + "**!")
            .setColor(0xE74C3C)
            .setTimestamp();
          await gradeChannel.send({ embeds: [embed] });
        }

        await interaction.reply({ content: '✅ Ai demisionat cu succes și rolurile ți-au fost retrase.', ephemeral: true });
      } catch (err) {
        console.error('[RESIGN ERROR]', err);
        await interaction.reply({ content: '❌ A apărut o eroare la procesarea demisiei tale.', ephemeral: true });
      }
    }

    // ─── SINDICAT: ADĂUGĂ MEMBRU ───
    else if (interaction.customId === 'btn_sindicat_add_membru') {
      const modal = new ModalBuilder()
        .setCustomId('modal_sindicat_add_membru')
        .setTitle('⚜️ Adaugă Membru Sindicat');
      const idInput = new TextInputBuilder()
        .setCustomId('user_id')
        .setLabel('Discord User ID')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 811954484955709491')
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(idInput));
      await interaction.showModal(modal);
    }

    // ─── SINDICAT: ADĂUGĂ CO-LIDER ───
    else if (interaction.customId === 'btn_sindicat_add_colider') {
      const modal = new ModalBuilder()
        .setCustomId('modal_sindicat_add_colider')
        .setTitle('⚔️ Adaugă Co-Lider Sindicat');
      const idInput = new TextInputBuilder()
        .setCustomId('user_id')
        .setLabel('Discord User ID')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 811954484955709491')
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(idInput));
      await interaction.showModal(modal);
    }

    // ─── SINDICAT: ELIMINĂ MEMBRU ───
    else if (interaction.customId === 'btn_sindicat_remove_member') {
      const modal = new ModalBuilder()
        .setCustomId('modal_sindicat_remove_membru')
        .setTitle('❌ Elimină Membru Sindicat');
      const idInput = new TextInputBuilder()
        .setCustomId('user_id')
        .setLabel('Discord User ID')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 811954484955709491')
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(idInput));
      await interaction.showModal(modal);
    }

    // ─── MANAGER: ȘTERGE MAFIE ───
    else if (interaction.customId === 'btn_manager_delete_mafia') {
      if (db.mafias.length === 0) {
        return interaction.reply({ content: '❌ Nu există nicio mafie înregistrată.', ephemeral: true });
      }
      const select = new StringSelectMenuBuilder()
        .setCustomId('select_manager_delete')
        .setPlaceholder('Alege mafia...')
        .addOptions(db.mafias.map(m => ({ label: m.name, value: m.id })));
      const row = new ActionRowBuilder().addComponents(select);
      await interaction.reply({ content: 'Selectează mafia pe care dorești să o **ștergi definitiv**:', components: [row], ephemeral: true });
    }

    // ─── MANAGER: MODIFICĂ TIP ───
    else if (interaction.customId === 'btn_manager_change_type') {
      if (db.mafias.length === 0) {
        return interaction.reply({ content: '❌ Nu există nicio mafie înregistrată.', ephemeral: true });
      }
      const select = new StringSelectMenuBuilder()
        .setCustomId('select_manager_change_type_mafia')
        .setPlaceholder('Alege mafia...')
        .addOptions(db.mafias.map(m => ({ label: m.name, value: m.id })));
      const row = new ActionRowBuilder().addComponents(select);
      await interaction.reply({ content: 'Selectează mafia pentru care dorești să modifici tipul:', components: [row], ephemeral: true });
    }

    // ─── MANAGER: SANCȚIONEAZĂ MAFIE ───
    else if (interaction.customId === 'btn_manager_sanction_mafia') {
      if (db.mafias.length === 0) {
        return interaction.reply({ content: '❌ Nu există nicio mafie înregistrată.', ephemeral: true });
      }
      const select = new StringSelectMenuBuilder()
        .setCustomId('select_manager_sanction_mafia')
        .setPlaceholder('Alege mafia...')
        .addOptions(db.mafias.map(m => ({ label: m.name, value: m.id })));
      const row = new ActionRowBuilder().addComponents(select);
      await interaction.reply({ content: 'Selectează mafia pe care dorești să o **sancționezi**:', components: [row], ephemeral: true });
    }

    // ─── MANAGER: SCHIMBĂ LIDER ───
    else if (interaction.customId === 'btn_manager_change_leader') {
      if (db.mafias.length === 0) {
        return interaction.reply({ content: '❌ Nu există nicio mafie înregistrată.', ephemeral: true });
      }
      const select = new StringSelectMenuBuilder()
        .setCustomId('select_manager_change_leader_mafia')
        .setPlaceholder('Alege mafia...')
        .addOptions(db.mafias.map(m => ({ label: m.name, value: m.id })));
      const row = new ActionRowBuilder().addComponents(select);
      await interaction.reply({ content: 'Selectează mafia pentru care dorești să **schimbi liderul**:', components: [row], ephemeral: true });
    }
  }
  
  // 3. String Select Menu Interactions
  else if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'select_mafia_type') {
      const type = interaction.values[0];
      
      const modal = new ModalBuilder()
        .setCustomId("modal_create_mafia_" + type)
        .setTitle("Creare " + type.toUpperCase());
        
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

      const isBlacklisted = (db.blacklist || []).some(b => b.userId === interaction.user.id);
      if (isBlacklisted) {
        return interaction.reply({ content: '❌ Nu te poți alătura unei facțiuni deoarece ești înregistrat pe Blacklist!', ephemeral: true });
      }

      if (db.settings.verificatRoleId) {
        const memberCheck = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (memberCheck && !memberCheck.roles.cache.has(db.settings.verificatRoleId)) {
          const verCh = db.settings.verificareChannelId ? "<#" + db.settings.verificareChannelId + ">" : 'canalul #verificare';
          return interaction.reply({
            content: "❌ **Nu ești verificat!**\nTrebuie să treci mai întâi prin verificarea de identitate în " + verCh + " înainte de a intra într-o mafie.",
            ephemeral: true
          });
        }
      }
      
      if (mafia.members.includes(interaction.user.id)) {
        return interaction.reply({ content: '❌ Faci deja parte din această mafie!', ephemeral: true });
      }
      
      const inOther = db.mafias.find(m => m.members.includes(interaction.user.id));
      if (inOther) {
        return interaction.reply({ content: "❌ Faci parte deja din altă mafie (**" + inOther.name + "**)! Trebuie să ieși din ea mai întâi.", ephemeral: true });
      }
      
      const modalTitle = ("🎮 Alăturare — " + mafia.name).slice(0, 45);
      const joinModal = new ModalBuilder()
        .setCustomId("modal_join_verify_" + mafiaId)
        .setTitle(modalTitle);

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

    // ─── SELECT COLOR ───
    else if (interaction.customId.startsWith('select_color_')) {
      const mafiaId = interaction.customId.replace('select_color_', '');
      const selectedColor = interaction.values[0];

      const mafia = db.mafias.find(m => m.id === mafiaId);
      if (!mafia) return interaction.reply({ content: '❌ Facțiunea nu a fost găsită.', ephemeral: true });

      const isLeader = mafia.ownerId === interaction.user.id;
      const isCoLeader = mafia.coLeaders && mafia.coLeaders.includes(interaction.user.id);
      if (!isLeader && !isCoLeader) {
        return interaction.reply({ content: '❌ Doar Liderii și Co-Liderii pot folosi acest panou de setări!', ephemeral: true });
      }

      try {
        const guild = interaction.guild;
        const role = await guild.roles.fetch(mafia.roleId);
        if (role) {
          await role.setColor(selectedColor);
          await interaction.reply({ content: "🎨 Culoarea rolului facțiunii a fost schimbată cu succes în **" + selectedColor + "**!", ephemeral: true });

          await sendLogEmbed(
            '🎨 CULOARE ROL ACTUALIZATĂ',
            'Liderul **' + interaction.user.username + '** a schimbat culoarea rolului facțiunii **' + mafia.name + '** în ' + selectedColor + '.',
            selectedColor
          );
        } else {
          await interaction.reply({ content: '❌ Rolul facțiunii nu a fost găsit pe server.', ephemeral: true });
        }
      } catch (err) {
        console.error('[SET COLOR ERROR]', err);
        await interaction.reply({ content: '❌ A apărut o eroare la schimbarea culorii rolului. Verifică permisiunile botului.', ephemeral: true });
      }
    }

    // ─── SELECT SET CO-LIDER ───
    else if (interaction.customId.startsWith('select_set_colider_')) {
      const mafiaId = interaction.customId.replace('select_set_colider_', '');
      const targetUserId = interaction.values[0];

      const mafia = db.mafias.find(m => m.id === mafiaId);
      if (!mafia) return interaction.reply({ content: '❌ Facțiunea nu a fost găsită.', ephemeral: true });

      const isLeader = mafia.ownerId === interaction.user.id;
      if (!isLeader) {
        return interaction.reply({ content: '❌ Doar Liderul principal poate numi un Co-Lider!', ephemeral: true });
      }

      if (!mafia.coLeaders) mafia.coLeaders = [];
      if (mafia.coLeaders.includes(targetUserId)) {
        return interaction.reply({ content: '❌ Acest membru este deja setat drept Co-Lider!', ephemeral: true });
      }

      mafia.coLeaders.push(targetUserId);
      writeDb(db);

      const coLiderRoleIdMap = {
        'oficiala':   db.settings.coLiderOficialaRoleId,
        'neoficiala': db.settings.coLiderNeoficialaRoleId,
        'gang':       db.settings.coLiderGangRoleId
      };
      const coLiderRoleId = coLiderRoleIdMap[mafia.type];

      const guild = interaction.guild;
      try {
        const member = await guild.members.fetch(targetUserId);
        if (coLiderRoleId) {
          await member.roles.add(coLiderRoleId);
        }

        await ensureFactionsHaveSettings(guild);

        await sendLogEmbed(
          '👥 NUMIRE CO-LIDER',
          "Liderul **" + interaction.user.username + "** l-a numit pe <@" + targetUserId + "> drept Co-Lider în facțiunea **" + mafia.name + "**.",
          '#F1C40F'
        );

        await interaction.reply({ content: "👥 L-ai setat pe <@" + targetUserId + "> drept Co-Lider! Rolurile și accesele i-au fost actualizate.", ephemeral: true });
      } catch (err) {
        console.error('[SET CO-LEADER ERROR]', err);
        await interaction.reply({ content: '❌ A apărut o eroare la atribuirea rolului de Discord.', ephemeral: true });
      }
    }

    // ─── SELECT DEMOTE CO-LIDER ───
    else if (interaction.customId.startsWith('select_demote_colider_')) {
      const mafiaId = interaction.customId.replace('select_demote_colider_', '');
      const targetUserId = interaction.values[0];

      const mafia = db.mafias.find(m => m.id === mafiaId);
      if (!mafia) return interaction.reply({ content: '❌ Facțiunea nu a fost găsită.', ephemeral: true });

      const isLeader = mafia.ownerId === interaction.user.id;
      if (!isLeader) {
        return interaction.reply({ content: '❌ Doar Liderul principal poate demite un Co-Lider!', ephemeral: true });
      }

      mafia.coLeaders = (mafia.coLeaders || []).filter(id => id !== targetUserId);
      writeDb(db);

      const coLiderRoleIdMap = {
        'oficiala':   db.settings.coLiderOficialaRoleId,
        'neoficiala': db.settings.coLiderNeoficialaRoleId,
        'gang':       db.settings.coLiderGangRoleId
      };
      const coLiderRoleId = coLiderRoleIdMap[mafia.type];

      const guild = interaction.guild;
      try {
        const member = await guild.members.fetch(targetUserId);
        if (coLiderRoleId) {
          await member.roles.remove(coLiderRoleId).catch(() => null);
        }

        await ensureFactionsHaveSettings(guild);

        await sendLogEmbed(
          '👥 DEMITERE CO-LIDER',
          "Liderul **" + interaction.user.username + "** l-a demis pe <@" + targetUserId + "> din funcția de Co-Lider în facțiunea **" + mafia.name + "**.",
          '#E67E22'
        );

        await interaction.reply({ content: "👥 L-ai demis pe <@" + targetUserId + "> din gradul de Co-Lider. Rolurile i-au fost retrase.", ephemeral: true });
      } catch (err) {
        console.error('[DEMOTE CO-LEADER ERROR]', err);
        await interaction.reply({ content: '❌ A apărut o eroare la actualizarea rolurilor de Discord.', ephemeral: true });
      }
    }

    // ─── SELECT EXCLUDE MEMBRU ───
    else if (interaction.customId.startsWith('select_remove_member_')) {
      const mafiaId = interaction.customId.replace('select_remove_member_', '');
      const targetUserId = interaction.values[0];

      const mafia = db.mafias.find(m => m.id === mafiaId);
      if (!mafia) return interaction.reply({ content: '❌ Facțiunea nu a fost găsită.', ephemeral: true });

      const isLeader = mafia.ownerId === interaction.user.id;
      if (!isLeader) {
        return interaction.reply({ content: '❌ Doar Liderul principal poate exclude membri!', ephemeral: true });
      }

      mafia.members = (mafia.members || []).filter(id => id !== targetUserId);
      mafia.coLeaders = (mafia.coLeaders || []).filter(id => id !== targetUserId);
      writeDb(db);

      const coLiderRoleIdMap = {
        'oficiala':   db.settings.coLiderOficialaRoleId,
        'neoficiala': db.settings.coLiderNeoficialaRoleId,
        'gang':       db.settings.coLiderGangRoleId
      };
      const coLiderRoleId = coLiderRoleIdMap[mafia.type];

      const guild = interaction.guild;
      try {
        const member = await guild.members.fetch(targetUserId);
        if (member) {
          await member.roles.remove(mafia.roleId).catch(() => null);
          const globalRoleId = "1526283703360163921";
          await member.roles.remove(globalRoleId).catch(() => null);
          if (coLiderRoleId) {
            await member.roles.remove(coLiderRoleId).catch(() => null);
          }
        }

        const gradeChannel = guild.channels.cache.get(db.settings.gradeChannelId);
        if (gradeChannel) {
          const embed = new EmbedBuilder()
            .setTitle('👋 EXCLUDERE MEMBRU')
            .setDescription("👤 <@" + targetUserId + "> (**" + (member ? member.user.username : targetUserId) + "**) a fost exclus (demis) din facțiunea **" + mafia.name + "**!")
            .setColor(0xE74C3C)
            .setTimestamp();
          await gradeChannel.send({ embeds: [embed] });
        }

        await interaction.reply({ content: "🗑️ L-ai exclus cu succes pe <@" + targetUserId + "> din facțiune! Rolurile i-au fost retrase.", ephemeral: true });
      } catch (err) {
        console.error('[EXCLUDE MEMBER ERROR]', err);
        await interaction.reply({ content: '❌ A apărut o eroare la excluderea membrului din Discord.', ephemeral: true });
      }
    }

    // ─── SELECT BLACKLIST REMOVE ───
    else if (interaction.customId === 'select_blacklist_remove') {
      const targetId = interaction.values[0];
      db.blacklist = db.blacklist || [];
      const userIdx = db.blacklist.findIndex(b => b.userId === targetId);
      if (userIdx === -1) {
        return interaction.reply({ content: '❌ Acest utilizator nu a fost găsit în Blacklist.', ephemeral: true });
      }

      const ingameName = db.blacklist[userIdx].ingameName;
      db.blacklist.splice(userIdx, 1);
      writeDb(db);

      await interaction.reply({ content: "✅ Jucătorul **" + ingameName + "** (<@" + targetId + ">) a fost eliminat de pe Blacklist!", ephemeral: true });

      const blChanId = db.settings.blacklistChannelId;
      if (blChanId) {
        const blChan = await interaction.guild.channels.fetch(blChanId).catch(() => null);
        if (blChan) {
          const listEmbed = new EmbedBuilder()
            .setTitle('📋 LISTĂ JUCĂTORI PE BLACKLIST (NEAGRĂ) MAFII')
            .setDescription(
              db.blacklist.map((u, idx) => "**" + (idx + 1) + ".** <@" + u.userId + "> (" + u.userId + ")\n> 🎮 *In-game:* **" + u.ingameName + "**\n> 📝 *Motiv:* " + u.reason + "\n> 👤 *Adăugat de:* " + u.addedBy + " la " + u.addedAt).join('\n\n') || 
              'Niciun jucător pe Blacklist momentan.'
            )
            .setColor('#C0392B')
            .setTimestamp();

          const messages = await blChan.messages.fetch({ limit: 10 }).catch(() => new Map());
          const listMsg = [...messages.values()].find(m => m.embeds[0]?.title === '📋 LISTĂ JUCĂTORI PE BLACKLIST (NEAGRĂ) MAFII');
          if (listMsg) {
            await listMsg.edit({ embeds: [listEmbed] }).catch(() => null);
          }
        }
      }
    }

    // ─── SELECT ALLIANCE REMOVE ───
    else if (interaction.customId === 'select_alliance_remove') {
      const allianceId = interaction.values[0];
      db.alliances = db.alliances || [];
      const idx = db.alliances.findIndex(a => a.id === allianceId);
      if (idx === -1) {
        return interaction.reply({ content: '❌ Alianța nu a fost găsită.', ephemeral: true });
      }

      const a = db.alliances[idx];
      db.alliances.splice(idx, 1);
      writeDb(db);

      await ensureSindicatAlliancesEmbed(interaction.guild);
      await interaction.reply({ content: "✅ Alianța între **" + a.org1 + "** și **" + a.org2 + "** a fost eliminată!", ephemeral: true });
    }

    // ─── SELECT FACTIONS ARROW REMOVE ───
    else if (interaction.customId.startsWith('select_arrow_remove_')) {
      const mafiaId = interaction.customId.replace('select_arrow_remove_', '');
      const arrowId = interaction.values[0];

      const mafia = db.mafias.find(m => m.id === mafiaId);
      if (!mafia) {
        return interaction.reply({ content: '❌ Facțiunea nu a fost găsită.', ephemeral: true });
      }

      mafia.arrows = mafia.arrows || [];
      const idx = mafia.arrows.findIndex(a => a.id === arrowId);
      if (idx === -1) {
        return interaction.reply({ content: '❌ Săgeata nu a fost găsită.', ephemeral: true });
      }

      const deletedArrow = mafia.arrows[idx];
      mafia.arrows.splice(idx, 1);
      writeDb(db);

      await interaction.reply({ content: "✅ Săgeata **" + deletedArrow.name + "** a fost ștearsă cu succes!", ephemeral: true });

      if (mafia.channels.arrows) {
        const arrowsChan = await interaction.guild.channels.fetch(mafia.channels.arrows).catch(() => null);
        if (arrowsChan) {
          const embed = new EmbedBuilder()
            .setTitle("🏹 LISTĂ SĂGEȚI OFICIALE — " + mafia.name.toUpperCase())
            .setDescription(
              mafia.arrows.map((a, idx) => "**" + (idx + 1) + ".** **" + a.name + "**\n> 🌐 *ID FiveM:* " + a.fivemId + "\n> 👤 *Adăugat de:* " + a.addedBy).join('\n\n') ||
              'Nicio săgeată înregistrată momentan în această facțiune.'
            )
            .setColor('#3498DB')
            .setTimestamp();

          const messages = await arrowsChan.messages.fetch({ limit: 10 }).catch(() => new Map());
          const targetMsg = [...messages.values()].find(m => m.embeds[0]?.title?.includes('🏹 LISTĂ SĂGEȚI OFICIALE'));
          if (targetMsg) {
            await targetMsg.edit({ embeds: [embed] }).catch(() => null);
          }
        }
      }
    }

    // ─── MANAGER SELECTS ───
    else if (interaction.customId === 'select_manager_delete') {
      const mafiaId = interaction.values[0];
      const mafia = db.mafias.find(m => m.id === mafiaId);
      if (!mafia) return interaction.reply({ content: '❌ Facțiunea nu a fost găsită.', ephemeral: true });

      try {
        await interaction.deferReply({ ephemeral: true });
        const guild = interaction.guild;
        
        await deleteDiscordFaction(mafia.roleId, mafia.categoryId, mafia.channels);
        await archiveMafiaChannels(guild, mafia);

        db.mafias = db.mafias.filter(m => m.id !== mafiaId);
        writeDb(db);

        await interaction.editReply({ content: "✅ Facțiunea **" + mafia.name + "** a fost ștearsă definitiv și canalele au fost arhivate!" });

        await sendLogEmbed(
          '🗑️ FACȚIUNE ȘTEARSĂ',
          'Managerul **' + interaction.user.username + '** a șters definitiv facțiunea **' + mafia.name + '**.',
          '#E74C3C'
        );
      } catch (err) {
        console.error('[DELETE MAFIA ERROR]', err);
        await interaction.editReply({ content: '❌ Trimiterea a eșuat. Verifică consola.' });
      }
    }

    else if (interaction.customId === 'select_sindicat_manage_zone_choose') {
      const zoneId = interaction.values[0];
      const zones = db.auction_zones || [];
      const zone = zones.find(z => z.id === zoneId);
      if (!zone) return interaction.reply({ content: '❌ Zona selectată nu există.', ephemeral: true });

      const modal = new ModalBuilder()
        .setCustomId("modal_sindicat_edit_zone_" + zoneId)
        .setTitle("⚙️ Editare Zonă — " + zone.name.slice(0, 20));

      const ownerInput = new TextInputBuilder()
        .setCustomId('zone_owner')
        .setLabel('Deținător (Nume sau Disponibil)')
        .setStyle(TextInputStyle.Short)
        .setValue(zone.owner || 'Disponibil')
        .setRequired(true);

      const priceInput = new TextInputBuilder()
        .setCustomId('zone_price')
        .setLabel('Suma Plătită')
        .setStyle(TextInputStyle.Short)
        .setValue(zone.price || '0$')
        .setRequired(true);

      const statusInput = new TextInputBuilder()
        .setCustomId('zone_status')
        .setLabel('Status (Disponibil / Ocupat)')
        .setStyle(TextInputStyle.Short)
        .setValue(zone.status || 'Disponibil')
        .setPlaceholder('Disponibil / Ocupat')
        .setRequired(true);

      const detailsInput = new TextInputBuilder()
        .setCustomId('zone_details')
        .setLabel('Detalii / Mențiuni')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(zone.details || '')
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(ownerInput),
        new ActionRowBuilder().addComponents(priceInput),
        new ActionRowBuilder().addComponents(statusInput),
        new ActionRowBuilder().addComponents(detailsInput)
      );

      await interaction.showModal(modal);
    }

    else if (interaction.customId === 'select_manager_change_leader_mafia') {
      const mafiaId = interaction.values[0];
      const mafia = db.mafias.find(m => m.id === mafiaId);
      if (!mafia) return interaction.reply({ content: '❌ Facțiunea nu a fost găsită.', ephemeral: true });

      const modal = new ModalBuilder()
        .setCustomId("modal_manager_change_leader_" + mafiaId)
        .setTitle("👑 Lider Nou — " + mafia.name.slice(0, 20));

      const idInput = new TextInputBuilder()
        .setCustomId('new_leader_id')
        .setLabel('Discord User ID al noului Lider')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 811954484955709491')
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(idInput));
      await interaction.showModal(modal);
    }

    else if (interaction.customId === 'select_manager_change_type_mafia') {
      const mafiaId = interaction.values[0];
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("select_manager_change_type_action_" + mafiaId)
        .setPlaceholder('Alege noul tip...')
        .addOptions([
          { label: 'Mafie Oficială', value: 'oficiala', emoji: '🔴' },
          { label: 'Mafie Neoficială', value: 'neoficiala', emoji: '🟤' },
          { label: 'Gang / Organizație', value: 'gang', emoji: '🟢' }
        ]);

      const row = new ActionRowBuilder().addComponents(selectMenu);
      await interaction.reply({ content: 'Selectează noul tip de facțiune:', components: [row], ephemeral: true });
    }

    else if (interaction.customId.startsWith('select_manager_change_type_action_')) {
      const mafiaId = interaction.customId.replace('select_manager_change_type_action_', '');
      const newType = interaction.values[0];

      const mafia = db.mafias.find(m => m.id === mafiaId);
      if (!mafia) return interaction.reply({ content: '❌ Facțiunea nu a fost găsită.', ephemeral: true });

      try {
        await interaction.deferReply({ ephemeral: true });
        const oldType = mafia.type;
        mafia.type = newType;
        writeDb(db);

        await updateDiscordFaction(mafia.roleId, mafia.categoryId, mafia.channels, mafia.name, mafia.name, oldType, newType);
        await ensureFactionsHaveSettings(interaction.guild);

        await interaction.editReply({ content: "✅ Tipul facțiunii **" + mafia.name + "** a fost modificat din **" + oldType.toUpperCase() + "** în **" + newType.toUpperCase() + "**!" });

        await sendLogEmbed(
          '🔄 TIP FACȚIUNE MODIFICAT',
          'Managerul **' + interaction.user.username + '** a modificat tipul facțiunii **' + mafia.name + '** din **' + oldType.toUpperCase() + '** în **' + newType.toUpperCase() + '**.',
          '#3498DB'
        );
      } catch (err) {
        console.error('[CHANGE TYPE ERROR]', err);
        await interaction.editReply({ content: '❌ Trimiterea a eșuat. Verifică consola.' });
      }
    }

    else if (interaction.customId === 'select_manager_sanction_mafia') {
      const mafiaId = interaction.values[0];
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("select_manager_sanction_action_" + mafiaId)
        .setPlaceholder('Alege sancțiunea de aplicat...')
        .addOptions([
          { label: 'Avertisment Verbal (+1 AV)', value: 'av_add', emoji: '⚠️' },
          { label: 'Șterge Avertisment Verbal (-1 AV)', value: 'av_remove', emoji: '✅' },
          { label: 'Mafia Warn (+1 Warn)', value: 'warn_add', emoji: '🚫' },
          { label: 'Șterge Faction Warn (-1 Warn)', value: 'warn_remove', emoji: '🔄' }
        ]);

      const row = new ActionRowBuilder().addComponents(selectMenu);
      await interaction.reply({ content: 'Alege sancțiunea pe care vrei s-o aplici facțiunii:', components: [row], ephemeral: true });
    }

    else if (interaction.customId.startsWith('select_manager_sanction_action_')) {
      const mafiaId = interaction.customId.replace('select_manager_sanction_action_', '');
      const action = interaction.values[0];

      const mafia = db.mafias.find(m => m.id === mafiaId);
      if (!mafia) return interaction.reply({ content: '❌ Facțiunea nu a fost găsită.', ephemeral: true });

      try {
        await interaction.deferReply({ ephemeral: true });
        
        if (mafia.warningsAV === undefined) mafia.warningsAV = 0;
        if (mafia.warningsWarn === undefined) mafia.warningsWarn = 0;

        let desc = '';
        if (action === 'av_add') {
          mafia.warningsAV += 1;
          if (mafia.warningsAV >= 2) {
            mafia.warningsAV = 0;
            mafia.warningsWarn += 1;
            desc = "Sancțiune aplicată facțiunii **" + mafia.name + "**: **+1 Avertisment Verbal**. Din cauza acumulării a 2/2 AV, facțiunea primește **+1 Warn**.";
          } else {
            desc = "Sancțiune aplicată facțiunii **" + mafia.name + "**: **+1 Avertisment Verbal** (Stare curentă: " + mafia.warningsAV + "/2 AV, " + mafia.warningsWarn + "/3 Warns).";
          }
        } else if (action === 'av_remove') {
          if (mafia.warningsAV > 0) {
            mafia.warningsAV -= 1;
            desc = "Sancțiune retrasă facțiunii **" + mafia.name + "**: **-1 Avertisment Verbal** (Stare curentă: " + mafia.warningsAV + "/2 AV, " + mafia.warningsWarn + "/3 Warns).";
          } else {
            return interaction.editReply({ content: '❌ Această facțiune nu are niciun AV înregistrat.' });
          }
        } else if (action === 'warn_add') {
          mafia.warningsWarn += 1;
          desc = "Sancțiune aplicată facțiunii **" + mafia.name + "**: **+1 Faction Warn** (Stare curentă: " + mafia.warningsAV + "/2 AV, " + mafia.warningsWarn + "/3 Warns).";
        } else if (action === 'warn_remove') {
          if (mafia.warningsWarn > 0) {
            mafia.warningsWarn -= 1;
            desc = "Sancțiune retrasă facțiunii **" + mafia.name + "**: **-1 Faction Warn** (Stare curentă: " + mafia.warningsAV + "/2 AV, " + mafia.warningsWarn + "/3 Warns).";
          } else {
            return interaction.editReply({ content: '❌ Această facțiune nu are niciun Warn înregistrat.' });
          }
        }

        writeDb(db);
        await syncFactionWarningRoles(mafiaId);

        await interaction.editReply({ content: "✅ Sancțiunea a fost aplicată cu succes! " + desc });

        const gradeChanId = db.settings.gradeChannelId;
        if (gradeChanId) {
          const gradeChan = await interaction.guild.channels.fetch(gradeChanId).catch(() => null);
          if (gradeChan) {
            const sanctionEmbed = new EmbedBuilder()
              .setTitle('⚠️ SANCȚIUNE AUTOMATĂ FACȚIUNE')
              .setDescription(
                "Sancțiune aplicată de Managerul **" + interaction.user.username + "**.\\n\\n" +
                "🛡️ **Facțiune:** " + mafia.name + "\\n" +
                "📊 **Acțiune:** " + desc + "\\n" +
                "⚠️ **AV-uri:** " + mafia.warningsAV + "/2\\n" +
                "🚫 **Warns:** " + mafia.warningsWarn + "/3"
              )
              .setColor('#E67E22')
              .setTimestamp();
            await gradeChan.send({ embeds: [sanctionEmbed] });
          }
        }
      } catch (err) {
        console.error('[SANCTION ERROR]', err);
        await interaction.editReply({ content: '❌ Trimiterea a eșuat. Verifică consola.' });
      }
    }
  }
  
  // 4. Modal Submit Interactions
  else if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('reply_modal_')) {
      const targetUserId = interaction.customId.replace('reply_modal_', '');
      const replyText = interaction.fields.getTextInputValue('reply_text');
      
      try {
        const targetGuildId = db.settings.guildId || "1526274994353606726";
        const guild = client.guilds.cache.get(targetGuildId) || await client.guilds.fetch(targetGuildId).catch(() => null);
        
        let targetMember = null;
        if (guild) {
          targetMember = await guild.members.fetch(targetUserId).catch(() => null);
        }
        
        const targetUser = targetMember ? targetMember.user : await client.users.fetch(targetUserId).catch(() => null);

        if (!targetUser) {
          return interaction.reply({ 
            content: "❌ Nu s-a putut găsi utilizatorul cu ID-ul `" + targetUserId + "` pe Discord.\\n> Este posibil că a introdus un ID greșit în formular, sau a plecat de pe server.", 
            ephemeral: true 
          });
        }

        const embed = new EmbedBuilder()
          .setTitle('📬 Ai primit un răspuns de la Staff!')
          .setDescription(
            "Solicitarea ta de asistență a primit un răspuns.\\n\\n" +
            "👤 **Răspuns oferit de:** " + interaction.user.tag + "\\n\\n" +
            "💬 **Mesaj:**\\n> " + replyText.split('\n').join('\n> ') + "\\n\\n" +
            "*Dacă mai ai nelămuriri, poți trimite un nou tichet de pe panel.*"
          )
          .setColor(0x2ECC71)
          .setFooter({ text: 'Mafii/Gang Panel — Suport Staff' })
          .setTimestamp();

        if (targetMember) {
          await targetMember.send({ embeds: [embed] });
        } else {
          await targetUser.send({ embeds: [embed] });
        }

        await interaction.reply({ 
          content: "✅ Răspunsul a fost trimis cu succes în privat către **" + targetUser.tag + "** (<@" + targetUserId + ">)!", 
          ephemeral: true 
        });
      } catch (err) {
        console.error('[REPLY TICKET]', err);
        await interaction.reply({ 
          content: "❌ Trimiterea a eșuat. Utilizatorul `" + targetUserId + "` probabil are DM-urile închise sau nu este pe server.\\n> **Eroare:** " + err.message, 
          ephemeral: true 
        });
      }
      return;
    }

    if (interaction.customId === 'modal_verify_identity') {
      await interaction.deferReply({ ephemeral: true });

      const ingameName = interaction.fields.getTextInputValue('verify_ingame_name').trim();
      const fivemId    = interaction.fields.getTextInputValue('verify_fivem_id').trim();
      const newNickname = ingameName + " | " + fivemId;

      try {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        try {
          await member.setNickname(newNickname);
        } catch (_) {}

        if (db.settings.verificatRoleId) {
          await member.roles.add(db.settings.verificatRoleId).catch(() => {});
        }

        if (!db.profiles) db.profiles = {};
        db.profiles[interaction.user.id] = {
          ingameName,
          fivemId,
          nickname: newNickname,
          verifiedAt: new Date().toLocaleDateString('ro-RO')
        };
        writeDb(db);

        const logChannel = interaction.guild.channels.cache.get(db.settings.logsChannelId);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle('🔐 VERIFICARE COMPLETATA')
            .setColor('#2ECC71')
            .setThumbnail(interaction.user.displayAvatarURL())
            .addFields(
              { name: 'Utilizator Discord', value: "<@" + interaction.user.id + "> (" + interaction.user.tag + ")", inline: false },
              { name: 'Nickname setat',     value: "`" + newNickname + "`", inline: true },
              { name: 'Nume In-Game',       value: ingameName,           inline: true },
              { name: 'ID Server FiveM',    value: fivemId,              inline: true }
            )
            .setTimestamp();
          await logChannel.send({ embeds: [logEmbed] });
        }

        await interaction.editReply({
          content:
            "✅ **Verificare completă!**\\n\\n" +
            "🏷️ Nickname setat: `" + newNickname + "`\\n" +
            "🎮 Nume in-game: **" + ingameName + "**\\n" +
            "🔢 ID Server FiveM: **" + fivemId + "**\\n\\n" +
            "Acum poți accesa canalele serverului și te poți înregistra într-o mafie sau gang din canalul de înregistrare!"
        });

      } catch (err) {
        console.error('[DISCORD] Eroare la verificare identitate:', err);
        await interaction.editReply({ content: '❌ A apărut o eroare la verificare. Contactează un administrator.' });
      }
      return;
    }

    // ─── MODAL TICKET CREATE ───
    if (interaction.customId === 'modal_ticket_create') {
      const subject = interaction.fields.getTextInputValue('ticket_subject').trim();
      const ticketId = "tick_" + Date.now();

      const ticketCatId = db.settings.ticketCategoryId;
      if (!ticketCatId) {
        return interaction.reply({ content: '❌ Categoria de tichete nu este configurată pe server!', ephemeral: true });
      }

      const category = await interaction.guild.channels.fetch(ticketCatId).catch(() => null);
      if (!category) {
        return interaction.reply({ content: '❌ Categoria de tichete nu a fost găsită!', ephemeral: true });
      }

      // Create private channel for player
      const ticketChan = await interaction.guild.channels.create({
        name: "🎫│𝘁𝗶𝗰𝗵𝗲𝘁-" + interaction.user.username.slice(0, 15),
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
          {
            id: interaction.guild.id, // @everyone
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
          },
          {
            id: db.settings.managerRoleId,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
          },
          {
            id: db.settings.managerStaffRoleId,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
          }
        ]
      });

      // Send Welcome Message in player ticket channel
      const welcomeEmbed = new EmbedBuilder()
        .setTitle('🎫 TICHET ASISTENȚĂ DESCHIS')
        .setDescription(
          "Bun venit, <@" + interaction.user.id + ">!\n\n" +
          "Un manager va prelua tichetul tău în cel mai scurt timp pentru a te ajuta.\n\n" +
          "💬 **Subiectul tău:**\n> " + subject + "\n\n" +
          "Apasă pe butonul de mai jos dacă dorești să închizi tichetul."
        )
        .setColor('#3498DB')
        .setTimestamp();
      
      const welcomeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("btn_ticket_close_" + ticketId).setLabel('Închide Tichet').setStyle(ButtonStyle.Danger).setEmoji('🔒')
      );

      await ticketChan.send({ content: "Pinging <@&" + db.settings.managerRoleId + "> <@&" + db.settings.managerStaffRoleId + ">", embeds: [welcomeEmbed], components: [welcomeRow] });

      // Send Card in log-tickete channel
      const logChanId = db.settings.ticketsLogChannelId;
      if (logChanId) {
        const logChan = await interaction.guild.channels.fetch(logChanId).catch(() => null);
        if (logChan) {
          const logEmbed = new EmbedBuilder()
            .setTitle('🎫 TICHET SUPORT NOU')
            .setDescription(
              "👤 **Utilizator:** <@" + interaction.user.id + "> (" + interaction.user.id + ")\n" +
              "📝 **Subiect:** " + subject + "\n" +
              "📍 **Canal privat:** <#" + ticketChan.id + ">"
            )
            .setColor('#F1C40F')
            .setFooter({ text: "ID Tichet: " + ticketId })
            .setTimestamp();

          const logRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("btn_ticket_claim_" + ticketId + "_" + ticketChan.id).setLabel('Preia Ticket').setStyle(ButtonStyle.Success).setEmoji('🔓')
          );

          await logChan.send({ embeds: [logEmbed], components: [logRow] });
        }
      }

      await interaction.reply({ content: "✅ Tichetul tău a fost deschis cu succes! Apasă aici pentru a-l vedea: <#" + ticketChan.id + ">", ephemeral: true });
      return;
    }

    else if (interaction.customId.startsWith('modal_join_verify_')) {
      await interaction.deferReply({ ephemeral: true });
      const mafiaId    = interaction.customId.replace('modal_join_verify_', '');
      const ingameName = interaction.fields.getTextInputValue('ingame_name').trim();
      const fivemId    = interaction.fields.getTextInputValue('fivem_id').trim();
      const newNickname = ingameName + " | " + fivemId;
      
      const mafia = db.mafias.find(m => m.id === mafiaId);
      if (!mafia) return interaction.editReply({ content: '❌ Mafia nu mai există.' });

      if (mafia.members.includes(interaction.user.id)) {
        return interaction.editReply({ content: '❌ Faci deja parte din această mafie!' });
      }
      const inOther = db.mafias.find(m => m.members.includes(interaction.user.id));
      if (inOther) {
        return interaction.editReply({ content: "❌ Ești deja în **" + inOther.name + "**! Ieși din ea mai întâi." });
      }

      try {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        await member.roles.add(mafia.roleId);
        try {
          await member.setNickname(newNickname);
        } catch (_) {}

        if (!db.profiles) db.profiles = {};
        db.profiles[interaction.user.id] = {
          ingameName,
          fivemId,
          nickname: newNickname,
          updatedAt: new Date().toLocaleDateString('ro-RO')
        };

        mafia.members.push(interaction.user.id);
        writeDb(db);

        const logChannel = interaction.guild.channels.cache.get(db.settings.logsChannelId);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle('👤 MEMBRU NOU')
            .setColor('#3498DB')
            .addFields(
              { name: 'Jucător Discord', value: "<@" + interaction.user.id + ">", inline: true },
              { name: 'Facțiune', value: mafia.name, inline: true },
              { name: 'Nume In-Game', value: ingameName, inline: true },
              { name: 'ID FiveM', value: fivemId, inline: true }
            )
            .setTimestamp();
          await logChannel.send({ embeds: [logEmbed] });
        }

        const gradeChannel = interaction.guild.channels.cache.get(db.settings.gradeChannelId);
        if (gradeChannel) {
          const embed = new EmbedBuilder()
            .setTitle('📥 MEMBRU NOU FACȚIUNE')
            .setDescription("👤 <@" + interaction.user.id + "> (**" + interaction.user.username + "**) s-a alăturat facțiunii **" + mafia.name + "**!")
            .setColor(0x2ECC71)
            .setTimestamp();
          await gradeChannel.send({ embeds: [embed] });
        }

        await interaction.editReply({
          content: "✅ Te-ai alăturat mafiei **" + mafia.name + "**!\\n🎮 Profil înregistrat: **" + ingameName + "** (ID: " + fivemId + ")\\nNickname-ul tău pe Discord a fost actualizat automat."
        });
      } catch (err) {
        console.error('[JOIN FACTION ERROR]', err);
        await interaction.editReply({ content: '❌ Eroare la alăturare. Verifică permisiunile botului.' });
      }
    }

    else if (interaction.customId.startsWith('modal_add_arrow_')) {
      await interaction.deferReply({ ephemeral: true });
      const mafiaId = interaction.customId.replace('modal_add_arrow_', '');
      const arrowName = interaction.fields.getTextInputValue('arrow_name').trim();
      const arrowFivemId = interaction.fields.getTextInputValue('arrow_fivem_id').trim();
      
      const mafia = db.mafias.find(m => m.id === mafiaId);
      if (!mafia) return interaction.editReply({ content: '❌ Mafia nu a mai fost găsită.' });
      
      if (!mafia.arrows) mafia.arrows = [];
      const exists = mafia.arrows.find(a => a.fivemId === arrowFivemId);
      if (exists) {
        return interaction.editReply({ content: "❌ Săgeata cu ID-ul FiveM **" + arrowFivemId + "** este deja înregistrată!" });
      }
      
      const newArrow = {
        id: "arrow_" + Date.now(),
        name: arrowName,
        fivemId: arrowFivemId,
        addedBy: interaction.user.username,
        createdAt: new Date().toLocaleDateString('ro-RO')
      };
      
      mafia.arrows.push(newArrow);
      writeDb(db);
      
      if (mafia.channels.arrows) {
        const channel = await interaction.guild.channels.fetch(mafia.channels.arrows).catch(() => null);
        if (channel) {
          const listEmbed = new EmbedBuilder()
            .setTitle("🏹 LISTĂ SĂGEȚI OFICIALE — " + mafia.name.toUpperCase())
            .setColor('#3498DB')
            .setDescription(
              mafia.arrows.map((a, idx) => "**" + (idx + 1) + ".** **" + a.name + "**\\n> 🌐 *ID FiveM:* " + a.fivemId + "\\n> 👤 *Adăugat de:* " + a.addedBy).join('\\n\\n') || 'Nicio săgeată înregistrată momentan.'
            )
            .setTimestamp();
            
          const messages = await channel.messages.fetch({ limit: 10 }).catch(() => new Map());
          const listMsg = [...messages.values()].find(m => m.embeds[0]?.title?.includes('🏹 LISTĂ SĂGEȚI OFICIALE'));
          if (listMsg) {
            await listMsg.edit({ embeds: [listEmbed] });
          } else {
            await channel.send({ embeds: [listEmbed] });
          }
        }
      }
      
      await interaction.editReply({ content: "✅ Săgeata **" + arrowName + "** (ID FiveM: " + arrowFivemId + ") a fost înregistrată cu succes!" });
      
      await sendLogEmbed(
        '🏹 SĂGEATĂ OFICIALĂ ADĂUGATĂ',
        "Membru **" + interaction.user.username + "** a adăugat săgeata **" + arrowName + "** (ID FiveM: **" + arrowFivemId + "**) în facțiunea **" + mafia.name + "**.",
        '#D35400'
      );
    }
    
    else if (interaction.customId.startsWith('modal_create_mafia_')) {
      await interaction.deferReply({ ephemeral: true });
      const type = interaction.customId.replace('modal_create_mafia_', '');
      const mafiaName = interaction.fields.getTextInputValue('mafia_name').trim();
      const rawColor = interaction.fields.getTextInputValue('mafia_color')?.trim() || '';
      
      const exists = db.mafias.find(m => m.name.toLowerCase() === mafiaName.toLowerCase());
      if (exists) {
        return interaction.editReply({ content: "❌ O mafie cu numele **" + mafiaName + "** există deja pe server!" });
      }
      
      const { guild } = interaction;
      const managerRoleId = db.settings.managerRoleId;
      
      if (!managerRoleId) {
        return interaction.editReply({ content: '❌ Configurația serverului nu este completă. Managerul trebuie să configureze serverul din nou.' });
      }
      
      try {
        let roleColor = '#95A5A6';
        if (type === 'oficiala') roleColor = '#FF3333';
        if (type === 'neoficiala') roleColor = '#A93226';
        if (type === 'gang') roleColor = '#2ECC71';
        
        if (rawColor) {
          let hex = rawColor;
          if (hex.match(/^[0-9A-Fa-f]{6}$/)) hex = '#' + hex;
          
          const colorMap = {
            'rosu': '#FF0000', 'roșu': '#FF0000', 'verde': '#00FF00', 'albastru': '#0000FF',
            'galben': '#FFFF00', 'mov': '#800080', 'portocaliu': '#FFA500', 'roz': '#FFC0CB',
            'alb': '#FFFFFF', 'negru': '#000000', 'gri': '#808080', 'cyan': '#00FFFF', 'magenta': '#FF00FF'
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
          name: rolePrefix + mafiaName,
          color: roleColor,
          hoist: true,
          reason: "Creare mafie: " + mafiaName
        });

        const managerStaffRoleId = db.settings.managerStaffRoleId;
        const overwrites = [
          { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          {
            id: mafiaRole.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, 
              PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak
            ]
          },
          {
            id: managerRoleId,
            allow: [
              PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.ManageMessages
            ]
          }
        ];
        
        if (managerStaffRoleId) {
          overwrites.push({
            id: managerStaffRoleId,
            allow: [
              PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.ManageMessages
            ]
          });
        }

        if (db.settings.sindicatLiderRoleId) {
          overwrites.push({ id: db.settings.sindicatLiderRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak] });
        }
        if (db.settings.sindicatCoLiderRoleId) {
          overwrites.push({ id: db.settings.sindicatCoLiderRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak] });
        }
        if (db.settings.sindicatMembruRoleId) {
          overwrites.push({ id: db.settings.sindicatMembruRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak] });
        }

        let boldPrefix = ' ⚔️ 𝗠𝗔𝗙𝗜𝗘 ';
        if (type === 'oficiala') {
          boldPrefix = ' 🔴 𝗠𝗔𝗙𝗜𝗘 𝗢𝗙𝗜𝗖𝗜𝗔𝗟𝗔 ';
        } else if (type === 'neoficiala') {
          boldPrefix = ' 🟤 𝗠𝗔𝗙𝗜𝗘 𝗡𝗘𝗢𝗙𝗜𝗖𝗜𝗔𝗟𝗔 ';
        } else if (type === 'gang') {
          boldPrefix = ' 🔫 𝗚𝗔𝗡𝗚 ';
        }

        const category = await guild.channels.create({
          name: "[" + boldPrefix + "] " + toBoldUnicode(mafiaName.toUpperCase()),
          type: ChannelType.GuildCategory,
          permissionOverwrites: overwrites
        });

        const cleanNameLower = mafiaName.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/ /g, '-');
        
        const chatChannel = await guild.channels.create({
          name: "💬│𝗰𝗵𝗮𝘁-" + cleanNameLower,
          type: ChannelType.GuildText,
          parent: category.id,
          permissionOverwrites: overwrites
        });
        
        const tasksChannel = await guild.channels.create({
          name: "📋│𝘁𝗮𝘀𝗸-𝘂𝗿𝗶-" + cleanNameLower,
          type: ChannelType.GuildText,
          parent: category.id,
          permissionOverwrites: overwrites
        });
        
        const sanctionsChannel = await guild.channels.create({
          name: "⚠️│𝘀𝗮𝗻𝗰𝘁𝗶𝘂𝗻𝗶-" + cleanNameLower,
          type: ChannelType.GuildText,
          parent: category.id,
          permissionOverwrites: overwrites
        });

        const voiceChannel = await guild.channels.create({
          name: '🔊│𝗩𝗼𝗶𝗰𝗲 𝗟𝗼𝗯𝗯𝘆',
          type: ChannelType.GuildVoice,
          parent: category.id,
          permissionOverwrites: overwrites
        });

        let arrowsChannelId = null;
        if (type !== 'gang') {
          const arrowsChannel = await guild.channels.create({
            name: '🏹│𝘀𝗮𝗴𝗲𝘁𝗶-𝗼𝗳𝗶𝗰𝗶𝗮𝗹𝗲',
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites: overwrites
          });
          arrowsChannelId = arrowsChannel.id;
        }

        const invoiriChannel = await guild.channels.create({
          name: "📝│𝗶𝗻𝘃𝗼𝗶𝗿𝗶-" + cleanNameLower,
          type: ChannelType.GuildText,
          parent: category.id,
          permissionOverwrites: overwrites
        });

        const newMafia = {
          id: "mafia_" + Date.now(),
          name: mafiaName,
          type,
          roleId: mafiaRole.id,
          categoryId: category.id,
          ownerId: interaction.user.id,
          coLeaders: [],
          members: [interaction.user.id],
          arrows: [],
          warningsAV: 0,
          warningsWarn: 0,
          sanctions: { av: 0, warn: 0 },
          channels: {
            chat: chatChannel.id,
            tasks: tasksChannel.id,
            sanctions: sanctionsChannel.id,
            voice: voiceChannel.id,
            arrows: arrowsChannelId,
            invoiri: invoiriChannel.id
          }
        };

        db.mafias.push(newMafia);
        writeDb(db);

        try {
          await ensureFactionsHaveSettings(guild);
        } catch (err) {
          console.error('[SETTINGS FAIL]', err);
        }

        const liderRoleIdMap = {
          'oficiala':   db.settings.liderOficialaRoleId,
          'neoficiala': db.settings.liderNeoficialaRoleId,
          'gang':       db.settings.liderGangRoleId
        };
        const liderRoleId = liderRoleIdMap[type];

        const member = await guild.members.fetch(interaction.user.id);
        if (liderRoleId) {
          await member.roles.add(liderRoleId).catch(() => null);
        }
        await member.roles.add(mafiaRole.id).catch(() => null);
        const globalRoleId = "1526283703360163921";
        await member.roles.add(globalRoleId).catch(() => null);

        await interaction.editReply({
          content: "✅ Facțiunea **" + mafiaName + "** (Tip: " + type.toUpperCase() + ") a fost creată cu succes! Canalele și rolurile au fost configurate."
        });

        await sendLogEmbed(
          '🆕 FACȚIUNE CREATĂ',
          "Liderul **" + interaction.user.username + "** a înființat facțiunea **" + mafiaName + "** (Tip: " + type.toUpperCase() + ").",
          roleColor
        );
      } catch (err) {
        console.error('[CREATE FACTION FAIL]', err);
        await interaction.editReply({ content: '❌ Eroare la crearea facțiunii. Verifică permisiunile botului.' });
      }
    }

    // ─── MODAL BLACKLIST ADD SUBMIT ───
    else if (interaction.customId === 'modal_blacklist_add') {
      const userId = interaction.fields.getTextInputValue('bl_user_id').trim();
      const ingameName = interaction.fields.getTextInputValue('bl_ingame_name').trim();
      const reason = interaction.fields.getTextInputValue('bl_reason').trim();

      if (!/^\d{17,19}$/.test(userId)) {
        return interaction.reply({ content: '❌ ID-ul de Discord introdus nu este valid! Trebuie să conțină doar cifre (17-19 caractere).', ephemeral: true });
      }

      db.blacklist = db.blacklist || [];
      if (db.blacklist.some(b => b.userId === userId)) {
        return interaction.reply({ content: '❌ Acest utilizator este deja adăugat în Blacklist!', ephemeral: true });
      }

      const addedBy = interaction.user.tag;
      const addedAt = new Date().toLocaleString('ro-RO');

      db.blacklist.push({ userId, ingameName, reason, addedBy, addedAt });
      writeDb(db);

      try {
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (member) {
          for (const mafia of db.mafias) {
            if (mafia.roleId && member.roles.cache.has(mafia.roleId)) {
              await member.roles.remove(mafia.roleId).catch(() => null);
            }
          }
        }
      } catch (err) {
        console.error('[BLACKLIST SYNC]', err.message);
      }

      await interaction.reply({ content: "✅ Jucătorul **" + ingameName + "** (<@" + userId + ">) a fost adăugat pe Faction Blacklist!", ephemeral: true });
      
      const blChanId = db.settings.blacklistChannelId;
      if (blChanId) {
        const blChan = await interaction.guild.channels.fetch(blChanId).catch(() => null);
        if (blChan) {
          const listEmbed = new EmbedBuilder()
            .setTitle('📋 LISTĂ JUCĂTORI PE BLACKLIST (NEAGRĂ) MAFII')
            .setDescription(
              db.blacklist.map((u, idx) => "**" + (idx + 1) + ".** <@" + u.userId + "> (" + u.userId + ")\n> 🎮 *In-game:* **" + u.ingameName + "**\n> 📝 *Motiv:* " + u.reason + "\n> 👤 *Adăugat de:* " + u.addedBy + " la " + u.addedAt).join('\n\n')
            )
            .setColor('#C0392B')
            .setTimestamp();
          
          const messages = await blChan.messages.fetch({ limit: 10 }).catch(() => new Map());
          const listMsg = [...messages.values()].find(m => m.embeds[0]?.title === '📋 LISTĂ JUCĂTORI PE BLACKLIST (NEAGRĂ) MAFII');
          if (listMsg) {
            await listMsg.edit({ embeds: [listEmbed] }).catch(() => null);
          }
        }
      }
    }

    // ─── MODAL COMPLAINT CREATE SUBMIT ───
    else if (interaction.customId === 'modal_complaint_create') {
      const target = interaction.fields.getTextInputValue('complaint_target').trim();
      const complainant = interaction.fields.getTextInputValue('complaint_complainant').trim();
      const reason = interaction.fields.getTextInputValue('complaint_reason').trim();
      const evidence = interaction.fields.getTextInputValue('complaint_evidence').trim();

      db.complaints = db.complaints || [];
      const complaintId = "comp_" + Date.now();
      
      const complaintObj = {
        id: complaintId,
        target,
        complainant,
        complainantId: interaction.user.id,
        reason,
        evidence,
        status: 'in_asteptare',
        verdict: null,
        resolvedBy: null,
        createdAt: new Date().toLocaleString('ro-RO')
      };

      db.complaints.push(complaintObj);
      writeDb(db);

      const verdictsChanId = db.settings.verdictsComplaintsChannelId;
      if (!verdictsChanId) {
        return interaction.reply({ content: '❌ Canalul de jurizare a reclamațiilor nu este configurat!', ephemeral: true });
      }

      const chan = await interaction.guild.channels.fetch(verdictsChanId).catch(() => null);
      if (!chan) {
        return interaction.reply({ content: '❌ Canalul de jurizare a reclamațiilor nu a fost găsit!', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle("🎫 RECLAMAȚIE LIDER MAFIE — status: ÎN ASTEPTARE")
        .setDescription(
          "👤 **Reclamant:** " + complainant + " (<@" + interaction.user.id + ">)\\n" +
          "👑 **Vizată:** " + target + "\\n" +
          "📝 **Motiv:** " + reason + "\\n" +
          "🔗 **Dovezi:** " + evidence + "\\n" +
          "🗓️ **Depusă la:** " + complaintObj.createdAt
        )
        .setColor('#F39C12')
        .setFooter({ text: "ID Reclamație: " + complaintId })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("btn_complaint_approve_" + complaintId).setLabel('Aprobă').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("btn_complaint_reject_" + complaintId).setLabel('Respinge').setStyle(ButtonStyle.Danger)
      );

      await chan.send({ embeds: [embed], components: [row] });
      await interaction.reply({ content: '✅ Reclamația ta a fost înregistrată cu succes și trimisă spre evaluare managerilor!', ephemeral: true });
    }

    // ─── MODAL COMPLAINT RESOLVE SUBMIT ───
    else if (interaction.customId.startsWith('modal_complaint_verdict_')) {
      const rawVerdictId = interaction.customId.replace('modal_complaint_verdict_', '');
      const lastUnderscoreIdx = rawVerdictId.lastIndexOf('_');
      const complaintId = rawVerdictId.substring(0, lastUnderscoreIdx);
      const statusText = rawVerdictId.substring(lastUnderscoreIdx + 1);
      const verdict = interaction.fields.getTextInputValue('verdict_text').trim();

      db.complaints = db.complaints || [];
      const complaint = db.complaints.find(c => c.id === complaintId);
      if (!complaint) {
        return interaction.reply({ content: '❌ Reclamația nu a fost găsită în baza de date.', ephemeral: true });
      }

      complaint.status = statusText === 'aprobata' ? 'aprobata' : 'respinsa';
      complaint.verdict = verdict;
      complaint.resolvedBy = interaction.user.tag;
      writeDb(db);

      const verdictsChanId = db.settings.verdictsComplaintsChannelId;
      if (verdictsChanId) {
        const chan = await interaction.guild.channels.fetch(verdictsChanId).catch(() => null);
        if (chan) {
          const messages = await chan.messages.fetch({ limit: 50 }).catch(() => new Map());
          const targetMsg = [...messages.values()].find(m => m.embeds[0]?.footer?.text?.includes(complaintId));
          if (targetMsg) {
            const oldEmbed = targetMsg.embeds[0];
            const updatedEmbed = EmbedBuilder.from(oldEmbed)
              .setTitle("🎫 RECLAMAȚIE LIDER MAFIE — SOLUȚIONATĂ (" + statusText.toUpperCase() + ")")
              .setColor(statusText === 'aprobata' ? '#2ECC71' : '#E74C3C')
              .addFields(
                { name: 'Verdict Manager', value: verdict },
                { name: 'Soluționată de', value: interaction.user.tag, inline: true }
              );
            await targetMsg.edit({ embeds: [updatedEmbed], components: [] }).catch(() => null);
          }
        }
      }

      const complaintsChanId = db.settings.complaintsChannelId;
      if (complaintsChanId) {
        const publicChan = await interaction.guild.channels.fetch(complaintsChanId).catch(() => null);
        if (publicChan) {
          const publicEmbed = new EmbedBuilder()
            .setTitle("📢 SOLUȚIONARE RECLAMAȚIE LIDER — " + statusText.toUpperCase())
            .setDescription(
              "👤 **Reclamant:** " + complaint.complainant + " (<@" + complaint.complainantId + ">)\\n" +
              "👑 **Facțiune Vizată:** " + complaint.target + "\\n" +
              "📝 **Motiv:** " + complaint.reason + "\\n" +
              "📊 **Verdict Manager:** **" + verdict + "**\\n" +
              "👤 **Manager:** " + interaction.user.tag
            )
            .setColor(statusText === 'aprobata' ? '#2ECC71' : '#E74C3C')
            .setTimestamp();
          await publicChan.send({ embeds: [publicEmbed] }).catch(() => null);
        }
      }

      const gradeChanId = db.settings.gradeChannelId;
      if (gradeChanId) {
        const gradeChan = await interaction.guild.channels.fetch(gradeChanId).catch(() => null);
        if (gradeChan) {
          const logEmbed = new EmbedBuilder()
            .setTitle('📰 DECIZIE SOLUȚIONARE RECLAMAȚIE LIDER')
            .setDescription(
              "Reclamația depusă de **" + complaint.complainant + "** împotriva **" + complaint.target + "** a fost soluționată.\\n\\n" +
              "📊 **Verdict:** " + statusText.toUpperCase() + "\\n" +
              "📝 **Detalii verdict:** " + verdict + "\\n" +
              "👤 **Manager:** " + interaction.user.tag
            )
            .setColor(statusText === 'aprobata' ? '#2ECC71' : '#E74C3C')
            .setTimestamp();
          await gradeChan.send({ embeds: [logEmbed] }).catch(() => null);
        }
      }

      try {
        const complainantUser = await client.users.fetch(complaint.complainantId).catch(() => null);
        if (complainantUser) {
          const dmEmbed = new EmbedBuilder()
            .setTitle('📬 Reclamația ta a fost soluționată!')
            .setDescription(
              "Reclamația depusă de tine împotriva **" + complaint.target + "** a primit un verdict.\\n\\n" +
              "📊 **Status:** " + statusText.toUpperCase() + "\\n" +
              "💬 **Verdict:** " + verdict
            )
            .setColor(statusText === 'aprobata' ? '#2ECC71' : '#E74C3C')
            .setTimestamp();
          await complainantUser.send({ embeds: [dmEmbed] }).catch(() => null);
        }
      } catch (dmErr) {
        console.error('[COMPLAINT DM] Failed to send DM to complainant:', dmErr.message);
      }

      await interaction.reply({ content: '✅ Reclamația a fost soluționată cu succes, iar verdictul a fost publicat!', ephemeral: true });
    }

    // ─── MODAL ALLIANCE ADD ───
    else if (interaction.customId === 'modal_alliance_add') {
      const org1 = interaction.fields.getTextInputValue('org_1').trim();
      const org2 = interaction.fields.getTextInputValue('org_2').trim();
      const details = interaction.fields.getTextInputValue('alliance_details').trim();

      db.alliances = db.alliances || [];
      const allianceId = "all_" + Date.now();
      db.alliances.push({
        id: allianceId, org1, org2, details, createdAt: new Date().toLocaleString('ro-RO')
      });
      writeDb(db);

      await ensureSindicatAlliancesEmbed(interaction.guild);
      await interaction.reply({ content: "✅ Alianța între **" + org1 + "** și **" + org2 + "** a fost înregistrată!", ephemeral: true });
    }

    // ─── MODAL SINDICAT: EDIT ZONE ───
    else if (interaction.customId.startsWith('modal_sindicat_edit_zone_')) {
      await interaction.deferReply({ ephemeral: true });
      const zoneId = interaction.customId.replace('modal_sindicat_edit_zone_', '');
      const owner = interaction.fields.getTextInputValue('zone_owner').trim();
      const price = interaction.fields.getTextInputValue('zone_price').trim();
      const status = interaction.fields.getTextInputValue('zone_status').trim();
      const details = interaction.fields.getTextInputValue('zone_details').trim();

      const zones = db.auction_zones || [];
      const zone = zones.find(z => z.id === zoneId);
      if (!zone) return interaction.editReply({ content: '❌ Zona nu a fost găsită în baza de date.' });

      zone.owner = owner;
      zone.price = price;
      zone.status = status;
      zone.details = details;
      zone.updatedAt = new Date().toLocaleString('ro-RO');

      writeDb(db);

      await ensureSindicatZonesEmbed(interaction.guild);

      await sendLogEmbed(
        '🗺️ ZONĂ LICITAȚII SINDICAT ACTUALIZATĂ',
        `Managerul/Liderul **${interaction.user.username}** a actualizat zona **${zone.name}**:\n\n` +
        `👑 **Deținător:** ${owner}\n` +
        `💰 **Preț Plătit:** ${price}\n` +
        `📊 **Status:** ${status}\n` +
        `📝 **Detalii:** ${details || 'Fără'}`,
        '#8E44AD'
      );

      await interaction.editReply({ content: `✅ Zona **${zone.name}** a fost actualizată cu succes!` });
    }
    // ─── MODAL MANAGER: SCHIMBĂ LIDER ───
    else if (interaction.customId.startsWith('modal_manager_change_leader_')) {
      const mafiaId = interaction.customId.replace('modal_manager_change_leader_', '');
      const newLeaderId = interaction.fields.getTextInputValue('new_leader_id').trim();

      const mafia = db.mafias.find(m => m.id === mafiaId);
      if (!mafia) return interaction.reply({ content: '❌ Facțiunea nu a fost găsită.', ephemeral: true });

      if (!/^\d{17,19}$/.test(newLeaderId)) {
        return interaction.reply({ content: '❌ ID-ul de Discord introdus nu este valid! Trebuie să conțină doar cifre (17-19 caractere).', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });

      try {
        const guild = interaction.guild;
        const member = await guild.members.fetch(newLeaderId).catch(() => null);
        if (!member) {
          return interaction.editReply({ content: '❌ Utilizatorul cu ID-ul `' + newLeaderId + '` nu a fost găsit pe acest server de Discord!' });
        }

        const oldOwnerId = mafia.ownerId;
        
        // 1. Sync leader roles on Discord (add leader role to new, remove from old)
        await syncDiscordLeader(oldOwnerId, newLeaderId, mafia.type);

        // 2. Add the new leader to the mafia's members list and give them the mafia role if missing
        if (!mafia.members.includes(newLeaderId)) {
          mafia.members.push(newLeaderId);
        }
        await member.roles.add(mafia.roleId).catch(() => null);

        // 3. Update database ownerId
        mafia.ownerId = newLeaderId;
        writeDb(db);

        // 4. Update the settings channel access overwrites
        await ensureFactionsHaveSettings(guild);

        // 5. Send log to grade-mafii and logs channel
        await sendGradeLog(
          '👑 SCHIMBARE LIDER FACȚIUNE',
          `Liderul facțiunii **${mafia.name}** a fost schimbat de către Managerul **${interaction.user.username}**.\n\n` +
          `👑 **Lider Nou:** <@${newLeaderId}> (${newLeaderId})\n` +
          `👤 **Fostul Lider:** ` + (oldOwnerId ? `<@${oldOwnerId}> (${oldOwnerId})` : 'Niciunul'),
          '#F1C40F'
        );

        await sendLogEmbed(
          '👑 SCHIMBARE LIDER FACȚIUNE',
          `Managerul **${interaction.user.username}** a schimbat liderul facțiunii **${mafia.name}**:\n` +
          `👑 Lider Nou: <@${newLeaderId}>\n` +
          `👤 Fost Lider: ` + (oldOwnerId ? `<@${oldOwnerId}>` : 'Niciunul'),
          '#F1C40F'
        );

        await interaction.editReply({ content: '👑 Liderul facțiunii **' + mafia.name + '** a fost schimbat cu succes! Noul lider este <@' + newLeaderId + '>.' });

      } catch (err) {
        console.error('[CHANGE LEADER ERROR]', err);
        await interaction.editReply({ content: '❌ A apărut o eroare la schimbarea liderului: ' + err.message });
      }
    }

    // ─── MODAL LIDER SETTINGS: INVITĂ MEMBRU ───
    else if (interaction.customId.startsWith('modal_invite_member_')) {
      await interaction.deferReply({ ephemeral: true });
      const mafiaId = interaction.customId.replace('modal_invite_member_', '');
      const targetUserId = interaction.fields.getTextInputValue('user_discord_id').trim();

      const mafia = db.mafias.find(m => m.id === mafiaId);
      if (!mafia) return interaction.editReply({ content: '❌ Această facțiune nu există în baza de date.' });

      if (!/^\d{17,19}$/.test(targetUserId)) {
        return interaction.editReply({ content: '❌ ID-ul de Discord introdus nu este valid! Trebuie să conțină doar cifre (17-19 caractere).' });
      }

      if (mafia.members.includes(targetUserId)) {
        return interaction.editReply({ content: '❌ Acest utilizator este deja membru al facțiunii tale!' });
      }

      const isBlacklisted = (db.blacklist || []).some(b => b.userId === targetUserId);
      if (isBlacklisted) {
        return interaction.editReply({ content: '❌ Acest utilizator nu poate fi invitat deoarece este înregistrat pe Blacklist-ul global!' });
      }

      const inOther = db.mafias.find(m => m.members.includes(targetUserId));
      if (inOther) {
        return interaction.editReply({ content: "❌ Acest utilizator face parte deja din altă facțiune (**" + inOther.name + "**)! Trebuie să părăsească acea facțiune înainte de a fi invitat." });
      }

      try {
        await sendInviteDM(targetUserId, mafiaId, mafia.name);
        await interaction.editReply({ content: "📥 Invitația de alăturare a fost trimisă cu succes în privat către utilizatorul cu ID-ul `" + targetUserId + "`!" });
      } catch (err) {
        console.error('[INVITE DM ERROR]', err);
        await interaction.editReply({ content: "❌ Trimiterea invitației în privat a eșuat. Utilizatorul probabil are DM-urile închise.\\n> **Eroare:** " + err.message });
      }
    }

    // ─── MODAL LIDER SETTINGS: SCHIMBĂ NUME ───
    else if (interaction.customId.startsWith('modal_change_name_')) {
      await interaction.deferReply({ ephemeral: true });
      const mafiaId = interaction.customId.replace('modal_change_name_', '');
      const newName = interaction.fields.getTextInputValue('new_ingame_name').trim();
      const fivemId = interaction.fields.getTextInputValue('fivem_id').trim();
      const newNickname = newName + " | " + fivemId;

      const mafia = db.mafias.find(m => m.id === mafiaId);
      if (!mafia) return interaction.editReply({ content: '❌ Facțiunea nu a fost găsită.' });

      try {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        await member.setNickname(newNickname);

        if (!db.profiles) db.profiles = {};
        db.profiles[interaction.user.id] = {
          ingameName: newName,
          fivemId,
          nickname: newNickname,
          updatedAt: new Date().toLocaleDateString('ro-RO')
        };
        writeDb(db);

        await sendLogEmbed(
          '📝 SCHIMBARE NUME MEMBRU',
          "Utilizatorul <@" + interaction.user.id + "> și-a schimbat numele in-game în **" + newName + "** (ID: " + fivemId + ") în cadrul facțiunii **" + mafia.name + "**.",
          '#3498DB'
        );

        await interaction.editReply({ content: "✅ Numele tău in-game a fost schimbat în **" + newName + "** și nickname-ul pe Discord a fost actualizat!" });
      } catch (err) {
        console.error('[CHANGE NICKNAME ERROR]', err);
        await interaction.editReply({ content: '❌ A apărut o eroare la actualizarea numelui. Verifică permisiunile botului.' });
      }
    }

    // ─── MODAL SINDICAT: ADĂUGĂ MEMBRU ───
    else if (interaction.customId === 'modal_sindicat_add_membru') {
      await interaction.deferReply({ ephemeral: true });
      const targetId = interaction.fields.getTextInputValue('user_id').trim();
      const roleId = db.settings.sindicatMembruRoleId;

      if (!roleId) return interaction.editReply({ content: '❌ Rolul de Membru Sindicat nu este configurat!' });

      try {
        const member = await interaction.guild.members.fetch(targetId);
        await member.roles.add(roleId);

        const gradeChannel = interaction.guild.channels.cache.get(db.settings.gradeChannelId);
        if (gradeChannel) {
          const embed = new EmbedBuilder()
            .setTitle('⚜️ SINDICAT: MEMBRU NOU')
            .setDescription("👤 <@" + targetId + "> (**" + member.user.username + "**) a fost adăugat în **Sindicat**!")
            .setColor('#3498DB')
            .setTimestamp();
          await gradeChannel.send({ embeds: [embed] });
        }

        await interaction.editReply({ content: "✅ L-ai adăugat pe <@" + targetId + "> în Sindicat cu rolul de Membru!" });
      } catch (err) {
        await interaction.editReply({ content: "❌ Nu s-a putut găsi utilizatorul sau oferi rolul. Detalii: " + err.message });
      }
    }

    // ─── MODAL SINDICAT: ADĂUGĂ CO-LIDER ───
    else if (interaction.customId === 'modal_sindicat_add_colider') {
      await interaction.deferReply({ ephemeral: true });
      const targetId = interaction.fields.getTextInputValue('user_id').trim();
      const roleId = db.settings.sindicatCoLiderRoleId;

      if (!roleId) return interaction.editReply({ content: '❌ Rolul de Co-Lider Sindicat nu este configurat!' });

      try {
        const member = await interaction.guild.members.fetch(targetId);
        await member.roles.add(roleId);

        const gradeChannel = interaction.guild.channels.cache.get(db.settings.gradeChannelId);
        if (gradeChannel) {
          const embed = new EmbedBuilder()
            .setTitle('⚔️ SINDICAT: CO-LIDER NOU')
            .setDescription("👤 <@" + targetId + "> (**" + member.user.username + "**) a fost numit **Co-Lider Sindicat**!")
            .setColor('#8E44AD')
            .setTimestamp();
          await gradeChannel.send({ embeds: [embed] });
        }

        await interaction.editReply({ content: "✅ L-ai adăugat pe <@" + targetId + "> în Sindicat cu rolul de Co-Lider!" });
      } catch (err) {
        await interaction.editReply({ content: "❌ Nu s-a putut găsi utilizatorul sau oferi rolul. Detalii: " + err.message });
      }
    }

    // ─── MODAL SINDICAT: ELIMINĂ MEMBRU ───
    else if (interaction.customId === 'modal_sindicat_remove_membru') {
      await interaction.deferReply({ ephemeral: true });
      const targetId = interaction.fields.getTextInputValue('user_id').trim();

      try {
        const member = await interaction.guild.members.fetch(targetId);
        if (db.settings.sindicatLiderRoleId) await member.roles.remove(db.settings.sindicatLiderRoleId).catch(() => null);
        if (db.settings.sindicatCoLiderRoleId) await member.roles.remove(db.settings.sindicatCoLiderRoleId).catch(() => null);
        if (db.settings.sindicatMembruRoleId) await member.roles.remove(db.settings.sindicatMembruRoleId).catch(() => null);

        const gradeChannel = interaction.guild.channels.cache.get(db.settings.gradeChannelId);
        if (gradeChannel) {
          const embed = new EmbedBuilder()
            .setTitle('👋 SINDICAT: MEMBRU ELIMINAT')
            .setDescription("👤 <@" + targetId + "> (**" + member.user.username + "**) a fost eliminat din **Sindicat** și i-au fost retrase toate rolurile aferente!")
            .setColor('#E74C3C')
            .setTimestamp();
          await gradeChannel.send({ embeds: [embed] });
        }

        await interaction.editReply({ content: "✅ I-ai retras toate rolurile de Sindicat lui <@" + targetId + ">!" });
      } catch (err) {
        await interaction.editReply({ content: "❌ Eșec la eliminare: " + err.message });
      }
    }
  }

  } catch (err) {
    console.error('[INTERACTION ERROR]', err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ A apărut o eroare neșteptată la procesarea acestei interacțiuni.', ephemeral: true }).catch(() => null);
    }
  }
});


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
      let boldPrefix = ' ⚔️ 𝗠𝗔𝗙𝗜𝗘 ';
      if (newType === 'oficiala') {
        boldPrefix = ' 🔴 𝗠𝗔𝗙𝗜𝗘 𝗢𝗙𝗜𝗖𝗜𝗔𝗟𝗔 ';
      } else if (newType === 'neoficiala') {
        boldPrefix = ' 🟤 𝗠𝗔𝗙𝗜𝗘 𝗡𝗘𝗢𝗙𝗜𝗖𝗜𝗔𝗟𝗔 ';
      } else if (newType === 'gang') {
        boldPrefix = ' 🔫 𝗚𝗔𝗡𝗚 ';
      }
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
    if (channels.invoiri) {
      const invoiriChan = await guild.channels.fetch(channels.invoiri).catch(() => null);
      if (invoiriChan) await invoiriChan.setName(`📝│𝗶𝗻𝘃𝗼𝗶𝗿𝗶-${cleanNameLower}`);
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
    if (channels.invoiri) {
      const invoiriChan = await guild.channels.fetch(channels.invoiri).catch(() => null);
      if (invoiriChan) await invoiriChan.delete().catch(() => null);
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
    
    let leaderRoleId = db.settings.liderGangRoleId;
    if (factionType === 'oficiala') leaderRoleId = db.settings.liderOficialaRoleId;
    if (factionType === 'neoficiala') leaderRoleId = db.settings.liderNeoficialaRoleId;

    if (!leaderRoleId) {
      console.warn(`[DISCORD] Role ID for leader type ${factionType} is not configured.`);
      return false;
    }
    
    const leaderRole = await guild.roles.fetch(leaderRoleId).catch(() => null);
    if (!leaderRole) {
      console.warn(`[DISCORD] Leader role with ID ${leaderRoleId} not found in guild.`);
      return false;
    }
    
    // Remove from old leader
    if (oldLeaderId) {
      const oldMember = await guild.members.fetch(oldLeaderId).catch(() => null);
      if (oldMember) {
        await oldMember.roles.remove(leaderRole.id).catch(() => null);
        console.log(`[DISCORD] Removed leader role from old leader: ${oldMember.user.tag}`);
      }
    }
    
    // Add to new leader and remove co-leader roles from them if they have any
    if (newLeaderId) {
      const newMember = await guild.members.fetch(newLeaderId).catch(() => null);
      if (newMember) {
        await newMember.roles.add(leaderRole.id).catch(() => null);
        console.log(`[DISCORD] Added leader role to new leader: ${newMember.user.tag}`);

        // Strip co-leader roles if any
        const coLiderRoleIds = [db.settings.coLiderOficialaRoleId, db.settings.coLiderNeoficialaRoleId, db.settings.coLiderGangRoleId].filter(Boolean);
        for (const rid of coLiderRoleIds) {
          if (newMember.roles.cache.has(rid)) {
            await newMember.roles.remove(rid).catch(() => null);
            console.log(`[DISCORD] Removed co-leader role ${rid} from new leader ${newMember.user.tag}`);
          }
        }
      }
    }
    return true;
  } catch (err) {
    console.error('[DISCORD] Eroare la sincronizarea liderului facțiunii:', err);
    return false;
  }
}

// Helper to sync faction-level warnings to the leader
async function syncFactionWarningRoles(mafiaId) {
  const db = readDb();
  const mafia = db.mafias.find(m => m.id === mafiaId);
  if (!mafia) return false;
  
  const guildId = db.settings.guildId || "1526274994353606726";
  try {
    const guild = await client.guilds.fetch(guildId);
    
    // Fetch faction leader (owner)
    const leaderMember = await guild.members.fetch(mafia.ownerId).catch(() => null);
    if (!leaderMember) {
      console.warn(`[DISCORD] Liderul ${mafia.ownerId} nu a fost gasit in guild pentru sync sanctiuni.`);
      return false;
    }
    
    // Fetch all 10 roles dynamically by name
    const rolesMap = {
      mafiaAv1: guild.roles.cache.find(r => r.name === '⚠️ Mafia AV 1/2'),
      mafiaAv2: guild.roles.cache.find(r => r.name === '⚠️ Mafia AV 2/2'),
      mafiaWarn1: guild.roles.cache.find(r => r.name === '⚠️ Mafia Warn 1/3'),
      mafiaWarn2: guild.roles.cache.find(r => r.name === '⚠️ Mafia Warn 2/3'),
      mafiaWarn3: guild.roles.cache.find(r => r.name === '⚠️ Mafia Warn 3/3'),
      gangAv1: guild.roles.cache.find(r => r.name === '⚠️ Gang AV 1/2'),
      gangAv2: guild.roles.cache.find(r => r.name === '⚠️ Gang AV 2/2'),
      gangWarn1: guild.roles.cache.find(r => r.name === '⚠️ Gang Warn 1/3'),
      gangWarn2: guild.roles.cache.find(r => r.name === '⚠️ Gang Warn 2/3'),
      gangWarn3: guild.roles.cache.find(r => r.name === '⚠️ Gang Warn 3/3')
    };

    const isGang = mafia.type === 'gang';

    // Helper to toggle a single role on the member
    const toggleRole = async (role, shouldHave) => {
      if (!role) return;
      try {
        if (shouldHave) {
          if (!leaderMember.roles.cache.has(role.id)) {
            await leaderMember.roles.add(role.id);
          }
        } else {
          if (leaderMember.roles.cache.has(role.id)) {
            await leaderMember.roles.remove(role.id);
          }
        }
      } catch (err) {
        console.error(`[DISCORD] Failed to toggle role ${role.name} on member ${leaderMember.user.tag}:`, err.message);
      }
    };
    
    if (isGang) {
      // Gang AV roles
      await toggleRole(rolesMap.gangAv1, mafia.warningsAV === 1);
      await toggleRole(rolesMap.gangAv2, mafia.warningsAV === 2);
      
      // Gang Warn roles
      await toggleRole(rolesMap.gangWarn1, mafia.warningsWarn === 1);
      await toggleRole(rolesMap.gangWarn2, mafia.warningsWarn === 2);
      await toggleRole(rolesMap.gangWarn3, mafia.warningsWarn >= 3);
      
      // Remove all Mafia warning roles
      await toggleRole(rolesMap.mafiaAv1, false);
      await toggleRole(rolesMap.mafiaAv2, false);
      await toggleRole(rolesMap.mafiaWarn1, false);
      await toggleRole(rolesMap.mafiaWarn2, false);
      await toggleRole(rolesMap.mafiaWarn3, false);
      
    } else {
      // Mafia AV roles
      await toggleRole(rolesMap.mafiaAv1, mafia.warningsAV === 1);
      await toggleRole(rolesMap.mafiaAv2, mafia.warningsAV === 2);
      
      // Mafia Warn roles
      await toggleRole(rolesMap.mafiaWarn1, mafia.warningsWarn === 1);
      await toggleRole(rolesMap.mafiaWarn2, mafia.warningsWarn === 2);
      await toggleRole(rolesMap.mafiaWarn3, mafia.warningsWarn >= 3);
      
      // Remove all Gang warning roles
      await toggleRole(rolesMap.gangAv1, false);
      await toggleRole(rolesMap.gangAv2, false);
      await toggleRole(rolesMap.gangWarn1, false);
      await toggleRole(rolesMap.gangWarn2, false);
      await toggleRole(rolesMap.gangWarn3, false);
    }
    
    console.log(`[DISCORD] Sincronizat roluri avertismente detaliate pentru liderul facțiunii ${mafia.name} (AV: ${mafia.warningsAV}, WARN: ${mafia.warningsWarn})`);
    return true;
  } catch (err) {
    console.error(`[DISCORD] Eroare la sincronizarea rolurilor de sanctiune detaliate pentru liderul facțiunii ${mafiaId}:`, err);
    return false;
  }
}

// Helper to send invite DM on Discord
async function sendInviteDM(userId, mafiaId, mafiaName) {
  const db = readDb();
  const guildId = db.settings.guildId || "1526274994353606726";
  try {
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) {
      console.warn(`[DISCORD] Membrul ${userId} nu a fost gasit in guild pentru a trimite invitatia.`);
      return false;
    }

    const embed = new EmbedBuilder()
      .setTitle('✉️ INVITAȚIE ÎN FACȚIUNE')
      .setDescription(`Salutare! Ai fost invitat să te alături facțiunii **${mafiaName}** de pe serverul **Vipuri Roleplay**.\n\nAlege una dintre opțiunile de mai jos pentru a accepta sau refuza invitația:`)
      .setColor(0xF1C40F)
      .setTimestamp();

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`invite:accept:${mafiaId}:${userId}`)
        .setLabel('Acceptă Invitația')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId(`invite:decline:${mafiaId}:${userId}`)
        .setLabel('Refuză Invitația')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌')

    );

    await member.send({ embeds: [embed], components: [buttons] });
    console.log(`[DISCORD] Trimis invitatie DM catre ${member.user.tag} pentru mafia ${mafiaName}.`);
    return true;
  } catch (err) {
    console.error(`[DISCORD] Eroare la trimiterea invitatiei DM catre ${userId}:`, err.message);
    return false;
  }
}

async function sendSupportTicketToAdmin(adminId, adminName, type, userName, userId, details) {
  try {
    const adminUser = await client.users.fetch(adminId).catch(() => null);
    if (!adminUser) {
      console.warn(`[DISCORD] Admin ${adminId} not found to send support ticket.`);
      return false;
    }

    const embed = new EmbedBuilder()
      .setTitle(`🎫 TICHEȚ ASISTENȚĂ NOU — ${type.toUpperCase()}`)
      .setDescription(
        `Ai primit o solicitare de asistență de la un utilizator de pe site-ul de conectare.\n\n` +
        `👤 **Nume Utilizator:** ${userName}\n` +
        `🆔 **Discord ID:** ${userId}\n` +
        `📝 **Detaliile Problemei:**\n${details}`
      )
      .setColor(0xE74C3C)
      .setTimestamp();

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`reply_ticket_${userId}`)
          .setLabel('Răspunde')
          .setStyle(ButtonStyle.Success)
          .setEmoji('📬')
      );

    await adminUser.send({ embeds: [embed], components: [row] });
    return true;
  } catch (err) {
    console.error('Error sending support ticket to admin:', err);
    return false;
  }
}

async function getGuildMeta() {
  const targetGuildId = "1526274994353606726";
  try {
    const guild = await client.guilds.fetch(targetGuildId);
    if (!guild) return { roles: [], channels: [] };

    // Fetch all roles and channels
    const [rolesCollection, channelsCollection] = await Promise.all([
      guild.roles.fetch(),
      guild.channels.fetch()
    ]);

    const roles = rolesCollection
      .filter(r => r.name !== '@everyone')
      .sort((a, b) => b.position - a.position)
      .map(r => ({ id: r.id, name: r.name, color: r.hexColor }))
      .slice(0, 80);

    const channels = channelsCollection
      .filter(c => c && c.type === 0) // text channels only
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(c => ({ id: c.id, name: c.name }))
      .slice(0, 100);

    return { roles, channels };
  } catch (err) {
    console.error('[BOT] getGuildMeta error:', err);
    return { roles: [], channels: [] };
  }
}

async function ensureFactionsHaveSettings(guild) {
  const db = readDb();
  let dbChanged = false;

  const managerRoleId = db.settings.managerRoleId;
  const managerStaffRoleId = db.settings.managerStaffRoleId;

  for (const mafia of db.mafias) {
    if (!mafia.categoryId) continue;

    const category = await guild.channels.fetch(mafia.categoryId).catch(() => null);
    if (!category) continue;

    // Clean up duplicate settings channels in this category
    try {
      const categoryChannels = category.children?.cache || [];
      for (const [chanId, chan] of categoryChannels) {
        if (chan.name.includes('𝘀𝗲𝘁𝘁𝗶𝗻𝗴𝘀-𝗹𝗶𝗱𝗲𝗿𝗶') || chan.name.includes('settings-lider')) {
          if (chanId !== mafia.channels.settings_lider) {
            await chan.delete().catch(() => null);
            console.log(`[DISCORD] Deleted duplicate lider settings channel ${chan.name} (${chanId}) for mafia ${mafia.name}`);
          }
        }
        if (chan.name.includes('𝘀𝗲𝘁𝘁𝗶𝗻𝗴𝘀-𝗺𝗲𝗺𝗯𝗿𝗶') || chan.name.includes('settings-membri')) {
          if (chanId !== mafia.channels.settings_membri) {
            await chan.delete().catch(() => null);
            console.log(`[DISCORD] Deleted duplicate membri settings channel ${chan.name} (${chanId}) for mafia ${mafia.name}`);
          }
        }
      }
    } catch (cleanErr) {
      console.error('[DISCORD] Failed to clean duplicate settings channels:', cleanErr.message);
    }

    if (!mafia.channels) mafia.channels = {};

    // Generate specific overwrites for Lider Settings
    const liderOverwrites = [
      {
        id: guild.id, // @everyone
        deny: [PermissionsBitField.Flags.ViewChannel]
      }
    ];
    if (mafia.roleId) {
      liderOverwrites.push({
        id: mafia.roleId,
        deny: [PermissionsBitField.Flags.ViewChannel]
      });
    }
    if (mafia.ownerId) {
      liderOverwrites.push({
        id: mafia.ownerId,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
      });
    }
    if (mafia.coLeaders && Array.isArray(mafia.coLeaders)) {
      for (const coLiderId of mafia.coLeaders) {
        liderOverwrites.push({
          id: coLiderId,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
        });
      }
    }
    if (managerRoleId) {
      liderOverwrites.push({
        id: managerRoleId,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
      });
    }
    if (managerStaffRoleId) {
      liderOverwrites.push({
        id: managerStaffRoleId,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
      });
    }

    // ─── 1. Lider Settings Channel ───
    let settingsLiderChan = null;
    if (mafia.channels.settings_lider) {
      settingsLiderChan = await guild.channels.fetch(mafia.channels.settings_lider).catch(() => null);
    }

    if (!settingsLiderChan) {
      settingsLiderChan = await guild.channels.create({
        name: '⚙️│𝘀𝗲𝘁𝘁𝗶𝗻𝗴𝘀-𝗹𝗶𝗱𝗲𝗿𝗶',
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: liderOverwrites
      });

      mafia.channels.settings_lider = settingsLiderChan.id;
      dbChanged = true;
      console.log(`[DISCORD] Created settings-lideri channel for ${mafia.name}`);
    } else {
      await settingsLiderChan.permissionOverwrites.set(liderOverwrites).catch(err => {
        console.error(`[DISCORD] Failed to update overwrites for settings-lideri of ${mafia.name}:`, err.message);
      });
    }

    // Send/Refresh static panel for Lider Settings
    const liderEmbed = new EmbedBuilder()
      .setTitle("⚙️ PANOU SETĂRI LIDER — " + mafia.name.toUpperCase())
      .setDescription(
        "Bun venit în panoul administrativ al facțiunii tale!\n\n" +
        "Folosește interacțiunile de mai jos pentru a gestiona mafia:\n\n" +
        "🎨 **Schimbă Culoarea**: Alege o nouă culoare pentru rolul facțiunii.\n" +
        "📥 **Invită Membru**: Trimite invitație unui jucător direct în DM.\n" +
        "👥 **Setează Co-Lider**: Acordă gradul de Co-Lider unui membru.\n" +
        "👥 **Demite Co-Lider**: Demite un Co-Lider înapoi la gradul de membru.\n" +
        "🗑️ **Exclude Membru**: Exclude (demite) un membru din facțiune."
      )
      .setColor('#2ECC71')
      .setTimestamp();

    const colorSelect = new StringSelectMenuBuilder()
      .setCustomId("select_color_" + mafia.id)
      .setPlaceholder('🎨 Alege culoarea rolului...')
      .addOptions([
        { label: 'Roșu aprins', value: '#FF0000', emoji: '🔴' },
        { label: 'Albastru electric', value: '#00D2FF', emoji: '🔵' },
        { label: 'Verde neon', value: '#00FF66', emoji: '🟢' },
        { label: 'Galben auriu', value: '#F1C40F', emoji: '🟡' },
        { label: 'Portocaliu', value: '#E67E22', emoji: '🟠' },
        { label: 'Mov imperial', value: '#9B59B6', emoji: '🟣' },
        { label: 'Roz bombon', value: '#E84393', emoji: '🌸' },
        { label: 'Negru', value: '#111111', emoji: '⚫' },
        { label: 'Gri argintiu', value: '#BDC3C7', emoji: '⚪' },
        { label: 'Cyan', value: '#00CEC9', emoji: '🌐' }
      ]);

    const actionRowColor = new ActionRowBuilder().addComponents(colorSelect);

    const actionRowButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("btn_invite_member_" + mafia.id).setLabel('📥 Invită').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("btn_set_colider_" + mafia.id).setLabel('👥 Co-Lider').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("btn_demote_colider_" + mafia.id).setLabel('👥 Demite').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("btn_remove_member_" + mafia.id).setLabel('🗑️ Exclude').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("btn_show_members_" + mafia.id).setLabel('👥 Membrii').setStyle(ButtonStyle.Secondary)
    );

    await refreshStaticPanel(settingsLiderChan, liderEmbed, [actionRowColor, actionRowButtons]);

    // Generate specific overwrites for Membri Settings
    const membriOverwrites = [
      {
        id: guild.id, // @everyone
        deny: [PermissionsBitField.Flags.ViewChannel]
      }
    ];
    if (mafia.roleId) {
      membriOverwrites.push({
        id: mafia.roleId,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
      });
    }
    if (mafia.ownerId) {
      membriOverwrites.push({
        id: mafia.ownerId,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
      });
    }
    if (mafia.coLeaders && Array.isArray(mafia.coLeaders)) {
      for (const coLiderId of mafia.coLeaders) {
        membriOverwrites.push({
          id: coLiderId,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
        });
      }
    }
    if (managerRoleId) {
      membriOverwrites.push({
        id: managerRoleId,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
      });
    }
    if (managerStaffRoleId) {
      membriOverwrites.push({
        id: managerStaffRoleId,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
      });
    }

    // ─── 2. Membri Settings Channel ───
    let settingsMembriChan = null;
    if (mafia.channels.settings_membri) {
      settingsMembriChan = await guild.channels.fetch(mafia.channels.settings_membri).catch(() => null);
    }

    if (!settingsMembriChan) {
      settingsMembriChan = await guild.channels.create({
        name: '⚙️│𝘀𝗲𝘁𝘁𝗶𝗻𝗴𝘀-𝗺𝗲𝗺𝗯𝗿𝗶',
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: membriOverwrites
      });

      mafia.channels.settings_membri = settingsMembriChan.id;
      dbChanged = true;
      console.log(`[DISCORD] Created settings-membri channel for ${mafia.name}`);
    } else {
      await settingsMembriChan.permissionOverwrites.set(membriOverwrites).catch(err => {
        console.error(`[DISCORD] Failed to update overwrites for settings-membri of ${mafia.name}:`, err.message);
      });
    }

    // Send/Refresh static panel for Membri Settings
    const membriEmbed = new EmbedBuilder()
      .setTitle("⚙️ SECȚIUNE MEMBRII — " + mafia.name.toUpperCase())
      .setDescription(
        "Bun venit în zona de servicii pentru membrii facțiunii **" + mafia.name + "**!\n\n" +
        "Folosește butoanele de mai jos pentru a efectua acțiuni în cadrul organizației:\n\n" +
        "📝 **Schimbă Nume In-Game**: Modifică-ți numele în joc și actualizează-ți nickname-ul automat pe Discord (Format: Nume | ID).\n" +
        "❌ **Demisionează**: Părăsește facțiunea în mod voluntar (ți se vor retrage toate rolurile și accesul)."
      )
      .setColor('#34495E')
      .setTimestamp();

    const actionRowMembri = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("btn_change_ingame_name_" + mafia.id).setLabel('📝 Schimbă Nume In-Game').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("btn_resign_" + mafia.id).setLabel('❌ Demisionează').setStyle(ButtonStyle.Danger)
    );

    await refreshStaticPanel(settingsMembriChan, membriEmbed, [actionRowMembri]);

    // ─── 3. Ensure arrows channel message layout has both add and remove buttons ───
    if (mafia.channels.arrows) {
      const arrowsChan = await guild.channels.fetch(mafia.channels.arrows).catch(() => null);
      if (arrowsChan) {
        const embed = new EmbedBuilder()
          .setTitle("🏹 LISTĂ SĂGEȚI OFICIALE — " + mafia.name.toUpperCase())
          .setDescription(
            (mafia.arrows || []).map((a, idx) => "**" + (idx + 1) + ".** **" + a.name + "**\n> 🌐 *ID FiveM:* " + a.fivemId + "\n> 👤 *Adăugat de:* " + a.addedBy).join('\n\n') ||
            'Nicio săgeată înregistrată momentan în această facțiune.'
          )
          .setColor('#3498DB')
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('btn_add_arrow').setLabel('➕ Adaugă Săgeată').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('btn_remove_arrow').setLabel('🗑️ Șterge Săgeată').setStyle(ButtonStyle.Danger)
        );
        await refreshStaticPanel(arrowsChan, embed, [row]);
      }
    }
  }

  if (dbChanged) {
    writeDb(db);
  }
}

async function ensureSindicatAccess(guild) {
  const db = readDb();
  
  const membruSindicatId = db.settings.sindicatMembruRoleId;
  const coLiderSindicatId = db.settings.sindicatCoLiderRoleId;
  const liderSindicatId = db.settings.sindicatLiderRoleId;

  if (!membruSindicatId && !coLiderSindicatId && !liderSindicatId) return;

  for (const mafia of db.mafias) {
    if (!mafia.categoryId) continue;

    const category = await guild.channels.fetch(mafia.categoryId).catch(() => null);
    if (!category) continue;

    try {
      const channels = category.children?.cache || [];
      for (const [chanId, chan] of channels) {
        // Skip staff management or settings channels
        if (chan.name.includes('settings-lideri') || chan.name.includes('settings-membri') || chan.name.includes('𝘀𝗲𝘁𝘁𝗶𝗻𝗴𝘀')) {
          continue;
        }

        // Grant access to Sindicat roles
        if (membruSindicatId) {
          await chan.permissionOverwrites.create(membruSindicatId, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            Connect: true,
            Speak: true
          }).catch(() => null);
        }
        if (coLiderSindicatId) {
          await chan.permissionOverwrites.create(coLiderSindicatId, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            Connect: true,
            Speak: true
          }).catch(() => null);
        }
        if (liderSindicatId) {
          await chan.permissionOverwrites.create(liderSindicatId, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            Connect: true,
            Speak: true
          }).catch(() => null);
        }
      }
    } catch (err) {
      console.error(`[SINDICAT ACCESS ERROR] Failed to sync Sindicat access for category ${category.name}:`, err.message);
    }
  }
}

async function archiveMafiaChannels(guild, mafia) {
  const archiveCatName = '📦│𝗔𝗥𝗛𝗜𝗩𝗔 𝗠𝗔𝗙𝗜𝗜';
  let archiveCategory = guild.channels.cache.find(c => c.name === archiveCatName && c.type === ChannelType.GuildCategory);
  if (!archiveCategory) {
    archiveCategory = await guild.channels.create({
      name: archiveCatName,
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        }
      ]
    });
  }

  const channelsToArchive = [mafia.channels.chat, mafia.channels.tasks, mafia.channels.sanctions, mafia.channels.arrows, mafia.channels.invoiri].filter(Boolean);
  for (const chanId of channelsToArchive) {
    const channel = await guild.channels.fetch(chanId).catch(() => null);
    if (channel) {
      await channel.setParent(archiveCategory.id, { lockPermissions: true }).catch(() => null);
      await channel.setName("📦│" + channel.name.replace(/[^a-zA-Z0-9-]/g, '')).catch(() => null);
    }
  }
  
  const category = await guild.channels.fetch(mafia.categoryId).catch(() => null);
  if (category) {
    await category.delete().catch(() => null);
  }
}

async function ensureSindicatAlliancesEmbed(guild) {
  const db = readDb();
  const chanId = db.settings.alliancesChannelId;
  if (!chanId) return;

  const channel = await guild.channels.fetch(chanId).catch(() => null);
  if (!channel) return;

  const alliances = db.alliances || [];
  const embed = new EmbedBuilder()
    .setTitle('🤝 PACTE ȘI ALIANȚE SINDICAT')
    .setDescription(
      alliances.map((a, idx) => "**" + (idx + 1) + ".** **" + a.org1 + "** 🤝 **" + a.org2 + "**\n> 📝 *Detalii:* " + a.details + "\n> 🗓️ *Semnat la:* " + a.createdAt).join('\n\n') ||
      'Niciun pact de alianță înregistrat oficial în acest moment.'
    )
    .setColor('#9B59B6')
    .setTimestamp();

  const messages = await channel.messages.fetch({ limit: 10 }).catch(() => new Map());
  const targetMsg = [...messages.values()].find(m => m.embeds[0]?.title === '🤝 PACTE ȘI ALIANȚE SINDICAT');
  if (targetMsg) {
    await targetMsg.edit({ embeds: [embed] }).catch(() => null);
  } else {
    await channel.send({ embeds: [embed] }).catch(() => null);
  }
}

async function ensureSindicatZonesEmbed(guild) {
  const db = readDb();
  const chanId = db.settings.zoneLicitatiiChannelId;
  if (!chanId) return;

  const channel = await guild.channels.fetch(chanId).catch(() => null);
  if (!channel) return;

  const zones = db.auction_zones || [];
  const embed = new EmbedBuilder()
    .setTitle('🗺️ TERITORII ȘI ZONE LICITAȚII SINDICAT')
    .setDescription(
      zones.map((z, idx) => "**" + (idx + 1) + ".** **" + z.zoneName + "**\n> 📊 *Status:* " + z.details + "\n> 🕒 *Ultima actualizare:* " + z.updatedAt).join('\n\n') ||
      'Nicio zonă de licitație înregistrată momentan.'
    )
    .setColor('#8E44AD')
    .setTimestamp();

  const messages = await channel.messages.fetch({ limit: 10 }).catch(() => new Map());
  const targetMsg = [...messages.values()].find(m => m.embeds[0]?.title === '🗺️ TERITORII ȘI ZONE LICITAȚII SINDICAT');
  if (targetMsg) {
    await targetMsg.edit({ embeds: [embed] }).catch(() => null);
  } else {
    await channel.send({ embeds: [embed] }).catch(() => null);
  }
}

async function refreshStaticPanel(channel, embed, components) {
  try {
    const messages = await channel.messages.fetch({ limit: 50 }).catch(() => new Map());
    const botMsgs = [...messages.values()].filter(m => m.author.id === client.user.id);
    for (const msg of botMsgs) {
      await msg.delete().catch(() => null);
    }
    await channel.send({ embeds: [embed], components: components }).catch(err => {
      console.error("[PANEL ERROR] Failed to send panel in " + channel.name + ":", err.message);
    });
  } catch (err) {
    console.error("[PANEL ERROR] Failed to refresh panel in " + channel.name + ":", err.message);
  }
}


async function ensureFactionsHaveSettings(guild) {
  const db = readDb();
  let dbChanged = false;

  const managerRoleId = db.settings.managerRoleId;
  const managerStaffRoleId = db.settings.managerStaffRoleId;

  for (const mafia of db.mafias) {
    if (!mafia.categoryId) continue;

    const category = await guild.channels.fetch(mafia.categoryId).catch(() => null);
    if (!category) continue;

    // Clean up duplicate settings channels in this category
    try {
      const categoryChannels = category.children?.cache || [];
      for (const [chanId, chan] of categoryChannels) {
        if (chan.name.includes('𝘀𝗲𝘁𝘁𝗶𝗻𝗴𝘀-𝗹𝗶𝗱𝗲𝗿𝗶') || chan.name.includes('settings-lider')) {
          if (chanId !== mafia.channels.settings_lider) {
            await chan.delete().catch(() => null);
            console.log(`[DISCORD] Deleted duplicate lider settings channel ${chan.name} (${chanId}) for mafia ${mafia.name}`);
          }
        }
        if (chan.name.includes('𝘀𝗲𝘁𝘁𝗶𝗻𝗴𝘀-𝗺𝗲𝗺𝗯𝗿𝗶') || chan.name.includes('settings-membri')) {
          if (chanId !== mafia.channels.settings_membri) {
            await chan.delete().catch(() => null);
            console.log(`[DISCORD] Deleted duplicate membri settings channel ${chan.name} (${chanId}) for mafia ${mafia.name}`);
          }
        }
      }
    } catch (cleanErr) {
      console.error('[DISCORD] Failed to clean duplicate settings channels:', cleanErr.message);
    }

    if (!mafia.channels) mafia.channels = {};

    // Dynamically detect Faction Leader (owner) and Co-Leaders from Discord roles
    const liderRoleIds = [db.settings.liderOficialaRoleId, db.settings.liderNeoficialaRoleId, db.settings.liderGangRoleId].filter(Boolean);
    const coLiderRoleIds = [db.settings.coLiderOficialaRoleId, db.settings.coLiderNeoficialaRoleId, db.settings.coLiderGangRoleId].filter(Boolean);

    let activeOwnerId = mafia.ownerId;
    let activeCoLeaders = [...(mafia.coLeaders || [])];

    if (mafia.roleId) {
      try {
        // Fetch all members holding this faction role
        const roleObj = await guild.roles.fetch(mafia.roleId).catch(() => null);
        if (roleObj) {
          const membersWithRole = roleObj.members;
          
          // Find members who have a global Leader role
          const discordLeaders = membersWithRole.filter(m => liderRoleIds.some(rid => m.roles.cache.has(rid)));
          if (discordLeaders.size > 0) {
            const firstLeaderId = discordLeaders.first().id;
            if (mafia.ownerId !== firstLeaderId) {
              mafia.ownerId = firstLeaderId;
              activeOwnerId = firstLeaderId;
              dbChanged = true;
              console.log(`[DISCORD] Automatically updated database ownerId for faction ${mafia.name} to match Discord leader: ${discordLeaders.first().user.tag}`);
            }
          }

          // Find members who have a global Co-Leader role
          const discordCoLeaders = membersWithRole.filter(m => coLiderRoleIds.some(rid => m.roles.cache.has(rid)));
          const discordCoLeaderIds = discordCoLeaders.map(m => m.id);
          const hasCoLeaderDiff = !mafia.coLeaders || 
                                  mafia.coLeaders.length !== discordCoLeaderIds.length || 
                                  mafia.coLeaders.some(id => !discordCoLeaderIds.includes(id));
          if (hasCoLeaderDiff) {
            mafia.coLeaders = discordCoLeaderIds;
            activeCoLeaders = discordCoLeaderIds;
            dbChanged = true;
            console.log(`[DISCORD] Automatically updated database coLeaders for faction ${mafia.name} to match Discord co-leaders: ${discordCoLeaderIds.join(', ')}`);
          }
        }
      } catch (err) {
        console.error(`[DISCORD] Failed to dynamically sync leaders/co-leaders for ${mafia.name}:`, err.message);
      }
    }

    // Generate specific overwrites for Lider Settings
    const liderOverwrites = [
      {
        id: guild.id, // @everyone
        deny: [PermissionsBitField.Flags.ViewChannel]
      }
    ];
    if (mafia.roleId) {
      liderOverwrites.push({
        id: mafia.roleId,
        deny: [PermissionsBitField.Flags.ViewChannel]
      });
    }
    if (activeOwnerId) {
      liderOverwrites.push({
        id: activeOwnerId,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
      });
    }
    if (activeCoLeaders && Array.isArray(activeCoLeaders)) {
      for (const coLiderId of activeCoLeaders) {
        liderOverwrites.push({
          id: coLiderId,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
        });
      }
    }
    if (managerRoleId) {
      liderOverwrites.push({
        id: managerRoleId,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
      });
    }
    if (managerStaffRoleId) {
      liderOverwrites.push({
        id: managerStaffRoleId,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
      });
    }

    // ─── 1. Lider Settings Channel ───
    let settingsLiderChan = null;
    if (mafia.channels.settings_lider) {
      settingsLiderChan = await guild.channels.fetch(mafia.channels.settings_lider).catch(() => null);
    }

    if (!settingsLiderChan) {
      settingsLiderChan = await guild.channels.create({
        name: '⚙️│𝘀𝗲𝘁𝘁𝗶𝗻𝗴𝘀-𝗹𝗶𝗱𝗲𝗿𝗶',
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: liderOverwrites
      });

      mafia.channels.settings_lider = settingsLiderChan.id;
      dbChanged = true;
      console.log(`[DISCORD] Created settings-lideri channel for ${mafia.name}`);
    } else {
      await settingsLiderChan.permissionOverwrites.set(liderOverwrites).catch(err => {
        console.error(`[DISCORD] Failed to update overwrites for settings-lideri of ${mafia.name}:`, err.message);
      });
    }

    // Send/Refresh static panel for Lider Settings
    const liderEmbed = new EmbedBuilder()
      .setTitle("⚙️ PANOU SETĂRI LIDER — " + mafia.name.toUpperCase())
      .setDescription(
        "Bun venit în panoul administrativ al facțiunii tale!\n\n" +
        "Folosește interacțiunile de mai jos pentru a gestiona mafia:\n\n" +
        "🎨 **Schimbă Culoarea**: Alege o nouă culoare pentru rolul facțiunii.\n" +
        "📥 **Invită Membru**: Trimite invitație unui jucător direct în DM.\n" +
        "👥 **Setează Co-Lider**: Acordă gradul de Co-Lider unui membru.\n" +
        "👥 **Demite Co-Lider**: Demite un Co-Lider înapoi la gradul de membru.\n" +
        "🗑️ **Exclude Membru**: Exclude (demite) un membru din facțiune."
      )
      .setColor('#2ECC71')
      .setTimestamp();

    const colorSelect = new StringSelectMenuBuilder()
      .setCustomId("select_color_" + mafia.id)
      .setPlaceholder('🎨 Alege culoarea rolului...')
      .addOptions([
        { label: 'Roșu aprins', value: '#FF0000', emoji: '🔴' },
        { label: 'Albastru electric', value: '#00D2FF', emoji: '🔵' },
        { label: 'Verde neon', value: '#00FF66', emoji: '🟢' },
        { label: 'Galben auriu', value: '#F1C40F', emoji: '🟡' },
        { label: 'Portocaliu', value: '#E67E22', emoji: '🟠' },
        { label: 'Mov imperial', value: '#9B59B6', emoji: '🟣' },
        { label: 'Roz bombon', value: '#E84393', emoji: '🌸' },
        { label: 'Negru', value: '#111111', emoji: '⚫' },
        { label: 'Gri argintiu', value: '#BDC3C7', emoji: '⚪' },
        { label: 'Cyan', value: '#00CEC9', emoji: '🌐' }
      ]);

    const actionRowColor = new ActionRowBuilder().addComponents(colorSelect);

    const actionRowButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("btn_invite_member_" + mafia.id).setLabel('📥 Invită').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("btn_set_colider_" + mafia.id).setLabel('👥 Co-Lider').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("btn_demote_colider_" + mafia.id).setLabel('👥 Demite').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("btn_remove_member_" + mafia.id).setLabel('🗑️ Exclude').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("btn_show_members_" + mafia.id).setLabel('👥 Membrii').setStyle(ButtonStyle.Secondary)
    );

    await refreshStaticPanel(settingsLiderChan, liderEmbed, [actionRowColor, actionRowButtons]);

    // Generate specific overwrites for Membri Settings
    const membriOverwrites = [
      {
        id: guild.id, // @everyone
        deny: [PermissionsBitField.Flags.ViewChannel]
      }
    ];
    if (mafia.roleId) {
      membriOverwrites.push({
        id: mafia.roleId,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
      });
    }
    if (mafia.ownerId) {
      membriOverwrites.push({
        id: mafia.ownerId,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
      });
    }
    if (mafia.coLeaders && Array.isArray(mafia.coLeaders)) {
      for (const coLiderId of mafia.coLeaders) {
        membriOverwrites.push({
          id: coLiderId,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
        });
      }
    }
    if (managerRoleId) {
      membriOverwrites.push({
        id: managerRoleId,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
      });
    }
    if (managerStaffRoleId) {
      membriOverwrites.push({
        id: managerStaffRoleId,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
      });
    }

    // ─── 2. Membri Settings Channel ───
    let settingsMembriChan = null;
    if (mafia.channels.settings_membri) {
      settingsMembriChan = await guild.channels.fetch(mafia.channels.settings_membri).catch(() => null);
    }

    if (!settingsMembriChan) {
      settingsMembriChan = await guild.channels.create({
        name: '⚙️│𝘀𝗲𝘁𝘁𝗶𝗻𝗴𝘀-𝗺𝗲𝗺𝗯𝗿𝗶',
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: membriOverwrites
      });

      mafia.channels.settings_membri = settingsMembriChan.id;
      dbChanged = true;
      console.log(`[DISCORD] Created settings-membri channel for ${mafia.name}`);
    } else {
      await settingsMembriChan.permissionOverwrites.set(membriOverwrites).catch(err => {
        console.error(`[DISCORD] Failed to update overwrites for settings-membri of ${mafia.name}:`, err.message);
      });
    }

    // Send/Refresh static panel for Membri Settings
    const membriEmbed = new EmbedBuilder()
      .setTitle("⚙️ SECȚIUNE MEMBRII — " + mafia.name.toUpperCase())
      .setDescription(
        "Bun venit în zona de servicii pentru membrii facțiunii **" + mafia.name + "**!\n\n" +
        "Folosește butoanele de mai jos pentru a efectua acțiuni în cadrul organizației:\n\n" +
        "📝 **Schimbă Nume In-Game**: Modifică-ți numele în joc și actualizează-ți nickname-ul automat pe Discord (Format: Nume | ID).\n" +
        "❌ **Demisionează**: Părăsește facțiunea în mod voluntar (ți se vor retrage toate rolurile și accesul)."
      )
      .setColor('#34495E')
      .setTimestamp();

    const actionRowMembri = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("btn_change_ingame_name_" + mafia.id).setLabel('📝 Schimbă Nume In-Game').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("btn_resign_" + mafia.id).setLabel('❌ Demisionează').setStyle(ButtonStyle.Danger)
    );

    await refreshStaticPanel(settingsMembriChan, membriEmbed, [actionRowMembri]);

    // ─── 3. Ensure arrows channel message layout has both add and remove buttons ───
    if (mafia.channels.arrows) {
      const arrowsChan = await guild.channels.fetch(mafia.channels.arrows).catch(() => null);
      if (arrowsChan) {
        const embed = new EmbedBuilder()
          .setTitle("🏹 LISTĂ SĂGEȚI OFICIALE — " + mafia.name.toUpperCase())
          .setDescription(
            (mafia.arrows || []).map((a, idx) => "**" + (idx + 1) + ".** **" + a.name + "**\n> 🌐 *ID FiveM:* " + a.fivemId + "\n> 👤 *Adăugat de:* " + a.addedBy).join('\n\n') ||
            'Nicio săgeată înregistrată momentan în această facțiune.'
          )
          .setColor('#3498DB')
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('btn_add_arrow').setLabel('➕ Adaugă Săgeată').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('btn_remove_arrow').setLabel('🗑️ Șterge Săgeată').setStyle(ButtonStyle.Danger)
        );
        await refreshStaticPanel(arrowsChan, embed, [row]);
      }
    }
  }

  if (dbChanged) {
    writeDb(db);
  }
}

async function ensureSindicatAccess(guild) {
  const db = readDb();
  
  const membruSindicatId = db.settings.sindicatMembruRoleId;
  const coLiderSindicatId = db.settings.sindicatCoLiderRoleId;
  const liderSindicatId = db.settings.sindicatLiderRoleId;

  if (!membruSindicatId && !coLiderSindicatId && !liderSindicatId) return;

  for (const mafia of db.mafias) {
    if (!mafia.categoryId) continue;

    const category = await guild.channels.fetch(mafia.categoryId).catch(() => null);
    if (!category) continue;

    try {
      const channels = category.children?.cache || [];
      for (const [chanId, chan] of channels) {
        // Skip staff management or settings channels
        if (chan.name.includes('settings-lideri') || chan.name.includes('settings-membri') || chan.name.includes('𝘀𝗲𝘁𝘁𝗶𝗻𝗴𝘀')) {
          continue;
        }

        // Grant access to Sindicat roles
        if (membruSindicatId) {
          await chan.permissionOverwrites.create(membruSindicatId, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            Connect: true,
            Speak: true
          }).catch(() => null);
        }
        if (coLiderSindicatId) {
          await chan.permissionOverwrites.create(coLiderSindicatId, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            Connect: true,
            Speak: true
          }).catch(() => null);
        }
        if (liderSindicatId) {
          await chan.permissionOverwrites.create(liderSindicatId, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            Connect: true,
            Speak: true
          }).catch(() => null);
        }
      }
    } catch (err) {
      console.error(`[SINDICAT ACCESS ERROR] Failed to sync Sindicat access for category ${category.name}:`, err.message);
    }
  }
}

async function archiveMafiaChannels(guild, mafia) {
  const archiveCatName = '📦│𝗔𝗥𝗛𝗜𝗩𝗔 𝗠𝗔𝗙𝗜𝗜';
  let archiveCategory = guild.channels.cache.find(c => c.name === archiveCatName && c.type === ChannelType.GuildCategory);
  if (!archiveCategory) {
    archiveCategory = await guild.channels.create({
      name: archiveCatName,
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        }
      ]
    });
  }

  const channelsToArchive = [mafia.channels.chat, mafia.channels.tasks, mafia.channels.sanctions, mafia.channels.arrows, mafia.channels.invoiri].filter(Boolean);
  for (const chanId of channelsToArchive) {
    const channel = await guild.channels.fetch(chanId).catch(() => null);
    if (channel) {
      await channel.setParent(archiveCategory.id, { lockPermissions: true }).catch(() => null);
      await channel.setName("📦│" + channel.name.replace(/[^a-zA-Z0-9-]/g, '')).catch(() => null);
    }
  }
  
  const category = await guild.channels.fetch(mafia.categoryId).catch(() => null);
  if (category) {
    await category.delete().catch(() => null);
  }
}

async function ensureSindicatAlliancesEmbed(guild) {
  const db = readDb();
  const chanId = db.settings.alliancesChannelId;
  if (!chanId) return;

  const channel = await guild.channels.fetch(chanId).catch(() => null);
  if (!channel) return;

  const alliances = db.alliances || [];
  const embed = new EmbedBuilder()
    .setTitle('🤝 PACTE ȘI ALIANȚE SINDICAT')
    .setDescription(
      alliances.map((a, idx) => "**" + (idx + 1) + ".** **" + a.org1 + "** 🤝 **" + a.org2 + "**\n> 📝 *Detalii:* " + a.details + "\n> 🗓️ *Semnat la:* " + a.createdAt).join('\n\n') ||
      'Niciun pact de alianță înregistrat oficial în acest moment.'
    )
    .setColor('#9B59B6')
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_alliance_add').setLabel('➕ Adaugă Alianță').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('btn_alliance_remove').setLabel('🗑️ Șterge Alianță').setStyle(ButtonStyle.Danger)
  );

  await refreshStaticPanel(channel, embed, [row]);
}

async function ensureSindicatZonesEmbed(guild) {
  const db = readDb();
  const chanId = db.settings.zoneLicitatiiChannelId;
  if (!chanId) return;

  const channel = await guild.channels.fetch(chanId).catch(() => null);
  if (!channel) return;

  const zones = db.auction_zones || [];
  const embed = new EmbedBuilder()
    .setTitle('🗺️ TERITORII ȘI ZONE LICITAȚII SINDICAT')
    .setDescription(
      zones.map((z, idx) => "**" + (idx + 1) + ".** **" + z.zoneName + "**\n> 📊 *Status:* " + z.details + "\n> 🕒 *Ultima actualizare:* " + z.updatedAt).join('\n\n') ||
      'Nicio zonă de licitație înregistrată momentan.'
    )
    .setColor('#8E44AD')
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_sindicat_add_zone').setLabel('🗺️ Înregistrează Licitare Zonă').setStyle(ButtonStyle.Primary)
  );

  await refreshStaticPanel(channel, embed, [row]);
}

async function refreshStaticPanel(channel, embed, components) {
  try {
    const messages = await channel.messages.fetch({ limit: 50 }).catch(() => new Map());
    const botMsgs = [...messages.values()].filter(m => m.author.id === client.user.id);
    for (const msg of botMsgs) {
      await msg.delete().catch(() => null);
    }
    await channel.send({ embeds: [embed], components: components }).catch(err => {
      console.error("[PANEL ERROR] Failed to send panel in " + channel.name + ":", err.message);
    });
  } catch (err) {
    console.error("[PANEL ERROR] Failed to refresh panel in " + channel.name + ":", err.message);
  }
}


async function ensureFactionsHaveSettings(guild) {
  const db = readDb();
  let dbChanged = false;

  const managerRoleId = db.settings.managerRoleId;
  const managerStaffRoleId = db.settings.managerStaffRoleId;

  for (const mafia of db.mafias) {
    if (!mafia.categoryId) continue;

    const category = await guild.channels.fetch(mafia.categoryId).catch(() => null);
    if (!category) continue;

    // Clean up duplicate settings channels in this category
    try {
      const categoryChannels = category.children?.cache || [];
      for (const [chanId, chan] of categoryChannels) {
        if (chan.name.includes('𝘀𝗲𝘁𝘁𝗶𝗻𝗴𝘀-𝗹𝗶𝗱𝗲𝗿𝗶') || chan.name.includes('settings-lider')) {
          if (chanId !== mafia.channels.settings_lider) {
            await chan.delete().catch(() => null);
            console.log(`[DISCORD] Deleted duplicate lider settings channel ${chan.name} (${chanId}) for mafia ${mafia.name}`);
          }
        }
        if (chan.name.includes('𝘀𝗲𝘁𝘁𝗶𝗻𝗴𝘀-𝗺𝗲𝗺𝗯𝗿𝗶') || chan.name.includes('settings-membri')) {
          if (chanId !== mafia.channels.settings_membri) {
            await chan.delete().catch(() => null);
            console.log(`[DISCORD] Deleted duplicate membri settings channel ${chan.name} (${chanId}) for mafia ${mafia.name}`);
          }
        }
      }
    } catch (cleanErr) {
      console.error('[DISCORD] Failed to clean duplicate settings channels:', cleanErr.message);
    }

    if (!mafia.channels) mafia.channels = {};

    // Dynamically detect Faction Leader (owner) and Co-Leaders from Discord roles
    const liderRoleIds = [db.settings.liderOficialaRoleId, db.settings.liderNeoficialaRoleId, db.settings.liderGangRoleId].filter(Boolean);
    const coLiderRoleIds = [db.settings.coLiderOficialaRoleId, db.settings.coLiderNeoficialaRoleId, db.settings.coLiderGangRoleId].filter(Boolean);

    let activeOwnerId = mafia.ownerId;
    let activeCoLeaders = [...(mafia.coLeaders || [])];

    if (mafia.roleId) {
      try {
        // Fetch all members holding this faction role
        const roleObj = await guild.roles.fetch(mafia.roleId).catch(() => null);
        if (roleObj) {
          const membersWithRole = roleObj.members;
          
          // Find members who have a global Leader role
          const discordLeaders = membersWithRole.filter(m => liderRoleIds.some(rid => m.roles.cache.has(rid)));
          if (discordLeaders.size > 0) {
            const firstLeaderId = discordLeaders.first().id;
            if (mafia.ownerId !== firstLeaderId) {
              mafia.ownerId = firstLeaderId;
              activeOwnerId = firstLeaderId;
              dbChanged = true;
              console.log(`[DISCORD] Automatically updated database ownerId for faction ${mafia.name} to match Discord leader: ${discordLeaders.first().user.tag}`);
            }
          }

          // Find members who have a global Co-Leader role
          const discordCoLeaders = membersWithRole.filter(m => coLiderRoleIds.some(rid => m.roles.cache.has(rid)));
          const discordCoLeaderIds = discordCoLeaders.map(m => m.id);
          const hasCoLeaderDiff = !mafia.coLeaders || 
                                  mafia.coLeaders.length !== discordCoLeaderIds.length || 
                                  mafia.coLeaders.some(id => !discordCoLeaderIds.includes(id));
          if (hasCoLeaderDiff) {
            mafia.coLeaders = discordCoLeaderIds;
            activeCoLeaders = discordCoLeaderIds;
            dbChanged = true;
            console.log(`[DISCORD] Automatically updated database coLeaders for faction ${mafia.name} to match Discord co-leaders: ${discordCoLeaderIds.join(', ')}`);
          }
        }
      } catch (err) {
        console.error(`[DISCORD] Failed to dynamically sync leaders/co-leaders for ${mafia.name}:`, err.message);
      }
    }

    // Generate specific overwrites for Lider Settings
    const liderOverwrites = [
      {
        id: guild.id, // @everyone
        deny: [PermissionsBitField.Flags.ViewChannel]
      }
    ];
    if (mafia.roleId) {
      liderOverwrites.push({
        id: mafia.roleId,
        deny: [PermissionsBitField.Flags.ViewChannel]
      });
    }
    if (activeOwnerId) {
      liderOverwrites.push({
        id: activeOwnerId,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
      });
    }
    if (activeCoLeaders && Array.isArray(activeCoLeaders)) {
      for (const coLiderId of activeCoLeaders) {
        liderOverwrites.push({
          id: coLiderId,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
        });
      }
    }
    if (managerRoleId) {
      liderOverwrites.push({
        id: managerRoleId,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
      });
    }
    if (managerStaffRoleId) {
      liderOverwrites.push({
        id: managerStaffRoleId,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
      });
    }

    // ─── 1. Lider Settings Channel ───
    let settingsLiderChan = null;
    if (mafia.channels.settings_lider) {
      settingsLiderChan = await guild.channels.fetch(mafia.channels.settings_lider).catch(() => null);
    }

    if (!settingsLiderChan) {
      settingsLiderChan = await guild.channels.create({
        name: '⚙️│𝘀𝗲𝘁𝘁𝗶𝗻𝗴𝘀-𝗹𝗶𝗱𝗲𝗿𝗶',
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: liderOverwrites
      });

      mafia.channels.settings_lider = settingsLiderChan.id;
      dbChanged = true;
      console.log(`[DISCORD] Created settings-lideri channel for ${mafia.name}`);
    } else {
      await settingsLiderChan.permissionOverwrites.set(liderOverwrites).catch(err => {
        console.error(`[DISCORD] Failed to update overwrites for settings-lideri of ${mafia.name}:`, err.message);
      });
    }

    // Send/Refresh static panel for Lider Settings
    const liderEmbed = new EmbedBuilder()
      .setTitle("⚙️ PANOU SETĂRI LIDER — " + mafia.name.toUpperCase())
      .setDescription(
        "Bun venit în panoul administrativ al facțiunii tale!\n\n" +
        "Folosește interacțiunile de mai jos pentru a gestiona mafia:\n\n" +
        "🎨 **Schimbă Culoarea**: Alege o nouă culoare pentru rolul facțiunii.\n" +
        "📥 **Invită Membru**: Trimite invitație unui jucător direct în DM.\n" +
        "👥 **Setează Co-Lider**: Acordă gradul de Co-Lider unui membru.\n" +
        "👥 **Demite Co-Lider**: Demite un Co-Lider înapoi la gradul de membru.\n" +
        "🗑️ **Exclude Membru**: Exclude (demite) un membru din facțiune."
      )
      .setColor('#2ECC71')
      .setTimestamp();

    const colorSelect = new StringSelectMenuBuilder()
      .setCustomId("select_color_" + mafia.id)
      .setPlaceholder('🎨 Alege culoarea rolului...')
      .addOptions([
        { label: 'Roșu aprins', value: '#FF0000', emoji: '🔴' },
        { label: 'Albastru electric', value: '#00D2FF', emoji: '🔵' },
        { label: 'Verde neon', value: '#00FF66', emoji: '🟢' },
        { label: 'Galben auriu', value: '#F1C40F', emoji: '🟡' },
        { label: 'Portocaliu', value: '#E67E22', emoji: '🟠' },
        { label: 'Mov imperial', value: '#9B59B6', emoji: '🟣' },
        { label: 'Roz bombon', value: '#E84393', emoji: '🌸' },
        { label: 'Negru', value: '#111111', emoji: '⚫' },
        { label: 'Gri argintiu', value: '#BDC3C7', emoji: '⚪' },
        { label: 'Cyan', value: '#00CEC9', emoji: '🌐' }
      ]);

    const actionRowColor = new ActionRowBuilder().addComponents(colorSelect);

    const actionRowButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("btn_invite_member_" + mafia.id).setLabel('📥 Invită').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("btn_set_colider_" + mafia.id).setLabel('👥 Co-Lider').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("btn_demote_colider_" + mafia.id).setLabel('👥 Demite').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("btn_remove_member_" + mafia.id).setLabel('🗑️ Exclude').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("btn_show_members_" + mafia.id).setLabel('👥 Membrii').setStyle(ButtonStyle.Secondary)
    );

    await refreshStaticPanel(settingsLiderChan, liderEmbed, [actionRowColor, actionRowButtons]);

    // Generate specific overwrites for Membri Settings
    const membriOverwrites = [
      {
        id: guild.id, // @everyone
        deny: [PermissionsBitField.Flags.ViewChannel]
      }
    ];
    if (mafia.roleId) {
      membriOverwrites.push({
        id: mafia.roleId,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
      });
    }
    if (mafia.ownerId) {
      membriOverwrites.push({
        id: mafia.ownerId,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
      });
    }
    if (mafia.coLeaders && Array.isArray(mafia.coLeaders)) {
      for (const coLiderId of mafia.coLeaders) {
        membriOverwrites.push({
          id: coLiderId,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
        });
      }
    }
    if (managerRoleId) {
      membriOverwrites.push({
        id: managerRoleId,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
      });
    }
    if (managerStaffRoleId) {
      membriOverwrites.push({
        id: managerStaffRoleId,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
      });
    }

    // ─── 2. Membri Settings Channel ───
    let settingsMembriChan = null;
    if (mafia.channels.settings_membri) {
      settingsMembriChan = await guild.channels.fetch(mafia.channels.settings_membri).catch(() => null);
    }

    if (!settingsMembriChan) {
      settingsMembriChan = await guild.channels.create({
        name: '⚙️│𝘀𝗲𝘁𝘁𝗶𝗻𝗴𝘀-𝗺𝗲𝗺𝗯𝗿𝗶',
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: membriOverwrites
      });

      mafia.channels.settings_membri = settingsMembriChan.id;
      dbChanged = true;
      console.log(`[DISCORD] Created settings-membri channel for ${mafia.name}`);
    } else {
      await settingsMembriChan.permissionOverwrites.set(membriOverwrites).catch(err => {
        console.error(`[DISCORD] Failed to update overwrites for settings-membri of ${mafia.name}:`, err.message);
      });
    }

    // Send/Refresh static panel for Membri Settings
    const membriEmbed = new EmbedBuilder()
      .setTitle("⚙️ SECȚIUNE MEMBRII — " + mafia.name.toUpperCase())
      .setDescription(
        "Bun venit în zona de servicii pentru membrii facțiunii **" + mafia.name + "**!\n\n" +
        "Folosește butoanele de mai jos pentru a efectua acțiuni în cadrul organizației:\n\n" +
        "📝 **Schimbă Nume In-Game**: Modifică-ți numele în joc și actualizează-ți nickname-ul automat pe Discord (Format: Nume | ID).\n" +
        "❌ **Demisionează**: Părăsește facțiunea în mod voluntar (ți se vor retrage toate rolurile și accesul)."
      )
      .setColor('#34495E')
      .setTimestamp();

    const actionRowMembri = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("btn_change_ingame_name_" + mafia.id).setLabel('📝 Schimbă Nume In-Game').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("btn_resign_" + mafia.id).setLabel('❌ Demisionează').setStyle(ButtonStyle.Danger)
    );

    await refreshStaticPanel(settingsMembriChan, membriEmbed, [actionRowMembri]);

    // ─── 3. Ensure arrows channel message layout has both add and remove buttons ───
    if (mafia.channels.arrows) {
      const arrowsChan = await guild.channels.fetch(mafia.channels.arrows).catch(() => null);
      if (arrowsChan) {
        const embed = new EmbedBuilder()
          .setTitle("🏹 LISTĂ SĂGEȚI OFICIALE — " + mafia.name.toUpperCase())
          .setDescription(
            (mafia.arrows || []).map((a, idx) => "**" + (idx + 1) + ".** **" + a.name + "**\n> 🌐 *ID FiveM:* " + a.fivemId + "\n> 👤 *Adăugat de:* " + a.addedBy).join('\n\n') ||
            'Nicio săgeată înregistrată momentan în această facțiune.'
          )
          .setColor('#3498DB')
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('btn_add_arrow').setLabel('➕ Adaugă Săgeată').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('btn_remove_arrow').setLabel('🗑️ Șterge Săgeată').setStyle(ButtonStyle.Danger)
        );
        await refreshStaticPanel(arrowsChan, embed, [row]);
      }
    }
  }

  if (dbChanged) {
    writeDb(db);
  }
}

async function ensureSindicatAccess(guild) {
  const db = readDb();
  
  const membruSindicatId = db.settings.sindicatMembruRoleId;
  const coLiderSindicatId = db.settings.sindicatCoLiderRoleId;
  const liderSindicatId = db.settings.sindicatLiderRoleId;

  if (!membruSindicatId && !coLiderSindicatId && !liderSindicatId) return;

  for (const mafia of db.mafias) {
    if (!mafia.categoryId) continue;

    const category = await guild.channels.fetch(mafia.categoryId).catch(() => null);
    if (!category) continue;

    try {
      const channels = category.children?.cache || [];
      for (const [chanId, chan] of channels) {
        // Skip staff management or settings channels
        if (chan.name.includes('settings-lideri') || chan.name.includes('settings-membri') || chan.name.includes('𝘀𝗲𝘁𝘁𝗶𝗻𝗴𝘀')) {
          continue;
        }

        // Grant access to Sindicat roles
        if (membruSindicatId) {
          await chan.permissionOverwrites.create(membruSindicatId, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            Connect: true,
            Speak: true
          }).catch(() => null);
        }
        if (coLiderSindicatId) {
          await chan.permissionOverwrites.create(coLiderSindicatId, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            Connect: true,
            Speak: true
          }).catch(() => null);
        }
        if (liderSindicatId) {
          await chan.permissionOverwrites.create(liderSindicatId, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            Connect: true,
            Speak: true
          }).catch(() => null);
        }
      }
    } catch (err) {
      console.error(`[SINDICAT ACCESS ERROR] Failed to sync Sindicat access for category ${category.name}:`, err.message);
    }
  }
}

async function archiveMafiaChannels(guild, mafia) {
  const archiveCatName = '📦│𝗔𝗥𝗛𝗜𝗩𝗔 𝗠𝗔𝗙𝗜𝗜';
  let archiveCategory = guild.channels.cache.find(c => c.name === archiveCatName && c.type === ChannelType.GuildCategory);
  if (!archiveCategory) {
    archiveCategory = await guild.channels.create({
      name: archiveCatName,
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        }
      ]
    });
  }

  const channelsToArchive = [mafia.channels.chat, mafia.channels.tasks, mafia.channels.sanctions, mafia.channels.arrows, mafia.channels.invoiri].filter(Boolean);
  for (const chanId of channelsToArchive) {
    const channel = await guild.channels.fetch(chanId).catch(() => null);
    if (channel) {
      await channel.setParent(archiveCategory.id, { lockPermissions: true }).catch(() => null);
      await channel.setName("📦│" + channel.name.replace(/[^a-zA-Z0-9-]/g, '')).catch(() => null);
    }
  }
  
  const category = await guild.channels.fetch(mafia.categoryId).catch(() => null);
  if (category) {
    await category.delete().catch(() => null);
  }
}

async function ensureSindicatAlliancesEmbed(guild) {
  const db = readDb();
  const chanId = db.settings.alliancesChannelId;
  if (!chanId) return;

  const channel = await guild.channels.fetch(chanId).catch(() => null);
  if (!channel) return;

  const alliances = db.alliances || [];
  const embed = new EmbedBuilder()
    .setTitle('🤝 PACTE ȘI ALIANȚE SINDICAT')
    .setDescription(
      alliances.map((a, idx) => "**" + (idx + 1) + ".** **" + a.org1 + "** 🤝 **" + a.org2 + "**\n> 📝 *Detalii:* " + a.details + "\n> 🗓️ *Semnat la:* " + a.createdAt).join('\n\n') ||
      'Niciun pact de alianță înregistrat oficial în acest moment.'
    )
    .setColor('#9B59B6')
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_alliance_add').setLabel('➕ Adaugă Alianță').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('btn_alliance_remove').setLabel('🗑️ Șterge Alianță').setStyle(ButtonStyle.Danger)
  );

  await refreshStaticPanel(channel, embed, [row]);
}

async function ensureSindicatZonesEmbed(guild) {
  const db = readDb();
  const chanId = db.settings.zoneLicitatiiChannelId;
  if (!chanId) return;

  const channel = await guild.channels.fetch(chanId).catch(() => null);
  if (!channel) return;

  const zones = db.auction_zones || [];
  const list = zones.map((z, idx) => {
    const statusEmoji = z.status?.toLowerCase() === 'disponibil' ? '🟢' : '🔴';
    const statusText = z.status || 'Disponibil';
    return `📍 **${z.name}**\n` +
           `> 📊 **Status:** ${statusEmoji} **${statusText}**\n` +
           `> 👑 **Deținător:** ${z.owner || 'Disponibil'}\n` +
           `> 💰 **Preț Plătit:** ${z.price || '0$'}\n` +
           `> 📝 **Detalii:** *${z.details || 'Fără detalii.'}*\n` +
           `> 🕒 *Ultima actualizare:* ${z.updatedAt || 'Niciodată'}`;
  }).join('\n\n');

  const embed = new EmbedBuilder()
    .setTitle('🗺️ TERITORII ȘI ZONE LICITAȚII SINDICAT')
    .setDescription(list || 'Nicio zonă de licitație configurată.')
    .setColor('#8E44AD')
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_sindicat_manage_zones').setLabel('⚙️ Administrează Zone').setStyle(ButtonStyle.Secondary)
  );

  await refreshStaticPanel(channel, embed, [row]);
}

async function refreshStaticPanel(channel, embed, components) {
  try {
    const messages = await channel.messages.fetch({ limit: 50 }).catch(() => new Map());
    const botMsgs = [...messages.values()].filter(m => m.author.id === client.user.id);
    for (const msg of botMsgs) {
      await msg.delete().catch(() => null);
    }
    await channel.send({ embeds: [embed], components: components }).catch(err => {
      console.error("[PANEL ERROR] Failed to send panel in " + channel.name + ":", err.message);
    });
  } catch (err) {
    console.error("[PANEL ERROR] Failed to refresh panel in " + channel.name + ":", err.message);
  }
}


async function sendGradeLog(embedOrTitle, description, color = '#E67E22') {
  try {
    const db = readDb();
    const gradeChanId = db.settings.gradeChannelId;
    if (!gradeChanId) return;
    const guildId = db.settings.guildId || '1526274994353606726';
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    const gradeChan = guild.channels.cache.get(gradeChanId);
    if (gradeChan) {
      if (typeof embedOrTitle === 'string') {
        const embed = new EmbedBuilder()
          .setTitle(embedOrTitle)
          .setDescription(description)
          .setColor(color)
          .setTimestamp();
        await gradeChan.send({ embeds: [embed] }).catch(() => null);
      } else {
        await gradeChan.send({ embeds: [embedOrTitle] }).catch(() => null);
      }
    }
  } catch (err) {
    console.error('[DISCORD] Failed to send grade log:', err.message);
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
  syncDiscordLeader,
  syncFactionWarningRoles,
  sendInviteDM,
  sendSupportTicketToAdmin,
  getGuildMeta,
  sendGradeLog
};
