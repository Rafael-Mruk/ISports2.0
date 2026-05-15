/**
 * ============================================
 * SCRIPT.JS - Sistema de Gerenciamento de Eventos Esportivos
 * Cores do Brasil | UI/UX Aprimorada | Performance Otimizada
 * ============================================
 */

// ============================================
// CONSTANTES (Preservadas conforme requisito)
// ============================================
const STORAGE_KEY = 'sports_events_v2';
const LAST_ADMIN_KEY = 'last_admin_user';
const JOINED_PREFIX = 'joined_event_';
const TRASH_KEY = 'events_trash';
const GOOGLE_MAPS_API_KEY = ''; // Configure sua API key do Google Maps
const SUPABASE_URL = ''; // Configure sua URL do Supabase
const SUPABASE_ANON_KEY = ''; // Configure sua chave anon do Supabase
const SUPABASE_TABLE = 'events';
const CLOUD_SYNC_INTERVAL_MS = 3000;

// ============================================
// ESTADO GLOBAL
// ============================================
let events = [];
let trash = [];
let currentEventId = null;
let currentUser = null;
let syncInterval = null;
let timerInterval = null;
let mapInstance = null;
let audioContext = null;

// ============================================
// UTILITÁRIOS
// ============================================

/**
 * Gera um ID único
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Formata data para exibição
 */
function formatDate(dateString, includeTime = true) {
  const date = new Date(dateString);
  const options = { 
    day: '2-digit', 
    month: 'long', 
    year: 'numeric' 
  };
  
  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }
  
  return date.toLocaleDateString('pt-BR', options);
}

/**
 * Calcula diferença de tempo
 */
function getTimeRemaining(endTime) {
  const total = Date.parse(endTime) - Date.parse(new Date());
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor((total / (1000 * 60 * 60)));
  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  
  return { total, days, hours, minutes };
}

/**
 * Verifica se evento está bloqueado (1h antes)
 */
function isEventLocked(eventDate, eventTime) {
  const eventDateTime = new Date(`${eventDate}T${eventTime}`);
  const now = new Date();
  const diffMs = eventDateTime - now;
  const diffHours = diffMs / (1000 * 60 * 60);
  
  return diffHours <= 1 && diffHours > 0;
}

/**
 * Verifica se evento já passou
 */
function isEventPast(eventDate, eventTime) {
  const eventDateTime = new Date(`${eventDate}T${eventTime}`);
  return new Date() > eventDateTime;
}

/**
 * Obtém iniciais do nome
 */
function getInitials(name) {
  return name
    .split(' ')
    .map(word => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Gera cor baseada no nome
 */
function getColorFromName(name) {
  const colors = [
    '#009B3A', '#002776', '#FFDF00', '#DC2626',
    '#7C3AED', '#DB2777', '#EA580C', '#059669'
  ];
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[index % colors.length];
}

// ============================================
// SISTEMA DE TOASTS
// ============================================

/**
 * Exibe notificação toast
 */
function showToast(type, title, message, actionText = null, actionCallback = null) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icons = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
  };
  
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || icons.info}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    ${actionText ? `<button class="toast-action">${actionText}</button>` : ''}
  `;
  
  container.appendChild(toast);
  
  // Animação de entrada
  requestAnimationFrame(() => {
    toast.classList.add('active');
  });
  
  // Configurar ação
  if (actionText && actionCallback) {
    const actionBtn = toast.querySelector('.toast-action');
    actionBtn.addEventListener('click', () => {
      actionCallback();
      removeToast(toast);
    });
  }
  
  // Auto-dismiss após 5 segundos
  setTimeout(() => {
    removeToast(toast);
  }, 5000);
  
  return toast;
}

/**
 * Remove toast
 */
function removeToast(toast) {
  toast.classList.remove('active');
  setTimeout(() => {
    toast.remove();
  }, 250);
}

// ============================================
// SISTEMA DE MODAIS
// ============================================

/**
 * Abre modal com animação e trap focus
 */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  const backdrop = document.getElementById('modal-backdrop');
  
  if (!modal) return;
  
  // Ativar backdrop
  backdrop.classList.add('active');
  
  // Mostrar modal com animação
  modal.classList.add('active');
  
  // Trap focus
  const focusableElements = modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];
  
  // Focar no primeiro elemento
  setTimeout(() => firstFocusable?.focus(), 100);
  
  // Fechar com ESC
  const handleEsc = (e) => {
    if (e.key === 'Escape') {
      closeModal(modalId);
      document.removeEventListener('keydown', handleEsc);
    }
  };
  document.addEventListener('keydown', handleEsc);
  
  // Fechar ao clicar no backdrop
  backdrop.addEventListener('click', () => closeModal(modalId), { once: true });
}

/**
 * Fecha modal com animação
 */
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  const backdrop = document.getElementById('modal-backdrop');
  
  if (!modal) return;
  
  modal.classList.remove('active');
  backdrop.classList.remove('active');
}

// ============================================
// ARMAZENAMENTO LOCAL
// ============================================

/**
 * Carrega eventos do LocalStorage
 */
function loadEvents() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    events = stored ? JSON.parse(stored) : [];
    
    const storedTrash = localStorage.getItem(TRASH_KEY);
    trash = storedTrash ? JSON.parse(storedTrash) : [];
    
    return true;
  } catch (error) {
    console.error('Erro ao carregar eventos:', error);
    return false;
  }
}

/**
 * Salva eventos no LocalStorage
 */
function saveEvents() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    localStorage.setItem(TRASH_KEY, JSON.stringify(trash));
    return true;
  } catch (error) {
    console.error('Erro ao salvar eventos:', error);
    showToast('error', 'Erro', 'Não foi possível salvar as alterações');
    return false;
  }
}

/**
 * Move evento para lixeira
 */
function moveToTrash(eventId) {
  const eventIndex = events.findIndex(e => e.id === eventId);
  if (eventIndex === -1) return false;
  
  const event = events[eventIndex];
  event.deletedAt = new Date().toISOString();
  event.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 dias
  
  trash.push(event);
  events.splice(eventIndex, 1);
  
  saveEvents();
  cloudMarkDeleted(eventId);
  
  return true;
}

/**
 * Restaura evento da lixeira
 */
function restoreFromTrash(eventId) {
  const trashIndex = trash.findIndex(e => e.id === eventId);
  if (trashIndex === -1) return false;
  
  const event = trash[trashIndex];
  delete event.deletedAt;
  delete event.expiresAt;
  
  events.push(event);
  trash.splice(trashIndex, 1);
  
  saveEvents();
  
  return true;
}

/**
 * Remove permanentemente da lixeira
 */
function permanentlyDelete(eventId) {
  const trashIndex = trash.findIndex(e => e.id === eventId);
  if (trashIndex === -1) return false;
  
  trash.splice(trashIndex, 1);
  saveEvents();
  
  return true;
}

/**
 * Limpa eventos expirados da lixeira
 */
function cleanExpiredTrash() {
  const now = new Date();
  trash = trash.filter(event => {
    if (!event.expiresAt) return true;
    return new Date(event.expiresAt) > now;
  });
  saveEvents();
}

// ============================================
// SINCRONIZAÇÃO COM SUPABASE
// ============================================

/**
 * Busca eventos da nuvem
 */
async function cloudPullEvents() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?select=*&deleted_at=is.null`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) throw new Error('Falha na sincronização');
    
    const cloudEvents = await response.json();
    
    // Merge com eventos locais
    cloudEvents.forEach(cloudEvent => {
      const localIndex = events.findIndex(e => e.id === cloudEvent.id);
      if (localIndex === -1) {
        events.push(cloudEvent);
      } else if (new Date(cloudEvent.updated_at) > new Date(events[localIndex].updated_at)) {
        events[localIndex] = cloudEvent;
      }
    });
    
    saveEvents();
    renderEvents();
  } catch (error) {
    console.log('Sync offline ou falhou:', error.message);
  }
}

