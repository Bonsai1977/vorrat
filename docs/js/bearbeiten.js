// Dialog: einen Vorratseintrag (und das zugehörige Produkt) bearbeiten
import { aendern, loeschen, stammdaten, esc, optionen, einheitOptionen, meldung, mhdInfo } from './api.js';
import { dialogOeffnen } from './dialog.js';

export async function bestandBearbeiten(e) {
  const { lagerorte, kategorien, einstellungen } = await stammdaten();
  return new Promise((aufloesen) => {
    let geaendert = false;
    const info = mhdInfo(e.mhd, einstellungen.warnschwelle_tage);
    const dlg = dialogOeffnen(`
      <h3>${esc(e.name)}</h3>
      <p class="leise" style="margin-top:-8px">${esc(e.marke || '')} <span class="marke ${info.klasse}">${esc(info.text)}</span></p>
      <form class="stapel" data-form>
        <div class="zeile">
          <div class="feld"><label for="b-menge">Menge (${esc(e.einheit)})</label>
            <input id="b-menge" name="menge" type="number" inputmode="decimal" step="any" min="0" value="${e.menge}" required></div>
          <div class="feld"><label for="b-mhd">Mindesthaltbar bis</label>
            <input id="b-mhd" name="mhd" type="date" value="${esc(e.mhd || '')}"></div>
        </div>
        <div class="feld"><label for="b-ort">Lagerort</label>
          <select id="b-ort" name="lagerort_id">${optionen(lagerorte, e.lagerort_id)}</select></div>

        <details>
          <summary class="leise" style="cursor:pointer">Produktangaben ändern</summary>
          <div class="stapel" style="margin-top:12px">
            <div class="feld"><label for="b-name">Name</label><input id="b-name" name="name" value="${esc(e.name)}" required></div>
            <div class="zeile">
              <div class="feld"><label for="b-marke">Marke</label><input id="b-marke" name="marke" value="${esc(e.marke || '')}"></div>
              <div class="feld"><label for="b-kat">Kategorie</label>
                <select id="b-kat" name="kategorie_id">${optionen(kategorien, e.kategorie_id, '– keine –')}</select></div>
            </div>
            <div class="zeile">
              <div class="feld"><label for="b-einheit">Einheit</label><select id="b-einheit" name="einheit">${einheitOptionen(e.einheit)}</select></div>
              <div class="feld"><label for="b-min">Mindestbestand</label>
                <input id="b-min" name="mindestbestand" type="number" inputmode="decimal" step="any" min="0" value="${e.mindestbestand}"></div>
            </div>
            <div class="feld"><label for="b-code">Barcode</label><input id="b-code" name="barcode" inputmode="numeric" value="${esc(e.barcode || '')}"></div>
          </div>
        </details>

        <div class="dialog-fuss">
          <button class="knopf gefahr" type="button" data-weg>Entnehmen</button>
          <span style="flex:1"></span>
          <button class="knopf" type="button" data-schliessen>Abbrechen</button>
          <button class="knopf haupt">Speichern</button>
        </div>
      </form>
    `, { beimSchliessen: () => aufloesen(geaendert) });

    dlg.querySelector('[data-weg]').addEventListener('click', async () => {
      if (!confirm(`„${e.name}“ (${e.lagerort}) komplett aus dem Vorrat nehmen?`)) return;
      try {
        await loeschen(`bestand/${e.id}`);
        geaendert = true;
        meldung(`„${e.name}“ entnommen.`);
        dlg.close();
      } catch (f) { meldung(f.message, 'fehler'); }
    });

    dlg.querySelector('[data-form]').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(ev.target));
      try {
        await aendern(`produkte/${e.produkt_id}`, {
          name: f.name, marke: f.marke, kategorie_id: f.kategorie_id || null,
          einheit: f.einheit, mindestbestand: f.mindestbestand, barcode: f.barcode,
        });
        await aendern(`bestand/${e.id}`, { menge: f.menge, mhd: f.mhd, lagerort_id: f.lagerort_id });
        geaendert = true;
        meldung('Gespeichert.');
        dlg.close();
      } catch (f2) { meldung(f2.message, 'fehler'); }
    });
  });
}

// Eine Zeile für Listen von Vorratseinträgen
export function bestandZeile(e, warnTage, { mitKnoepfen = true } = {}) {
  const info = mhdInfo(e.mhd, warnTage);
  const bild = e.bild_url ? `<img class="bild" src="${esc(e.bild_url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '';
  const knoepfe = mitKnoepfen ? `
    <div class="menge">
      <button class="rund" type="button" data-minus="${e.id}" aria-label="Eins weniger">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg></button>
      <output>${Number(e.menge).toLocaleString('de-DE', { maximumFractionDigits: 2 })}</output>
      <button class="rund" type="button" data-plus="${e.id}" aria-label="Eins mehr">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>
    </div>` : `<span class="leise">${Number(e.menge).toLocaleString('de-DE', { maximumFractionDigits: 2 })} ${esc(e.einheit)}</span>`;
  return `<li data-id="${e.id}">
    ${bild}
    <div class="haupt" data-bearbeiten="${e.id}" role="button" tabindex="0">
      <div class="name">${esc(e.name)}</div>
      <div class="unter">
        ${e.marke ? `<span>${esc(e.marke)}</span>` : ''}
        <span>${esc(e.lagerort)}</span>
        ${mitKnoepfen ? `<span>${esc(e.einheit)}</span>` : ''}
        <span class="marke ${info.klasse}">${esc(info.text)}</span>
      </div>
    </div>
    ${knoepfe}
  </li>`;
}

// Klicks in einer Liste von Vorratseinträgen verarbeiten. neuLaden() wird nach Änderungen aufgerufen.
export function listeVerdrahten(ul, eintraege, neuLaden) {
  const finde = (id) => eintraege.find((x) => String(x.id) === String(id));
  const oeffnen = async (id) => { if (await bestandBearbeiten(finde(id))) neuLaden(); };
  ul.addEventListener('click', async (ev) => {
    const ziel = ev.target.closest('[data-minus],[data-plus],[data-bearbeiten]');
    if (!ziel) return;
    if (ziel.dataset.bearbeiten) return oeffnen(ziel.dataset.bearbeiten);
    const e = finde(ziel.dataset.minus || ziel.dataset.plus);
    const neu = Math.max(0, e.menge + (ziel.dataset.plus ? 1 : -1));
    if (neu === 0 && !confirm(`Letzte Einheit von „${e.name}“ entnehmen? Der Eintrag verschwindet dann.`)) return;
    try {
      await aendern(`bestand/${e.id}`, { menge: neu });
      e.menge = neu;
      if (neu === 0) neuLaden();
      else ziel.parentElement.querySelector('output').textContent = neu.toLocaleString('de-DE', { maximumFractionDigits: 2 });
    } catch (f) { meldung(f.message, 'fehler'); }
  });
  ul.addEventListener('keydown', (ev) => {
    const ziel = ev.target.closest('[data-bearbeiten]');
    if (ziel && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); oeffnen(ziel.dataset.bearbeiten); }
  });
}
