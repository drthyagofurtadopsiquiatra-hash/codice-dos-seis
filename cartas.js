'use strict';

const tool = document.querySelector('[data-collection]');
if (tool) {
  const collection = tool.dataset.collection;
  const cards = [...document.querySelectorAll('article.spell')];
  const search = tool.querySelector('input[type="search"]');
  const filter = tool.querySelector('select');
  const count = tool.querySelector('output');
  const message = tool.querySelector('[role="status"]');
  const backup = tool.querySelector('input[type="file"]');
  const storageKey = 'codice-seis.anotacoes.v2';
  const format = 'codice-seis-notes-v2';
  const normalize = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  let notes = Object.create(null);
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    for (const [key, value] of Object.entries(saved)) {
      if (typeof value === 'string') notes[key] = value;
    }
  } catch {
    message.textContent = 'As anotações salvas não puderam ser carregadas.';
  }

  function saveNotes() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(notes));
      return true;
    } catch {
      message.textContent = 'Este navegador não conseguiu salvar. Exporte as anotações antes de sair.';
      return false;
    }
  }

  const sections = new Set();
  for (const card of cards) {
    const section = card.closest('section');
    sections.add(section);
    const heading = card.querySelector('h3');
    const status = card.querySelector('.spell-status');
    card.dataset.search = normalize([heading.textContent, card.querySelector('.original-name')?.textContent || '', status?.textContent || ''].join(' '));
    card.dataset.group = collection === 'thalyta'
      ? (['zombaria-viciosa', 'mensagem', 'rajada-mistica', 'estilhaco-mental', 'prestidigitacao', 'ilusao-menor'].includes(card.id) ? 'truques' : 'circulo')
      : section.id;
    const details = document.createElement('details');
    details.open = true;
    const summary = document.createElement('summary');
    summary.append(heading);
    details.append(summary, ...card.childNodes);
    card.append(details);

    const label = document.createElement('label');
    const input = document.createElement('textarea');
    label.textContent = 'Anotações pessoais';
    input.rows = 2;
    input.maxLength = 10000;
    input.dataset.note = collection + '/' + card.id;
    input.value = notes[input.dataset.note] || '';
    input.addEventListener('input', () => {
      if (input.value) notes[input.dataset.note] = input.value;
      else delete notes[input.dataset.note];
      saveNotes();
    });
    label.append(input);
    details.querySelector('.spell-copy').append(label);
  }

  for (const [key, label] of [
    ['preparadas', 'Preparadas'], ['disponiveis', 'Disponíveis para preparar'],
    ['paladino', 'Preparadas de Paladino'], ['bruxo', 'Preparadas de Bruxo'],
    ['circulo', 'Magias de 1º círculo'], ['truques', 'Truques'],
  ]) {
    if (cards.some((card) => card.dataset.group === key)) filter.add(new Option(label, key));
  }

  function redraw() {
    const query = normalize(search.value);
    let visible = 0;
    for (const card of cards) {
      card.hidden = !(card.dataset.search.includes(query) && (!filter.value || card.dataset.group === filter.value));
      if (!card.hidden) visible++;
    }
    for (const section of sections) section.hidden = !section.querySelector('article.spell:not([hidden])');
    count.textContent = visible === 0 ? 'Nenhuma carta encontrada.' : visible === 1 ? '1 carta' : visible + ' cartas';
  }

  search.addEventListener('input', redraw);
  filter.addEventListener('change', redraw);
  for (const button of tool.querySelectorAll('[data-expand]')) {
    button.addEventListener('click', () => {
      for (const card of cards) {
        if (!card.hidden) card.querySelector('details').open = button.dataset.expand === 'true';
      }
    });
  }

  tool.querySelector('[data-export]').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({format, notes}, null, 2)], {type: 'application/json'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Codice-dos-Seis-anotacoes.json';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  backup.addEventListener('change', async () => {
    const file = backup.files[0];
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      if (imported.format !== format || !imported.notes || typeof imported.notes !== 'object' || Array.isArray(imported.notes)) throw new Error();
      let total = 0;
      let conflicts = 0;
      for (const [key, value] of Object.entries(imported.notes)) {
        if (!/^(thalyta|mercile|thyago|laios)\/[a-z0-9-]+$/.test(key) || typeof value !== 'string' || !value.trim() || value.length > 10000) continue;
        if (notes[key] && notes[key] !== value) {
          conflicts++;
          continue;
        }
        notes[key] = value;
        total++;
      }
      for (const input of document.querySelectorAll('textarea[data-note]')) input.value = notes[input.dataset.note] || '';
      if (saveNotes()) message.textContent = total + ' anotações importadas. ' + (conflicts ? conflicts + ' conflitos mantiveram a anotação local.' : '');
    } catch {
      message.textContent = 'Escolha um arquivo JSON exportado por esta versão do Códice.';
    } finally {
      backup.value = '';
    }
  });
  tool.hidden = false;
  redraw();
}