/**
 * Envia evento para nuvem
 */
async function cloudUpsertEvent(event) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  
  try {
    const method = event.id ? 'PATCH' : 'POST';
    const url = event.id 
      ? `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?id=eq.${event.id}`
      : `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`;
    
    const response = await fetch(url, {
      method,
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        ...event,
        updated_at: new Date().toISOString()
      })
    });
    
    return response.ok;
  } catch (error) {
    console.error('Erro ao sincronizar:', error);
    return false;
  }
}

/**
 * Marca evento como deletado na nuvem
 */
async function cloudMarkDeleted(eventId) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?id=eq.${eventId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}',
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          deleted_at: new Date().toISOString()
        })
      }
    );
    
    return response.ok;
  } catch (error) {
    console.error('Erro ao marcar deletado:', error);
    return false;
  }
}

/**
 * Inicia sincronização periódica
 */
function startCloudSync() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  
  cloudPullEvents();
  syncInterval = setInterval(cloudPullEvents, CLOUD_SYNC_INTERVAL_MS);
}

// ============================================
// RENDERIZAÇÃO
// ============================================

/**
 * Renderiza lista de eventos (index.html)
 */
function renderEvents(filter = 'active') {
  const container = document.getElementById('events-list');
  const emptyState = document.getElementById('empty-state');
  
  if (!container) return;
  
  // Filtrar eventos
  let filteredEvents = events.filter(event => {
    const isPast = isEventPast(event.date, event.time);
    const eventDateTime = new Date(`${event.date}T${event.time}`);
    const now = new Date();
    
    switch (filter) {
      case 'active':
        return !isPast && eventDateTime > now;
      case 'upcoming':
        return !isPast;
      case 'completed':
        return isPast || event.status === 'completed';
      default:
        return true;
    }
  });
  
  // Ordenar por data
  filteredEvents.sort((a, b) => {
    const dateA = new Date(`${a.date}T${a.time}`);
    const dateB = new Date(`${b.date}T${b.time}`);
    return dateA - dateB;
  });
  
  // Remover skeletons
  container.innerHTML = '';
  
  // Mostrar empty state se não houver eventos
  if (filteredEvents.length === 0) {
    emptyState?.classList.remove('hidden');
    container.classList.add('hidden');
    return;
  }
  
  emptyState?.classList.add('hidden');
  container.classList.remove('hidden');
  
  // Renderizar cards
  filteredEvents.forEach((event, index) => {
    const card = createEventCard(event, index);
    container.appendChild(card);
  });
}

/**
 * Cria card de evento
 */
