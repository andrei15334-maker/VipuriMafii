// State Management
let currentUser = null;
let activeFaction = null;
let allFactions = [];

// DOM Elements
const userAvatarEl = document.getElementById('user-avatar');
const userUsernameEl = document.getElementById('user-username');
const userRoleBadgeEl = document.getElementById('user-role-badge');
const menuFactionsEl = document.getElementById('menu-factions');

const tabOverviewEl = document.getElementById('tab-overview');
const tabFactionsEl = document.getElementById('tab-factions');
const pageHeaderTitleEl = document.getElementById('page-header-title');
const pageHeaderSubEl = document.getElementById('page-header-sub');
const factionHeaderBadgeEl = document.getElementById('faction-header-badge');

const statMafiasEl = document.getElementById('stat-mafias');
const statMembersEl = document.getElementById('stat-members');
const statSanctionsEl = document.getElementById('stat-sanctions');
const statTasksEl = document.getElementById('stat-tasks');

const managerSelectorWrapper = document.getElementById('manager-selector-wrapper');
const factionSelector = document.getElementById('faction-selector');

// Action forms
const addMemberForm = document.getElementById('add-member-form');
const addSanctionForm = document.getElementById('add-sanction-form');
const addTaskForm = document.getElementById('add-task-form');

// List containers
const membersListContainer = document.getElementById('members-list-container');
const sanctionsListContainer = document.getElementById('sanctions-list-container');
const tasksListContainer = document.getElementById('tasks-list-container');

const memberCountEl = document.getElementById('member-count');
const factionTypeBadgeEl = document.getElementById('faction-type-badge');
const sanctionPointsTotalEl = document.getElementById('sanction-points-total');

// Arrows elements
const arrowsPanel = document.getElementById('arrows-panel');
const addArrowForm = document.getElementById('add-arrow-form');
const newArrowNameEl = document.getElementById('new-arrow-name');
const newArrowIdEl = document.getElementById('new-arrow-id');
const addArrowBtn = document.getElementById('add-arrow-btn');
const arrowsListContainer = document.getElementById('arrows-list-container');
const arrowCountEl = document.getElementById('arrow-count');
const sanctionTypeEl = document.getElementById('sanction-type');

// 1. Initialize Dashboard
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  
  const authResult = await fetchCurrentUser();
  if (authResult === true) {
    applyRoleBasedUI();
    await fetchStats();
    await loadFactionsData();
    setupActions();
    setupSuperadminExtras();
  } else if (authResult === 'denied') {
    // Show access denied overlay - don't redirect
    showAccessDenied();
  } else {
    // Not logged in at all - go to login
    window.location.href = '/';
  }
});

// ════════════════════════════════════════════════════════════
// ROLE-BASED UI VISIBILITY
// ════════════════════════════════════════════════════════════
function applyRoleBasedUI() {
  const role = currentUser?.role; // superadmin | manager | leader | member

  const menuFactions     = document.getElementById('menu-factions');      // tab-factions
  const menuAllFactions  = document.getElementById('menu-all-factions');  // tab-all-factions
  const menuOnline       = document.getElementById('menu-online-players'); // tab-online-players
  const menuLogs         = document.getElementById('menu-logs');           // tab-logs
  const menuSettings     = document.getElementById('menu-settings');       // tab-settings

  // === MEMBER ===
  // Poate vedea: Facțiunea Mea (tab-factions), Toate Factiunile, Jucatori Online
  // NU poate vedea: Loguri, Setari, Ședințe & Activități
  if (role === 'member') {
    if (menuFactions) {
      menuFactions.style.display = 'block';
      const textSpan = menuFactions.querySelector('.nav-text');
      if (textSpan) textSpan.innerText = 'Facțiunea Mea';
    }
    if (menuLogs)        menuLogs.style.display        = 'none';
    if (menuSettings)    menuSettings.style.display    = 'none';
    
    const menuActivities = document.getElementById('menu-activities');
    if (menuActivities) menuActivities.style.display = 'none';

    // Start on Factions (My Faction) tab
    activateTab('tab-factions');
    return;
  }

  // === LEADER ===
  // Poate vedea: Facțiunea Mea (tab-factions), Toate Factiunile, Jucatori Online, Ședințe
  // NU poate vedea: Loguri, Setari
  if (role === 'leader') {
    if (menuFactions) {
      const textSpan = menuFactions.querySelector('.nav-text');
      if (textSpan) textSpan.innerText = 'Facțiunea Mea';
    }
    if (menuLogs)        menuLogs.style.display        = 'none';
    if (menuSettings)    menuSettings.style.display    = 'none';
    return;
  }

  // === MANAGER ===
  // Poate vedea: toate in afara de Setari (doar superadmin)
  if (role === 'manager') {
    if (menuSettings)    menuSettings.style.display    = 'none';
    return;
  }

  // === SUPERADMIN ===
  // Vede tot - settings se arata in setupSuperadminExtras
}

function activateTab(tabId) {
  document.querySelectorAll('.nav-item[data-tab]').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
  if (navItem) navItem.classList.add('active');
  const pane = document.getElementById(tabId);
  if (pane) pane.classList.add('active');
  // Update header
  const headers = {
    'tab-overview':       ['Prezentare Generală',       'Statistici globale ale serverului Vipuri Roleplay.'],
    'tab-all-factions':   ['Toate Facțiunile',           'Vizualizează toate mafiile și gang-urile înregistrate.'],
    'tab-online-players': ['Jucători Online',            'Membrii conectați acum pe FiveM sau Dashboard.'],
  };
  if (headers[tabId] && pageHeaderTitleEl) {
    pageHeaderTitleEl.innerText = headers[tabId][0];
    pageHeaderSubEl.innerText   = headers[tabId][1];
  }
}

