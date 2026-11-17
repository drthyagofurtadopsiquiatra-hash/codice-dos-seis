'use strict';

const screens = [...document.querySelectorAll('.screen')];
const tabs = [...document.querySelectorAll('.nav a')];
const notesKey = 'codice-seis.anotacoes.v2';
const backupFormat = 'codice-seis-notes-v2';
const notesButton = document.querySelector('[data-export]');
const upload = document.querySelector('input[type=file]');
const message = document.querySelector('.backups [role=status]');
const normalize = (text) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const notes = Object.create(null);

try {
  for (const [key, value] of Object.entries(JSON.parse(localStorage.getItem(notesKey) || '{}'))) {
    if (typeof value === 'string') notes[key] = value;
  }
} catch {
  message.textContent = 'As anotações salvas não puderam ser carregadas.';
}

function save() {
  try {
    localStorage.setItem(notesKey, JSON.stringify(notes));
    return true;
  } catch {
    message.textContent = 'O navegador não conseguiu salvar. Exporte as anotações antes de sair.';
    document.querySelector('.backups').open = true;
    return false;
  }
}

const fields = new Map([...document.querySelectorAll('[data-note]')].map(card => [card.dataset.note, card.querySelector('textarea')]));
for (const [key, field] of fields) {
  field.value = notes[key] || '';
  field.addEventListener('input', () => {
    if (field.value) notes[key] = field.value;
    else delete notes[key];
    save();
  });
}

const searches = new Map();
for (const screen of screens) {
  const controls = screen.querySelector('.controls');
  if (!controls) continue;
  const search = controls.querySelector('input');
  const select = controls.querySelector('select');
  const count = controls.querySelector('output');
  const cards = [...screen.querySelectorAll('.card')];
  const names = cards.map(card => normalize(card.querySelector('summary').textContent));

  function redraw() {
    let shown = 0;
    const query = normalize(search.value);
    cards.forEach((card, index) => {
      card.hidden = !names[index].includes(query) || Boolean(select?.value && card.dataset.group !== select.value);
      if (!card.hidden) shown++;
    });
    count.textContent = shown === 0 ? 'Nenhum registro encontrado.' : shown === 1 ? '1 registro' : shown + ' registros';
  }
  searches.set(screen.id, {search, select, redraw});
  search.addEventListener('input', redraw);
  select?.addEventListener('change', redraw);
  for (const button of controls.querySelectorAll('[data-open]')) {
    button.addEventListener('click', () => {
      for (const card of cards) {
        if (!card.hidden) card.open = button.dataset.open === 'true';
      }
    });
  }
  controls.hidden = false;
  redraw();
}

function show(scroll) {
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { id = ''; }
  let target = document.getElementById(id === 'cartas' ? 'thalyta' : id);
  if (!target && id) target = document.getElementById('thalyta-' + id);
  const active = target?.closest('.screen') || screens[0];
  for (const screen of screens) screen.hidden = screen !== active;
  for (const tab of tabs) {
    if (tab.hash === '#' + active.id) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }
  if (target?.matches('.card')) {
    const state = searches.get(active.id);
    if (target.hidden && state) {
      state.search.value = '';
      if (state.select) state.select.value = '';
      state.redraw();
    }
    target.open = true;
  }
  if (scroll) {
    if (target && target !== active) target.scrollIntoView();
    else window.scrollTo({top: 0, behavior: 'instant'});
  }
}
show(Boolean(location.hash));
window.addEventListener('hashchange', () => show(true));

notesButton.addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify({format: backupFormat, notes}, null, 2)], {type: 'application/json'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Codice-dos-Seis-anotacoes.json';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

upload.addEventListener('change', async () => {
  const file = upload.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.format !== backupFormat || !data.notes || typeof data.notes !== 'object' || Array.isArray(data.notes)) throw new Error();
    let count = 0;
    let conflicts = 0;
    for (const [key, value] of Object.entries(data.notes)) {
      if (!fields.has(key) || typeof value !== 'string' || !value.trim() || value.length > 10000) continue;
      if (notes[key] && notes[key] !== value) {
        conflicts++;
        continue;
      }
      notes[key] = value;
      fields.get(key).value = value;
      count++;
    }
    if (save()) message.textContent = (count === 1 ? '1 anotação importada.' : count + ' anotações importadas.') + (conflicts ? ' Anotações locais preservadas em ' + conflicts + ' conflitos.' : '');
  } catch {
    message.textContent = 'Selecione um backup JSON da versão online do Códice.';
  } finally {
    upload.value = '';
  }
});
document.querySelector('.backups').hidden = false;