function createEventCard(event, index) {
  const card = document.createElement('div');
  card.className = 'event-card animate-slide-up';
  card.style.animationDelay = `${index * 50}ms`;
  card.dataset.eventId = event.id;
  
  const confirmedCount = event.participants?.filter(p => p.status === 'confirmed').length || 0;
  const spotsLeft = event.maxPlayers - confirmedCount;
  const isFull = spotsLeft <= 0;
  const isPast = isEventPast(event.date, event.time);
  
  card.innerHTML = `
    <div class="event-card-image">
      ⚽
    </div>
    <div class="event-card-body">
      <h3 class="event-card-title">${event.name}</h3>
      <div class="event-card-meta">
        <div class="event-card-meta-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
          ${formatDate(event.date, false)}
        </div>
        <div class="event-card-meta-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 8v5l5 0"/>
          </svg>
          ${event.time}
        </div>
        <div class="event-card-meta-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
          ${confirmedCount}/${event.maxPlayers}
        </div>
      </div>
      ${event.cost ? `
        <div class="badge badge-yellow mt-4">
          R$ ${(event.cost / Math.max(confirmedCount, 1)).toFixed(2)} por pessoa
        </div>
      ` : ''}
    </div>
    <div class="event-card-footer">
      <span class="status-badge ${isPast ? 'status-completed' : 'status-upcoming'}">
        ${isPast ? '✅ Finalizado' : (isFull ? '🔒 Lotado' : '📅 Confirmado')}
      </span>
      <button class="btn btn-sm btn-outline" onclick="openEventDetails('${event.id}')">
        Ver detalhes
      </button>
    </div>
  `;
  
  // Adicionar evento de clique
  card.addEventListener('click', (e) => {
    if (!e.target.closest('button')) {
      openEventDetails(event.id);
    }
  });
  
  return card;
}

/**
 * Abre modal de detalhes do evento
 */
