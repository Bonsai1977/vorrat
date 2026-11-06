// Einkaufsliste: automatisch (Mindestbestand) und eigene Einträge
import { holen, senden, aendern, loeschen, stammdaten, esc, optionen, mengeText, zahlText, meldung, heuteISO, einkaufZaehlerAktualisieren, ICON } from '../api.js';
import { dialogOeffnen } from '../dialog.js';

export default async function einkaufsliste(el) {
  const [liste, produkte, { lagerorte }] = await Promise.all([holen('einkaufsliste'), holen('produkte'), stammdaten()]);
  const offen = liste.filter((e) => !e.erledigt);
  const erledigt = liste.filter((e) => e.erledigt);

  const zeile = (e) => `
    <li class="${e.erledigt ? 'erledigt' : ''}" data-id="${e.id}">
      <input type="checkbox" ${e.erledigt ? 'checked' : ''} data-haken aria-label="${esc(e.name)} abhaken">
      <div class="haupt" data-haken-text>
        <div class="name">${esc(e.name)}</div>
        <div class="unter">
          <span>${esc(mengeText(e.menge, e.einheit || ''))}</span>
          ${e.automatisch ? `<span class="marke orange">Mindestbestand ${esc(zahlText(e.mindestbestand))}, da: ${esc(zahlText(e.gesamt))}</span>` : ''}
          ${e.marke ? `<span>${esc(e.marke)}</span>` : ''}
        </div>
      </div>
      <button class="rund" type="button" data-einbuchen title="Gekauft – in den Vorrat buchen" aria-label="In den Vorrat buchen">${ICON.kiste}</button>
      <button class="rund" type="button" data-weg title="Von der Liste entfernen" aria-label="Von der Liste entfernen">${ICON.loeschen}</button>
    </li>`;

  // Offene Einträge nach Kategorie gruppieren
  const gruppen = new Map();
  for (const e of offen) {
    const k = e.kategorie || 'Ohne Kategorie';
    if (!gruppen.has(k)) gruppen.set(k, []);
    gruppen.get(k).push(e);
  }

  el.innerHTML = `<div data-wurzel>
    <form class="karte" data-neu style="display:grid;grid-template-columns:1fr 80px auto;gap:8px;align-items:end" autocomplete="off">
      <div class="feld"><label for="e-text">Was fehlt?</label>
        <input id="e-text" name="text" list="e-produkte" placeholder="z. B. Milch" required>
        <datalist id="e-produkte">${produkte.map((p) => `<option value="${esc(p.name)}"></option>`).join('')}</datalist></div>
      <div class="feld"><label for="e-menge">Menge</label><input id="e-menge" name="menge" type="number" inputmode="decimal" step="any" min="0.01" value="1"></div>
      <button class="knopf haupt" aria-label="Hinzufügen">${ICON.plus}</button>
    </form>

    ${offen.length ? [...gruppen].map(([k, eintraege]) => `
      <div class="gruppe">${esc(k)}</div>
      <ul class="liste">${eintraege.map(zeile).join('')}</ul>`).join('')
      : '<p class="leer karte" style="margin-top:16px">Die Einkaufsliste ist leer. 🎉</p>'}

    ${erledigt.length ? `
      <div class="abschnitt-kopf"><div class="gruppe">Im Wagen (${erledigt.length})</div>
        <button class="textknopf" type="button" data-aufraeumen>Erledigte entfernen</button></div>
      <ul class="liste">${erledigt.map(zeile).join('')}</ul>` : ''}

    ${offen.length ? `<div class="knopfreihe" style="margin-top:16px">
      <button class="knopf" type="button" data-teilen>Liste teilen / kopieren</button></div>` : ''}
    <p class="leise" style="margin-top:16px">Tipp: Mit ${ICON.kiste.replace('<svg', '<svg style="width:16px;height:16px;vertical-align:-3px"')} buchst du Gekauftes direkt in den Vorrat.
      Produkte unter ihrem Mindestbestand erscheinen hier automatisch.</p></div>`;
  const wurzel = el.querySelector('[data-wurzel]');

  const neu = () => einkaufsliste(el);
  const finde = (id) => liste.find((x) => String(x.id) === String(id));

  el.querySelector('[data-neu]').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const text = ev.target.elements.text.value.trim();
    const menge = ev.target.elements.menge.value;
    const p = produkte.find((x) => x.name.toLowerCase() === text.toLowerCase());
    try {
      await senden('einkaufsliste', p ? { produkt_id: p.id, menge } : { freier_text: text, menge });
      await neu();
      el.querySelector('#e-text').focus();
    } catch (e) { meldung(e.message, 'fehler'); }
  });

  wurzel.addEventListener('click', async (ev) => {
    const li = ev.target.closest('li[data-id]');
    if (!li) return;
    const e = finde(li.dataset.id);
    try {
      if (ev.target.closest('[data-weg]')) {
        await loeschen(`einkaufsliste/${e.id}`);
        if (e.automatisch && !e.erledigt) meldung('Hinweis: Solange der Mindestbestand unterschritten ist, kommt das Produkt wieder auf die Liste.');
        return neu();
      }
      if (ev.target.closest('[data-einbuchen]')) {
        if (await einbuchenDialog(e, lagerorte)) neu();
        return;
      }
      if (ev.target.closest('[data-haken]') || ev.target.closest('[data-haken-text]')) {
        await aendern(`einkaufsliste/${e.id}`, { erledigt: !e.erledigt });
        return neu();
      }
    } catch (f) { meldung(f.message, 'fehler'); }
  });

  el.querySelector('[data-aufraeumen]')?.addEventListener('click', async () => {
    await senden('einkaufsliste/erledigte-entfernen', {});
    neu();
  });

  el.querySelector('[data-teilen]')?.addEventListener('click', async () => {
    const text = 'Einkaufsliste:\n' + offen.map((e) => `- ${e.name} (${mengeText(e.menge, e.einheit || '')})`).join('\n');
    try {
      if (navigator.share) await navigator.share({ title: 'Einkaufsliste', text });
      else { await navigator.clipboard.writeText(text); meldung('Liste in die Zwischenablage kopiert.'); }
    } catch { /* abgebrochen */ }
  });

  einkaufZaehlerAktualisieren();
}

