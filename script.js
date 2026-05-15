/**
 * SCRIPT.JS - Sistema de Gerenciamento de Eventos Esportivos
 */

var STORAGE_KEY = 'sports_events_v2';
var TRASH_KEY = 'events_trash';
var USER_KEY = 'current_user';

var events = [];
var trash = [];
var currentUser = null;

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatDate(dateString, includeTime) {
  var date = new Date(dateString);
  var options = { day: '2-digit', month: 'long', year: 'numeric' };
  if (includeTime !== false) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }
  return date.toLocaleDateString('pt-BR', options);
}

function isEventLocked(eventDate, eventTime) {
  var eventDateTime = new Date(eventDate + 'T' + eventTime);
  var now = new Date();
  var diffHours = (eventDateTime - now) / (1000 * 60 * 60);
  return diffHours <= 1 && diffHours > 0;
}

function getInitials(name) {
  return name.split(' ').map(function(n) { return n[0]; }).join('').toUpperCase().slice(0, 2);
}

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  localStorage.setItem(TRASH_KEY, JSON.stringify(trash));
}

function loadFromStorage() {
  try {
    events = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    trash = JSON.parse(localStorage.getItem(TRASH_KEY)) || [];
  } catch (e) {
    events = [];
    trash = [];
  }
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch (e) {
    return null;
  }
}

function setCurrentUser(user) {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
  currentUser = user;
}

function showToast(type, title, message, duration) {
  var toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return;
  duration = duration || 4000;

  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.innerHTML = '<div class="toast-icon">' + getToastIcon(type) + '</div>' +
    '<div class="toast-content"><strong>' + title + '</strong><p>' + message + '</p></div>' +
    '<button class="toast-close" onclick="this.parentElement.remove()">x</button>';

  toastContainer.appendChild(toast);

  setTimeout(function() {
    toast.classList.add('toast-hide');
    setTimeout(function() { toast.remove(); }, 300);
  }, duration);
}

function getToastIcon(type) {
  var icons = { success: '✓', error: 'x', warning: '⚠', info: 'i' };
  return icons[type] || 'i';
}

function openModal(modalId) {
  var modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add('modal-open');
  document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
  var modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove('modal-open');
  document.body.style.overflow = '';
}

function initLoginPage() {
  console.log('Login page initialized');
  
  var savedUser = getCurrentUser();
  if (savedUser) {
    window.location.href = 'index.html';
    return;
  }

  var loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  var guestForm = document.getElementById('guestForm');
  if (guestForm) {
    guestForm.addEventListener('submit', handleGuestLogin);
  }
}

function handleLogin(e) {
  e.preventDefault();
  var email = document.getElementById('loginEmail').value;
  var user = { id: generateId(), email: email, name: email.split('@')[0], type: 'admin', isLoggedIn: true };
  setCurrentUser(user);
  showToast('success', 'Login realizado!', 'Bem-vindo ao EsporteBR');
  setTimeout(function() { window.location.href = 'index.html'; }, 1000);
}

function handleGuestLogin(e) {
  e.preventDefault();
  var name = document.getElementById('guestName').value.trim();
  if (!name) { showToast('error', 'Erro', 'Digite seu nome para continuar'); return; }
  var user = { id: generateId(), name: name, type: 'guest', isLoggedIn: true };
  setCurrentUser(user);
  showToast('success', 'Bem-vindo!', 'Ola, ' + name);
  setTimeout(function() { window.location.href = 'index.html'; }, 1000);
}

function logout() {
  setCurrentUser(null);
  showToast('info', 'Logout', 'Voce saiu do sistema');
  setTimeout(function() { window.location.href = 'login.html'; }, 1000);
}

function initAdminPage() {
  loadFromStorage();
  var user = getCurrentUser();
  if (!user) { window.location.href = 'login.html'; return; }
  currentUser = user;
  renderEventsList();
  setupEventListeners();
  updateDashboardStats();
}