function openEventDetails(eventId) {
  const event = events.find(e => e.id === eventId);
  if (!event) return;
  
  currentEventId = eventId;
  const modal = document.getElementById('event-details-modal');
  const content = document.getElementById('event-details-content');
  
  const confirmedCount = event.participants?.filter(p => p.status === 'confirmed').length || 0;
  const waitlistCount = event.participants?.filter(p => p.status === 'waitlist').length || 0;
  
  content.innerHTML = `
    <div class="mb-4">
      <h3 class="font-bold text-lg mb-2">${event.name}</h3>
      <p class="text-gray">${event.description || 'Sem descrição'}</p>
    </div>
    
    <div class="grid grid-cols-1 gap-4 mb-4">
      <div class="stat-card">
        <div class="stat-value">${confirmedCount}</div>
        <div class="stat-label">Confirmados</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${waitlistCount}</div>
        <div class="stat-label">Lista de Espera</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${event.maxPlayers - confirmedCount}</div>
        <div class="stat-label">Vagas Disponíveis</div>
      </div>
    </div>
    
    <div class="alert alert-info mb-4">
      <svg class="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
      </svg>
      <div class="alert-content">
        <p class="alert-message">
          <strong>Data:</strong> ${formatDate(event.date)} às ${event.time}<br>
          <strong>Local:</strong> ${event.location}
        </p>
      </div>
    </div>
    
    ${event.cost ? `
      <div class="alert alert-success mb-4">
        <svg class="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <div class="alert-content">
          <p class="alert-message">
            Custo total: R$ ${event.cost.toFixed(2)}<br>
            Por pessoa: R$ ${(event.cost / Math.max(confirmedCount, 1)).toFixed(2)}
          </p>
        </div>
      </div>
    ` : ''}
    
    <div class="divider">Participantes</div>
    
    <h4 class="font-bold mb-2">Confirmados (${confirmedCount})</h4>
    <ul class="participant-list mb-4">
      ${(event.participants?.filter(p => p.status === 'confirmed').map(p => `
        <li class="participant-item">
          <div class="avatar avatar-sm" style="background: ${getColorFromName(p.name)}">
            ${getInitials(p.name)}
          </div>
          <div class="participant-info">
            <div class="participant-name">${p.name}</div>
            ${p.email ? `<div class="participant-email">${p.email}</div>` : ''}
          </div>
        </li>
      `).join('') || '<li class="text-gray text-sm">Nenhum confirmado ainda</li>'}
    </ul>
    
    ${waitlistCount > 0 ? `
      <h4 class="font-bold mb-2">Lista de Espera (${waitlistCount})</h4>
      <ul class="participant-list">
        ${(event.participants?.filter(p => p.status === 'waitlist').map(p => `
          <li class="participant-item">
            <div class="avatar avatar-sm" style="background: ${getColorFromName(p.name)}">
              ${getInitials(p.name)}
            </div>
            <div class="participant-info">
              <div class="participant-name">${p.name}</div>
              ${p.email ? `<div class="participant-email">${p.email}</div>` : ''}
            </div>
            <span class="badge badge-yellow">Reserva</span>
          </li>
        `).join('') || ''}
      </ul>
    ` : ''}
  `;
  
  openModal('event-details-modal');
}

/**
 * Renderiza participantes na página pública
 */
function renderParticipants(event) {
  const list = document.getElementById('participants-list');
  const emptyState = document.getElementById('participants-empty');
  const confirmedCountEl = document.getElementById('confirmed-count');
  const waitlistCountEl = document.getElementById('waitlist-count');
  
  if (!list) return;
  
  const confirmed = event.participants?.filter(p => p.status === 'confirmed') || [];
  const waitlist = event.participants?.filter(p => p.status === 'waitlist') || [];
  
  confirmedCountEl.textContent = confirmed.length;
  waitlistCountEl.textContent = waitlist.length;
  
  list.innerHTML = '';
  
  const participants = confirmed.length > 0 ? confirmed : waitlist;
  
  if (participants.length === 0) {
    emptyState?.classList.remove('hidden');
    return;
  }
  
  emptyState?.classList.add('hidden');
  
  participants.forEach((p, index) => {
    const li = document.createElement('li');
    li.className = 'participant-item animate-fade-in';
    li.style.animationDelay = `${index * 50}ms`;
    
    li.innerHTML = `
      <div class="avatar avatar-sm" style="background: ${getColorFromName(p.name)}">
        ${getInitials(p.name)}
      </div>
      <div class="participant-info">
        <div class="participant-name">${p.name}</div>
        ${p.email ? `<div class="participant-email">${p.email}</div>` : ''}
      </div>
    `;
    
    list.appendChild(li);
  });
}

// ============================================
// LÓGICA DE EVENTOS
// ============================================

/**
 * Cria novo evento
 */
function createEvent(eventData) {
  const event = {
    id: generateId(),
    name: eventData.name,
    description: eventData.description || '',
    date: eventData.date,
    time: eventData.time,
    location: eventData.location,
    maxPlayers: parseInt(eventData.maxPlayers),
    cost: parseFloat(eventData.cost) || 0,
    duration: parseInt(eventData.duration) || 60,
    requireLogin: eventData.requireLogin || false,
    participants: [],
    status: 'upcoming',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: currentUser?.id || 'anonymous'
  };
  
  events.push(event);
  saveEvents();
  cloudUpsertEvent(event);
  
  return event;
}

/**
 * Atualiza evento existente
 */
function updateEvent(eventId, eventData) {
  const eventIndex = events.findIndex(e => e.id === eventId);
  if (eventIndex === -1) return null;
  
  events[eventIndex] = {
    ...events[eventIndex],
    ...eventData,
    updatedAt: new Date().toISOString()
  };
  
  saveEvents();
  cloudUpsertEvent(events[eventIndex]);
  
  return events[eventIndex];
}

/**
 * Confirma presença no evento
 */
function joinEvent(eventId, participantData, isWaitlist = false) {
  const event = events.find(e => e.id === eventId);
  if (!event) return false;
  
  const confirmedCount = event.participants?.filter(p => p.status === 'confirmed').length || 0;
  const isFull = confirmedCount >= event.maxPlayers;
  
  if (!event.participants) {
    event.participants = [];
  }
  
  // Verificar se já está inscrito
  const existingIndex = event.participants.findIndex(
    p => p.email === participantData.email || p.name === participantData.name
  );
  
  if (existingIndex !== -1) {
    showToast('warning', 'Atenção', 'Você já está inscrito neste evento');
    return false;
  }
  
  // Adicionar participante
  event.participants.push({
    id: generateId(),
    name: participantData.name,
    email: participantData.email || '',
    status: (isFull || isWaitlist) ? 'waitlist' : 'confirmed',
    joinedAt: new Date().toISOString()
  });
  
  // Promover da lista de espera se houver vaga
  if (!isFull && !isWaitlist) {
    promoteFromWaitlist(event);
  }
  
  event.updatedAt = new Date().toISOString();
  saveEvents();
  cloudUpsertEvent(event);
  
  // Marcar como joined no localStorage
  localStorage.setItem(`${JOINED_PREFIX}${eventId}`, 'true');
  
  return true;
}

/**
 * Remove participante
 */
function leaveEvent(eventId, participantEmail) {
  const event = events.find(e => e.id === eventId);
  if (!event) return false;
  
  // Verificar trava de 1h
  if (isEventLocked(event.date, event.time)) {
    showToast('warning', 'Bloqueado', 'Não é possível cancelar menos de 1 hora antes do início');
    return false;
  }
  
  const participantIndex = event.participants?.findIndex(p => p.email === participantEmail);
  if (participantIndex === -1) return false;
  
  event.participants.splice(participantIndex, 1);
  
  // Promover da lista de espera
  promoteFromWaitlist(event);
  
  event.updatedAt = new Date().toISOString();
  saveEvents();
  cloudUpsertEvent(event);
  
  // Remover marcação de joined
  localStorage.removeItem(`${JOINED_PREFIX}${eventId}`);
  
  return true;
}

/**
 * Promove participante da lista de espera
 */
function promoteFromWaitlist(event) {
  const confirmedCount = event.participants?.filter(p => p.status === 'confirmed').length || 0;
  const waitlistParticipants = event.participants?.filter(p => p.status === 'waitlist') || [];
  
  const spotsAvailable = event.maxPlayers - confirmedCount;
  
  if (spotsAvailable > 0 && waitlistParticipants.length > 0) {
    const toPromote = Math.min(spotsAvailable, waitlistParticipants.length);
    
    for (let i = 0; i < toPromote; i++) {
      const participant = waitlistParticipants[i];
      participant.status = 'confirmed';
      
      showToast('success', 'Promovido!', `${participant.name} foi promovido da lista de espera`);
    }
  }
}

/**
 * Adiciona convidado
 */
function addGuest(eventId, guestData, isWaitlist = false) {
  return joinEvent(eventId, guestData, isWaitlist);
}

// ============================================
// CONTROLE DE PARTIDA
// ============================================

let matchState = {
  eventId: null,
  timerSeconds: 0,
  timerRunning: false,
  scoreA: 0,
  scoreB: 0,
  teamsGenerated: false
};

/**
 * Inicia controle de partida
 */
function openMatchControl(eventId) {
  const event = events.find(e => e.id === eventId);
  if (!event) return;
  
  currentEventId = eventId;
  matchState = {
    eventId,
    timerSeconds: 0,
    timerRunning: false,
    scoreA: 0,
    scoreB: 0,
    teamsGenerated: false
  };
  
  // Restaurar estado salvo
  const savedState = localStorage.getItem(`match_${eventId}`);
  if (savedState) {
    matchState = { ...matchState, ...JSON.parse(savedState) };
  }
  
  updateTimerDisplay();
  updateScoreboard();
  
  openModal('match-modal');
}

/**
 * Atualiza display do timer
 */
function updateTimerDisplay() {
  const display = document.getElementById('timer-display');
  if (!display) return;
  
  const minutes = Math.floor(matchState.timerSeconds / 60);
  const seconds = matchState.timerSeconds % 60;
  
  display.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  
  display.className = 'timer-display';
  if (matchState.timerRunning) {
    display.classList.add('timer-running');
  } else if (matchState.timerSeconds > 0) {
    display.classList.add('timer-paused');
  } else {
    display.classList.add('timer-paused');
  }
}

/**
 * Inicia timer
 */
function startTimer() {
  if (matchState.timerRunning) return;
  
  matchState.timerRunning = true;
  saveMatchState();
  updateTimerDisplay();
  updateTimerButtons();
  
  const event = events.find(e => e.id === matchState.eventId);
  const durationSeconds = (event?.duration || 60) * 60;
  
  timerInterval = setInterval(() => {
    if (!document.hidden) {
      matchState.timerSeconds++;
      updateTimerDisplay();
      saveMatchState();
      
      // Verificar fim do tempo
      if (matchState.timerSeconds >= durationSeconds) {
        endTimer();
        showToast('info', 'Tempo Esgotado', 'A partida chegou ao fim!');
        playWhistle();
      }
    }
  }, 1000);
}

/**
 * Pausa timer
 */
function pauseTimer() {
  if (!matchState.timerRunning) return;
  
  matchState.timerRunning = false;
  saveMatchState();
  updateTimerDisplay();
  updateTimerButtons();
  
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

/**
 * Para timer
 */
function endTimer() {
  pauseTimer();
  matchState.timerRunning = false;
}

/**
 * Reseta timer
 */
function resetTimer() {
  pauseTimer();
  matchState.timerSeconds = 0;
  updateTimerDisplay();
  saveMatchState();
}

/**
 * Atualiza botões do timer
 */
function updateTimerButtons() {
  const startBtn = document.getElementById('btn-start-timer');
  const pauseBtn = document.getElementById('btn-pause-timer');
  
  if (!startBtn || !pauseBtn) return;
  
  if (matchState.timerRunning) {
    startBtn.classList.add('hidden');
    pauseBtn.classList.remove('hidden');
  } else {
    startBtn.classList.remove('hidden');
    pauseBtn.classList.add('hidden');
  }
}

/**
 * Atualiza placar
 */
function updateScoreboard() {
  const scoreA = document.getElementById('score-team-a');
  const scoreB = document.getElementById('score-team-b');
  
  if (scoreA) scoreA.textContent = matchState.scoreA;
  if (scoreB) scoreB.textContent = matchState.scoreB;
}

/**
 * Adiciona gol
 */
function addGoal(team) {
  if (team === 'A') {
    matchState.scoreA++;
  } else {
    matchState.scoreB++;
  }
  
  updateScoreboard();
  saveMatchState();
  playWhistle();
}

/**
 * Toca apito
 */
function playWhistle() {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 2000;
    oscillator.type = 'square';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (error) {
    console.error('Erro ao tocar apito:', error);
  }
}

/**
 * Gera times aleatórios
 */
function generateTeams(eventId) {
  const event = events.find(e => e.id === eventId);
  if (!event) return;
  
  const confirmed = event.participants?.filter(p => p.status === 'confirmed') || [];
  
  if (confirmed.length < 2) {
    showToast('warning', 'Atenção', 'É necessário pelo menos 2 jogadores para sortear times');
    return;
  }
  
  // Embaralhar
  const shuffled = [...confirmed].sort(() => Math.random() - 0.5);
  
  // Dividir em times
  const teamA = shuffled.slice(0, Math.floor(shuffled.length / 2));
  const teamB = shuffled.slice(Math.floor(shuffled.length / 2));
  
  matchState.teamsGenerated = true;
  matchState.teamA = teamA;
  matchState.teamB = teamB;
  
  saveMatchState();
  renderTeams();
  
  showToast('success', 'Times Sorteados', 'Times gerados aleatoriamente!');
}

/**
 * Renderiza times
 */
function renderTeams() {
  const container = document.getElementById('teams-container');
  if (!container) return;
  
  if (!matchState.teamA || !matchState.teamB) {
    container.innerHTML = '<p class="text-gray text-center">Sorteie os times para ver a divisão</p>';
    return;
  }
  
  container.innerHTML = `
    <div class="grid grid-cols-1 gap-4">
      <div class="card">
        <div class="card-header">
          <h4 class="font-bold">Time A (${matchState.teamA.length})</h4>
        </div>
        <div class="card-body">
          <ul class="participant-list">
            ${matchState.teamA.map(p => `
              <li class="participant-item">
                <div class="avatar avatar-sm" style="background: ${getColorFromName(p.name)}">
                  ${getInitials(p.name)}
                </div>
                <span class="participant-name">${p.name}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      </div>
      
      <div class="card">
        <div class="card-header">
          <h4 class="font-bold">Time B (${matchState.teamB.length})</h4>
        </div>
        <div class="card-body">
          <ul class="participant-list">
            ${matchState.teamB.map(p => `
              <li class="participant-item">
                <div class="avatar avatar-sm" style="background: ${getColorFromName(p.name)}">
                  ${getInitials(p.name)}
                </div>
                <span class="participant-name">${p.name}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      </div>
    </div>
  `;
}

/**
 * Salva estado da partida
 */
function saveMatchState() {
  if (matchState.eventId) {
    localStorage.setItem(`match_${matchState.eventId}`, JSON.stringify(matchState));
  }
}

/**
 * Finaliza partida
 */
function endMatch() {
  const event = events.find(e => e.id === matchState.eventId);
  if (!event) return;
  
  event.status = 'completed';
  event.matchResult = {
    scoreA: matchState.scoreA,
    scoreB: matchState.scoreB,
    duration: matchState.timerSeconds,
    completedAt: new Date().toISOString()
  };
  
  updateEvent(matchState.eventId, event);
  closeModal('match-modal');
  
  showToast('success', 'Partida Finalizada', `Placar final: ${matchState.scoreA} - ${matchState.scoreB}`);
}

// ============================================
// MAPA
// ============================================

/**
 * Inicializa mapa
 */
function initMap(location, containerId = 'map-container') {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  if (GOOGLE_MAPS_API_KEY && window.google?.maps) {
    // Usar Google Maps API real
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: location }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const map = new google.maps.Map(container, {
          center: results[0].geometry.location,
          zoom: 15,
          disableDefaultUI: false
        });
        
        new google.maps.Marker({
          position: results[0].geometry.location,
          map: map
        });
        
        mapInstance = map;
      }
    });
  } else {
    // Fallback com iframe
    const encodedLocation = encodeURIComponent(location);
    container.innerHTML = `
      <iframe 
        src="https://maps.google.com/maps?q=${encodedLocation}&t=&z=15&ie=UTF8&iwloc=&output=embed"
        width="100%" 
        height="100%" 
        frameborder="0" 
        style="border:0" 
        allowfullscreen
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade">
      </iframe>
    `;
  }
}

