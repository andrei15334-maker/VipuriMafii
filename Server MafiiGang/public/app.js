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
  
  const authenticated = await fetchCurrentUser();
  if (authenticated) {
    await fetchStats();
    await loadFactionsData();
    setupActions();
    setupSuperadminExtras();
  } else {
    window.location.href = '/';
  }
});

// 2. Navigation Setup
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item[data-tab]');
  navItems.forEach(item => {
    item.addEventListener('click', async () => {
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
      const tabId = item.getAttribute('data-tab');
      document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
      document.getElementById(tabId)?.classList.add('active');

      const headers = {
        'tab-overview':         ['Prezentare Generală',       'Statistici globale ale serverului Vipuri Roleplay.'],
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

      if (tabId === 'tab-all-factions') await renderAllFactionsGrid();
      if (tabId === 'tab-online-players') await renderOnlinePlayers();
      if (tabId === 'tab-logs') await renderAuditLogs();
    });
  });
}

// 3. API calls
async function fetchCurrentUser() {
  try {
    const response = await fetch('/api/me');
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
      roleText = 'Lider Facțiune';
      badgeColor = '#ff3333';
    } else if (currentUser.role === 'member') {
      roleText = 'Membru Facțiune';
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
        factionSelector.innerHTML = '<option value="">Fără facțiuni înregistrate</option>';
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
  membersListContainer.innerHTML = '<div class="empty-state">Nu a fost selectată nicio facțiune activă.</div>';
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
  
  members.forEach(m => {
    const memberId = m.id;
    const item = document.createElement('div');
    item.className = 'member-item';
    
    // Check if member is founder/owner
    const isFounder = memberId === mafia.ownerId;
    const canKick = (currentUser.role === 'manager' || currentUser.role === 'superadmin' || (currentUser.role === 'leader' && !isFounder)) && memberId !== currentUser.id;
    const canSanction = (currentUser.role === 'manager' || currentUser.role === 'superadmin' || (currentUser.role === 'leader' && !isFounder)) && memberId !== currentUser.id;
    
    // Render Warning Tag
    const warningTag = m.warnings > 0 ? `<span class="badge badge-oficiala" style="font-size: 0.65rem; padding: 2px 6px; margin-left: 5px;">AV ${m.warnings}/3</span>` : '';
    
    // Online indicators (buline)
    const discordStatusDot = m.onlineDiscord ? `<span style="display:inline-block; width:8px; height:8px; background:#2ecc71; border-radius:50%; margin-right:4px;" title="Online pe Dashboard"></span>` : `<span style="display:inline-block; width:8px; height:8px; background:#95a5a6; border-radius:50%; margin-right:4px;" title="Offline pe Dashboard"></span>`;
    const fivemStatusDot = m.onlineFiveM ? `<span style="display:inline-block; width:8px; height:8px; background:#2ecc71; border-radius:50%; margin-right:4px;" title="Online în FiveM"></span>` : `<span style="display:inline-block; width:8px; height:8px; background:#95a5a6; border-radius:50%; margin-right:4px;" title="Offline în FiveM"></span>`;

    item.innerHTML = `
      <div class="member-details">
        <div class="member-avatar flex-center">👤</div>
        <div>
          <div class="member-id">
            ${m.username || memberId} 
            ${isFounder ? '<span class="badge badge-leader" style="font-size: 0.65rem; padding: 2px 6px; margin-left:5px;">Lider</span>' : ''}
            ${warningTag}
          </div>
          <div style="font-size: 0.75rem; color: var(--text-secondary); display: flex; align-items: center; gap: 10px; margin-top: 2px;">
            <span style="display: flex; align-items: center;">${discordStatusDot} Web</span>
            <span style="display: flex; align-items: center;">${fivemStatusDot} FiveM</span>
          </div>
        </div>
      </div>
      <div style="display: flex; gap: 8px;">
        ${canSanction ? `<button class="btn-sm btn-danger-sm sanction-member-btn" data-userid="${memberId}">Sancționează</button>` : ''}
        ${canKick ? `<button class="btn-sm btn-danger-sm kick-btn" style="background: rgba(231, 76, 60, 0.1);" data-userid="${memberId}">Demitere</button>` : ''}
      </div>
    `;
    
    membersListContainer.appendChild(item);
  });
  
  // Event listeners for kick buttons
  document.querySelectorAll('.kick-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const userId = e.target.getAttribute('data-userid');
      if (confirm(`Sigur dorești să îl demiți pe membrul cu ID-ul ${userId}?`)) {
        await kickMember(mafia.id, userId);
      }
    });
  });

  // Event listeners for individual member sanction buttons
  document.querySelectorAll('.sanction-member-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const userId = e.target.getAttribute('data-userid');
      openMemberSanctionModal(mafia.id, userId);
    });
  });
}

function renderSanctions(mafia) {
  sanctionsListContainer.innerHTML = '';
  
  if (!mafia.sanctions || mafia.sanctions.length === 0) {
    sanctionsListContainer.innerHTML = '<div class="empty-state">Această facțiune nu are nicio sancțiune activă.</div>';
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
    if (!activeFaction) return alert('Selectează o facțiune mai întâi!');
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
        alert('Facțiune editată cu succes!');
        editFactionModal.style.display = 'none';
        
        // Reload all factions from API
        await loadFactionsData();
      } else {
        alert(`Eroare: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Eroare la editarea facțiunii.');
    }
  });

  // Delete Faction Button
  document.getElementById('delete-faction-btn').addEventListener('click', async () => {
    if (!activeFaction) return alert('Selectează o facțiune mai întâi!');
    
    const confirmDelete = confirm(`Ești ABSOLUT sigur că vrei să ștergi facțiunea "${activeFaction.name}" definitiv?\n` +
      `Această acțiune va șterge toate rolurile, categoriile și canalele de pe Discord!`);
      
    if (!confirmDelete) return;
    
    try {
      const response = await fetch(`/api/mafias/${activeFaction.id}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      if (response.ok) {
        alert('Facțiune ștearsă cu succes de pe site și Discord!');
        location.reload(); // Reload dashboard to clear everything and refresh
      } else {
        alert(`Eroare: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Eroare la ștergerea facțiunii.');
    }
  });
}

async function kickMember(mafiaId, userId) {
  try {
    const response = await fetch(`/api/mafias/${mafiaId}/members/${userId}`, {
      method: 'DELETE'
    });
    const data = await response.json();
    if (response.ok) {
      alert('Membru demis cu succes!');
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
      grid.innerHTML = '<div class="empty-state">Nicio facțiune înregistrată încă.</div>';
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

  // If user has no in-game profile, show a soft banner
  const db_profile_check = async () => {
    const me = await fetch('/api/me').then(r => r.json());
    if (!me.ingameName) {
      // Show a top bar reminder
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