function renderEventsList() {
  var container = document.getElementById('events-list');
  if (!container) return;

  if (events.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div><h3>Nenhum evento criado</h3><p>Crie seu primeiro evento esportivo!</p><button class="btn btn-primary" onclick="openModal(\'create-event-modal\')">Criar Evento</button></div>';
    return;
  }

  var html = '';
  for (var i = 0; i < events.length; i++) {
    var event = events[i];
    html += '<div class="event-card" data-event-id="' + event.id + '">' +
      '<div class="event-card-header"><div class="event-sport-icon">' + getSportIcon(event.sport) + '</div>' +
      '<div class="event-status event-status-' + (event.status || 'active') + '">' + getStatusText(event.status) + '</div></div>' +
      '<h3 class="event-title">' + event.title + '</h3>' +
      '<div class="event-info"><span class="event-date">📅 ' + formatDate(event.date) + '</span><span class="event-time">⏰ ' + event.time + '</span></div>' +
      '<div class="event-location">📍 ' + (event.location || 'Local nao definido') + '</div>' +
      '<div class="event-participants">👥 ' + (event.participants ? event.participants.length : 0) + '/' + (event.maxParticipants || 22) + ' participantes</div>' +
      '<div class="event-actions"><button class="btn btn-sm btn-secondary" onclick="viewEvent(\'' + event.id + '\')">Ver Detalhes</button>' +
      '<button class="btn btn-sm btn-outline" onclick="editEvent(\'' + event.id + '\')">Editar</button>' +
      '<button class="btn btn-sm btn-danger" onclick="deleteEvent(\'' + event.id + '\')">Excluir</button></div></div>';
  }
  container.innerHTML = html;
}

function getSportIcon(sport) {
  var icons = { 'futebol': '⚽', 'basquete': '🏀', 'volei': '🏐', 'tenis': '🎾', 'outro': '🏆' };
  return icons[(sport || '').toLowerCase()] || '🏆';
}

function getStatusText(status) {
  var texts = { 'active': 'Ativo', 'upcoming': 'Proximo', 'completed': 'Finalizado', 'cancelled': 'Cancelado' };
  return texts[status] || 'Ativo';
}

function setupEventListeners() {
  var createForm = document.getElementById('create-event-form');
  if (createForm) createForm.addEventListener('submit', handleCreateEvent);

  var logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  var closeButtons = document.querySelectorAll('[data-close-modal]');
  for (var i = 0; i < closeButtons.length; i++) {
    closeButtons[i].addEventListener('click', function() {
      var modal = this.closest('.modal');
      if (modal) closeModal(modal.id);
    });
  }
}

function handleCreateEvent(e) {
  e.preventDefault();
  var eventData = {
    id: generateId(),
    title: document.getElementById('event-title').value,
    sport: document.getElementById('event-sport').value,
    date: document.getElementById('event-date').value,
    time: document.getElementById('event-time').value,
    location: document.getElementById('event-location').value,
    maxParticipants: parseInt(document.getElementById('event-max').value) || 22,
    costPerPerson: parseFloat(document.getElementById('event-cost').value) || 0,
    description: document.getElementById('event-description').value,
    participants: [],
    waitlist: [],
    createdBy: currentUser.id,
    createdAt: new Date().toISOString(),
    status: 'active'
  };
  events.push(eventData);
  saveToStorage();
  showToast('success', 'Evento criado!', 'Seu evento foi criado com sucesso');
  closeModal('create-event-modal');
  document.getElementById('create-event-form').reset();
  renderEventsList();
  updateDashboardStats();
}

function viewEvent(eventId) { window.location.href = 'evento.html?id=' + eventId; }

function editEvent(eventId) {
  var event = null;
  for (var i = 0; i < events.length; i++) { if (events[i].id === eventId) { event = events[i]; break; } }
  if (!event) return;
  document.getElementById('event-title').value = event.title;
  document.getElementById('event-sport').value = event.sport;
  document.getElementById('event-date').value = event.date;
  document.getElementById('event-time').value = event.time;
  document.getElementById('event-location').value = event.location;
  document.getElementById('event-max').value = event.maxParticipants;
  document.getElementById('event-cost').value = event.costPerPerson;
  document.getElementById('event-description').value = event.description || '';
  openModal('create-event-modal');
}

function deleteEvent(eventId) {
  if (!confirm('Tem certeza que deseja excluir este evento?')) return;
  var eventIndex = -1;
  for (var i = 0; i < events.length; i++) { if (events[i].id === eventId) { eventIndex = i; break; } }
  if (eventIndex === -1) return;
  events.splice(eventIndex, 1);
  saveToStorage();
  renderEventsList();
  updateDashboardStats();
  showToast('success', 'Evento excluido', 'O evento foi movido para a lixeira');
}

