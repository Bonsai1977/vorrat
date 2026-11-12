// Dialog: einen Vorratseintrag (und das zugehörige Produkt) bearbeiten
import { holen, senden, aendern, loeschen, stammdaten, esc, optionen, einheitOptionen, meldung, mhdInfo, zahlText, datumText, heuteISO } from './api.js';
import { dialogOeffnen } from './dialog.js';

// Dialog: eine weitere Packung desselben Artikels einlagern (anderer Ort und/oder anderes MHD)
export async function weiterePackung(e) {
  const { lagerorte } = await stammdaten();
  return new Promise((aufloesen) => {
    let gespeichert = false;
    const dlg = dialogOeffnen(`
      <h3>Weitere Packung</h3>
      <p class="leise" style="margin-top:-8px">${esc(e.name)}${e.marke ? ` · ${esc(e.marke)}` : ''}</p>
      <form class="stapel">
        <div class="zeile">
          <div class="feld"><label for="w-menge">Menge (${esc(e.einheit)})</label>
            <input id="w-menge" name="menge" type="number" inputmode="decimal" step="any" min="0.01" value="1" required></div>
          <div class="feld"><label for="w-ort">Lagerort</label>
            <select id="w-ort" name="lagerort_id">${optionen(lagerorte, e.lagerort_id)}</select></div>
        </div>
        <div class="feld"><label for="w-mhd">Mindesthaltbar bis</label>
          <input id="w-mhd" name="mhd" type="date"></div>
        <div class="knopfreihe" data-mhd-schnell style="gap:6px">
          <button type="button" class="marke" data-tage="30">+1 Monat</button>
          <button type="button" class="marke" data-tage="90">+3 Monate</button>
          <button type="button" class="marke" data-tage="365">+1 Jahr</button>
          <button type="button" class="marke" data-tage="">ohne MHD</button>
        </div>
        <div class="dialog-fuss">
          <button class="knopf" type="button" data-schliessen>Abbrechen</button>
          <button class="knopf haupt">Einlagern</button>
        </div>
      </form>`, { beimSchliessen: () => aufloesen(gespeichert) });
    const form = dlg.querySelector('form');
    dlg.querySelector('[data-mhd-schnell]').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-tage]');
      if (b) form.elements.mhd.value = b.dataset.tage ? heuteISO(Number(b.dataset.tage)) : '';
    });
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(form));
      try {
        const r = await senden('bestand', { produkt_id: e.produkt_id, lagerort_id: f.lagerort_id, menge: f.menge, mhd: f.mhd });
        gespeichert = true;
        meldung(`Weitere Packung „${e.name}“ in ${r.lagerort} eingelagert.`);
        dlg.close();
      } catch (f2) { meldung(f2.message, 'fehler'); }
    });
  });
}

export async function bestandBearbeiten(e) {
  const [{ lagerorte, kategorien, einstellungen }, alleBestaende] = await Promise.all([stammdaten(), holen('bestand?sortierung=mhd')]);
  const andere = alleBestaende.filter((b) => b.produkt_id === e.produkt_id && b.id !== e.id);
  return new Promise((aufloesen) => {
    let geaendert = false;
    let packungDanach = false;
    const info = mhdInfo(e.mhd, einstellungen.warnschwelle_tage);
    const dlg = dialogOeffnen(`
      <h3>${esc(e.name)}</h3>
      <p class="leise" style="margin-top:-8px">${esc(e.marke || '')} <span class="marke ${info.klasse}">${esc(info.text)}</span></p>
      ${andere.length ? `
        <p class="leise" style="margin:0 0 4px">Weitere Packungen dieses Artikels:</p>
        <ul class="packungen">${andere.map((b) => {
          const i = mhdInfo(b.mhd, einstellungen.warnschwelle_tage);
          return `<li><b>${esc(zahlText(b.menge))} ${esc(b.einheit)}</b><span>${esc(b.lagerort)}</span>
            <span class="marke ${i.klasse}">${esc(b.mhd ? 'MHD ' + datumText(b.mhd) : 'ohne MHD')}</span></li>`;
        }).join('')}</ul>` : ''}
      <button class="knopf breit" type="button" data-packung style="margin-bottom:14px">+ Weitere Packung (anderer Ort oder MHD)</button>
      <form class="stapel" data-form>
        <div class="zeile">
          <div class="feld"><label for="b-menge">Menge (${esc(e.einheit)})</label>
            <input id="b-menge" name="menge" type="number" inputmode="decimal" step="any" min="0" value="${e.menge}" required></div>
          <div class="feld"><label for="b-mhd">Mindesthaltbar bis</label>
            <input id="b-mhd" name="mhd" type="date" value="${esc(e.mhd || '')}"></div>
        </div>
        <div class="feld"><label for="b-ort">Lagerort</label>
          <select id="b-ort" name="lagerort_id">${optionen(lagerorte, e.lagerort_id)}</select></div>
        <div class="feld"><label for="b-bem">Bemerkung zum Artikel</label>
          <textarea id="b-bem" name="bemerkung" rows="2">${esc(e.bemerkung || '')}</textarea></div>

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
    `, {
      beimSchliessen: () => {
        // Nach dem Schließen ggf. direkt den Dialog für eine weitere Packung öffnen
        if (packungDanach) weiterePackung(e).then((neu) => aufloesen(geaendert || neu));
        else aufloesen(geaendert);
      },
    });

    dlg.querySelector('[data-packung]').addEventListener('click', () => {
      packungDanach = true;
      dlg.close();
    });

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
          einheit: f.einheit, mindestbestand: f.mindestbestand, barcode: f.barcode, bemerkung: f.bemerkung,
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
      ${e.bemerkung ? `<div class="bemerkung">${esc(e.bemerkung)}</div>` : ''}
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