function showAccessDenied() {
  // Hide main layout
  document.querySelector('.app-layout')?.style.setProperty('display', 'none');
  
  // Show access denied screen
  const overlay = document.createElement('div');
  overlay.id = 'access-denied-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0;
    background: #0d0d1a;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    z-index: 9999; gap: 20px;
    font-family: 'Inter', sans-serif;
  `;
  overlay.innerHTML = `
    <div style="font-size: 64px;">🚫</div>
    <h1 style="color: #e74c3c; font-size: 2rem; margin: 0;">Acces Interzis</h1>
    <p style="color: #a0a0b0; text-align: center; max-width: 420px; font-size: 1rem; line-height: 1.6;">
      Nu ai niciun rol activ pe serverul de Discord (Manager Staff, Manager Mafii/Gang, Lider sau Membru al unei facțiuni înregistrate).
      <br><br>Contactează un <strong style="color:#e74c3c">Manager Staff</strong> pentru acces.
    </p>
    <a href="/auth/logout" style="
      background: #e74c3c; color: #fff;
      padding: 12px 28px; border-radius: 8px;
      text-decoration: none; font-size: 0.95rem;
      font-weight: 600; margin-top: 8px;
    ">🔓 Deconectare</a>
  `;
  document.body.appendChild(overlay);
}

// 2. Navigation Setup
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item[data-tab]');
  navItems.forEach(item => {
    item.addEventListener('click', async () => {
      const tabId = item.getAttribute('data-tab');
      const role  = currentUser?.role;

      // Guard restricted tabs
      const restrictedForMember = ['tab-activities', 'tab-logs', 'tab-settings'];
      const restrictedForLeader = ['tab-logs', 'tab-settings'];
      const restrictedForManager= ['tab-settings'];

      let denied = false;
      if (role === 'member'  && restrictedForMember.includes(tabId))  denied = true;
      if (role === 'leader'  && restrictedForLeader.includes(tabId))  denied = true;
      if (role === 'manager' && restrictedForManager.includes(tabId)) denied = true;

      if (denied) {
        showTabAccessDenied(tabId);
        return;
      }

      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
      document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
      document.getElementById(tabId)?.classList.add('active');

      const headers = {
        'tab-leaderboard':      ['Clasament Facțiuni',         'Clasamentul oficial al organizațiilor pe baza activității lor.'],
        'tab-activities':       ['Ședințe & Activități',       'Planifică ședințe, antrenamente sau war-uri pe Discord.'],
        'tab-factions':         ['Gestionare Facțiuni',        'Administrează membrii, sarcinile și sancțiunile active.'],
        'tab-all-factions':     ['Toate Facțiunile',           'Vizualizează toate mafiile și gang-urile înregistrate.'],
        'tab-online-players':   ['Jucători Online',            'Membrii conectați acum pe FiveM sau Dashboard.'],
        'tab-logs':             ['Loguri Activitate',           'Istoricul acțiunilor din sistem.'],
        'tab-settings':         ['Setări Sistem',               'Configurare globală bot + Discord.']
      };
      if (headers[tabId]) {
        pageHeaderTitleEl.innerText = headers[tabId][0];
        pageHeaderSubEl.innerText   = headers[tabId][1];
      }

      if (tabId === 'tab-leaderboard') await renderLeaderboard();
      if (tabId === 'tab-activities') await renderActivities();
      if (tabId === 'tab-all-factions') await renderAllFactionsGrid();
      if (tabId === 'tab-online-players') await renderOnlinePlayers();
      if (tabId === 'tab-logs') await renderAuditLogs();
    });
  });
}

function showTabAccessDenied(tabId) {
  // Show a toast / inline denied message without redirecting
  let toast = document.getElementById('tab-denied-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'tab-denied-toast';
    toast.style.cssText = `
      position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
      background: #e74c3c; color: #fff; padding: 12px 28px;
      border-radius: 10px; font-weight: 600; font-size: .95rem;
      z-index: 9999; box-shadow: 0 4px 24px rgba(0,0,0,.4);
      opacity: 0; transition: opacity .3s;
    `;
    document.body.appendChild(toast);
  }
  const messages = {
    'tab-factions': '🚫 Secțiunea "Gestionare Facțiuni" este disponibilă doar pentru Lideri și Manageri.',
    'tab-logs':     '🚫 Logurile de activitate sunt disponibile doar pentru Manageri Staff.',
    'tab-settings': '🚫 Setările sistemului sunt disponibile doar pentru Manageri Staff.',
  };
  toast.innerText = messages[tabId] || '🚫 Acces interzis.';
  toast.style.opacity = '1';
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => { toast.style.opacity = '0'; }, 3500);
}

// 3. API calls
async function fetchCurrentUser() {
  try {
    const response = await fetch('/api/me');
    
    if (response.status === 401) {
      // Not logged in - redirect to login
      return false;
    }
    
    if (response.status === 403) {
      // Logged in but no valid role - show access denied
      return 'denied';
    }
    
    if (!response.ok) return false;
    
    currentUser = await response.json();
    
    // Populate user profile in sidebar
    userAvatarEl.src = currentUser.avatar;
    userUsernameEl.innerText = currentUser.username;
    
    // Format Role tag
    let roleText = 'Membru';
    let badgeColor = '#a0a0b0';
    
    if (currentUser.role === 'superadmin') {
      roleText = 'Manager Staff';
      badgeColor = '#e74c3c';
    } else if (currentUser.role === 'manager') {
      roleText = 'Manager Mafii/Gang';
      badgeColor = '#f1c40f';
    } else if (currentUser.role === 'leader') {
      roleText = 'Lider Organizație';
      badgeColor = '#ff3333';
    } else if (currentUser.role === 'member') {
      roleText = 'Membru Organizație';
      badgeColor = '#2ecc71';
    }
    
    userRoleBadgeEl.innerText = roleText;
    userRoleBadgeEl.style.color = badgeColor;
    
    return true;
  } catch (err) {
    console.error('Error fetching user:', err);
    return false;
  }
}

async function fetchStats() {
  try {
    const response = await fetch('/api/stats');
    if (!response.ok) return;
    const stats = await response.json();
    
    statMafiasEl.innerText = stats.totalMafias;
    statMembersEl.innerText = stats.totalMembers;
    statSanctionsEl.innerText = stats.totalSanctions;
    statTasksEl.innerText = stats.totalTasks;
  } catch (err) {
    console.error('Error fetching stats:', err);
  }
}

async function loadFactionsData() {
  try {
    const response = await fetch('/api/mafias');
    if (!response.ok) return;
    allFactions = await response.json();
    
    if (currentUser.role === 'manager' || currentUser.role === 'superadmin') {
      managerSelectorWrapper.style.display = 'block';
      
      // Populate select selector
      factionSelector.innerHTML = '';
      
      if (allFactions.length === 0) {
        factionSelector.innerHTML = '<option value="">Fără organizații înregistrate</option>';
        renderEmptyFactionView();
        return;
      }
      
      allFactions.forEach(f => {
        const option = document.createElement('option');
        option.value = f.id;
        option.innerText = `${f.name} (${f.type.toUpperCase()})`;
        factionSelector.appendChild(option);
      });
      
      // Set active faction to first in list
      activeFaction = allFactions[0];
      
      // Handler for selector change
      factionSelector.addEventListener('change', (e) => {
        const id = e.target.value;
        activeFaction = allFactions.find(f => f.id === id);
        renderFactionDetails(activeFaction);
      });
      
    } else {
      managerSelectorWrapper.style.display = 'none';
      if (allFactions.length > 0) {
        activeFaction = allFactions[0];
      }
    }
    
    if (activeFaction) {
      renderFactionDetails(activeFaction);
    } else {
      renderEmptyFactionView();
    }
  } catch (err) {
    console.error('Error loading factions data:', err);
  }
}

// 4. Render Functions
function renderEmptyFactionView() {
  membersListContainer.innerHTML = '<div class="empty-state">Nu a fost selectată nicio organizație activă.</div>';
  sanctionsListContainer.innerHTML = '<div class="empty-state">Fără sancțiuni.</div>';
  tasksListContainer.innerHTML = '<div class="empty-state">Fără task-uri.</div>';
}

function renderFactionDetails(mafia) {
  if (!mafia) return renderEmptyFactionView();
  
  // Set Count & Badge
  memberCountEl.innerText = mafia.members.length;
  sanctionPointsTotalEl.innerText = `WARN: ${mafia.warningsWarn || 0}/3 | AV: ${mafia.warningsAV || 0}/2`;
  
  // Type Badge style
  factionTypeBadgeEl.className = `badge badge-${mafia.type}`;
  factionTypeBadgeEl.innerText = mafia.type.toUpperCase();
  
  // Display Action Forms based on permissions
  const { role } = currentUser;
  
  if (role === 'manager' || role === 'superadmin') {
    addMemberForm.style.display = 'flex';
    addSanctionForm.style.display = 'block';
    addTaskForm.style.display = 'block';
  } else if (role === 'leader') {
    addMemberForm.style.display = 'flex';
    addSanctionForm.style.display = 'none'; // Leaders can't self-sanction
    addTaskForm.style.display = 'block';
  } else {
    // Member - Read only
    addMemberForm.style.display = 'none';
    addSanctionForm.style.display = 'none';
    addTaskForm.style.display = 'none';
  }

  // Manage Arrows Panel (Only visible for Mafias)
  if (mafia.type === 'oficiala' || mafia.type === 'neoficiala') {
    arrowsPanel.style.display = 'block';
    if (role === 'manager' || role === 'superadmin' || role === 'leader') {
      addArrowForm.style.display = 'flex';
    } else {
      addArrowForm.style.display = 'none';
    }
    renderArrows(mafia);
  } else {
    arrowsPanel.style.display = 'none';
  }
  
  // Render lists
  renderMembers(mafia);
  renderSanctions(mafia);
  renderTasks(mafia);
}

// Member Sanction State
let targetSanctionMemberId = null;
let targetSanctionMafiaId = null;

const memberSanctionModal = document.getElementById('member-sanction-modal');
const sanctionMemberNameEl = document.getElementById('sanction-member-name');

function openMemberSanctionModal(mafiaId, userId) {
  targetSanctionMafiaId = mafiaId;
  targetSanctionMemberId = userId;
  sanctionMemberNameEl.innerText = `Membru Discord ID: ${userId}`;
  document.getElementById('member-sanction-reason').value = '';
  document.getElementById('member-sanction-points').value = '1';
  memberSanctionModal.style.display = 'block';
}

function closeMemberSanctionModal() {
  memberSanctionModal.style.display = 'none';
  targetSanctionMafiaId = null;
  targetSanctionMemberId = null;
}

function renderMembers(mafia) {
  membersListContainer.innerHTML = '';
  
  const members = mafia.decoratedMembers || [];
  if (members.length === 0) {
    membersListContainer.innerHTML = '<div class="empty-state">Fără membrii.</div>';
    return;
  }
  
  // Create premium table element
  const table = document.createElement('table');
  table.className = 'premium-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th style="width: 50px;"></th>
        <th>Nume Discord</th>
        <th>Rol / Rang</th>
        <th>Status Online</th>
        <th>Sancțiuni (AV)</th>
        <th style="text-align: right;">Acțiuni</th>
      </tr>
    </thead>
    <tbody id="members-table-body"></tbody>
  `;
  
  membersListContainer.appendChild(table);
  const tbody = document.getElementById('members-table-body');
  
  members.forEach(m => {
    const memberId = m.id;
    const row = document.createElement('tr');
    
    // Check if member is founder/owner or co-leader
    const isFounder = memberId === mafia.ownerId;
    const isCoLeader = m.role === 'coleader';
    
    // Safety check: a leader/founder can be managed, sanctioned or kicked ONLY by a manager/superadmin
    const isManager = currentUser.role === 'manager' || currentUser.role === 'superadmin';
    const canKick = (isManager || currentUser.role === 'leader') && (!isFounder || isManager) && memberId !== currentUser.id;
    const canSanction = (isManager || currentUser.role === 'leader') && (!isFounder || isManager) && memberId !== currentUser.id;
    const canManageRank = (isManager || currentUser.role === 'leader') && (!isFounder || isManager) && memberId !== currentUser.id;

    
    // Render Warning Tag
    const warningTag = m.warnings > 0 
      ? `<span class="badge badge-oficiala" style="font-size: 0.72rem; padding: 3px 8px; font-weight: 800;">AV ${m.warnings}/3</span>` 
      : `<span style="color: var(--text-secondary); font-size: 0.82rem; opacity: 0.65;">Fără sancțiuni</span>`;
    
    // Online indicators (badges)
    const discordStatus = m.onlineDiscord 
      ? `<span class="badge" style="background: rgba(46,204,113,0.1); border-color: rgba(46,204,113,0.25); color: #2ecc71; font-size: 0.7rem; padding: 3px 8px; display: inline-flex; align-items: center; gap: 4px; font-weight: 700;"><span style="width: 6px; height: 6px; background: #2ecc71; border-radius: 50%;"></span> Web</span>` 
      : `<span class="badge" style="background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.05); color: var(--text-secondary); font-size: 0.7rem; padding: 3px 8px; display: inline-flex; align-items: center; gap: 4px; font-weight: 700;"><span style="width: 6px; height: 6px; background: var(--text-secondary); border-radius: 50%; opacity: 0.5;"></span> Web</span>`;
      
    const fivemStatus = m.onlineFiveM 
      ? `<span class="badge" style="background: rgba(46,204,113,0.1); border-color: rgba(46,204,113,0.25); color: #2ecc71; font-size: 0.7rem; padding: 3px 8px; display: inline-flex; align-items: center; gap: 4px; font-weight: 700;"><span style="width: 6px; height: 6px; background: #2ecc71; border-radius: 50%;"></span> FiveM</span>` 
      : `<span class="badge" style="background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.05); color: var(--text-secondary); font-size: 0.7rem; padding: 3px 8px; display: inline-flex; align-items: center; gap: 4px; font-weight: 700;"><span style="width: 6px; height: 6px; background: var(--text-secondary); border-radius: 50%; opacity: 0.5;"></span> FiveM</span>`;

    // Role tags
    let roleBadge = '<span class="badge" style="font-size: 0.7rem; padding: 3px 8px; background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.05); color: var(--text-secondary); display: inline-flex; align-items: center; gap: 4px;">👤 Membru</span>';
    if (isFounder) {
      roleBadge = '<span class="badge badge-leader" style="font-size: 0.72rem; padding: 3px 8px; font-weight: 900; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 4px;">👑 Lider</span>';
    } else if (isCoLeader) {
      roleBadge = '<span class="badge badge-neoficiala" style="font-size: 0.72rem; padding: 3px 8px; font-weight: 900; background: rgba(243,156,18,0.1); border-color: rgba(243,156,18,0.25); color: #f39c12; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 4px;">🛡️ Co-Lider</span>';
    }


    // Rank action buttons
    let rankButtonHtml = '';
    if (canManageRank) {
      if (isCoLeader) {
        rankButtonHtml = `<button class="btn-sm demote-btn" style="background: rgba(231, 76, 60, 0.12); border-color: rgba(231, 76, 60, 0.25); color: #ff7675; padding: 6px 12px; font-size: 0.75rem;" data-userid="${memberId}">Retrogradează</button>`;
      } else {
        rankButtonHtml = `<button class="btn-sm promote-btn" style="background: rgba(46, 204, 113, 0.12); border-color: rgba(46, 204, 113, 0.25); color: #55efc4; padding: 6px 12px; font-size: 0.75rem;" data-userid="${memberId}">Promovează Co-Lider</button>`;
      }
    }

    let leaderButtonHtml = '';
    if (isManager && !isFounder) {
      leaderButtonHtml = `<button class="btn-sm promote-leader-btn" style="background: rgba(139, 92, 246, 0.12); border-color: rgba(139, 92, 246, 0.25); color: #c084fc; padding: 6px 12px; font-size: 0.75rem;" data-userid="${memberId}">Promovează Lider</button>`;
    }

    row.innerHTML = `
      <td style="padding: 12px 18px;"><div class="member-avatar flex-center" style="width: 32px; height: 32px; font-size: 1rem; border-radius: 50%; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); color: var(--text-secondary);">👤</div></td>
      <td style="font-weight: 700; color: #fff; padding: 12px 18px;">${m.username || memberId}</td>
      <td style="padding: 12px 18px;">${roleBadge}</td>
      <td style="padding: 12px 18px;">
        <div style="display: flex; gap: 8px; align-items: center;">
          ${discordStatus}
          ${fivemStatus}
        </div>
      </td>
      <td style="padding: 12px 18px;">${warningTag}</td>
      <td style="text-align: right; padding: 12px 18px;">
        <div style="display: inline-flex; gap: 8px; align-items: center;">
          ${leaderButtonHtml}
          ${rankButtonHtml}

          ${canSanction ? `<button class="btn-sm sanction-member-btn" style="background: rgba(244,197,66,0.12); border-color: rgba(244,197,66,0.25); color: var(--accent-gold); padding: 6px 12px; font-size: 0.75rem;" data-userid="${memberId}">Sancționează</button>` : ''}
          ${canKick ? `<button class="btn-sm kick-btn" style="background: rgba(231, 76, 60, 0.08); border-color: rgba(231, 76, 60, 0.18); color: #ff7675; padding: 6px 12px; font-size: 0.75rem;" data-userid="${memberId}">Demitere</button>` : ''}
        </div>
      </td>
    `;
    
    tbody.appendChild(row);
  });
  
  // Event listeners for kick buttons
  document.querySelectorAll('.kick-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const userId = e.target.getAttribute('data-userid');
      showCustomKickModal(mafia.id, userId, async (kickDiscord) => {
        await kickMember(mafia.id, userId, kickDiscord);
      });
    });
  });


  // Event listeners for individual member sanction buttons
  document.querySelectorAll('.sanction-member-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const userId = e.target.getAttribute('data-userid');
      openMemberSanctionModal(mafia.id, userId);
    });
  });

  // Event listeners for promote buttons
  document.querySelectorAll('.promote-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const userId = e.target.getAttribute('data-userid');
      if (confirm('Sigur dorești să promovezi acest membru ca Co-Lider?')) {
        try {
          const res = await fetch(`/api/mafias/${mafia.id}/members/${userId}/promote`, { method: 'POST' });
          const data = await res.json();
          if (res.ok && data.success) {
            window.showToast('✅ Membrul a fost promovat ca Co-Lider!');
            loadFactions();
          } else {
            alert(data.error || 'Eroare la promovare.');
          }
        } catch (err) {
          console.error(err);
          alert('Eroare rețea.');
        }
      }
    });
  });

  // Event listeners for promote leader buttons
  document.querySelectorAll('.promote-leader-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const userId = e.target.getAttribute('data-userid');
      if (confirm(`Sigur dorești să îl promovezi pe membrul cu ID-ul ${userId} ca Lider Principal al acestei facțiuni? Această acțiune va înlocui vechiul lider.`)) {
        try {
          const res = await fetch(`/api/mafias/${mafia.id}/members/${userId}/promote-leader`, { method: 'POST' });
          const data = await res.json();
          if (res.ok && data.success) {
            window.showToast('👑 Membru promovat ca Lider Principal!');
            await refreshActiveFaction();
          } else {
            alert(`Eroare: ${data.error}`);
          }
        } catch (err) {
          console.error(err);
          alert('Eroare la promovarea liderului.');
        }
      }
    });
  });

  // Event listeners for demote buttons

  document.querySelectorAll('.demote-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const userId = e.target.getAttribute('data-userid');
      if (confirm('Sigur dorești să retrogradezi acest Co-Lider?')) {
        try {
          const res = await fetch(`/api/mafias/${mafia.id}/members/${userId}/demote`, { method: 'POST' });
          const data = await res.json();
          if (res.ok && data.success) {
            window.showToast('✅ Co-Liderul a fost retrogradat.');
            loadFactions();
          } else {
            alert(data.error || 'Eroare la retrogradare.');
          }
        } catch (err) {
          console.error(err);
          alert('Eroare rețea.');
        }
      }
    });
  });
}