// ============================================
// INICIALIZAÇÃO
// ============================================

/**
 * Inicializa aplicação
 */
function initApp() {
  // Limpar lixeira expirada
  cleanExpiredTrash();
  
  // Carregar eventos
  loadEvents();
  
  // Verificar se está na página admin ou evento
  const isIndexPage = window.location.pathname.includes('index.html') || window.location.pathname === '/';
  const isEventPage = window.location.pathname.includes('evento.html');
  
  if (isIndexPage) {
    initAdminPage();
  } else if (isEventPage) {
    initEventPage();
  }
  
  // Iniciar sync com nuvem
  startCloudSync();
  
  // Setup global de modais
  setupGlobalModalHandlers();
}

/**
 * Setup de handlers globais de modal
 */
function setupGlobalModalHandlers() {
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal');
      if (modal) {
        closeModal(modal.id);
      }
    });
  });
}

/**
 * Inicializa página admin (index.html)
 */
function initAdminPage() {
  renderEvents();
  
  // Tabs
  document.querySelectorAll('.tab-button[data-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab-button[data-tab]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderEvents(tab.dataset.tab);
    });
  });
  
  // Botão criar evento
  document.getElementById('btn-create-event')?.addEventListener('click', () => {
    openCreateEventModal();
  });
  
  // Botão lixeira
  document.getElementById('btn-view-trash')?.addEventListener('click', () => {
    openTrashModal();
  });
  
  // Formulário de evento
  document.getElementById('event-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    saveEventForm();
  });
  
  // Cancelar criação
  document.getElementById('btn-cancel-event')?.addEventListener('click', () => {
    closeModal('event-modal');
  });
  
  // Delete event
  document.getElementById('btn-delete-event')?.addEventListener('click', () => {
    if (currentEventId) {
      moveToTrash(currentEventId);
      closeModal('event-details-modal');
      renderEvents();
      showToast('success', 'Excluído', 'Evento movido para lixeira');
    }
  });
  
  // Edit event
  document.getElementById('btn-edit-event')?.addEventListener('click', () => {
    closeModal('event-details-modal');
    openCreateEventModal(currentEventId);
  });
  
  // Match controls
  document.getElementById('btn-start-timer')?.addEventListener('click', startTimer);
  document.getElementById('btn-pause-timer')?.addEventListener('click', pauseTimer);
  document.getElementById('btn-reset-timer')?.addEventListener('click', resetTimer);
  document.getElementById('btn-whistle')?.addEventListener('click', playWhistle);
  document.getElementById('btn-end-match')?.addEventListener('click', endMatch);
  document.getElementById('btn-generate-teams')?.addEventListener('click', () => {
    generateTeams(currentEventId);
  });
  
  // Goal buttons
  document.querySelectorAll('.btn-add-goal').forEach(btn => {
    btn.addEventListener('click', () => {
      addGoal(btn.dataset.team);
    });
  });
}

