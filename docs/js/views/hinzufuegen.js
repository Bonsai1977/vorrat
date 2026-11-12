// Neue Ware einbuchen: per Barcode oder von Hand
import { holen, senden, stammdaten, esc, optionen, einheitOptionen, meldung, heuteISO, ICON } from '../api.js';
import { scanne } from '../scanner.js';

const LAGERORT_MERKEN = 'vorrat-letzter-lagerort';
function gemerkterLagerort() { try { return localStorage.getItem(LAGERORT_MERKEN); } catch { return null; } }
function lagerortMerken(id) { try { localStorage.setItem(LAGERORT_MERKEN, id); } catch { /* egal */ } }

export default async function hinzufuegen(el, params) {
  const [{ lagerorte, kategorien }, produkte] = await Promise.all([stammdaten(true), holen('produkte')]);
  const startOrt = lagerorte.some((l) => String(l.id) === gemerkterLagerort()) ? gemerkterLagerort() : lagerorte[0]?.id;

  el.innerHTML = `
    <button class="knopf haupt breit scan-gross" type="button" data-scan>${ICON.scan} Barcode scannen</button>
    <p class="leise" style="text-align:center;margin:8px 0 16px">oder unten von Hand eintragen</p>

    <form class="karte stapel" data-form autocomplete="off">
      <div data-vorschlag hidden></div>

      <div class="feld"><label for="h-name">Produkt</label>
        <input id="h-name" name="name" list="h-produkte" placeholder="z. B. Spaghetti" required>
        <datalist id="h-produkte">${produkte.map((p) => `<option value="${esc(p.name)}">${esc(p.marke || '')}</option>`).join('')}</datalist>
      </div>
      <div class="zeile">
        <div class="feld"><label for="h-marke">Marke</label><input id="h-marke" name="marke"></div>
        <div class="feld"><label for="h-kat">Kategorie</label><select id="h-kat" name="kategorie_id">${optionen(kategorien, '', '– keine –')}</select></div>
      </div>
      <div class="feld"><label for="h-bem">Bemerkung zum Artikel</label>
        <textarea id="h-bem" name="bemerkung" rows="2" placeholder="z. B. nur für Kuchen, schmeckt bitter = ranzig"></textarea></div>

      <div class="zeile">
        <div class="feld"><label for="h-ort">Lagerort</label><select id="h-ort" name="lagerort_id" required>${optionen(lagerorte, startOrt)}</select></div>
        <div class="feld"><label for="h-mhd">Mindesthaltbar bis</label><input id="h-mhd" name="mhd" type="date" min="2000-01-01"></div>
      </div>
      <div class="knopfreihe" data-mhd-schnell style="gap:6px">
        <button type="button" class="marke" data-tage="7">+1 Woche</button>
        <button type="button" class="marke" data-tage="30">+1 Monat</button>
        <button type="button" class="marke" data-tage="90">+3 Monate</button>
        <button type="button" class="marke" data-tage="365">+1 Jahr</button>
        <button type="button" class="marke" data-tage="">ohne MHD</button>
      </div>

      <div class="zeile-3">
        <div class="feld"><label for="h-menge">Menge</label><input id="h-menge" name="menge" type="number" inputmode="decimal" step="any" min="0.01" value="1" required></div>
        <div class="feld"><label for="h-einheit">Einheit</label><select id="h-einheit" name="einheit">${einheitOptionen()}</select></div>
        <div class="feld"><label for="h-min">Mindestbestand</label><input id="h-min" name="mindestbestand" type="number" inputmode="decimal" step="any" min="0" value="0"></div>
      </div>
      <p class="leise" style="margin-top:4px">Mindestbestand: Fällt der Vorrat darunter, kommt das Produkt automatisch auf die Einkaufsliste. 0 = aus.</p>

      <details>
        <summary class="leise" style="cursor:pointer">Barcode</summary>
        <div class="feld" style="margin-top:8px"><input id="h-code" name="barcode" inputmode="numeric" placeholder="Barcode-Nummer" aria-label="Barcode-Nummer"></div>
      </details>

      <div class="knopfreihe">
        <button class="knopf haupt">Speichern</button>
        <button class="knopf" data-weiter>${ICON.scan} Speichern & nächsten scannen</button>
      </div>
    </form>`;

  const form = el.querySelector('[data-form]');
  const feld = (name) => form.elements[name];
  const vorschlag = el.querySelector('[data-vorschlag]');
  let produktId = null;
  let bildUrl = null;

  function vorschlagZeigen(html) {
    vorschlag.innerHTML = html;
    vorschlag.hidden = !html;
    vorschlag.querySelector('[data-anderes]')?.addEventListener('click', () => {
      produktId = null;
      vorschlagZeigen('');
      feld('name').value = '';
      feld('name').focus();
    });
  }

  function produktEintragen(p, { mitId }) {
    produktId = mitId ? p.id : null;
    bildUrl = p.bild_url || null;
    feld('name').value = p.name || '';
    feld('marke').value = p.marke || '';
    if (p.kategorie_id) feld('kategorie_id').value = p.kategorie_id;
    if (p.einheit) {
      if (![...feld('einheit').options].some((o) => o.value === p.einheit)) feld('einheit').add(new Option(p.einheit, p.einheit));
      feld('einheit').value = p.einheit;
    }
    if (mitId) {
      feld('mindestbestand').value = p.mindestbestand ?? 0;
      feld('bemerkung').value = p.bemerkung || '';
    }
    if (p.barcode) feld('barcode').value = p.barcode;
  }

  function zuruecksetzen() {
    const ort = feld('lagerort_id').value;
    form.reset();
    feld('lagerort_id').value = ort;
    produktId = null;
    bildUrl = null;
    vorschlagZeigen('');
  }

  async function barcodeNachschlagen(code) {
    feld('barcode').value = code;
    vorschlagZeigen('<p class="leise" style="margin:0">Barcode wird nachgeschlagen …</p>');
    try {
      const r = await holen(`barcode/${encodeURIComponent(code)}`);
      const bild = r.produkt.bild_url ? `<img src="${esc(r.produkt.bild_url)}" alt="" referrerpolicy="no-referrer">` : '';
      if (r.quelle === 'eigene') {
        produktEintragen(r.produkt, { mitId: true });
        vorschlagZeigen(`<div class="vorschlag">${bild}<div><b>${esc(r.produkt.name)}</b><br>
          <span class="leise">Bekanntes Produkt – nur noch Menge und MHD prüfen.</span></div></div>`);
        feld('mhd').focus();
      } else if (r.quelle === 'unbekannt') {
        produktEintragen({ barcode: code }, { mitId: false });
        vorschlagZeigen(`<div class="vorschlag"><div><b>Barcode ${esc(code)}</b><br>
          <span class="leise">${esc(r.hinweis || 'Nicht gefunden.')} Bitte den Produktnamen eintragen – beim nächsten Scan kennt die App ihn.</span></div></div>`);
        feld('name').value = '';
        feld('name').focus();
      } else {
        produktEintragen(r.produkt, { mitId: false });
        vorschlagZeigen(`<div class="vorschlag">${bild}<div><b>${esc(r.produkt.name)}</b><br>
          <span class="leise">Gefunden bei Open Food Facts. Name bei Bedarf anpassen.</span></div></div>`);
        feld('mhd').focus();
      }
    } catch (e) {
      vorschlagZeigen('');
      meldung(e.message, 'fehler');
    }
  }

  async function scannen() {
    const code = await scanne('Barcode scannen');
    if (code) {
      zuruecksetzen();
      await barcodeNachschlagen(code);
    }
  }

  el.querySelector('[data-scan]').addEventListener('click', scannen);

  // Bekanntes Produkt aus der Vorschlagsliste gewählt
  feld('name').addEventListener('change', () => {
    if (produktId) return;
    const name = feld('name').value.trim().toLowerCase();
    const p = produkte.find((x) => x.name.toLowerCase() === name);
    if (p) {
      produktEintragen(p, { mitId: true });
      vorschlagZeigen(`<div class="vorschlag"><div><b>${esc(p.name)}</b><br><span class="leise">Bekanntes Produkt.
        <button type="button" class="textknopf" data-anderes>Doch ein neues Produkt</button></span></div></div>`);
    }
  });

  feld('barcode').addEventListener('change', () => {
    const code = feld('barcode').value.replace(/\D/g, '');
    if (code.length >= 6 && !produktId) barcodeNachschlagen(code);
  });

  el.querySelector('[data-mhd-schnell]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tage]');
    if (b) feld('mhd').value = b.dataset.tage ? heuteISO(Number(b.dataset.tage)) : '';
  });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const weiter = ev.submitter?.hasAttribute('data-weiter');
    const f = Object.fromEntries(new FormData(form));
    try {
      const r = await senden('bestand', {
        produkt: {
          id: produktId,
          name: f.name,
          marke: f.marke,
          barcode: f.barcode,
          kategorie_id: f.kategorie_id || null,
          einheit: f.einheit,
          mindestbestand: f.mindestbestand,
          bemerkung: f.bemerkung,
          bild_url: bildUrl,
        },
        lagerort_id: f.lagerort_id,
        menge: f.menge,
        mhd: f.mhd,
      });
      lagerortMerken(f.lagerort_id);
      meldung(`„${r.name}“ in ${r.lagerort} eingelagert.`);
      const bekannt = { id: r.produkt_id, name: r.name, marke: r.marke, einheit: r.einheit, mindestbestand: r.mindestbestand, kategorie_id: r.kategorie_id, barcode: r.barcode, bemerkung: r.bemerkung };
      const i = produkte.findIndex((p) => p.id === r.produkt_id);
      if (i >= 0) produkte[i] = bekannt;
      else produkte.push(bekannt);
      zuruecksetzen();
      if (weiter) scannen();
      else window.scrollTo(0, 0);
    } catch (e) {
      meldung(e.message, 'fehler');
    }
  });

  if (params.get('barcode')) barcodeNachschlagen(params.get('barcode'));
  else if (params.get('scan')) {
    history.replaceState(null, '', '#/hinzufuegen');
    scannen();
  }
}