function renderSanctions(mafia) {
  sanctionsListContainer.innerHTML = '';
  
  if (!mafia.sanctions || mafia.sanctions.length === 0) {
    sanctionsListContainer.innerHTML = '<div class="empty-state">Această organizație nu are nicio sancțiune activă.</div>';
    return;
  }
  
  mafia.sanctions.forEach(s => {
    const item = document.createElement('div');
    item.className = 'sanction-item';
    item.innerHTML = `
      <div>
        <div class="sanction-reason">${s.reason}</div>
        <div class="sanction-meta">Acordat de: <strong>${s.givenBy}</strong> la ${s.createdAt}</div>
      </div>
      <div class="sanction-points">${s.points} Avertismente</div>
    `;
    sanctionsListContainer.appendChild(item);
  });
}

function renderTasks(mafia) {
  tasksListContainer.innerHTML = '';
  
  if (!mafia.tasks || mafia.tasks.length === 0) {
    tasksListContainer.innerHTML = '<div class="empty-state">Nu sunt task-uri alocate momentan.</div>';
    return;
  }
  
  mafia.tasks.forEach(t => {
    const isCompleted = t.status === 'completed';
    const canManage = currentUser.role === 'manager' || currentUser.role === 'leader';
    
    const item = document.createElement('div');
    item.className = `task-item ${isCompleted ? 'completed' : ''}`;
    
    item.innerHTML = `
      <div class="task-top">
        <div>
          <div class="task-title">${t.title}</div>
          <div class="task-desc">${t.description}</div>
        </div>
        <div style="display: flex; gap: 8px;">
          ${(!isCompleted && canManage) ? `<button class="btn-sm btn-success-sm complete-task-btn" data-taskid="${t.id}">Finalizează</button>` : ''}
          ${canManage ? `<button class="btn-sm btn-danger-sm delete-task-btn" data-taskid="${t.id}">Șterge</button>` : ''}
        </div>
      </div>
      <div class="task-footer">
        <span>Creat de: <strong>${t.createdBy}</strong></span>
        <span>Data: ${t.createdAt}</span>
      </div>
    `;
    
    tasksListContainer.appendChild(item);
  });
  
  // Event listeners for tasks actions
  document.querySelectorAll('.complete-task-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const taskId = e.target.getAttribute('data-taskid');
      await completeTask(mafia.id, taskId);
    });
  });
  
  document.querySelectorAll('.delete-task-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const taskId = e.target.getAttribute('data-taskid');
      if (confirm('Sigur dorești să ștergi acest task?')) {
        await deleteTask(mafia.id, taskId);
      }
    });
  });
}