/**
 * Abre modal de criar/editar evento
 */
function openCreateEventModal(eventId = null) {
  const modal = document.getElementById('event-modal');
  const title = document.getElementById('modal-title');
  const form = document.getElementById('event-form');
  
  if (!modal || !form) return;
  
  form.reset();
  
  if (eventId) {
    const event = events.find(e => e.id === eventId);
    if (event) {
      title.textContent = 'Editar Evento';
      document.getElementById('event-id').value = event.id;
      document.getElementById('event-name').value = event.name;
      document.getElementById('event-description').value = event.description || '';
      document.getElementById('event-date').value = event.date;
      document.getElementById('event-time').value = event.time;
      document.getElementById('event-location').value = event.location;
      document.getElementById('event-max-players').value = event.maxPlayers;
      document.getElementById('event-cost').value = event.cost || '';
      document.getElementById('event-duration').value = event.duration || 60;
      document.getElementById('event-require-login').checked = event.requireLogin || false;
    }
  } else {
    title.textContent = 'Novo Evento';
    document.getElementById('event-id').value = '';
    
    // Set defaults
    const today = new Date();
    document.getElementById('event-date').value = today.toISOString().split('T')[0];
    document.getElementById('event-time').value = '19:00';
  }
  
  openModal('event-modal');
}

