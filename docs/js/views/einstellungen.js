// Einstellungen: Lagerorte, Kategorien, Warnschwelle, Artikelstamm, Datensicherung
import { holen, senden, aendern, loeschen, stammdaten, stammVergessen, esc, zahlText, meldung, dateiWeitergeben, ICON } from '../api.js';
import { bestandExportieren } from '../export.js';

export default async function einstellungen(el) {
  const [{ lagerorte, kategorien, einstellungen: e }, produkte] = await Promise.all([
    stammdaten(true), holen('produkte'),
  ]);

  const verwalten = (art, liste, zaehlwort) => `
    <ul class="liste verwalten" data-art="${art}">
      ${liste.map((x) => `<li data-id="${x.id}">
        <input value="${esc(x.name)}" aria-label="Name" data-umbenennen>
        <span class="leise" style="white-space:nowrap">${x.anzahl} ${zaehlwort}</span>
        <button class="rund" type="button" data-weg aria-label="${esc(x.name)} löschen">${ICON.loeschen}</button>
      </li>`).join('')}
    </ul>
    <form data-neu="${art}" style="display:grid;grid-template-columns:1fr auto;gap:8px">
      <input name="name" placeholder="Neu …" aria-label="Neuer Name" required>
      <button class="knopf">Hinzufügen</button>
    </form>`;

  el.innerHTML = `<div data-wurzel>
    <h2>Lagerorte</h2>
    ${verwalten('lagerorte', lagerorte, 'Einträge')}

    <h2>Kategorien</h2>
    ${verwalten('kategorien', kategorien, 'Produkte')}

    <h2>Warnung vor Ablauf</h2>
    <div class="karte">
      <label for="s-tage">Wie viele Tage vor dem MHD soll gewarnt werden?</label>
      <input id="s-tage" type="number" min="0" max="365" inputmode="numeric" value="${e.warnschwelle_tage}" style="max-width:140px">
    </div>

    <div class="abschnitt-kopf"><h2>Alle Produkte (${produkte.length})</h2></div>
    <p class="leise" style="margin-top:0">Hier kannst du den Mindestbestand festlegen und Produkte, die ihr nicht mehr kauft, löschen.</p>
    <input type="search" data-produkt-suche placeholder="Produkt suchen …" aria-label="Produkt suchen" style="margin-bottom:8px">
    <ul class="liste verwalten" data-produkte>
      ${produkte.map((p) => `<li data-id="${p.id}" data-name="${esc(p.name.toLowerCase())}">
        <div class="haupt" style="cursor:default"><div class="name">${esc(p.name)}</div>
          <div class="unter">${p.marke ? `<span>${esc(p.marke)}</span>` : ''}<span>vorhanden ${esc(zahlText(p.gesamt))} ${esc(p.einheit)}</span></div></div>
        <div style="width:84px;flex:none"><label style="font-size:.7rem;margin:0" for="m-${p.id}">Minimum</label>
          <input id="m-${p.id}" type="number" min="0" step="any" inputmode="decimal" value="${p.mindestbestand}" data-minimum></div>
        <button class="rund" type="button" data-produkt-weg aria-label="${esc(p.name)} löschen">${ICON.loeschen}</button>
      </li>`).join('') || '<li class="leise">Noch keine Produkte.</li>'}
    </ul>

    <h2>Bestandsliste als Tabelle</h2>
    <div class="karte stapel">
      <p class="leise" style="margin:0">Erstellt eine Tabelle mit dem gesamten Vorrat (Produkt, Marke, Kategorie, Lagerort, Menge, MHD, Status, Bemerkung …).
        Die CSV-Datei öffnet sich in Excel oder Google Tabellen.</p>
      <button class="knopf" type="button" data-csv>Tabelle (CSV) erstellen</button>
    </div>

    <h2>Datensicherung</h2>
    <div class="karte stapel">
      <p style="margin:0">Deine Daten liegen <b>nur auf diesem Handy</b>. Wenn du die Browserdaten löschst oder das Handy verlierst, sind sie weg.
        Speichere deshalb ab und zu eine Sicherung und lege sie z. B. in Google Drive oder schick sie dir per Mail.</p>
      <p class="leise" style="margin:0">Letzte Sicherung: ${e.letzte_sicherung ? esc(e.letzte_sicherung.split('-').reverse().join('.')) : 'noch nie'}</p>
      <div class="knopfreihe">
        <button class="knopf haupt" type="button" data-export>Sicherung speichern</button>
        <button class="knopf" type="button" data-import>Sicherung einspielen</button>
        <input type="file" accept="application/json,.json" hidden data-import-datei>
      </div>
    </div>
    <p class="leise" style="text-align:center;margin-top:24px">Vorratshaltung 2.1 · Daten nur auf diesem Gerät · Produktdaten von <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener">Open Food Facts</a></p>
  </div>`;

  const wurzel = el.querySelector('[data-wurzel]');
  const neu = () => { stammVergessen(); return einstellungen(el); };

  // Lagerorte & Kategorien: umbenennen, löschen, hinzufügen
  wurzel.querySelectorAll('ul[data-art]').forEach((ul) => {
    const art = ul.dataset.art;
    ul.addEventListener('change', async (ev) => {
      if (!ev.target.matches('[data-umbenennen]')) return;
      const id = ev.target.closest('li').dataset.id;
      try { await aendern(`${art}/${id}`, { name: ev.target.value }); stammVergessen(); meldung('Umbenannt.'); }
      catch (f) { meldung(f.message, 'fehler'); neu(); }
    });
    ul.addEventListener('click', async (ev) => {
      if (!ev.target.closest('[data-weg]')) return;
      const li = ev.target.closest('li');
      const name = li.querySelector('input').value;
      if (!confirm(`„${name}“ löschen?`)) return;
      try { await loeschen(`${art}/${li.dataset.id}`); neu(); }
      catch (f) { meldung(f.message, 'fehler'); }
    });
  });
  wurzel.querySelectorAll('form[data-neu]').forEach((form) =>
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      try { await senden(form.dataset.neu, { name: form.elements.name.value }); neu(); }
      catch (f) { meldung(f.message, 'fehler'); }
    })
  );

  wurzel.querySelector('#s-tage').addEventListener('change', async (ev) => {
    try { await aendern('einstellungen', { warnschwelle_tage: ev.target.value }); stammVergessen(); meldung('Gespeichert.'); }
    catch (f) { meldung(f.message, 'fehler'); }
  });

  // Artikelstamm
  const pListe = wurzel.querySelector('[data-produkte]');
  wurzel.querySelector('[data-produkt-suche]').addEventListener('input', (ev) => {
    const q = ev.target.value.trim().toLowerCase();
    pListe.querySelectorAll('li[data-name]').forEach((li) => { li.hidden = q && !li.dataset.name.includes(q); });
  });
  pListe.addEventListener('change', async (ev) => {
    if (!ev.target.matches('[data-minimum]')) return;
    const id = ev.target.closest('li').dataset.id;
    try { await aendern(`produkte/${id}`, { mindestbestand: ev.target.value || 0 }); meldung('Mindestbestand gespeichert.'); }
    catch (f) { meldung(f.message, 'fehler'); }
  });
  pListe.addEventListener('click', async (ev) => {
    if (!ev.target.closest('[data-produkt-weg]')) return;
    const li = ev.target.closest('li');
    const p = produkte.find((x) => String(x.id) === li.dataset.id);
    const zusatz = p.gesamt > 0 ? ` Achtung: Es sind noch ${zahlText(p.gesamt)} ${p.einheit} im Vorrat, die dann ebenfalls entfernt werden.` : '';
    if (!confirm(`Produkt „${p.name}“ löschen?${zusatz}`)) return;
    try { await loeschen(`produkte/${p.id}`); neu(); }
    catch (f) { meldung(f.message, 'fehler'); }
  });

  wurzel.querySelector('[data-csv]').addEventListener('click', bestandExportieren);

  // Datensicherung speichern: Teilen-Menü (z. B. Google Drive, Mail) oder Download
  wurzel.querySelector('[data-export]').addEventListener('click', async () => {
    try {
      const s = await holen('backup');
      const name = `vorrat-sicherung-${s.erstellt.slice(0, 10)}.json`;
      const datei = new File([JSON.stringify(s, null, 1)], name, { type: 'application/json' });
      if (!(await dateiWeitergeben(datei, 'Vorrat-Sicherung'))) return;
      await aendern('backup/erledigt', {});
      meldung('Sicherung gespeichert.');
      neu();
    } catch (f) { meldung(f.message, 'fehler'); }
  });

  // Datensicherung einspielen
  const datei = wurzel.querySelector('[data-import-datei]');
  wurzel.querySelector('[data-import]').addEventListener('click', () => datei.click());
  datei.addEventListener('change', async () => {
    const d = datei.files[0];
    datei.value = '';
    if (!d) return;
    if (!confirm('Achtung: Alle jetzigen Daten werden durch die Sicherung ersetzt. Fortfahren?')) return;
    try {
      const r = await senden('backup', JSON.parse(await d.text()));
      meldung(`Sicherung eingespielt (${r.anzahl} Vorratseinträge).`);
      neu();
    } catch (f) {
      meldung(f instanceof SyntaxError ? 'Die Datei ist keine gültige Sicherung.' : f.message, 'fehler');
    }
  });
}