// 5. Actions Handlers
function setupActions() {
  // ── Autocomplete for member search ────────────────────────────────────────
  const memberSearchEl = document.getElementById('new-member-search');
  const memberIdHidden = document.getElementById('new-member-id');
  const memberAddBtn   = document.getElementById('add-member-btn');
  const autocompleteList = document.getElementById('new-member-autocomplete-list');

  let acDebounce = null;
  if (memberSearchEl) {
    memberSearchEl.addEventListener('input', () => {
      clearTimeout(acDebounce);
      const q = memberSearchEl.value.trim();
      if (q.length < 2) { autocompleteList.style.display = 'none'; return; }
      acDebounce = setTimeout(async () => {
        const res = await fetch(`/api/guild-members?q=${encodeURIComponent(q)}`);
        const members = await res.json();
        autocompleteList.innerHTML = '';
        if (members.length === 0) { autocompleteList.style.display = 'none'; return; }
        members.forEach(m => {
          const item = document.createElement('div');
          item.className = 'autocomplete-item';
          item.innerHTML = `
            <img class="autocomplete-avatar" src="${m.avatar}" onerror="this.src=''" style="width:28px;height:28px;border-radius:50%;">
            <div>
              <div style="font-weight:600;font-size:.88rem;">${m.displayName}</div>
              <div style="font-size:.72rem;color:#a0a0b0;">@${m.username} &bull; ID: ${m.id}</div>
            </div>
          `;
          item.addEventListener('click', () => {
            memberSearchEl.value = `${m.displayName} (@${m.username})`;
            memberIdHidden.value = m.id;
            memberAddBtn.disabled = false;
            autocompleteList.style.display = 'none';
          });
          autocompleteList.appendChild(item);
        });
        autocompleteList.style.display = 'block';
      }, 280);
    });

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
      if (!memberSearchEl.contains(e.target) && !autocompleteList.contains(e.target)) {
        autocompleteList.style.display = 'none';
      }
    });
  }

  // Add Member
  document.getElementById('add-member-btn').addEventListener('click', async () => {
    const userId = memberIdHidden ? memberIdHidden.value.trim() : '';
    if (!userId) return alert('Selectează un membru din lista de sugestii.');
    try {
      const response = await fetch(`/api/mafias/${activeFaction.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await response.json();
      if (response.ok) {
        if (memberSearchEl) memberSearchEl.value = '';
        if (memberIdHidden) memberIdHidden.value = '';
        if (memberAddBtn) memberAddBtn.disabled = true;
        alert('Membru adăugat cu succes!');
        await refreshActiveFaction();
      } else {
        alert(`Eroare: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Eroare la adăugarea membrului.');
    }
  });
  
  // Add Sanction
  document.getElementById('submit-sanction-btn').addEventListener('click', async () => {
    const reasonEl = document.getElementById('sanction-reason');
    const reason = reasonEl.value.trim();
    const type = sanctionTypeEl.value;
    
    if (!reason || !type) return alert('Introdu motivul și selectează tipul.');
    
    try {
      const response = await fetch(`/api/mafias/${activeFaction.id}/sanctions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, type })
      });
      
      const data = await response.json();
      if (response.ok) {
        reasonEl.value = '';
        if (data.disbanded) {
          alert('Facțiunea a acumulat 3/3 WARN-uri și a fost DESFIINȚATĂ AUTOMAT de pe server și Discord!');
          location.reload();
        } else {
          alert('Sancțiune acordată cu succes!');
          await refreshActiveFaction();
          await fetchStats(); // update global stats counter
        }
      } else {
        alert(`Eroare: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Eroare la adăugarea sancțiunii.');
    }
  });
  
  // Add Task
  document.getElementById('submit-task-btn').addEventListener('click', async () => {
    const titleEl = document.getElementById('task-title');
    const descEl = document.getElementById('task-desc');
    const title = titleEl.value.trim();
    const description = descEl.value.trim();
    
    if (!title || !description) return alert('Te rog introdu titlul și descrierea.');
    
    try {
      const response = await fetch(`/api/mafias/${activeFaction.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description })
      });
      
      const data = await response.json();
      if (response.ok) {
        titleEl.value = '';
        descEl.value = '';
        alert('Task alocat cu succes!');
        await refreshActiveFaction();
        await fetchStats();
      } else {
        alert(`Eroare: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Eroare la adăugarea task-ului.');
    }
  });

  // Cancel Member Sanction Modal
  document.getElementById('cancel-member-sanction-btn').addEventListener('click', () => {
    closeMemberSanctionModal();
  });

  // Confirm Member Sanction Modal
  document.getElementById('confirm-member-sanction-btn').addEventListener('click', async () => {
    const reason = document.getElementById('member-sanction-reason').value.trim();
    const points = document.getElementById('member-sanction-points').value;
    
    if (!reason || !points) return alert('Te rog introdu motivul și numărul de puncte.');
    
    try {
      const response = await fetch(`/api/mafias/${targetSanctionMafiaId}/members/${targetSanctionMemberId}/sanction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, points })
      });
      
      const data = await response.json();
      if (response.ok) {
        alert(data.autoKicked ? 'Membrul a acumulat 3/3 AV și a fost DEMIS automat!' : 'Sancțiune acordată cu succes!');
        closeMemberSanctionModal();
        await refreshActiveFaction();
        await fetchStats();
      } else {
        alert(`Eroare: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Eroare la trimiterea sancțiunii.');
    }
  });

  // Add Arrow Click Handler
  document.getElementById('add-arrow-btn').addEventListener('click', async () => {
    const name = newArrowNameEl.value.trim();
    const fivemId = newArrowIdEl.value.trim();
    
    if (!name || !fivemId) return alert('Te rog introdu numele și ID-ul de pe server.');
    
    try {
      const response = await fetch(`/api/mafias/${activeFaction.id}/arrows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, fivemId })
      });
      
      const data = await response.json();
      if (response.ok) {
        newArrowNameEl.value = '';
        newArrowIdEl.value = '';
        alert('Săgeată adăugată cu succes!');
        await refreshActiveFaction();
      } else {
        alert(`Eroare: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Eroare la adăugarea săgeții.');
    }
  });

  // Edit Faction Modal Controls
  const editFactionModal = document.getElementById('edit-faction-modal');
  
  document.getElementById('edit-faction-btn').addEventListener('click', () => {
    if (!activeFaction) return alert('Selectează o organizație mai întâi!');
    document.getElementById('edit-faction-name').value = activeFaction.name;
    document.getElementById('edit-faction-type').value = activeFaction.type;
    document.getElementById('edit-faction-owner').value = activeFaction.ownerId;
    editFactionModal.style.display = 'block';
  });

  document.getElementById('cancel-edit-faction-btn').addEventListener('click', () => {
    editFactionModal.style.display = 'none';
  });

  document.getElementById('confirm-edit-faction-btn').addEventListener('click', async () => {
    const name = document.getElementById('edit-faction-name').value.trim();
    const type = document.getElementById('edit-faction-type').value;
    const ownerId = document.getElementById('edit-faction-owner').value.trim();
    
    if (!name || !type || !ownerId) return alert('Toate câmpurile sunt obligatorii.');
    
    try {
      const response = await fetch(`/api/mafias/${activeFaction.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, ownerId })
      });
      
      const data = await response.json();
      if (response.ok) {
        alert('Organizație editată cu succes!');
        editFactionModal.style.display = 'none';
        
        // Reload all factions from API
        await loadFactionsData();
      } else {
        alert(`Eroare: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Eroare la editarea organizației.');
    }
  });

  // Delete Faction Button
  document.getElementById('delete-faction-btn').addEventListener('click', async () => {
    if (!activeFaction) return alert('Selectează o organizație mai întâi!');
    
    const confirmDelete = confirm(`Ești ABSOLUT sigur că vrei să desființezi organizația "${activeFaction.name}" definitiv?\n` +
      `Această acțiune va șterge toate rolurile, categoriile și canalele de pe Discord!`);
      
    if (!confirmDelete) return;
    
    try {
      const response = await fetch(`/api/mafias/${activeFaction.id}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      if (response.ok) {
        alert('Organizație desființată cu succes de pe site și Discord!');
        location.reload(); // Reload dashboard to clear everything and refresh
      } else {
        alert(`Eroare: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Eroare la desființarea organizației.');
    }
  });
}

function showCustomKickModal(mafiaId, userId, callback) {
  // Check if modal already exists
  let modal = document.getElementById('custom-kick-modal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'custom-kick-modal';
  modal.className = 'modal-overlay open';
  modal.innerHTML = `
    <div class="modal-box glass-panel" style="max-width: 440px; padding: 28px; text-align: center; background: rgba(10, 10, 18, 0.95); border: 1px solid rgba(255,255,255,0.08); box-shadow: var(--shadow-lg); border-radius: 16px;">
      <h3 style="font-size: 1.3rem; font-weight: 800; color: #ff7675; margin-bottom: 12px; display: flex; align-items: center; justify-content: center; gap: 8px;">
        ⚠️ DEMITERE MEMBRU
      </h3>
      <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 24px; line-height: 1.5;">
        Alege cum dorești să aplici demiterea pentru membrul cu ID-ul Discord <strong style="color: #fff;"><span id="kick-user-display">${userId}</span></strong>:
      </p>

      <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px;">
        <button id="kick-only-roles" class="btn-action" style="width: 100%; padding: 12px; font-size: 0.85rem; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255,255,255,0.08); color: #fff; cursor: pointer; border-radius: 8px;">
          🚫 Doar scoate gradele (Rămâne pe Discord)
        </button>
        <button id="kick-from-server" class="btn-action" style="width: 100%; padding: 12px; font-size: 0.85rem; background: rgba(231, 76, 60, 0.15); border: 1px solid rgba(231, 76, 60, 0.3); color: #ff7675; cursor: pointer; border-radius: 8px;">
          🚨 Scoate gradele + Kick de pe Discord
        </button>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 10px;">
        <button id="kick-cancel" class="btn-action" style="background: transparent; border: none; color: var(--text-secondary); padding: 8px 16px; cursor: pointer; font-weight: 700;">
          Anulează
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Event listeners
  document.getElementById('kick-only-roles').addEventListener('click', () => {
    modal.classList.remove('open');
    setTimeout(() => modal.remove(), 300);
    callback(false); // kickDiscord = false
  });

  document.getElementById('kick-from-server').addEventListener('click', () => {
    modal.classList.remove('open');
    setTimeout(() => modal.remove(), 300);
    callback(true); // kickDiscord = true
  });

  document.getElementById('kick-cancel').addEventListener('click', () => {
    modal.classList.remove('open');
    setTimeout(() => modal.remove(), 300);
  });
}

async function kickMember(mafiaId, userId, kickDiscord) {
  try {
    const response = await fetch(`/api/mafias/${mafiaId}/members/${userId}?kickDiscord=${kickDiscord}`, {
      method: 'DELETE'
    });
    const data = await response.json();
    if (response.ok) {
      window.showToast('✅ Membru demis cu succes!');
      await refreshActiveFaction();
    } else {
      alert(`Eroare: ${data.error}`);
    }
  } catch (err) {
    console.error(err);
    alert('Eroare la demiterea membrului.');
  }
}


async function completeTask(mafiaId, taskId) {
  try {
    const response = await fetch(`/api/mafias/${mafiaId}/tasks/${taskId}/complete`, {
      method: 'POST'
    });
    const data = await response.json();
    if (response.ok) {
      await refreshActiveFaction();
    } else {
      alert(`Eroare: ${data.error}`);
    }
  } catch (err) {
    console.error(err);
  }
}

async function deleteTask(mafiaId, taskId) {
  try {
    const response = await fetch(`/api/mafias/${mafiaId}/tasks/${taskId}`, {
      method: 'DELETE'
    });
    const data = await response.json();
    if (response.ok) {
      await refreshActiveFaction();
      await fetchStats();
    } else {
      alert(`Eroare: ${data.error}`);
    }
  } catch (err) {
    console.error(err);
  }
}

// Helpers
async function refreshActiveFaction() {
  try {
    const response = await fetch('/api/mafias');
    if (!response.ok) return;
    allFactions = await response.json();
    
    // Find active mafia updated data
    activeFaction = allFactions.find(f => f.id === activeFaction.id);
    renderFactionDetails(activeFaction);
  } catch (err) {
    console.error('Error refreshing active faction:', err);
  }
}

function renderArrows(mafia) {
  arrowsListContainer.innerHTML = '';
  const arrows = mafia.arrows || [];
  arrowCountEl.innerText = arrows.length;
  
  if (arrows.length === 0) {
    arrowsListContainer.innerHTML = '<div class="empty-state">Nicio săgeată înregistrată.</div>';
    return;
  }
  
  arrows.forEach(a => {
    const item = document.createElement('div');
    item.className = 'member-item';
    
    const canDelete = currentUser.role === 'manager' || currentUser.role === 'superadmin' || currentUser.role === 'leader';
    
    item.innerHTML = `
      <div class="member-details">
        <div class="member-avatar flex-center" style="background: rgba(211, 84, 0, 0.1); color: #d35400;">🏹</div>
        <div>
          <div class="member-id">${a.name}</div>
          <div style="font-size: 0.75rem; color: var(--text-secondary);">
            ID Server FiveM: **${a.fivemId}** | Adăugat de: <strong>${a.addedBy}</strong>
          </div>
        </div>
      </div>
      <div>
        ${canDelete ? `<button class="btn-sm btn-danger-sm delete-arrow-btn" style="background: rgba(231, 76, 60, 0.1);" data-arrowid="${a.id}">Șterge</button>` : ''}
      </div>
    `;
    
    arrowsListContainer.appendChild(item);
  });
  
  // Event listeners for delete buttons
  document.querySelectorAll('.delete-arrow-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const arrowId = e.target.getAttribute('data-arrowid');
      if (confirm('Sigur dorești să ștergi această săgeată?')) {
        await deleteArrow(mafia.id, arrowId);
      }
    });
  });
}

async function deleteArrow(mafiaId, arrowId) {
  try {
    const response = await fetch(`/api/mafias/${mafiaId}/arrows/${arrowId}`, {
      method: 'DELETE'
    });
    const data = await response.json();
    if (response.ok) {
      alert('Săgeată eliminată cu succes!');
      await refreshActiveFaction();
    } else {
      alert(`Eroare: ${data.error}`);
    }
  } catch (err) {
    console.error(err);
    alert('Eroare la eliminarea săgeții.');
  }
}

// ════════════════════════════════════════════════════════════
// ALL FACTIONS GRID
// ════════════════════════════════════════════════════════════
async function renderAllFactionsGrid() {
  const grid = document.getElementById('all-factions-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="empty-state">Se încarcă...</div>';

  try {
    const res = await fetch('/api/mafias');
    if (!res.ok) { grid.innerHTML = '<div class="empty-state">Eroare la încărcare.</div>'; return; }
    const factions = await res.json();
    allFactions = factions;

    if (factions.length === 0) {
      grid.innerHTML = '<div class="empty-state">Nicio organizație înregistrată încă.</div>';
      return;
    }

    grid.innerHTML = '';
    factions.forEach(f => {
      const typeIcon  = f.type === 'gang' ? '🔫' : f.type === 'oficiala' ? '⚔️' : '🔹';
      const typeLabel = f.type === 'gang' ? 'Gang' : f.type === 'oficiala' ? 'Mafie Oficială' : 'Mafie Neoficială';
      const warnColor = (f.warningsWarn || 0) >= 2 ? '#e74c3c' : (f.warningsWarn || 0) >= 1 ? '#f39c12' : '#2ecc71';

      const card = document.createElement('div');
      card.className = 'faction-card';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
          <span style="font-size:1.8rem;">${typeIcon}</span>
          <span class="badge badge-${f.type}" style="font-size:.7rem;">${typeLabel.toUpperCase()}</span>
        </div>
        <div class="faction-card-title">${f.name}</div>
        <div class="faction-card-meta">
          <span>👤 ${f.members.length} membri</span>
          <span style="color:${warnColor};">WARN ${f.warningsWarn||0}/3</span>
          <span>AV ${f.warningsAV||0}/2</span>
          ${f.channels?.arrows ? '<span style="color:#d35400;">🏹 Are Săgeți</span>' : ''}
        </div>
        <div class="faction-card-stats">
          <div class="fc-stat"><div class="fc-stat-num">${f.members.length}</div><div class="fc-stat-lbl">Membri</div></div>
          <div class="fc-stat"><div class="fc-stat-num">${(f.tasks||[]).length}</div><div class="fc-stat-lbl">Task-uri</div></div>
          <div class="fc-stat"><div class="fc-stat-num">${(f.arrows||[]).length}</div><div class="fc-stat-lbl">Săgeți</div></div>
        </div>
      `;
      card.addEventListener('click', () => openFactionModal(f));
      grid.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    grid.innerHTML = '<div class="empty-state">Eroare la încărcare.</div>';
  }
}

// ════════════════════════════════════════════════════════════
// FACTION DETAIL MODAL
// ════════════════════════════════════════════════════════════
function openFactionModal(f) {
  const modal = document.getElementById('faction-detail-modal');
  if (!modal) return;

  const typeIcon = f.type === 'gang' ? '🔫' : f.type === 'oficiala' ? '⚔️' : '🔹';
  const typeLabel = f.type === 'gang' ? 'Gang' : f.type === 'oficiala' ? 'Mafie Oficială' : 'Mafie Neoficială';

  document.getElementById('fdm-type-icon').textContent = typeIcon;
  document.getElementById('fdm-name').textContent = f.name;
  document.getElementById('fdm-sub').textContent = `${typeLabel} • ${f.members.length} membri activi`;
  document.getElementById('fdm-badge').textContent = f.type.toUpperCase();
  document.getElementById('fdm-badge').className = `badge badge-${f.type}`;
  document.getElementById('fdm-members').textContent = f.members.length;
  document.getElementById('fdm-warn').textContent = `${f.warningsWarn||0}/3`;
  document.getElementById('fdm-av').textContent = `${f.warningsAV||0}/2`;
  document.getElementById('fdm-tasks').textContent = (f.tasks||[]).length;

  // Members list
  const membersList = document.getElementById('fdm-members-list');
  if ((f.decoratedMembers || []).length === 0) {
    membersList.innerHTML = '<div class="empty-state">Niciun membru.</div>';
  } else {
    membersList.innerHTML = '';
    f.decoratedMembers.forEach(m => {
      const isLeader = m.id === f.ownerId;
      const row = document.createElement('div');
      row.className = 'modal-member-row';
      row.innerHTML = `
        <div class="modal-member-avatar">👤</div>
        <div style="flex:1;">
          <div class="modal-member-name">
            ${m.username || m.id}
            ${isLeader ? '<span class="badge badge-leader" style="font-size:.65rem;margin-left:6px;">Lider</span>' : ''}
            ${m.warnings > 0 ? `<span class="badge badge-oficiala" style="font-size:.62rem;margin-left:5px;">AV ${m.warnings}/3</span>` : ''}
          </div>
          <div class="modal-member-id">Discord ID: ${m.id}</div>
          ${m.ingameName ? `<div class="modal-ingame">🎮 ${m.ingameName} • CFX: ${m.cfxId || 'N/A'}</div>` : '<div style="font-size:.72rem;color:#e67e22;">Profil in-game nelegat</div>'}
        </div>
        <div style="display:flex;gap:6px;flex-direction:column;align-items:flex-end;">
          ${m.onlineFiveM ? '<span class="ingame-badge">🎮 FiveM</span>' : ''}
          ${m.onlineDiscord ? '<span class="ingame-badge">🌐 Web</span>' : ''}
        </div>
      `;
      membersList.appendChild(row);
    });
  }

  // Arrows list (mafias only)
  const arrowsSection = document.getElementById('fdm-arrows-section');
  const arrowsList    = document.getElementById('fdm-arrows-list');
  if (f.type !== 'gang' && (f.arrows||[]).length > 0) {
    arrowsSection.style.display = 'block';
    arrowsList.innerHTML = '';
    f.arrows.forEach((a, idx) => {
      const row = document.createElement('div');
      row.className = 'modal-member-row';
      row.innerHTML = `
        <div class="modal-member-avatar" style="background:rgba(211,84,0,.1);color:#d35400;">🏹</div>
        <div>
          <div class="modal-member-name">${a.name}</div>
          <div class="modal-member-id">Discord ID: ${a.discordId} • Adăugat de: ${a.addedBy}</div>
        </div>
      `;
      arrowsList.appendChild(row);
    });
  } else {
    arrowsSection.style.display = 'none';
    arrowsList.innerHTML = '';
  }

  modal.classList.add('open');
}

document.getElementById('faction-modal-close')?.addEventListener('click', () => {
  document.getElementById('faction-detail-modal')?.classList.remove('open');
});
document.getElementById('faction-detail-modal')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('faction-detail-modal')) {
    document.getElementById('faction-detail-modal').classList.remove('open');
  }
});

// ════════════════════════════════════════════════════════════
// ONLINE PLAYERS TAB
// ════════════════════════════════════════════════════════════
async function renderOnlinePlayers() {
  const container = document.getElementById('online-players-list-container');
  if (!container) return;
  container.innerHTML = '<div class="empty-state">Se încarcă...</div>';

  try {
    const res = await fetch('/api/online-players');
    const players = await res.json();

    if (players.length === 0) {
      container.innerHTML = '<div class="empty-state">Niciun membru conectat pe server în acest moment.</div>';
      return;
    }

    container.innerHTML = '';
    players.forEach(p => {
      const row = document.createElement('div');
      row.className = 'online-player-row';
      row.innerHTML = `
        <div class="online-dot"></div>
        <img src="${p.avatar || ''}" onerror="this.style.display='none'" style="width:38px;height:38px;border-radius:50%;object-fit:cover;">
        <div style="flex:1;">
          <div style="font-weight:700;font-size:.95rem;">${p.username}</div>
          <div style="font-size:.78rem;color:#a0a0b0;">
            ${p.factionName} • ${p.isOwner ? 'Lider' : 'Membru'}
            ${p.ingameName ? ` • 🎮 ${p.ingameName} (CFX: ${p.cfxId})` : ''}
          </div>
        </div>
        <div style="display:flex;gap:6px;">
          ${p.onFiveM ? '<span class="ingame-badge">🎮 FiveM</span>' : ''}
          ${p.onWeb ? '<span class="ingame-badge">🌐 Dashboard</span>' : ''}
        </div>
      `;
      container.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = '<div class="empty-state">Eroare la încărcare.</div>';
  }
}

// ════════════════════════════════════════════════════════════
// AUDIT LOGS TAB
// ════════════════════════════════════════════════════════════
async function renderAuditLogs() {
  const container = document.getElementById('audit-logs-list-container');
  if (!container) return;
  container.innerHTML = '<div class="empty-state">Se încarcă...</div>';

  try {
    const res = await fetch('/api/logs');
    const logs = await res.json();

    if (logs.length === 0) {
      container.innerHTML = '<div class="empty-state">Fără activități înregistrate încă.</div>';
      return;
    }

    container.innerHTML = '';
    logs.forEach(l => {
      const entry = document.createElement('div');
      entry.className = 'log-entry';
      entry.innerHTML = `
        <div class="log-time">${l.timestamp || ''}</div>
        <div>
          <div class="log-action">${l.action}</div>
          <div class="log-detail">${l.details} <span style="color:#666;">— ${l.user}</span></div>
        </div>
      `;
      container.appendChild(entry);
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = '<div class="empty-state">Eroare la încărcare.</div>';
  }
}

// ════════════════════════════════════════════════════════════
// SUPERADMIN EXTRAS (settings tab, ingame profile banner)
// ════════════════════════════════════════════════════════════
function setupSuperadminExtras() {
  // Show settings tab only for superadmin
  if (currentUser.role === 'superadmin') {
    const settingsMenu = document.getElementById('menu-settings');
    if (settingsMenu) settingsMenu.style.display = 'flex';
  }

  // Load settings + populate dropdowns when settings tab is navigated to
  const menuSettingsBtn = document.getElementById('menu-settings');
  if (menuSettingsBtn) {
    menuSettingsBtn.addEventListener('click', loadSettingsDropdowns);
  }

  // Hook up save button
  const saveBtn = document.getElementById('save-settings-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const guildId      = document.getElementById('settings-guild-id')?.value?.trim() || '';
      const staffRoleId  = document.getElementById('settings-staff-role')?.value?.trim() || '';
      const managerRoleId= document.getElementById('settings-manager-role')?.value?.trim() || '';
      const logsChannelId= document.getElementById('settings-logs-channel')?.value?.trim() || '';
      const setupChannelId=document.getElementById('settings-setup-channel')?.value?.trim() || '';

      if (!guildId) return alert('Guild ID este obligatoriu!');

      saveBtn.disabled = true;
      saveBtn.innerText = 'Se salvează...';
      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guildId,
            managerRoleId: staffRoleId,
            logsChannelId,
            setupChannelId,
            zoneCategoryId: ''
          })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          window.showToast('✅ Setările au fost salvate cu succes!');
        } else {
          alert(data.error || 'Eroare la salvare.');
        }
      } catch (err) {
        alert('Eroare rețea la salvare.');
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = 'Salvează Setările';
      }
    });
  }

  // If user has no in-game profile, show a soft banner
  const db_profile_check = async () => {
    const me = await fetch('/api/me').then(r => r.json());
    if (!me.ingameName) {
      const banner = document.createElement('div');
      banner.style.cssText = 'background:rgba(241,196,15,.12);border:1px solid rgba(241,196,15,.3);border-radius:10px;padding:12px 18px;margin-bottom:18px;display:flex;align-items:center;gap:12px;cursor:pointer;';
      banner.innerHTML = `
        <span style="font-size:1.3rem;">🎮</span>
        <div style="flex:1;">
          <div style="font-weight:700;color:#f1c40f;font-size:.9rem;">Profil in-game nelegat!</div>
          <div style="font-size:.8rem;color:#a0a0b0;">Apasă aici pentru a-ți lega contul de joc (Nume + ID CFX). Astfel vei putea fi văzut în jucătorii online.</div>
        </div>
        <span style="color:#f1c40f;font-size:1.1rem;">→</span>
      `;
      banner.addEventListener('click', () => openIngameProfileModal());
      const mainContent = document.querySelector('.main-content');
      const header = document.querySelector('.header-container');
      if (mainContent && header) mainContent.insertBefore(banner, header.nextSibling);
    }
  };
  db_profile_check();
}

async function loadSettingsDropdowns() {
  // Load current settings first
  try {
    const statsRes = await fetch('/api/stats');
    if (statsRes.ok) {
      const stats = await statsRes.json();
      const s = stats.settings || {};
      if (s.guildId) document.getElementById('settings-guild-id').value = s.guildId;
    }
  } catch {}

  // Hide loading spinners
  const hideLoading = () => {
    ['settings-staff-role-loading','settings-manager-role-loading','settings-logs-loading','settings-setup-loading'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  };

  try {
    const res = await fetch('/api/discord/meta');
    if (!res.ok) throw new Error('Acces interzis sau eroare server.');
    const { roles, channels } = await res.json();

    // Helper to populate a select
    const fillSelect = (selectId, items, currentVal) => {
      const sel = document.getElementById(selectId);
      if (!sel) return;
      sel.innerHTML = '<option value="">— Selectează —</option>';
      items.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.id;
        opt.textContent = item.name;
        if (item.id === currentVal) opt.selected = true;
        sel.appendChild(opt);
      });
    };

    // Load saved values for pre-selection
    const statsRes = await fetch('/api/stats');
    const stats = statsRes.ok ? await statsRes.json() : {};
    const s = stats.settings || {};

    fillSelect('settings-staff-role', roles, s.managerRoleId);
    fillSelect('settings-manager-role', roles, s.managerRoleId);
    fillSelect('settings-logs-channel', channels, s.logsChannelId);
    fillSelect('settings-setup-channel', channels, s.setupChannelId);

    hideLoading();
  } catch (err) {
    console.error('[Settings] Failed to load Discord meta:', err);
    // Fall back: hide spinners and let user manually type in a text fallback
    hideLoading();
    window.showToast('⚠️ Nu s-au putut încărca datele Discord. Reîncearcă.');
  }
}

