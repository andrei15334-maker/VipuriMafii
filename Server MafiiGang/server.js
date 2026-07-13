const express = require('express');
const session = require('express-session');
const axios = require('axios');
const path = require('path');
const { readDb, writeDb } = require('./database');
const { PermissionsBitField } = require('discord.js');

let botModule = null;
// We require bot.js dynamically later to avoid circular dependencies
function getBot() {
  if (!botModule) {
    botModule = require('./bot');
  }
  return botModule;
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'vipuri-secret-key-12345',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 60000 * 60 } // 1 hour session
}));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Discord OAuth2 Configurations
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const PORT = process.env.PORT || 3000;

// Tracking online statuses
let fivemOnlinePlayers = []; // Discord IDs online in-game
const onlineWebUsers = new Set(); // Dashboard online users

// OAuth2 Redirect
app.get('/auth/login', (req, res) => {
  // If Client Secret is default, show a warning or allow bypass
  if (!CLIENT_SECRET || CLIENT_SECRET === 'YOUR_CLIENT_SECRET_HERE') {
    console.log('[WEB] Client Secret is not set. Redirecting to manual developer login.');
    return res.redirect('/?error=oauth_not_configured');
  }
  
  const oauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`;
  res.redirect(oauthUrl);
});

// OAuth2 Callback
app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect('/?error=no_code');
  
  try {
    // Exchange code for token
    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: REDIRECT_URI
    }).toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    const accessToken = tokenResponse.data.access_token;
    
    // Fetch user details
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    
    const user = userResponse.data;
    req.session.user = {
      id: user.id,
      username: user.username,
      avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png'
    };
    
    res.redirect('/dashboard.html');
  } catch (err) {
    console.error('[WEB] Eroare la callback OAuth2:', err.response?.data || err.message);
    res.redirect('/?error=oauth_failed');
  }
});

// Developer Bypass Login (For local testing without client secret)
app.post('/auth/dev-login', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID is required' });
  
  try {
    const { client } = getBot();
    const db = readDb();
    
    if (!db.settings.guildId) {
      return res.status(400).json({ error: 'Botul nu a fost configurat pe Discord! Rulează comanda /setup-server în Discord mai întâi.' });
    }
    
    const guild = await client.guilds.fetch(db.settings.guildId).catch(() => null);
    if (!guild) {
      return res.status(400).json({ error: 'Serverul de Discord configurat nu a fost găsit.' });
    }
    
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) {
      return res.status(400).json({ error: 'Utilizatorul nu se află pe serverul de Discord!' });
    }
    
    req.session.user = {
      id: member.user.id,
      username: member.user.username,
      avatar: member.user.displayAvatarURL()
    };
    
    res.json({ success: true, redirect: '/dashboard.html' });
  } catch (err) {
    console.error('[WEB] Dev login failed:', err);
    res.status(500).json({ error: 'A apărut o eroare la verificarea utilizatorului.' });
  }
});

// Logout Route
app.get('/auth/logout', (req, res) => {
  if (req.session.user) {
    onlineWebUsers.delete(req.session.user.id);
  }
  req.session.destroy();
  res.redirect('/');
});

// Authentication Middleware
async function checkAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Neautorizat. Te rog să te conectezi.' });
  }
  
  const db = readDb();
  const { client } = getBot();
  const userId = req.session.user.id;
  const guildId = db.settings.guildId || "1526274994353606726";
  
  try {
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      return res.status(500).json({ error: 'Serverul de Discord nu poate fi accesat de bot.' });
    }
    
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) {
      return res.status(403).json({ error: 'Nu te afli pe serverul de Discord!' });
    }
    
    // Check roles
    const isSuperAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator) || 
                         (db.settings.managerStaffRoleId && member.roles.cache.has(db.settings.managerStaffRoleId)) ||
                         member.roles.cache.some(r => r.name.includes('Manager Staff'));

    const isFactionManager = isSuperAdmin || 
                             (db.settings.managerRoleId && member.roles.cache.has(db.settings.managerRoleId)) ||
                             member.roles.cache.some(r => r.name.includes('Manager Mafii/Gang'));
                       
    console.log(`[DEBUG AUTH] Utilizator: ${member.user.tag} (${userId})`);
    console.log(`[DEBUG AUTH] Administrator Discord: ${member.permissions.has(PermissionsBitField.Flags.Administrator)}`);
    console.log(`[DEBUG AUTH] Roluri în setări: Staff=${db.settings.managerStaffRoleId}, Manager=${db.settings.managerRoleId}`);
    console.log(`[DEBUG AUTH] Roluri membru:`, member.roles.cache.map(r => `${r.name} (${r.id})`));
    console.log(`[DEBUG AUTH] Rezultat: isSuperAdmin=${isSuperAdmin}, isFactionManager=${isFactionManager}`);

    req.session.user.role = 'none';
    req.session.user.mafiaId = null;
    
    if (isSuperAdmin) {
      req.session.user.role = 'superadmin';
    } else if (isFactionManager) {
      req.session.user.role = 'manager';
    } else {
      // Find mafia where user is owner
      const ownedMafia = db.mafias.find(m => m.ownerId === userId);
      if (ownedMafia) {
        req.session.user.role = 'leader';
        req.session.user.mafiaId = ownedMafia.id;
      } else {
        // Find mafia where user is member
        const memberMafia = db.mafias.find(m => m.members.includes(userId));
        if (memberMafia) {
          req.session.user.role = 'member';
          req.session.user.mafiaId = memberMafia.id;
        }
      }
    }
    
    if (req.session.user.role === 'none') {
      return res.status(403).json({ error: 'Nu deții un rol de Manager sau Lider/Membru într-o Mafie înregistrată!' });
    }
    
    // Mark as active in Web Panel
    onlineWebUsers.add(userId);
    
    next();
  } catch (err) {
    console.error('[WEB] Auth middleware error:', err);
    res.status(500).json({ error: 'Eroare internă de autentificare.' });
  }
}

// Helper function to append activity logs
function addLog(action, details, user) {
  const db = readDb();
  if (!db.logs) db.logs = [];
  db.logs.push({
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    action,
    details,
    user: user || 'Sistem',
    timestamp: new Date().toLocaleString('ro-RO')
  });
  if (db.logs.length > 200) db.logs.shift();
  writeDb(db);
}

// API Routes
// Get Activity Logs
app.get('/api/logs', checkAuth, (req, res) => {
  const db = readDb();
  res.json((db.logs || []).slice().reverse()); // newest first
});

// Search Discord Guild Members (for autocomplete)
app.get('/api/guild-members', checkAuth, async (req, res) => {
  const query = (req.query.q || '').toLowerCase().trim();
  if (query.length < 2) return res.json([]);

  try {
    const { client } = getBot();
    const db = readDb();
    const guild = client.guilds.cache.get(db.settings.guildId || '1526274994353606726');
    if (!guild) return res.json([]);

    // Fetch all members (cached or fresh)
    await guild.members.fetch();

    const results = guild.members.cache
      .filter(m => !m.user.bot && (
        m.user.username.toLowerCase().includes(query) ||
        (m.nickname || '').toLowerCase().includes(query) ||
        m.user.id.includes(query)
      ))
      .map(m => ({
        id: m.user.id,
        username: m.user.username,
        nickname: m.nickname || null,
        displayName: m.nickname || m.user.username,
        avatar: m.user.displayAvatarURL({ size: 64 })
      }))
      .slice(0, 15);

    res.json(results);
  } catch (err) {
    console.error('[API] guild-members error:', err);
    res.json([]);
  }
});

// Get Online Players (FiveM + Web combined)
app.get('/api/online-players', checkAuth, async (req, res) => {
  try {
    const { client } = getBot();
    const db = readDb();
    const guild = client.guilds.cache.get(db.settings.guildId || '1526274994353606726');

    const onlinePlayers = [];

    for (const mafia of db.mafias) {
      for (const memberId of mafia.members) {
        const onFiveM = fivemOnlinePlayers.includes(memberId);
        const onWeb   = onlineWebUsers.has(memberId);
        if (!onFiveM && !onWeb) continue;

        let username = memberId;
        let avatar = null;
        const profile = (db.profiles || {})[memberId];

        if (guild) {
          const m = guild.members.cache.get(memberId);
          if (m) {
            username = m.nickname || m.user.username;
            avatar = m.user.displayAvatarURL({ size: 64 });
          }
        }

        onlinePlayers.push({
          id: memberId,
          username,
          avatar,
          factionName: mafia.name,
          factionType: mafia.type,
          isOwner: mafia.ownerId === memberId,
          onFiveM,
          onWeb,
          ingameName: profile?.ingameName || null,
          cfxId:      profile?.cfxId || null
        });
      }
    }

    res.json(onlinePlayers);
  } catch (err) {
    console.error('[API] online-players error:', err);
    res.json([]);
  }
});

// Save In-Game Profile (linked to Discord ID)
app.post('/api/profile', checkAuth, (req, res) => {
  const { ingameName, cfxId } = req.body;
  if (!ingameName || !cfxId) return res.status(400).json({ error: 'Numele și ID-ul CFX sunt obligatorii.' });

  const db = readDb();
  if (!db.profiles) db.profiles = {};

  db.profiles[req.session.user.id] = {
    ingameName: ingameName.trim(),
    cfxId: cfxId.trim(),
    updatedAt: new Date().toLocaleDateString('ro-RO')
  };
  writeDb(db);

  res.json({ success: true });
});

// 1. Get Me (Current Session Info)
app.get('/api/me', checkAuth, (req, res) => {
  res.json(req.session.user);
});

// 2. Get Statistics
app.get('/api/stats', checkAuth, (req, res) => {
  const db = readDb();
  const stats = {
    totalMafias: db.mafias.length,
    totalMembers: db.mafias.reduce((acc, m) => acc + m.members.length, 0),
    totalSanctions: db.mafias.reduce((acc, m) => acc + m.sanctions.length, 0),
    totalTasks: db.mafias.reduce((acc, m) => acc + m.tasks.length, 0)
  };
  res.json(stats);
});

// 3. Get Factions List
app.get('/api/mafias', checkAuth, async (req, res) => {
  const db = readDb();
  const { role, mafiaId } = req.session.user;
  
  let targetFactions = [];
  if (role === 'manager' || role === 'superadmin') {
    targetFactions = db.mafias;
  } else {
    const mafia = db.mafias.find(m => m.id === mafiaId);
    targetFactions = mafia ? [mafia] : [];
  }
  
  const { client } = getBot();
  const guild = client.guilds.cache.get(db.settings.guildId || "1526274994353606726");
  
  // Decorate members with status and warnings info
  const decorated = await Promise.all(targetFactions.map(async m => {
    const decoratedMembers = await Promise.all(m.members.map(async memberId => {
      const memberSanctions = m.memberSanctions?.[memberId] || [];
      const warningsCount = memberSanctions.reduce((sum, s) => sum + s.points, 0);
      
      let username = `Utilizator (${memberId})`;
      if (guild) {
        try {
          const discordMember = await guild.members.fetch(memberId);
          if (discordMember) {
            username = discordMember.nickname || discordMember.user.username;
          }
        } catch (fetchErr) {
          // Fallback if member cannot be fetched (e.g. left server)
        }
      }
      
      const profile = (db.profiles || {})[memberId];

      return {
        id: memberId,
        username: username,
        onlineFiveM: fivemOnlinePlayers.includes(memberId),
        onlineDiscord: onlineWebUsers.has(memberId),
        warnings: warningsCount,
        sanctionsList: memberSanctions,
        ingameName: profile?.ingameName || null,
        cfxId: profile?.cfxId || null
      };
    }));
    
    return {
      ...m,
      decoratedMembers
    };
  }));
  
  res.json(decorated);
});

// FiveM CFX Sync Webhook
app.post('/api/fivem/sync', (req, res) => {
  const { players } = req.body; // Expects array of Discord IDs online on FiveM
  if (Array.isArray(players)) {
    fivemOnlinePlayers = players;
    return res.json({ success: true, count: fivemOnlinePlayers.length });
  }
  res.status(400).json({ error: 'Data must contain a "players" array of Discord User IDs.' });
});

// 4. Add Faction-level Sanction (AV/WARN) (Manager Only)
app.post('/api/mafias/:id/sanctions', checkAuth, async (req, res) => {
  const { role } = req.session.user;
  if (role !== 'manager' && role !== 'superadmin') {
    return res.status(403).json({ error: 'Doar Managerii pot acorda sancțiuni facțiunilor!' });
  }
  
  const { reason, type } = req.body; // type should be 'av' or 'warn'
  if (!reason || !type) {
    return res.status(400).json({ error: 'Motivul și tipul sancțiunii (av/warn) sunt obligatorii.' });
  }
  
  const db = readDb();
  const mafia = db.mafias.find(m => m.id === req.params.id);
  if (!mafia) return res.status(404).json({ error: 'Facțiunea nu a fost găsită.' });
  
  // Initialize warnings if not present
  if (mafia.warningsAV === undefined) mafia.warningsAV = 0;
  if (mafia.warningsWarn === undefined) mafia.warningsWarn = 0;
  
  let textType = '';
  let avConverted = false;
  
  if (type === 'av') {
    mafia.warningsAV += 1;
    textType = mafia.type === 'gang' ? 'Gang AV (+1)' : 'Mafia AV (+1)';
    
    if (mafia.warningsAV >= 2) {
      mafia.warningsAV = 0;
      mafia.warningsWarn += 1;
      avConverted = true;
      textType += ' ➔ Convertit automat în 1 WARN (acumulare 2/2 AV)';
    }
  } else if (type === 'warn') {
    mafia.warningsWarn += 1;
    textType = mafia.type === 'gang' ? 'Gang WARN (+1)' : 'Mafia WARN (+1)';
  } else {
    return res.status(400).json({ error: 'Tipul de sancțiune trebuie să fie av sau warn.' });
  }
  
  const sanction = {
    id: `sanction_${Date.now()}`,
    type,
    reason,
    points: 1,
    givenBy: req.session.user.username,
    createdAt: new Date().toLocaleDateString('ro-RO')
  };
  
  mafia.sanctions.push(sanction);
  
  // Check if Faction disbands (3/3 WARNs)
  let disbanded = false;
  const { deleteDiscordFaction, sendLogEmbed, sendChannelMessage } = getBot();
  
  if (mafia.warningsWarn >= 3) {
    disbanded = true;
    
    // Delete Discord roles/channels
    await deleteDiscordFaction(mafia.roleId, mafia.categoryId, mafia.channels);
    
    // Remove from Database
    db.mafias = db.mafias.filter(m => m.id !== mafia.id);
  }
  
  writeDb(db);
  
  // Discord Logging
  if (disbanded) {
    await sendLogEmbed(
      '🚨 FACȚIUNE DESFIINȚATĂ AUTOMAT (3/3 WARN)',
      `Facțiunea **${mafia.name}** a acumulat **3/3 WARN-uri** și a fost desființată automat!\n\n` +
      `📝 **Ultimul motiv:** ${reason}\n` +
      `👤 **Sancționat de:** ${req.session.user.username}`,
      '#FF0000'
    );
  } else {
    await sendLogEmbed(
      '⚠️ SANCȚIUNE FACȚIUNE',
      `Facțiunea **${mafia.name}** a fost sancționată cu **${textType}**.\n\n` +
      `📈 **Status curent:** ${mafia.warningsWarn}/3 WARN-uri | ${mafia.warningsAV}/2 AV-uri\n` +
      `📝 **Motiv:** ${reason}\n` +
      `👤 **Sancționat de:** ${req.session.user.username}`,
      '#E67E22'
    );
    
    // Log inside Faction's private sanctions channel
    if (mafia.channels?.sanctions) {
      const embedData = {
        title: '⚠️ SANCȚIUNE FACȚIUNE',
        description: `Facțiunea a primit o sancțiune: **${textType}**.\n\n` +
                     `📈 **Status curent:** ${mafia.warningsWarn}/3 WARN | ${mafia.warningsAV}/2 AV\n` +
                     `📝 **Motiv:** ${reason}\n` +
                     `👤 **Acordat de:** ${req.session.user.username}`,
        color: 0xE67E22,
        timestamp: new Date().toISOString()
      };
      await sendChannelMessage(mafia.channels.sanctions, `||<@&${mafia.roleId}>||`, embedData);
    }
  }
  
  res.json({ success: true, warningsAV: mafia.warningsAV, warningsWarn: mafia.warningsWarn, disbanded, sanction });
});

// 5. Add Task (Manager & Leader)
app.post('/api/mafias/:id/tasks', checkAuth, async (req, res) => {
  const { role, mafiaId } = req.session.user;
  const targetId = req.params.id;
  
  if (role !== 'manager' && role !== 'superadmin' && (role !== 'leader' || mafiaId !== targetId)) {
    return res.status(403).json({ error: 'Nu ai permisiunea de a crea task-uri pentru această facțiune!' });
  }
  
  const { title, description } = req.body;
  if (!title || !description) {
    return res.status(400).json({ error: 'Titlul și descrierea sunt obligatorii.' });
  }
  
  const db = readDb();
  const mafia = db.mafias.find(m => m.id === targetId);
  if (!mafia) return res.status(404).json({ error: 'Mafia nu a fost găsită.' });
  
  const task = {
    id: `task_${Date.now()}`,
    title,
    description,
    status: 'active', // active, completed
    createdBy: req.session.user.username,
    createdAt: new Date().toLocaleDateString('ro-RO')
  };
  
  mafia.tasks.push(task);
  writeDb(db);
  
  // Alert inside Discord Faction Task Channel
  const { sendChannelMessage } = getBot();
  const embedData = {
    title: '📋 TASK NOU ALOCAT',
    description: `**Titlu:** ${title}\n` +
                 `**Descriere:** ${description}\n\n` +
                 `👤 **Alocat de:** ${req.session.user.username}`,
    color: 0x3498DB,
    timestamp: new Date().toISOString()
  };
  
  if (mafia.channels?.tasks) {
    await sendChannelMessage(mafia.channels.tasks, `||<@&${mafia.roleId}>||`, embedData);
  }
  
  res.json({ success: true, task });
});

// 6. Complete Task (Manager & Leader)
app.post('/api/mafias/:id/tasks/:taskId/complete', checkAuth, async (req, res) => {
  const { role, mafiaId } = req.session.user;
  const targetId = req.params.id;
  
  if (role !== 'manager' && role !== 'superadmin' && (role !== 'leader' || mafiaId !== targetId)) {
    return res.status(403).json({ error: 'Nu ai permisiunea de a modifica task-urile acestei facțiuni!' });
  }
  
  const db = readDb();
  const mafia = db.mafias.find(m => m.id === targetId);
  if (!mafia) return res.status(404).json({ error: 'Mafia nu a fost găsită.' });
  
  const task = mafia.tasks.find(t => t.id === req.params.taskId);
  if (!task) return res.status(404).json({ error: 'Task-ul nu a fost găsit.' });
  
  task.status = 'completed';
  writeDb(db);
  
  // Notify Faction Channel
  const { sendChannelMessage } = getBot();
  if (mafia.channels?.tasks) {
    await sendChannelMessage(mafia.channels.tasks, `✅ **Task Finalizat:** *${task.title}* (finalizat de ${req.session.user.username})`);
  }
  
  res.json({ success: true, task });
});

// 7. Delete Task (Manager & Leader)
app.delete('/api/mafias/:id/tasks/:taskId', checkAuth, async (req, res) => {
  const { role, mafiaId } = req.session.user;
  const targetId = req.params.id;
  
  if (role !== 'manager' && role !== 'superadmin' && (role !== 'leader' || mafiaId !== targetId)) {
    return res.status(403).json({ error: 'Nu ai permisiunea de a modifica task-urile acestei facțiuni!' });
  }
  
  const db = readDb();
  const mafia = db.mafias.find(m => m.id === targetId);
  if (!mafia) return res.status(404).json({ error: 'Mafia nu a fost găsită.' });
  
  const taskIndex = mafia.tasks.findIndex(t => t.id === req.params.taskId);
  if (taskIndex === -1) return res.status(404).json({ error: 'Task-ul nu a fost găsit.' });
  
  mafia.tasks.splice(taskIndex, 1);
  writeDb(db);
  
  res.json({ success: true });
});

// 8. Add Member to Mafia (Manager & Leader)
app.post('/api/mafias/:id/members', checkAuth, async (req, res) => {
  const { role, mafiaId } = req.session.user;
  const targetId = req.params.id;
  
  if (role !== 'manager' && role !== 'superadmin' && (role !== 'leader' || mafiaId !== targetId)) {
    return res.status(403).json({ error: 'Nu ai permisiunea de a gestiona membrii acestei facțiuni!' });
  }
  
  const { userId } = req.body; // Needs Discord User ID
  if (!userId) return res.status(400).json({ error: 'Discord User ID este obligatoriu.' });
  
  const db = readDb();
  const mafia = db.mafias.find(m => m.id === targetId);
  if (!mafia) return res.status(404).json({ error: 'Mafia nu a fost găsită.' });
  
  if (mafia.members.includes(userId)) {
    return res.status(400).json({ error: 'Utilizatorul face deja parte din această facțiune.' });
  }
  
  // Check if user is in any other mafia
  const inOther = db.mafias.find(m => m.members.includes(userId));
  if (inOther) {
    return res.status(400).json({ error: `Utilizatorul face deja parte din altă mafie (${inOther.name})!` });
  }
  
  const { modifyMemberRole, sendLogEmbed } = getBot();
  
  // Add Discord Role
  const roleAdded = await modifyMemberRole(userId, mafia.roleId, 'add');
  if (!roleAdded) {
    return res.status(500).json({ error: 'Nu s-a putut atribui rolul de Discord. Verifică ID-ul utilizatorului și permisiunile botului.' });
  }
  
  // Update Database
  mafia.members.push(userId);
  writeDb(db);
  
  // Log
  await sendLogEmbed('👤 MEMBRU NOU (PANEL)', `Liderul/Managerul **${req.session.user.username}** l-a adăugat pe <@${userId}> în facțiunea **${mafia.name}**.`);
  
  res.json({ success: true, members: mafia.members });
});

// 9. Remove Member from Mafia (Manager & Leader)
app.delete('/api/mafias/:id/members/:userId', checkAuth, async (req, res) => {
  const { role, mafiaId } = req.session.user;
  const targetId = req.params.id;
  const memberId = req.params.userId;
  
  if (role !== 'manager' && role !== 'superadmin' && (role !== 'leader' || mafiaId !== targetId)) {
    return res.status(403).json({ error: 'Nu ai permisiunea de a gestiona membrii acestei facțiuni!' });
  }
  
  const db = readDb();
  const mafia = db.mafias.find(m => m.id === targetId);
  if (!mafia) return res.status(404).json({ error: 'Mafia nu a fost găsită.' });
  
  if (!mafia.members.includes(memberId)) {
    return res.status(404).json({ error: 'Utilizatorul nu face parte din această facțiune.' });
  }
  
  // Cannot kick the owner/founder unless you are a manager
  if (memberId === mafia.ownerId && role !== 'manager' && role !== 'superadmin') {
    return res.status(400).json({ error: 'Liderul fondator poate fi demis doar de către un Manager!' });
  }
  
  const { modifyMemberRole, sendLogEmbed } = getBot();
  
  // Remove Discord Role
  await modifyMemberRole(memberId, mafia.roleId, 'remove');
  
  // Remove Leader Role if they are owner/lider
  if (memberId === mafia.ownerId) {
    let leaderRoleName = 'Lider Gang';
    if (mafia.type === 'oficiala') leaderRoleName = 'Lider Mafie Oficiala';
    if (mafia.type === 'neoficiala') leaderRoleName = 'Lider Mafie Neoficiala';
    
    const { client } = getBot();
    const guild = client.guilds.cache.get(db.settings.guildId);
    const liderRole = guild?.roles.cache.find(r => r.name === leaderRoleName);
    if (liderRole) {
      await modifyMemberRole(memberId, liderRole.id, 'remove');
    }
    
    // Change owner if the founder was kicked by a manager (reset ownerId to manager)
    if (role === 'manager' || role === 'superadmin') {
      mafia.ownerId = req.session.user.id;
    }
  }
  
  // Update Database
  mafia.members = mafia.members.filter(id => id !== memberId);
  writeDb(db);
  
  // Log
  await sendLogEmbed('👤 MEMBRU DEMIS (PANEL)', `Utilizatorul <@${memberId}> a fost demis din facțiunea **${mafia.name}** de către **${req.session.user.username}**.`);
  
  res.json({ success: true, members: mafia.members });
});

// 10. Sanction Individual Member (Manager & Leader)
app.post('/api/mafias/:id/members/:userId/sanction', checkAuth, async (req, res) => {
  const { role, mafiaId } = req.session.user;
  const targetId = req.params.id;
  const memberId = req.params.userId;
  
  if (role !== 'manager' && (role !== 'leader' || mafiaId !== targetId)) {
    return res.status(403).json({ error: 'Nu ai permisiunea de a sancționa membrii acestei facțiuni!' });
  }
  
  const { reason, points } = req.body;
  if (!reason || !points) {
    return res.status(400).json({ error: 'Motivul și punctele sunt obligatorii.' });
  }
  
  const db = readDb();
  const mafia = db.mafias.find(m => m.id === targetId);
  if (!mafia) return res.status(404).json({ error: 'Mafia nu a fost găsită.' });
  
  if (!mafia.members.includes(memberId)) {
    return res.status(404).json({ error: 'Utilizatorul nu face parte din această facțiune.' });
  }
  
  // Initialize memberSanctions if doesn't exist
  if (!mafia.memberSanctions) mafia.memberSanctions = {};
  if (!mafia.memberSanctions[memberId]) mafia.memberSanctions[memberId] = [];
  
  const newSanction = {
    id: `ms_${Date.now()}`,
    reason,
    points: parseInt(points),
    givenBy: req.session.user.username,
    createdAt: new Date().toLocaleDateString('ro-RO')
  };
  
  mafia.memberSanctions[memberId].push(newSanction);
  
  // Calculate total warnings
  const totalWarnings = mafia.memberSanctions[memberId].reduce((sum, s) => sum + s.points, 0);
  
  const { applyWarningRoles, modifyMemberRole, sendLogEmbed, sendChannelMessage } = getBot();
  
  // Apply warning roles in Discord
  await applyWarningRoles(memberId, totalWarnings);
  
  let actionTakenText = `a primit un avertisment (Total: ${totalWarnings}/3 AV).`;
  let autoKicked = false;
  
  if (totalWarnings >= 3) {
    autoKicked = true;
    actionTakenText = `a acumulat 3/3 AV și a fost DEMIS AUTOMAT din facțiune!`;
    
    // Kick from mafia role on Discord
    await modifyMemberRole(memberId, mafia.roleId, 'remove');
    // Clear warnings in Discord
    await applyWarningRoles(memberId, 0);
    
    // If they were owner/founder, clear roles and handle
    if (memberId === mafia.ownerId) {
      let leaderRoleName = 'Lider Gang';
      if (mafia.type === 'oficiala') leaderRoleName = 'Lider Mafie Oficiala';
      if (mafia.type === 'neoficiala') leaderRoleName = 'Lider Mafie Neoficiala';
      
      const { client } = getBot();
      const guild = client.guilds.cache.get(db.settings.guildId || "1526274994353606726");
      const liderRole = guild?.roles.cache.find(r => r.name === leaderRoleName);
      if (liderRole) {
        await modifyMemberRole(memberId, liderRole.id, 'remove');
      }
      
      if (role === 'manager') {
        mafia.ownerId = req.session.user.id;
      }
    }
    
    // Remove from db members list
    mafia.members = mafia.members.filter(id => id !== memberId);
    delete mafia.memberSanctions[memberId];
  }
  
  writeDb(db);
  
  // Log on Discord
  const embedData = {
    title: autoKicked ? '🔴 EXCLUDERE AUTOMATĂ (3/3 AV)' : '⚠️ MEMBRU SANCȚIONAT',
    description: `Membrul <@${memberId}> din facțiunea **${mafia.name}** ${actionTakenText}\n\n` +
                 `📝 **Motiv:** ${reason}\n` +
                 `👤 **Acordat de:** ${req.session.user.username}`,
    color: autoKicked ? 0xFF0000 : 0xE67E22,
    timestamp: new Date().toISOString()
  };
  
  // Faction logs
  await sendLogEmbed(
    autoKicked ? '🔴 DEMITERE AUTOMATĂ' : '⚠️ SANCȚIUNE MEMBRU',
    `Jucătorul <@${memberId}> din facțiunea **${mafia.name}** ${actionTakenText}\nMotiv: ${reason}\nAcordat de: ${req.session.user.username}`,
    autoKicked ? '#FF0000' : '#E67E22'
  );
  
  // Send message inside specific channel
  if (mafia.channels?.sanctions) {
    await sendChannelMessage(mafia.channels.sanctions, `||<@${memberId}>||`, embedData);
  }
  
  res.json({ success: true, totalWarnings, autoKicked });
});

// 11. Edit Faction (Manager & Super Admin)
app.put('/api/mafias/:id', checkAuth, async (req, res) => {
  const { role } = req.session.user;
  if (role !== 'superadmin' && role !== 'manager') {
    return res.status(403).json({ error: 'Doar Managerii pot edita facțiunile!' });
  }
  
  const { name, type, ownerId } = req.body;
  if (!name || !type || !ownerId) {
    return res.status(400).json({ error: 'Numele, tipul și ID-ul Liderului sunt obligatorii.' });
  }
  
  const db = readDb();
  const mafia = db.mafias.find(m => m.id === req.params.id);
  if (!mafia) return res.status(404).json({ error: 'Facțiunea nu a fost găsită.' });
  
  const { updateDiscordFaction, syncDiscordLeader, sendLogEmbed } = getBot();
  const oldName = mafia.name;
  const oldType = mafia.type;
  const oldOwner = mafia.ownerId;
  
  // A. Sync Discord channels & role rename
  const syncSuccess = await updateDiscordFaction(
    mafia.roleId,
    mafia.categoryId,
    mafia.channels,
    oldName,
    name,
    oldType,
    type
  );
  
  if (!syncSuccess) {
    return res.status(500).json({ error: 'Sincronizarea pe Discord a eșuat. Verifică permisiunile botului.' });
  }
  
  // B. Sync Discord Leader roles if leader changed
  if (oldOwner !== ownerId) {
    await syncDiscordLeader(oldOwner, ownerId, type);
    // Ensure new leader is in members list
    if (!mafia.members.includes(ownerId)) {
      mafia.members.push(ownerId);
      const { modifyMemberRole } = getBot();
      await modifyMemberRole(ownerId, mafia.roleId, 'add');
    }
  }
  
  // C. Update Database
  mafia.name = name;
  mafia.type = type;
  mafia.ownerId = ownerId;
  writeDb(db);
  
  // Log changes
  await sendLogEmbed(
    '📝 FACȚIUNE MODIFICATĂ',
    `Facțiunea **${oldName}** a fost editată de **${req.session.user.username}**.\n\n` +
    `🔹 Nume nou: **${name}**\n` +
    `🔹 Tip nou: **${type.toUpperCase()}**\n` +
    `🔹 Lider nou: <@${ownerId}>`,
    '#3498DB'
  );
  
  res.json({ success: true, mafia });
});

// 12. Delete Faction (Manager & Super Admin)
app.delete('/api/mafias/:id', checkAuth, async (req, res) => {
  const { role } = req.session.user;
  if (role !== 'superadmin' && role !== 'manager') {
    return res.status(403).json({ error: 'Doar Managerii pot șterge facțiunile!' });
  }
  
  const db = readDb();
  const mafiaIndex = db.mafias.findIndex(m => m.id === req.params.id);
  if (mafiaIndex === -1) return res.status(404).json({ error: 'Facțiunea nu a fost găsită.' });
  
  const mafia = db.mafias[mafiaIndex];
  const { deleteDiscordFaction, sendLogEmbed } = getBot();
  
  // A. Delete channels, roles, and category on Discord
  const deleteSuccess = await deleteDiscordFaction(mafia.roleId, mafia.categoryId, mafia.channels);
  if (!deleteSuccess) {
    console.warn(`[WEB] Ștergerea Discord a eșuat sau a fost parțială pentru facțiunea ${mafia.name}.`);
  }
  
  // B. Remove from Database
  db.mafias.splice(mafiaIndex, 1);
  writeDb(db);
  
  // Log deletion
  await sendLogEmbed(
    '🗑️ FACȚIUNE ȘTEARSĂ',
    `Facțiunea **${mafia.name}** a fost ștersă definitiv de pe server de către **${req.session.user.username}**.\n` +
    `Toate canalele și rolurile asociate au fost curățate de pe Discord.`,
    '#E74C3C'
  );
  
  res.json({ success: true });
});

// 14. Add Official Arrow (Manager & Leader)
app.post('/api/mafias/:id/arrows', checkAuth, async (req, res) => {
  const { role, mafiaId } = req.session.user;
  const targetId = req.params.id;
  
  if (role !== 'manager' && role !== 'superadmin' && (role !== 'leader' || mafiaId !== targetId)) {
    return res.status(403).json({ error: 'Nu ai permisiunea de a adăuga săgeți pentru această facțiune!' });
  }
  
  const { name, fivemId } = req.body;
  if (!name || !fivemId) {
    return res.status(400).json({ error: 'Numele și ID-ul FiveM ale săgeții sunt obligatorii.' });
  }
  
  const db = readDb();
  const mafia = db.mafias.find(m => m.id === targetId);
  if (!mafia) return res.status(404).json({ error: 'Facțiunea nu a fost găsită.' });
  
  if (mafia.type === 'gang') {
    return res.status(400).json({ error: 'Găngurile nu pot înregistra săgeți oficiale!' });
  }
  
  if (!mafia.arrows) mafia.arrows = [];
  
  const exists = mafia.arrows.find(a => a.fivemId === fivemId);
  if (exists) {
    return res.status(400).json({ error: 'Această săgeată este deja înregistrată!' });
  }
  
  const newArrow = {
    id: `arrow_${Date.now()}`,
    name,
    fivemId,
    addedBy: req.session.user.username,
    createdAt: new Date().toLocaleDateString('ro-RO')
  };
  
  mafia.arrows.push(newArrow);
  writeDb(db);
  
  // Sync on Discord channel list message
  const { client, sendLogEmbed } = getBot();
  
  const arrowsChannelId = mafia.channels.arrows;
  if (arrowsChannelId) {
    const guild = client.guilds.cache.get(db.settings.guildId);
    const channel = await guild?.channels.fetch(arrowsChannelId).catch(() => null);
    if (channel) {
      const listEmbed = new EmbedBuilder()
        .setTitle('🏹 LISTĂ SĂGEȚI OFICIALE')
        .setDescription(mafia.arrows.map((a, idx) => `**${idx + 1}.** ${a.name} (ID: **${a.fivemId}**) - Adăugat de: **${a.addedBy}** la ${a.createdAt}`).join('\n') || 'Nicio săgeată înregistrată momentan.')
        .setColor(0xD35400)
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
  
  // Log
  await sendLogEmbed(
    '🏹 SĂGEATĂ OFICIALĂ ADĂUGATĂ (PANEL)',
    `Utilizatorul **${req.session.user.username}** a adăugat săgeata **${name}** (ID FiveM: **${fivemId}**) în facțiunea **${mafia.name}** via Panel.`,
    '#D35400'
  );
  
  res.json({ success: true, arrows: mafia.arrows });
});

// 15. Delete Official Arrow (Manager & Leader)
app.delete('/api/mafias/:id/arrows/:arrowId', checkAuth, async (req, res) => {
  const { role, mafiaId } = req.session.user;
  const targetId = req.params.id;
  const arrowId = req.params.arrowId;
  
  if (role !== 'manager' && role !== 'superadmin' && (role !== 'leader' || mafiaId !== targetId)) {
    return res.status(403).json({ error: 'Nu ai permisiunea de a șterge săgeți din această facțiune!' });
  }
  
  const db = readDb();
  const mafia = db.mafias.find(m => m.id === targetId);
  if (!mafia) return res.status(404).json({ error: 'Facțiunea nu a fost găsită.' });
  
  if (!mafia.arrows) mafia.arrows = [];
  
  const arrow = mafia.arrows.find(a => a.id === arrowId);
  if (!arrow) return res.status(404).json({ error: 'Săgeata nu a fost găsită în listă.' });
  
  mafia.arrows = mafia.arrows.filter(a => a.id !== arrowId);
  writeDb(db);
  
  // Sync on Discord channel list message
  const { client, sendLogEmbed } = getBot();
  
  const arrowsChannelId = mafia.channels.arrows;
  if (arrowsChannelId) {
    const guild = client.guilds.cache.get(db.settings.guildId);
    const channel = await guild?.channels.fetch(arrowsChannelId).catch(() => null);
    if (channel) {
      const listEmbed = new EmbedBuilder()
        .setTitle('🏹 LISTĂ SĂGEȚI OFICIALE')
        .setDescription(mafia.arrows.map((a, idx) => `**${idx + 1}.** ${a.name} (ID: **${a.fivemId}**) - Adăugat de: **${a.addedBy}** la ${a.createdAt}`).join('\n') || 'Nicio săgeată înregistrată momentan.')
        .setColor(0xD35400)
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
  
  // Log
  await sendLogEmbed(
    '🏹 SĂGEATĂ OFICIALĂ ȘTEARSĂ (PANEL)',
    `Utilizatorul **${req.session.user.username}** a eliminat săgeata **${arrow.name}** (ID FiveM: **${arrow.fivemId}**) din facțiunea **${mafia.name}** via Panel.`,
    '#D35400'
  );
  
  res.json({ success: true, arrows: mafia.arrows });
});

// 13. Update Global Settings (Super Admin Only)
app.post('/api/settings', checkAuth, async (req, res) => {
  const { role } = req.session.user;
  if (role !== 'superadmin') {
    return res.status(403).json({ error: 'Doar Managerii Staff pot modifica setările!' });
  }
  
  const { guildId, managerRoleId, logsChannelId, setupChannelId, zoneCategoryId } = req.body;
  
  const db = readDb();
  db.settings = {
    guildId: guildId || db.settings.guildId,
    managerRoleId: managerRoleId || db.settings.managerRoleId,
    logsChannelId: logsChannelId || db.settings.logsChannelId,
    setupChannelId: setupChannelId || db.settings.setupChannelId,
    zoneCategoryId: zoneCategoryId || db.settings.zoneCategoryId
  };
  writeDb(db);
  
  res.json({ success: true, settings: db.settings });
});

// Start function for the Express Server
function startWebserver() {
  app.listen(PORT, () => {
    console.log(`[WEB] Serverul rulează pe http://localhost:${PORT}`);
  });
}

module.exports = {
  startWebserver
};