/**
 * Salva formulário de evento
 */
function saveEventForm() {
  const eventId = document.getElementById('event-id').value;
  const formData = {
    name: document.getElementById('event-name').value,
    description: document.getElementById('event-description').value,
    date: document.getElementById('event-date').value,
    time: document.getElementById('event-time').value,
    location: document.getElementById('event-location').value,
    maxPlayers: document.getElementById('event-max-players').value,
    cost: document.getElementById('event-cost').value,
    duration: document.getElementById('event-duration').value,
    requireLogin: document.getElementById('event-require-login').checked
  };
  
  // Validação básica
  if (!formData.name || !formData.date || !formData.time || !formData.location || !formData.maxPlayers) {
    showToast('error', 'Campos obrigatórios', 'Preencha todos os campos obrigatórios');
    return;
  }
  
  if (eventId) {
    updateEvent(eventId, formData);
    showToast('success', 'Atualizado', 'Evento atualizado com sucesso');
  } else {
    createEvent(formData);
    showToast('success', 'Criado', 'Evento criado com sucesso');
  }
  
  closeModal('event-modal');
  renderEvents();
}

/**
 * Abre modal de lixeira
 */
function openTrashModal() {
  const list = document.getElementById('trash-list');
  const empty = document.getElementById('trash-empty');
  
  if (!list) return;
  
  list.innerHTML = '';
  
  if (trash.length === 0) {
    empty?.classList.remove('hidden');
    list.classList.add('hidden');
  } else {
    empty?.classList.add('hidden');
    list.classList.remove('hidden');
    
    trash.forEach(item => {
      const div = document.createElement('div');
      div.className = 'participant-item';
      div.innerHTML = `
        <div class="participant-info">
          <div class="participant-name">${item.name}</div>
          <div class="participant-email">Excluído em: ${formatDate(item.deletedAt)}</div>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-sm btn-primary" onclick="restoreFromTrashAndClose('${item.id}')">
            Restaurar
          </button>
          <button class="btn btn-sm btn-danger" onclick="permanentlyDeleteAndClose('${item.id}')">
            Excluir
          </button>
        </div>
      `;
      list.appendChild(div);
    });
  }
  
  openModal('trash-modal');
}

/**
 * Restaura da lixeira e fecha modal
 */
function restoreFromTrashAndClose(eventId) {
  restoreFromTrash(eventId);
  openTrashModal();
  renderEvents();
  showToast('success', 'Restaurado', 'Evento restaurado com sucesso');
}

/**
 * Exclui permanentemente e fecha modal
 */
function permanentlyDeleteAndClose(eventId) {
  permanentlyDelete(eventId);
  openTrashModal();
  showToast('success', 'Excluído', 'Evento excluído permanentemente');
}

/**
 * Inicializa página de evento (evento.html)
 */
