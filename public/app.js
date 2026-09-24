const board = document.querySelector('#board');
const matrix = document.querySelector('#matrix');
const cardDialog = document.querySelector('#card-dialog');
const toast = document.querySelector('#toast');
let cards = [];
let currentUser = null;
let activeFilter = 'all';
let priorityFilter = 'all';
let currentView = 'cards';
let searchQuery = '';
let customViews = [];
let imageData = '';
let toastTimer;

async function api(path, options = {}) {
  const response = await fetch(path, { credentials:'same-origin', headers:{'content-type':'application/json', ...(options.headers || {})}, ...options });
  if (response.status === 204) return null;
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Das hat nicht geklappt.');
  return result;
}

function escapeHtml(value = '') { return String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function icon(name, className = 'icon') { return `<svg class="${className}" aria-hidden="true"><use href="/icons.svg#${name}"></use></svg>`; }
function today() { return new Date().toISOString().slice(0, 10); }
function isDone(card) { return Boolean(card.done) || (card.checklist?.length > 0 && card.checklist.every((item) => item.done)); }
function dueTimestamp(card) { return card.dueDate ? new Date(`${card.dueDate}T23:59:00`).getTime() : Infinity; }
function niceDate(value) { return new Intl.DateTimeFormat('de-DE', { day:'numeric', month:'short' }).format(new Date(`${value}T12:00:00`)); }
function rank(card) { return ({high:6,medium:3,low:1}[card.importance] || 3) + ({high:3,medium:2,low:1}[card.urgency] || 2); }
function groupFor(card) { if (card.importance === 'high' && card.urgency === 'high') return 'urgent'; if (card.importance === 'low' && card.urgency === 'low') return 'later'; return 'next'; }
function showToast(message) { toast.textContent = message; toast.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('visible'), 2700); }

function showAuth(mode = 'login') {
  document.querySelector('#auth-screen').classList.remove('hidden');
  document.querySelector('#app-shell').classList.add('hidden');
  const isLogin = mode === 'login';
  document.querySelector('#login-form').classList.toggle('hidden', !isLogin);
  document.querySelector('#register-form').classList.toggle('hidden', isLogin);
  document.querySelectorAll('[data-auth-view]').forEach((button) => button.classList.toggle('active', button.dataset.authView === mode));
  document.querySelector('#auth-title').textContent = isLogin ? 'Schön, dass du da bist.' : 'Dein Bereich beginnt hier.';
  document.querySelector('#auth-subtitle').textContent = isLogin ? 'Melde dich bei deinem Kartenwerk an.' : 'Erstelle ein lokales Konto für deine Aufgaben.';
  document.querySelector('#login-error').textContent = '';
  document.querySelector('#register-error').textContent = '';
}

async function activateUser(user) {
  currentUser = user;
  document.querySelector('#auth-screen').classList.add('hidden');
  document.querySelector('#app-shell').classList.remove('hidden');
  const initials = (user.name || user.email).trim().slice(0, 1).toUpperCase();
  document.querySelector('#profile-avatar').textContent = initials;
  document.querySelector('#top-account-open').textContent = initials;
  document.querySelector('#account-large-avatar').textContent = initials;
  document.querySelector('#profile-name').textContent = user.name;
  document.querySelector('#profile-email').textContent = user.email;
  document.querySelector('#account-dialog-name').textContent = user.name;
  document.querySelector('#account-dialog-email').textContent = user.email;
  const saved = localStorage.getItem(`kartenwerk-views:${user.id}`);
  try { customViews = saved ? JSON.parse(saved) : []; } catch { customViews = []; }
  renderCustomViews();
  await loadCards();
}

async function checkSession() {
  try { const { user } = await api('/api/me'); if (user) await activateUser(user); else showAuth('login'); }
  catch { showAuth('login'); showToast('Der lokale Server ist nicht erreichbar. Bitte starte ihn erneut.'); }
}

async function loadCards() {
  try { cards = await api('/api/cards'); render(); }
  catch (error) {
    cards = [];
    render();
    if (error.message.includes('Bitte melde dich an')) showAuth('login');
    else showToast(error.message);
  }
}