// ── Ingame profile mini-modal ─────────────────────────────
function openIngameProfileModal() {
  // Create modal on the fly if it doesn't exist
  let modal = document.getElementById('ingame-profile-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'ingame-profile-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-box" style="max-width:450px;">
        <button class="modal-close-btn" onclick="document.getElementById('ingame-profile-modal').classList.remove('open')">✕</button>
        <div class="modal-title" style="margin-bottom:6px;">🎮 Leagă-ți Contul de Joc</div>
        <div class="modal-sub">Completează datele tale din FiveM. Acestea vor aparea la manageri în panelul jucătorilor online.</div>

        <div class="form-group" style="margin-bottom:14px;">
          <label>Nume In-Game (exact cum apare pe server)</label>
          <input type="text" id="igp-name" class="input-field" placeholder="Ex: Andrei Ionescu" style="margin-bottom:0;">
        </div>
        <div class="form-group" style="margin-bottom:20px;">
          <label>ID CFX (din F8 pe server: identifiers)</label>
          <input type="text" id="igp-cfx" class="input-field" placeholder="Ex: 123456" style="margin-bottom:0;">
        </div>
        <button id="igp-save-btn" class="btn-action" style="width:100%;">Salvează Profilul</button>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('igp-save-btn').addEventListener('click', async () => {
      const ingameName = document.getElementById('igp-name').value.trim();
      const cfxId = document.getElementById('igp-cfx').value.trim();
      if (!ingameName || !cfxId) return alert('Completează ambele câmpuri.');

      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingameName, cfxId })
      });
      const data = await res.json();
      if (res.ok) {
        alert('Profil salvat! Acum vei apărea în lista jucătorilor online.');
        modal.classList.remove('open');
        location.reload();
      } else {
        alert(`Eroare: ${data.error}`);
      }
    });
  }
  modal.classList.add('open');
}