function initEventPage() {
  // Obter ID do evento da URL
  const params = new URLSearchParams(window.location.search);
  const eventId = params.get('id');
  
  if (!eventId) {
    showEventError();
    return;
  }
  
  const event = events.find(e => e.id === eventId);
  
  if (!event || event.deletedAt) {
    showEventError();
    return;
  }
  
  currentEventId = eventId;
  
  // Esconder loading, mostrar conteúdo
  document.getElementById('loading-state')?.classList.add('hidden');
  document.getElementById('event-content')?.classList.remove('hidden');
  
  // Preencher dados do evento
  document.getElementById('event-title').textContent = event.name;
  document.getElementById('event-description').textContent = event.description || '';
  document.getElementById('event-datetime').textContent = formatDate(event.date, true);
  document.getElementById('event-location-text').textContent = event.location;
  
  const confirmedCount = event.participants?.filter(p => p.status === 'confirmed').length || 0;
  document.getElementById('event-players-count').textContent = `${confirmedCount}/${event.maxPlayers} jogadores`;
  
  if (event.cost) {
    const costPerPerson = event.cost / Math.max(confirmedCount, 1);
    document.getElementById('event-cost-display').textContent = `R$ ${costPerPerson.toFixed(2)}`;
    document.getElementById('cost-section')?.classList.remove('hidden');
  }
  
  // Progress bar
  const progressPercent = (confirmedCount / event.maxPlayers) * 100;
  document.getElementById('spots-progress-fill').style.width = `${progressPercent}%`;
  document.getElementById('spots-progress-text').textContent = `${confirmedCount}/${event.maxPlayers}`;
  
  // Status badge
  const statusBadge = document.getElementById('event-status-badge');
  const isPast = isEventPast(event.date, event.time);
  const isFull = confirmedCount >= event.maxPlayers;
  
  if (isPast) {
    statusBadge.className = 'status-badge status-completed';
    statusBadge.textContent = '✅ Finalizado';
  } else if (isFull) {
    statusBadge.className = 'status-badge status-live';
    statusBadge.textContent = '🔒 Lotado';
  }
  
  // Botões de ação
  const hasJoined = localStorage.getItem(`${JOINED_PREFIX}${eventId}`);
  const joinBtn = document.getElementById('btn-join-event');
  const leaveBtn = document.getElementById('btn-leave-event');
  const addGuestBtn = document.getElementById('btn-add-guest');
  const lockWarning = document.getElementById('lock-warning');
  
  if (hasJoined) {
    joinBtn?.classList.add('hidden');
    leaveBtn?.classList.remove('hidden');
    addGuestBtn?.classList.remove('hidden');
    
    // Mostrar mapa
    document.getElementById('map-section')?.classList.remove('hidden');
    initMap(event.location);
    
    // Link do maps
    document.getElementById('maps-link').href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`;
  } else {
    joinBtn?.classList.remove('hidden');
    leaveBtn?.classList.add('hidden');
    addGuestBtn?.classList.add('hidden');
    
    if (isEventLocked(event.date, event.time)) {
      lockWarning?.classList.remove('hidden');
    }
  }
  
  // Handlers
  joinBtn?.addEventListener('click', () => {
    promptJoinEvent(eventId);
  });
  
  leaveBtn?.addEventListener('click', () => {
    if (confirm('Tem certeza que deseja cancelar sua presença?')) {
      // Precisaríamos do email do usuário atual
      showToast('info', 'Info', 'Contate o administrador para cancelar');
    }
  });
  
  addGuestBtn?.addEventListener('click', () => {
    openModal('guest-modal');
  });
  
  // Admin section
  const isAdmin = true; // Simplificado - em produção verificar autenticação
  if (isAdmin) {
    document.getElementById('admin-section')?.classList.remove('hidden');
    document.getElementById('btn-open-match')?.addEventListener('click', () => {
      closeModal('guest-modal');
      openMatchControl(eventId);
    });
    document.getElementById('btn-edit-event-public')?.addEventListener('click', () => {
      window.location.href = `index.html?edit=${eventId}`;
    });
  }
  
  // Participant tabs
  document.querySelectorAll('[data-participant-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-participant-tab]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      // Implementar filtro de participantes
    });
  });
  
  // Guest form
  document.getElementById('guest-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const guestData = {
      name: document.getElementById('guest-name').value,
      email: document.getElementById('guest-email').value
    };
    const isWaitlist = document.getElementById('guest-is-waitlist').checked;
    
    if (addGuest(eventId, guestData, isWaitlist)) {
      showToast('success', 'Convidado Adicionado', `${guestData.name} foi adicionado ao evento`);
      closeModal('guest-modal');
      document.getElementById('guest-form').reset();
      
      // Re-render
      const updatedEvent = events.find(e => e.id === eventId);
      renderParticipants(updatedEvent);
    }
  });
  
  document.getElementById('btn-cancel-guest')?.addEventListener('click', () => {
    closeModal('guest-modal');
  });
  
  // Render participants
  renderParticipants(event);
}

/**
 * Prompt para confirmar presença
 */
function promptJoinEvent(eventId) {
  const name = prompt('Digite seu nome:');
  if (!name) return;
  
  const email = prompt('Digite seu e-mail (opcional):') || '';
  
  if (joinEvent(eventId, { name, email })) {
    showToast('success', 'Confirmado!', 'Sua presença foi confirmada');
    setTimeout(() => {
      location.reload();
    }, 1500);
  }
}

/**
 * Mostra erro de evento não encontrado
 */
function showEventError() {
  document.getElementById('loading-state')?.classList.add('hidden');
  document.getElementById('error-state')?.classList.remove('hidden');
}

// ============================================
// EXPORTAR FUNÇÕES GLOBAIS
// ============================================
window.openEventDetails = openEventDetails;
window.restoreFromTrashAndClose = restoreFromTrashAndClose;
window.permanentlyDeleteAndClose = permanentlyDeleteAndClose;

// ============================================
// INICIAR APLICAÇÃO
// ============================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