document.querySelectorAll('[data-auth-view]').forEach((button) => button.addEventListener('click', () => showAuth(button.dataset.authView)));
document.querySelector('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const submit = event.currentTarget.querySelector('[type=submit]');
  submit.disabled = true;
  try { const result = await api('/api/login', { method:'POST', body:JSON.stringify({email:form.get('email'), password:form.get('password')}) }); event.currentTarget.reset(); await activateUser(result.user); }
  catch (error) { document.querySelector('#login-error').textContent = error.message; }
  finally { submit.disabled = false; }
});
document.querySelector('#register-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const submit = event.currentTarget.querySelector('[type=submit]');
  submit.disabled = true;
  if (form.get('password') !== form.get('passwordConfirm')) { document.querySelector('#register-error').textContent = 'Die Passwörter stimmen nicht überein.'; submit.disabled = false; return; }
  try { const result = await api('/api/register', { method:'POST', body:JSON.stringify({name:form.get('name'), email:form.get('email'), password:form.get('password')}) }); event.currentTarget.reset(); await activateUser(result.user); showToast('Dein lokales Konto ist erstellt.'); }
  catch (error) { document.querySelector('#register-error').textContent = error.message; }
  finally { submit.disabled = false; }
});

function activeItems() {
  let items = [...cards];
  const filter = activeFilter.startsWith('custom:') ? customViews.find((view) => view.id === activeFilter.slice(7))?.kind : activeFilter;
  if (filter === 'done') items = items.filter(isDone);
  else {
    items = items.filter((card) => !isDone(card));
    if (filter === 'today') items = items.filter((card) => card.dueDate === today());
    if (filter === 'week') { const end = new Date(); end.setDate(end.getDate() + 7); items = items.filter((card) => card.dueDate && new Date(`${card.dueDate}T00:00:00`) <= end); }
    if (filter === 'high') items = items.filter((card) => card.importance === 'high' || card.urgency === 'high');
    if (filter === 'dated') items = items.filter((card) => Boolean(card.dueDate));
  }
  if (priorityFilter !== 'all') items = items.filter((card) => card.importance === priorityFilter);
  if (searchQuery) items = items.filter((card) => `${card.title} ${card.description}`.toLowerCase().includes(searchQuery.toLowerCase()));
  const sort = document.querySelector('#sort-select').value;
  items.sort((a,b) => sort === 'date' ? dueTimestamp(a)-dueTimestamp(b) : sort === 'created' ? new Date(b.createdAt)-new Date(a.createdAt) : rank(b)-rank(a));
  return items;
}

function priorityLabel(card) { return card.importance === 'high' ? 'Wichtig' : card.importance === 'low' ? 'Niedrige Priorität' : 'Normal'; }
function cardTemplate(card) {
  const done = isDone(card);
  const completed = card.checklist?.filter((item) => item.done).length || 0;
  const total = card.checklist?.length || 0;
  const dueClass = card.dueDate && card.dueDate < today() && !done ? 'overdue' : card.dueDate === today() && !done ? 'soon' : '';
  const due = card.dueDate ? `<div class="card-date ${dueClass}"><span>${icon('clock-3','icon icon-small')}</span> Fällig ${niceDate(card.dueDate)}</div>` : '';
  const checklist = total ? `<div class="checklist">${card.checklist.map((item) => `<label class="check-item"><input type="checkbox" data-check="${escapeHtml(item.id)}" ${item.done?'checked':''}/><span>${escapeHtml(item.text)}</span></label>`).join('')}</div><div class="check-progress"><i style="width:${Math.round(completed/total*100)}%"></i></div>` : '';
  return `<article class="task-card ${done?'completed':''}" data-card="${escapeHtml(card.id)}"><div class="card-top"><span class="priority-badge priority-${card.importance}"><i></i>${priorityLabel(card)}</span><button class="card-menu" data-delete="${escapeHtml(card.id)}" aria-label="Karte löschen" title="Karte löschen">${icon('ellipsis','icon icon-small')}</button></div><h3>${escapeHtml(card.title)}</h3>${card.description?`<p class="task-description">${escapeHtml(card.description)}</p>`:''}${card.image?`<img class="card-image" src="${escapeHtml(card.image)}" alt="Bild zur Aufgabe" />`:''}${due}${checklist}<div class="card-footer"><span>${total?`${completed} von ${total} Schritten`:done?'Erledigt':'Aufgabe'}</span><button class="done-toggle" data-toggle-done="${escapeHtml(card.id)}">${done?'Wieder öffnen':`${icon('check','icon icon-small')} Erledigt`}</button><span class="mini-avatar">${escapeHtml((currentUser.name||'M').slice(0,1).toUpperCase())}</span></div></article>`;
}