function updateDashboardStats() {
  var totalEventsEl = document.getElementById('total-events');
  var totalParticipantsEl = document.getElementById('total-participants');
  var activeEventsEl = document.getElementById('active-events');
  if (!totalEventsEl || !totalParticipantsEl || !activeEventsEl) return;
  var totalEvents = events.length;
  var totalParticipants = 0;
  var activeEvents = 0;
  for (var i = 0; i < events.length; i++) {
    if (events[i].participants) totalParticipants += events[i].participants.length;
    if (events[i].status === 'active') activeEvents++;
  }
  totalEventsEl.textContent = totalEvents;
  totalParticipantsEl.textContent = totalParticipants;
  activeEventsEl.textContent = activeEvents;
}

function initEventPage() {
  loadFromStorage();
  var params = new URLSearchParams(window.location.search);
  var eventId = params.get('id');
  if (!eventId) { showEventError(); return; }
  var event = null;
  for (var i = 0; i < events.length; i++) { if (events[i].id === eventId) { event = events[i]; break; } }
  if (!event) { showEventError(); return; }
  currentUser = getCurrentUser();
  renderEventDetails(event);
  renderParticipants(event);
  setupEventPageListeners(event);
}

function renderEventDetails(event) {
  var el = document.getElementById('event-title-display'); if (el) el.textContent = event.title;
  el = document.getElementById('event-sport-display'); if (el) el.textContent = event.sport;
  el = document.getElementById('event-date-display'); if (el) el.textContent = formatDate(event.date);
  el = document.getElementById('event-time-display'); if (el) el.textContent = event.time;
  el = document.getElementById('event-location-display'); if (el) el.textContent = event.location || 'Local nao definido';
  el = document.getElementById('event-description-display'); if (el) el.textContent = event.description || 'Sem descricao';
  var participantsCount = event.participants ? event.participants.length : 0;
  var waitlistCount = event.waitlist ? event.waitlist.length : 0;
  el = document.getElementById('participants-count'); if (el) el.textContent = participantsCount;
  el = document.getElementById('waitlist-count'); if (el) el.textContent = waitlistCount;
  el = document.getElementById('max-participants'); if (el) el.textContent = event.maxParticipants;
  el = document.getElementById('main-count'); if (el) el.textContent = participantsCount;
  el = document.getElementById('waitlist-tab-count'); if (el) el.textContent = waitlistCount;
  var costPerPerson = event.costPerPerson > 0 ? (event.costPerPerson / Math.max(participantsCount, 1)).toFixed(2) : 'Gratis';
  el = document.getElementById('cost-per-person'); if (el) el.textContent = 'R$ ' + costPerPerson;
  var loadingState = document.getElementById('loading-state');
  var eventContent = document.getElementById('event-content');
  if (loadingState) loadingState.classList.add('hidden');
  if (eventContent) eventContent.classList.remove('hidden');
}

function renderParticipants(event) {
  var mainList = document.getElementById('participants-main-list');
  var waitlistEl = document.getElementById('participants-waitlist-list');
  if (mainList) {
    if (!event.participants || event.participants.length === 0) {
      mainList.innerHTML = '<p class="empty-list">Nenhum participante ainda</p>';
    } else {
      var html = '';
      for (var i = 0; i < event.participants.length; i++) {
        var p = event.participants[i];
        html += '<div class="participant-item"><div class="participant-avatar">' + getInitials(p.name) + '</div>' +
          '<div class="participant-info"><strong>' + p.name + '</strong>' + (p.email ? '<small>' + p.email + '</small>' : '') +
          (p.invitedBy ? '<small class="invited-by">Convidado por ' + p.invitedBy + '</small>' : '') + '</div>' +
          '<div class="participant-number">#' + (i + 1) + '</div></div>';
      }
      mainList.innerHTML = html;
    }
  }
  if (waitlistEl) {
    if (!event.waitlist || event.waitlist.length === 0) {
      waitlistEl.innerHTML = '<p class="empty-list">Lista de espera vazia</p>';
    } else {
      var html = '';
      for (var i = 0; i < event.waitlist.length; i++) {
        var p = event.waitlist[i];
        html += '<div class="participant-item waitlist"><div class="participant-avatar">📋</div>' +
          '<div class="participant-info"><strong>' + p.name + '</strong>' + (p.email ? '<small>' + p.email + '</small>' : '') + '</div>' +
          '<div class="participant-number">#' + (i + 1) + '</div></div>';
      }
      waitlistEl.innerHTML = html;
    }
  }
}