function einbuchenDialog(e, lagerorte) {
  return new Promise((aufloesen) => {
    let gebucht = false;
    const dlg = dialogOeffnen(`
      <h3>In den Vorrat buchen</h3>
      <p class="leise" style="margin-top:-8px">${esc(e.name)}</p>
      <form class="stapel">
        <div class="zeile">
          <div class="feld"><label for="eb-menge">Menge${e.einheit ? ` (${esc(e.einheit)})` : ''}</label>
            <input id="eb-menge" name="menge" type="number" inputmode="decimal" step="any" min="0.01" value="${e.menge}" required></div>
          <div class="feld"><label for="eb-ort">Lagerort</label>
            <select id="eb-ort" name="lagerort_id">${optionen(lagerorte, e.letzter_lagerort_id || lagerorte[0]?.id)}</select></div>
        </div>
        <div class="feld"><label for="eb-mhd">Mindesthaltbar bis</label>
          <input id="eb-mhd" name="mhd" type="date" min="${heuteISO(-30)}"></div>
        <div class="dialog-fuss">
          <button class="knopf" type="button" data-schliessen>Abbrechen</button>
          <button class="knopf haupt">Einbuchen</button>
        </div>
      </form>`, { beimSchliessen: () => aufloesen(gebucht) });
    dlg.querySelector('form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(ev.target));
      try {
        await senden(`einkaufsliste/${e.id}/einbuchen`, f);
        gebucht = true;
        meldung(`„${e.name}“ eingebucht.`);
        dlg.close();
      } catch (f2) { meldung(f2.message, 'fehler'); }
    });
  });
}