function render() {
  const items = activeItems();
  const openCount = cards.filter((card) => !isDone(card)).length;
  const doneCount = cards.filter(isDone).length;
  document.querySelector('#total-count').textContent = openCount;
  document.querySelector('#today-count').textContent = cards.filter((card) => card.dueDate === today() && !isDone(card)).length;
  document.querySelector('#open-count').textContent = openCount;
  document.querySelector('#done-count').textContent = doneCount;
  document.querySelector('#filter-badge').style.display = priorityFilter === 'all' ? 'none' : 'inline-block';
  document.querySelector('#summary-title').textContent = cards.length ? 'Du hast das im Blick.' : 'Dein Aufgabenbrett ist bereit.';
  document.querySelector('#summary-text').textContent = cards.length ? `${openCount} offene Aufgaben — fang mit dem an, was heute zählt.` : 'Erstelle deine erste Karte oder lass ChatGPT eine aus deinem Bild machen.';
  document.querySelector('#footer-date').textContent = new Intl.DateTimeFormat('de-DE', { weekday:'long', day:'numeric', month:'long' }).format(new Date());
  if (currentView === 'matrix') { renderMatrix(items); return; }
  const groups = [['urgent','Wichtig & dringend','#df946b'],['next','Als Nächstes','#c5a96d'],['later','Wenn Zeit ist','#91a08e']];
  board.innerHTML = groups.map(([key,title,color]) => {
    const group = items.filter((card) => groupFor(card) === key);
    return `<section class="column"><header class="column-head"><div class="column-title"><i style="background:${color}"></i>${title}</div><span class="column-count">${group.length}</span></header><div class="column-cards">${group.length ? group.map(cardTemplate).join('') : '<div class="empty-column">Hier ist gerade Platz für Neues.</div>'}</div><button class="add-column" data-add>${icon('plus','icon icon-small')} Karte hinzufügen</button></section>`;
  }).join('');
  board.classList.remove('hidden'); matrix.classList.add('hidden');
}

function renderMatrix(items) {
  board.classList.add('hidden'); matrix.classList.remove('hidden');
  const levels = ['high','medium','low'];
  document.querySelector('#matrix-cells').innerHTML = levels.flatMap((importance) => levels.map((urgency) => {
    const matching = items.filter((card) => card.importance === importance && card.urgency === urgency);
    const importanceLabel = importance === 'high' ? 'Wichtig' : importance === 'medium' ? 'Mittel' : 'Niedrig';
    const urgencyLabel = urgency === 'high' ? 'dringend' : urgency === 'medium' ? 'normal' : 'entspannt';
    return `<div class="matrix-cell"><small>${importanceLabel} · ${urgencyLabel}</small>${matching.map((card) => `<span class="matrix-chip">${escapeHtml(card.title)}</span>`).join('')}</div>`;
  })).join('');
}

function renderCustomViews() {
  document.querySelector('#custom-views').innerHTML = customViews.map((view) => `<div class="custom-view-row"><button class="custom-view-button" data-custom-view="${escapeHtml(view.id)}"><span class="view-dot violet"></span>${escapeHtml(view.name)}</button><button class="remove-view" data-remove-view="${escapeHtml(view.id)}" title="Ansicht entfernen" aria-label="Ansicht entfernen">${icon('x','icon icon-small')}</button></div>`).join('');
}

function addChecklistInput(value = '') {
  const row = document.createElement('div'); row.className = 'check-input-row';
  row.innerHTML = `<input maxlength="240" placeholder="Nächster kleiner Schritt" value="${escapeHtml(value)}"/><button class="remove-check" type="button" aria-label="Punkt entfernen">${icon('x','icon icon-small')}</button>`;
  row.querySelector('button').onclick = () => row.remove();
  document.querySelector('#checklist-inputs').append(row);
  row.querySelector('input').focus();
}

function openCardDialog() {
  imageData = ''; document.querySelector('#card-form').reset(); document.querySelector('#checklist-inputs').innerHTML = ''; document.querySelector('#image-name').textContent = ''; addChecklistInput(); cardDialog.showModal(); document.querySelector('#card-title').focus();
}

