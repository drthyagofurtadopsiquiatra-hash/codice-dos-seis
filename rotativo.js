'use strict';
const campaign = JSON.parse(document.getElementById('public-roster').textContent);
const storageKey = `codice.notes.v3:${campaign.campaignId}`;
let notes = Object.create(null);
const status = document.getElementById('backup-status');
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
  for (const person of campaign.roster) if (typeof saved[person.id] === 'string') notes[person.id] = saved[person.id];
} catch { status.textContent = 'Não foi possível ler as anotações locais. Use um backup para recuperá-las.'; }
const container = document.getElementById('roster');
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify(notes)); return true; }
  catch { status.textContent = 'Não foi possível salvar no navegador. Exporte suas anotações antes de sair.'; return false; }
}
for (const person of campaign.roster) {
  const card = element('article', undefined, 'person-card');
  card.id = 'personagem-' + person.id;
  card.dataset.person = person.id;
  if (person.portrait) {
    const figure = element('figure', undefined, 'portrait');
    const link = element('a');
    link.href = person.portrait;
    link.setAttribute('aria-label', 'Ampliar retrato de ' + person.name);
    const image = element('img');
    image.src = person.portrait;
    image.alt = person.portraitAlt;
    image.loading = 'lazy';
    link.append(image);
    figure.append(link, element('figcaption', person.portraitCaption));
    card.append(figure);
  }

  card.append(element('span', person.formation === 'initial' ? 'Formação inicial' : 'Reserva', 'tag'));
  card.append(element('h2', person.name));
  card.append(element('p', `${person.classLabel} · Nível ${person.level}`, 'person-class'));
  const details = element('details');
  details.append(element('summary', 'Magias e anotações'));
  for (const [key, label] of [['cantrips', 'Truques conhecidos'], ['prepared', 'Magias preparadas']]) {
    details.append(element('h3', label));
    if (person[key].length) {
      const list = element('ul', undefined, 'spell-list');
      for (const spell of person[key]) list.append(element('li', spell.name));
      details.append(list);
    } else details.append(element('p', 'Nenhuma registrada.', 'muted'));
  }
  details.append(element('p', 'Listas do reinício. As cartas mecânicas anteriores permanecem no acervo e podem corresponder a outra ficha.', 'scope-note'));
  const label = element('label', 'Minhas anotações');
  const field = element('textarea');
  field.rows = 3;
  field.maxLength = 10000;
  field.value = notes[person.id] || '';
  field.placeholder = 'Ideias e lembretes deste personagem…';
  field.addEventListener('input', () => {
    if (field.value) notes[person.id] = field.value;
    else delete notes[person.id];
    persist();
  });
  label.append(field);
  details.append(label);
  card.append(details);
  container.append(card);
}
const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const search = document.getElementById('roster-search');
const formation = document.getElementById('formation');
function filterRoster() {
  let count = 0;
  for (const person of campaign.roster) {
    const card = document.getElementById('personagem-' + person.id);
    card.hidden = !normalize(person.name + ' ' + person.classLabel).includes(normalize(search.value)) || Boolean(formation.value !== 'all' && person.formation !== formation.value);
    if (!card.hidden) count++;
  }
  document.getElementById('roster-count').textContent = `${count} ${count === 1 ? 'personagem' : 'personagens'}`;
}
search.addEventListener('input', filterRoster);
formation.addEventListener('change', filterRoster);
filterRoster();
document.getElementById('source-status').textContent = `${campaign.status} · ${campaign.updated.split('-').reverse().join('/')} · ${campaign.roster.length} no elenco · ${campaign.roster.filter(x => x.formation === 'initial').length} na formação inicial`;
function navigate() {
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { id = ''; }
  const aliases = {painel:'elenco',thyago:'personagem-feiticeiro',thalyta:'personagem-thalya',senshi:'personagem-senshi',mercile:'personagem-marcelli',laios:'personagem-laios',fichas:'elenco'};
  id = aliases[id] || id;
  const target = document.getElementById(id);
  const active = target?.closest('.screen') || document.getElementById('elenco');
  for (const screen of document.querySelectorAll('.screen')) screen.hidden = screen !== active;
  for (const link of document.querySelectorAll('.nav a')) {
    if (link.getAttribute('href') === '#' + active.id) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  if (target?.matches('.person-card')) {
    search.value = '';
    formation.value = 'all';
    filterRoster();
    target.querySelector('details').open = true;
    target.scrollIntoView({block:'start'});
  } else window.scrollTo(0,0);
}
window.addEventListener('hashchange', navigate);
navigate();
document.getElementById('export-notes').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({format:'codice-roster-notes-v3', campaignId:campaign.campaignId, notes},null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const link = element('a');
  link.href = url;
  link.download = `Codice-${campaign.campaignId}-anotacoes.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
});
document.getElementById('import-notes').addEventListener('change', async event => {
  try {
    const file = event.target.files[0];
    if (!file) return;
    const data = JSON.parse(await file.text());
    if (data.format !== 'codice-roster-notes-v3' || data.campaignId !== campaign.campaignId || !data.notes || typeof data.notes !== 'object' || Array.isArray(data.notes)) throw new Error('Use um backup deste reinício. Anotações antigas continuam no acervo.');
    let added = 0, conflicts = 0;
    for (const person of campaign.roster) {
      const value = data.notes[person.id];
      if (typeof value !== 'string' || !value.trim() || value.length > 10000) continue;
      if (notes[person.id] && notes[person.id] !== value) { conflicts++; continue; }
      notes[person.id] = value;
      document.getElementById('personagem-' + person.id).querySelector('textarea').value = value;
      added++;
    }
    if (persist()) status.textContent = `${added} anotações importadas. ${conflicts} conflitos preservados sem sobrescrever.`;
  } catch (error) { status.textContent = error instanceof SyntaxError ? 'O arquivo não é um backup JSON válido.' : error.message; }
  finally { event.target.value = ''; }
});