// ── Faction Leaderboard Rendering ─────────────────────────
async function renderLeaderboard() {
  const body = document.getElementById('leaderboard-body');
  if (!body) return;

  body.innerHTML = '<tr><td colspan="6" class="empty-state" style="padding: 24px;">Se încarcă clasamentul...</td></tr>';

  try {
    const res = await fetch('/api/mafias');
    if (!res.ok) throw new Error();
    const factions = await res.json();

    if (factions.length === 0) {
      body.innerHTML = '<tr><td colspan="6" class="empty-state" style="padding: 24px;">Nicio facțiune înregistrată.</td></tr>';
      return;
    }

    // Decorate score: (Completed Tasks * 10) - (Warns * 15) - (AVs * 5) + (Member Count * 2)
    const scored = factions.map(f => {
      const warns = f.warningsWarn || 0;
      const avs = f.warningsAV || 0;
      const membersCount = f.members ? f.members.length : 0;
      
      // Filter tasks where status is completed (done)
      const completedTasks = f.tasks ? f.tasks.filter(t => t.completed).length : 0;
      
      const score = (completedTasks * 10) - (warns * 15) - (avs * 5) + (membersCount * 2);
      
      return { ...f, score, completedTasks, warns, avs, membersCount };
    });

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    body.innerHTML = scored.map((f, idx) => {
      let typeBadge = '';
      if (f.type === 'oficiala') typeBadge = '<span class="badge badge-leader" style="background:#ff4757;">Oficială</span>';
      else if (f.type === 'neoficiala') typeBadge = '<span class="badge badge-leader" style="background:#70a1ff;">Neoficială</span>';
      else if (f.type === 'gang') typeBadge = '<span class="badge badge-leader" style="background:#2ed573;">Gang</span>';

      let medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1;

      return `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.03); font-size: 0.95rem; vertical-align: middle;">
          <td style="padding: 16px; font-weight: 900; font-size: 1.15rem; color: var(--accent-gold);">${medal}</td>
          <td style="padding: 16px; font-weight: 700; color: #fff;">${f.name}</td>
          <td style="padding: 16px;">${typeBadge}</td>
          <td style="padding: 16px; text-align: center; font-weight: 700;">${f.membersCount} membri</td>
          <td style="padding: 16px; text-align: center; color: var(--accent-red); font-weight: 700;">${f.warns}/3 WARN | ${f.avs}/2 AV</td>
          <td style="padding: 16px; text-align: center; font-weight: 800; font-size: 1.05rem; color: var(--accent-gold);">${f.score} pct</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
    body.innerHTML = '<tr><td colspan="6" class="empty-state" style="padding: 24px; color: var(--accent-red);">Eroare la încărcarea clasamentului.</td></tr>';
  }
}

// ── Faction Activities & Scheduler ─────────────────────────
async function renderActivities() {
  const container = document.getElementById('activities-list-container');
  const factionSelectGroup = document.getElementById('act-faction-select-group');
  const factionSelect = document.getElementById('act-faction-id');
  const scheduleBtn = document.getElementById('btn-schedule-activity');

  if (!container) return;

  container.innerHTML = '<div class="empty-state">Se încarcă evenimentele...</div>';

  // Toggle faction select for Manager
  if (currentUser.role === 'manager' || currentUser.role === 'superadmin') {
    if (factionSelectGroup) factionSelectGroup.style.display = 'block';
    
    // Populate Factions select list if empty
    if (factionSelect && factionSelect.options.length <= 1) {
      try {
        const res = await fetch('/api/mafias');
        if (res.ok) {
          const factions = await res.json();
          factions.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.id;
            opt.innerText = f.name;
            factionSelect.appendChild(opt);
          });
        }
      } catch (err) {
        console.error(err);
      }
    }
  } else {
    if (factionSelectGroup) factionSelectGroup.style.display = 'none';
  }

  // Load activities list
  try {
    const res = await fetch('/api/activities');
    if (!res.ok) throw new Error();
    const activities = await res.json();

    // Filter by faction context if leader
    let filtered = activities;
    if (currentUser.role === 'leader') {
      filtered = activities.filter(a => a.mafiaId === currentUser.mafiaId || !a.mafiaId);
    }

    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty-state">Niciun eveniment programat.</div>';
    } else {
      // Sort upcoming events first
      filtered.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

      container.innerHTML = filtered.map(a => {
        const icons = {
          'sedinta': '📅',
          'antrenament': '💪',
          'war': '⚔️',
          'special': '⭐'
        };
        const icon = icons[a.type] || '📅';

        // Format Date
        let dateStr = a.dateTime;
        try {
          const d = new Date(a.dateTime);
          dateStr = d.toLocaleString('ro-RO', { dateStyle: 'medium', timeStyle: 'short' });
        } catch (e) {}

        const tagColor = a.type === 'war' ? '#ff4757' : a.type === 'antrenament' ? '#2ed573' : '#f1c40f';

        return `
          <div class="member-row" style="padding: 16px; border-radius: 10px; background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.03); display: flex; flex-direction: column; align-items: flex-start; gap: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.4rem;">${icon}</span>
                <div>
                  <div style="font-weight: 800; font-size: 1rem; color: #fff;">${a.title}</div>
                  <div style="font-size: 0.72rem; color: var(--text-secondary);">Organizat de: <strong>${a.createdBy}</strong> pentru <strong>${a.mafiaName}</strong></div>
                </div>
              </div>
              <span class="badge" style="background: ${tagColor}; border-color: ${tagColor}; font-size: 0.65rem; color: #fff; text-transform: uppercase;">${a.type}</span>
            </div>
            
            <p style="font-size: 0.88rem; color: var(--text-secondary); line-height: 1.5; margin: 4px 0;">${a.description || 'Fără detalii suplimentare.'}</p>
            
            <div style="display: flex; justify-content: space-between; width: 100%; align-items: center; border-top: 1px solid rgba(255,255,255,0.03); padding-top: 8px; margin-top: 4px;">
              <span style="font-size: 0.8rem; color: var(--accent-gold); font-weight: 700;">⏳ Data: ${dateStr}</span>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = '<div class="empty-state">Eroare la încărcarea evenimentelor.</div>';
  }

  // Hook Schedule Button once
  if (scheduleBtn && !scheduleBtn.dataset.hooked) {
    scheduleBtn.dataset.hooked = 'true';
    scheduleBtn.addEventListener('click', async () => {
      const title = document.getElementById('act-title').value.trim();
      const description = document.getElementById('act-desc').value.trim();
      const type = document.getElementById('act-type').value;
      const dateTime = document.getElementById('act-date').value;
      const targetFactionId = factionSelect ? factionSelect.value : '';

      if (!title || !dateTime) {
        return alert('Titlul și Data/Ora sunt obligatorii!');
      }

      window.showToast('Trimitere eveniment pe Discord...');

      try {
        const response = await fetch('/api/activities', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ title, description, type, dateTime, targetFactionId })
        });

        const resData = await response.json();
        if (response.ok && resData.success) {
          window.showToast('✅ Eveniment programat și trimis pe Discord!');
          // Clear inputs
          document.getElementById('act-title').value = '';
          document.getElementById('act-desc').value = '';
          document.getElementById('act-date').value = '';
          renderActivities();
        } else {
          alert(resData.error || 'Trimiterea a eșuat.');
        }
      } catch (err) {
        alert('Eroare la programare.');
      }
    });
  }
}