document.querySelector('#new-card').onclick = openCardDialog;
document.querySelector('#add-check').onclick = () => addChecklistInput();
document.querySelector('#choose-image').onclick = () => document.querySelector('#card-image').click();
document.querySelector('#card-image').onchange = async (event) => {
  const file = event.target.files[0]; if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Bitte wähle eine Bilddatei.'); event.target.value = ''; return; }
  if (file.size > 1_800_000) { showToast('Bitte wähle ein Bild unter 1,8 MB.'); event.target.value = ''; return; }
  imageData = await new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(file); });
  document.querySelector('#image-name').textContent = file.name;
};
const uploadArea = document.querySelector('#upload-area');
uploadArea.ondragover = (event) => { event.preventDefault(); uploadArea.classList.add('dragging'); };
uploadArea.ondragleave = () => uploadArea.classList.remove('dragging');
uploadArea.ondrop = (event) => { event.preventDefault(); uploadArea.classList.remove('dragging'); const file = event.dataTransfer.files[0]; if (!file || !file.type.startsWith('image/')) return; const transfer = new DataTransfer(); transfer.items.add(file); document.querySelector('#card-image').files = transfer.files; document.querySelector('#card-image').dispatchEvent(new Event('change')); };

document.querySelector('#card-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const form = new FormData(event.currentTarget);
  const checklist = [...document.querySelectorAll('#checklist-inputs input')].map((input) => input.value.trim()).filter(Boolean).map((text) => ({id:crypto.randomUUID(), text, done:false}));
  const card = { title:form.get('title'), description:form.get('description'), importance:form.get('importance'), urgency:form.get('urgency'), dueDate:form.get('dueDate'), checklist, image:imageData, done:false };
  try { await api('/api/cards', {method:'POST', body:JSON.stringify(card)}); cardDialog.close(); await loadCards(); showToast('Deine Karte ist angelegt.'); }
  catch (error) { showToast(error.message); }
});

async function patchCard(id, patch) {
  try { await api(`/api/cards/${encodeURIComponent(id)}`, {method:'PATCH', body:JSON.stringify(patch)}); await loadCards(); }
  catch (error) { showToast(error.message); }
}

document.addEventListener('click', async (event) => {
  const close = event.target.closest('[data-close]');
  if (close) { close.closest('dialog')?.close(); return; }
  if (event.target.closest('[data-add]')) { openCardDialog(); return; }
  const sideFilter = event.target.closest('[data-filter]');
  if (sideFilter) { setFilter(sideFilter.dataset.filter, sideFilter.textContent.trim()); return; }
  const customView = event.target.closest('[data-custom-view]');
  if (customView) { setFilter(`custom:${customView.dataset.customView}`, customViews.find((view) => view.id === customView.dataset.customView)?.name || 'Ansicht'); return; }
  const removeView = event.target.closest('[data-remove-view]');
  if (removeView) { customViews = customViews.filter((view) => view.id !== removeView.dataset.removeView); localStorage.setItem(`kartenwerk-views:${currentUser.id}`, JSON.stringify(customViews)); renderCustomViews(); if (activeFilter === `custom:${removeView.dataset.removeView}`) setFilter('all','Alle Aufgaben'); return; }
  const deleteButton = event.target.closest('[data-delete]');
  if (deleteButton) { if (!confirm('Diese Karte löschen?')) return; try { await api(`/api/cards/${encodeURIComponent(deleteButton.dataset.delete)}`, {method:'DELETE'}); await loadCards(); showToast('Karte gelöscht.'); } catch (error) { showToast(error.message); } return; }
  const toggleDone = event.target.closest('[data-toggle-done]');
  if (toggleDone) { const card = cards.find((item) => item.id === toggleDone.dataset.toggleDone); if (card) await patchCard(card.id,{done:!isDone(card)}); return; }
});

board.addEventListener('change', async (event) => {
  const checkbox = event.target.closest('[data-check]'); if (!checkbox) return;
  const card = cards.find((item) => item.id === checkbox.closest('[data-card]').dataset.card); if (!card) return;
  const checklist = card.checklist.map((item) => item.id === checkbox.dataset.check ? {...item,done:checkbox.checked} : item);
  const done = checklist.length > 0 && checklist.every((item) => item.done);
  await patchCard(card.id,{checklist,done});
});

