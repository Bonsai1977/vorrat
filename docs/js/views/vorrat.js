// Ganzer Vorrat mit Filtern
import { holen, stammdaten, optionen, esc, ICON } from '../api.js';
import { bestandZeile, listeVerdrahten } from '../bearbeiten.js';
import { bestandExportieren } from '../export.js';

// Filter bleiben erhalten, solange die App offen ist
const filter = { suche: '', lagerort: '', kategorie: '', sortierung: 'mhd' };

export default async function vorrat(el, params) {
  if (params.has('lagerort')) filter.lagerort = params.get('lagerort');
  const { lagerorte, kategorien, einstellungen } = await stammdaten(true);

  el.innerHTML = `
    <div class="filter">
      <input class="suche" type="search" placeholder="Suchen …" aria-label="Vorrat durchsuchen" value="">
      <select aria-label="Lagerort" data-f="lagerort">${optionen(lagerorte, filter.lagerort, 'Alle Lagerorte')}</select>
      <select aria-label="Kategorie" data-f="kategorie">${optionen(kategorien, filter.kategorie, 'Alle Kategorien')}</select>
      <select aria-label="Sortierung" data-f="sortierung" class="voll">
        <option value="mhd">Sortiert nach Haltbarkeit</option>
        <option value="name">Sortiert nach Name</option>
        <option value="lagerort">Sortiert nach Lagerort</option>
        <option value="neu">Zuletzt hinzugefügt</option>
      </select>
    </div>
    <div data-ergebnis></div>`;

  const suche = el.querySelector('.suche');
  suche.value = filter.suche;
  el.querySelector('[data-f="sortierung"]').value = filter.sortierung;
  const ergebnis = el.querySelector('[data-ergebnis]');

  async function laden() {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(filter)) if (v) q.set(k, v);
    const eintraege = await holen(`bestand?${q}`);
    if (!eintraege.length) {
      const gefiltert = filter.suche || filter.lagerort || filter.kategorie;
      ergebnis.innerHTML = `<div class="leer karte stapel">
        <p style="margin:0">${gefiltert ? 'Nichts gefunden.' : 'Der Vorrat ist leer.'}</p>
        <a class="knopf haupt" href="#/hinzufuegen?scan=1">${ICON.scan} Artikel scannen</a></div>`;
      return;
    }
    let html = '';
    let letzteGruppe = null;
    for (const e of eintraege) {
      if (filter.sortierung === 'lagerort' && e.lagerort !== letzteGruppe) {
        if (letzteGruppe !== null) html += '</ul>';
        html += `<div class="gruppe">${esc(e.lagerort)}</div><ul class="liste">`;
        letzteGruppe = e.lagerort;
      } else if (letzteGruppe === null && filter.sortierung !== 'lagerort') {
        html += '<ul class="liste">';
        letzteGruppe = '';
      }
      html += bestandZeile(e, einstellungen.warnschwelle_tage);
    }
    ergebnis.innerHTML = `${html}</ul><p class="leise" style="text-align:center">${eintraege.length} Einträge</p>
      <button class="knopf breit" type="button" data-csv>Gesamten Bestand als Tabelle (CSV)</button>`;
    ergebnis.querySelector('[data-csv]').addEventListener('click', bestandExportieren);
    ergebnis.querySelectorAll('ul.liste').forEach((ul) => listeVerdrahten(ul, eintraege, laden));
  }

  let warte;
  suche.addEventListener('input', () => {
    clearTimeout(warte);
    warte = setTimeout(() => { filter.suche = suche.value.trim(); laden(); }, 250);
  });
  el.querySelectorAll('select[data-f]').forEach((s) =>
    s.addEventListener('change', () => { filter[s.dataset.f] = s.value; laden(); })
  );
  await laden();
}