// ── Dashboard Support Ticket Handler ──────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Listen for clicks on dashboard staff cards
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.dashboard-staff-card');
    if (!card) return;

    const id = card.getAttribute('data-id');
    const name = card.getAttribute('data-name');
    if (!id || !name) return;

    // Auto-fill admin destination
    document.getElementById('db-support-admin-id').value = id;
    document.getElementById('db-support-admin-name').value = name;
    document.getElementById('db-support-details').value = '';

    // Auto-fill logged-in user info (from session - no manual input needed)
    const userName = currentUser ? (currentUser.nickname || currentUser.username || 'Utilizator') : 'Utilizator';
    const userId = currentUser ? currentUser.id : '';
    document.getElementById('db-support-user-name').value = userName;
    document.getElementById('db-support-user-id').value = userId;
    const fromDisplay = document.getElementById('db-support-from-display');
    if (fromDisplay) fromDisplay.value = `${userName} (${userId})`;
    
    document.getElementById('dashboard-support-modal').classList.add('open');
  });

  // Close modal
  const closeBtn = document.getElementById('db-support-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      document.getElementById('dashboard-support-modal').classList.remove('open');
    });
  }

  // Submit ticket
  const submitBtn = document.getElementById('db-support-submit-btn');
  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      const adminId = document.getElementById('db-support-admin-id').value;
      const adminName = document.getElementById('db-support-admin-name').value;
      const type = document.getElementById('db-support-type').value;
      const details = document.getElementById('db-support-details').value.trim();

      if (!details) {
        return alert('Te rugăm să completezi detaliile problemei.');
      }

      // Auto-fill user credentials from hidden fields (set when modal opened)
      const userName = document.getElementById('db-support-user-name')?.value
                    || (currentUser ? (currentUser.nickname || currentUser.username) : 'Utilizator');
      const userId   = document.getElementById('db-support-user-id')?.value
                    || (currentUser ? currentUser.id : '');

      submitBtn.disabled = true;
      submitBtn.innerText = 'Se trimite...';

      try {
        const res = await fetch('/api/support/ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminId, adminName, type, userName, userId, details })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          window.showToast(`✅ Tichetul a fost trimis în privat către ${adminName}!`);
          document.getElementById('dashboard-support-modal').classList.remove('open');
        } else {
          alert(data.error || 'Trimiterea tichetului a eșuat.');
        }
      } catch (err) {
        console.error(err);
        alert('Eroare rețea la trimiterea tichetului.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Trimite Tichet';
      }
    });
  }
});