function setFilter(filter, label) {
  activeFilter = filter;
  const choices = document.querySelectorAll('.nav-item,.side-link,.custom-view-button');
  choices.forEach((item) => item.classList.remove('active'));
  const selected = [...choices].find((item) => item.dataset.filter === filter || item.dataset.customView === filter.slice(7));
  selected?.classList.add('active');
  document.querySelector('.breadcrumbs strong').textContent = label;
  render();
}
document.querySelectorAll('.tab').forEach((button) => button.addEventListener('click', () => { currentView = button.dataset.view; document.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('active',tab===button)); render(); }));
document.querySelector('#sort-select').addEventListener('change', render);
document.querySelector('#filter-open').onclick = () => { document.querySelector('#priority-filter').value = priorityFilter; document.querySelector('#filter-dialog').showModal(); };
document.querySelector('#filter-form').addEventListener('submit', (event) => { event.preventDefault(); priorityFilter = document.querySelector('#priority-filter').value; document.querySelector('#filter-dialog').close(); render(); });
document.querySelector('#clear-filter').onclick = () => { priorityFilter = 'all'; document.querySelector('#filter-dialog').close(); render(); };
document.querySelector('#mcp-help').onclick = () => document.querySelector('#help-dialog').showModal();
document.querySelector('#search-open').onclick = () => { document.querySelector('#search-query').value = searchQuery; document.querySelector('#search-dialog').showModal(); document.querySelector('#search-query').focus(); };
document.querySelector('#search-form').addEventListener('submit', (event) => { event.preventDefault(); searchQuery = document.querySelector('#search-query').value.trim(); document.querySelector('#search-dialog').close(); render(); if (!activeItems().length) showToast('Keine passende Karte gefunden.'); });
document.querySelector('#notifications-open').onclick = () => {
  const upcoming = cards.filter((card) => card.dueDate && !isDone(card)).sort((a,b) => dueTimestamp(a)-dueTimestamp(b));
  const list = document.querySelector('#notifications-list');
  list.innerHTML = upcoming.length ? upcoming.map((card) => `<div class="notification-item"><strong>${escapeHtml(card.title)}</strong>${card.dueDate < today()?'Überfällig':card.dueDate===today()?'Heute fällig':`Fällig ${niceDate(card.dueDate)}`}</div>`).join('') : '<div class="notification-empty">Keine offenen Termine. Alles im grünen Bereich.</div>';
  document.querySelector('#notifications-dialog').showModal();
};

function openAccount() { document.querySelector('#account-dialog').showModal(); }
document.querySelector('#account-open').onclick = openAccount;
document.querySelector('#top-account-open').onclick = openAccount;
document.querySelector('#logout-button').onclick = async () => { try { await api('/api/logout',{method:'POST',body:'{}'}); } catch {} document.querySelector('#account-dialog').close(); currentUser = null; cards = []; showAuth('login'); showToast('Du bist abgemeldet.'); };

document.querySelector('#add-view').onclick = () => { document.querySelector('#view-form').reset(); document.querySelector('#view-dialog').showModal(); };
document.querySelector('#view-form').addEventListener('submit', (event) => {
  event.preventDefault(); const name = document.querySelector('#view-name').value.trim(); const kind = document.querySelector('#view-kind').value;
  if (customViews.some((view) => view.name.toLowerCase() === name.toLowerCase())) { showToast('Eine Ansicht mit diesem Namen gibt es schon.'); return; }
  customViews.push({id:crypto.randomUUID(),name,kind}); localStorage.setItem(`kartenwerk-views:${currentUser.id}`,JSON.stringify(customViews)); renderCustomViews(); document.querySelector('#view-dialog').close(); showToast('Ansicht hinzugefügt.');
});

document.querySelectorAll('dialog').forEach((dialog) => dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); }));
setInterval(async () => {
  if (!currentUser || document.hidden) return;
  try { const fresh = await api('/api/cards'); if (JSON.stringify(fresh) !== JSON.stringify(cards)) { cards = fresh; render(); } }
  catch { /* Temporary local server interruptions are shown on the next user action. */ }
}, 3000);
checkSession();