function setupEventPageListeners(event) {
  var joinBtn = document.getElementById('join-event-btn');
  if (joinBtn) {
    var isParticipant = false, isWaitlisted = false;
    if (currentUser && event.participants) {
      for (var i = 0; i < event.participants.length; i++) { if (event.participants[i].id === currentUser.id) { isParticipant = true; break; } }
    }
    if (currentUser && event.waitlist) {
      for (var i = 0; i < event.waitlist.length; i++) { if (event.waitlist[i].id === currentUser.id) { isWaitlisted = true; break; } }
    }
    if (isParticipant) { joinBtn.textContent = 'Ja estou participando'; joinBtn.disabled = true; }
    else if (isWaitlisted) { joinBtn.textContent = 'Na lista de espera'; joinBtn.disabled = true; }
    else { joinBtn.addEventListener('click', function() { handleJoinEvent(event); }); }
  }
  var addGuestBtn = document.getElementById('add-guest-btn');
  if (addGuestBtn && currentUser) { addGuestBtn.addEventListener('click', function() { openModal('add-guest-modal'); }); }
  else if (addGuestBtn) { addGuestBtn.style.display = 'none'; }
  var guestForm = document.getElementById('add-guest-form');
  if (guestForm) { guestForm.addEventListener('submit', function(e) { e.preventDefault(); handleAddGuest(event); }); }
  var backBtn = document.getElementById('back-to-admin');
  if (backBtn) { backBtn.addEventListener('click', function() { window.location.href = 'index.html'; }); }
  var tabButtons = document.querySelectorAll('.tab-btn');
  for (var i = 0; i < tabButtons.length; i++) {
    tabButtons[i].addEventListener('click', function() {
      var tabs = document.querySelectorAll('.tab-btn');
      for (var j = 0; j < tabs.length; j++) { tabs[j].classList.remove('active'); }
      this.classList.add('active');
      var tabName = this.getAttribute('data-tab');
      var mainList = document.getElementById('participants-main-list');
      var waitlistList = document.getElementById('participants-waitlist-list');
      if (tabName === 'main') { if (mainList) mainList.classList.remove('hidden'); if (waitlistList) waitlistList.classList.add('hidden'); }
      else { if (mainList) mainList.classList.add('hidden'); if (waitlistList) waitlistList.classList.remove('hidden'); }
    });
  }
}

function handleJoinEvent(event) {
  if (!currentUser) { showToast('warning', 'Atencao', 'Faca login para participar deste evento'); setTimeout(function() { window.location.href = 'login.html'; }, 1500); return; }
  if (isEventLocked(event.date, event.time)) { showToast('warning', 'Evento bloqueado', 'Nao e possivel participar 1h antes do inicio'); return; }
  var participantData = { id: currentUser.id, name: currentUser.name, email: currentUser.email || '', joinedAt: new Date().toISOString() };
  if (event.participants.length >= event.maxParticipants) { event.waitlist.push(participantData); showToast('info', 'Lista de espera', 'Voce foi adicionado a lista de espera'); }
  else { event.participants.push(participantData); showToast('success', 'Confirmado!', 'Sua presenca foi confirmada'); }
  saveToStorage();
  renderEventDetails(event);
  renderParticipants(event);
}

function handleAddGuest(event) {
  var guestName = document.getElementById('guest-name-input').value.trim();
  var guestEmail = document.getElementById('guest-email-input').value.trim();
  if (!guestName) { showToast('error', 'Erro', 'Nome do convidado e obrigatorio'); return; }
  var guestData = { id: generateId(), name: guestName, email: guestEmail, invitedBy: currentUser.name, joinedAt: new Date().toISOString() };
  if (event.participants.length >= event.maxParticipants) { event.waitlist.push(guestData); showToast('info', 'Convidado adicionado', 'Na lista de espera'); }
  else { event.participants.push(guestData); showToast('success', 'Convidado adicionado', guestName + ' foi adicionado ao evento'); }
  saveToStorage();
  closeModal('add-guest-modal');
  document.getElementById('add-guest-form').reset();
  renderParticipants(event);
}

function showEventError() {
  var loadingState = document.getElementById('loading-state');
  var errorState = document.getElementById('error-state');
  if (loadingState) loadingState.classList.add('hidden');
  if (errorState) errorState.classList.remove('hidden');
}

function initApp() {
  var path = window.location.pathname;
  if (path.indexOf('login.html') !== -1) { initLoginPage(); }
  else if (path.indexOf('evento.html') !== -1) { initEventPage(); }
  else { initAdminPage(); }
}

window.openModal = openModal;
window.closeModal = closeModal;
window.showToast = showToast;
window.logout = logout;
window.viewEvent = viewEvent;
window.editEvent = editEvent;
window.deleteEvent = deleteEvent;

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initApp); }
else { initApp(); }
