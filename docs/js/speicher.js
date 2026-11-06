// Datenspeicher direkt auf dem Handy (IndexedDB). Ersetzt den früheren PC-Server:
// anfrage('bestand?lagerort=2', 'GET') verhält sich wie die alte Server-Schnittstelle.

const DB_NAME = 'vorratshaltung';
const DB_STORE = 'daten';
const SCHLUESSEL = 'zustand';
const TABELLEN = ['lagerorte', 'kategorien', 'produkte', 'bestand', 'einkaufsliste', 'barcode_cache', 'einstellungen'];

let z = null; // aktueller Zustand
let ladeVersprechen = null;

class Fehler extends Error {}

// ---------- Laden & Speichern ----------
function idbOeffnen() {
  return new Promise((ok, nichtOk) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(DB_STORE);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => nichtOk(r.error);
  });
}
async function idbLesen() {
  const db = await idbOeffnen();
  return new Promise((ok, nichtOk) => {
    const r = db.transaction(DB_STORE).objectStore(DB_STORE).get(SCHLUESSEL);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => nichtOk(r.error);
  });
}
async function idbSchreiben(wert) {
  const db = await idbOeffnen();
  return new Promise((ok, nichtOk) => {
    const t = db.transaction(DB_STORE, 'readwrite');
    t.objectStore(DB_STORE).put(wert, SCHLUESSEL);
    t.oncomplete = () => ok();
    t.onerror = () => nichtOk(t.error);
  });
}

function leererZustand() {
  const zustand = Object.fromEntries(TABELLEN.map((t) => [t, []]));
  zustand.lagerorte = ['Küchenschrank', 'Kühlschrank', 'Gefrierschrank', 'Keller'].map((name, i) => ({ id: i + 1, name, sortierung: i }));
  zustand.kategorien = ['Konserven', 'Nudeln/Reis', 'Getränke', 'Backzutaten', 'Tiefkühl', 'Sonstiges'].map((name, i) => ({ id: i + 1, name }));
  zustand.einstellungen = [{ schluessel: 'warnschwelle_tage', wert: '7' }];
  return zustand;
}

export function laden() {
  if (!ladeVersprechen) {
    ladeVersprechen = (async () => {
      try {
        z = await idbLesen();
      } catch {
        z = null;
      }
      if (!z) {
        z = leererZustand();
        await speichern();
      }
      for (const t of TABELLEN) z[t] ||= [];
      // Browser bitten, die Daten nicht automatisch zu löschen
      try { await navigator.storage?.persist?.(); } catch { /* egal */ }
    })();
  }
  return ladeVersprechen;
}

async function speichern() {
  try {
    await idbSchreiben(z);
  } catch {
    throw new Fehler('Speichern auf dem Handy ist fehlgeschlagen. Ist der Speicher voll?');
  }
}

// ---------- Hilfen ----------
const kopie = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
const nachId = (t, id) => z[t].find((x) => x.id === Number(id));
const neueId = (t) => z[t].reduce((m, x) => Math.max(m, x.id), 0) + 1;
const vergleich = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'de', { sensitivity: 'base' });
const gleichName = (a, b) => vergleich(a, b) === 0;

function text(v) {
  if (v === undefined || v === null) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
}
function zahl(v, standard = 0) {
  if (v === undefined || v === null || v === '') return standard;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n)) throw new Fehler(`„${v}“ ist keine gültige Zahl.`);
  return n;
}
function datum(v) {
  const t = text(v);
  if (!t) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) throw new Fehler('Datum bitte im Format JJJJ-MM-TT angeben.');
  return t;
}
function heute(plusTage = 0) {
  const d = new Date();
  d.setDate(d.getDate() + plusTage);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function jetzt() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}
function einstellung(schluessel, standard) {
  const e = z.einstellungen.find((x) => x.schluessel === schluessel);
  return e ? e.wert : standard;
}
function einstellungSetzen(schluessel, wert) {
  const e = z.einstellungen.find((x) => x.schluessel === schluessel);
  if (e) e.wert = String(wert);
  else z.einstellungen.push({ schluessel, wert: String(wert) });
}
const gesamtMenge = (produktId) => z.bestand.filter((b) => b.produkt_id === produktId).reduce((s, b) => s + b.menge, 0);
// MHD-Sortierung: ohne MHD ans Ende
const mhdVergleich = (a, b) => (a.mhd === b.mhd ? 0 : !a.mhd ? 1 : !b.mhd ? -1 : a.mhd < b.mhd ? -1 : 1);

// Vorratseintrag mit Produkt-, Kategorie- und Lagerort-Angaben (wie der frühere SQL-Join)
function bestandVoll(b) {
  const p = nachId('produkte', b.produkt_id) || {};
  const l = nachId('lagerorte', b.lagerort_id) || {};
  const k = p.kategorie_id ? nachId('kategorien', p.kategorie_id) : null;
  return {
    ...b,
    name: p.name, marke: p.marke ?? null, barcode: p.barcode ?? null, einheit: p.einheit, mindestbestand: p.mindestbestand,
    bild_url: p.bild_url ?? null, kategorie_id: p.kategorie_id ?? null, kategorie: k?.name ?? null,
    lagerort: l.name, lagerort_sortierung: l.sortierung ?? 0,
  };
}
function produktVoll(p) {
  const k = p.kategorie_id ? nachId('kategorien', p.kategorie_id) : null;
  return { ...p, kategorie: k?.name ?? null, gesamt: gesamtMenge(p.id) };
}

// ---------- Kernlogik (wie früher auf dem Server) ----------
function produktSpeichern(p) {
  const name = text(p.name);
  const barcode = text(p.barcode);
  let id = p.id ? Number(p.id) : null;
  let perNameGefunden = false;
  if (!id && barcode) id = z.produkte.find((x) => x.barcode === barcode)?.id ?? null;
  if (!id && name && !barcode) {
    const v = z.produkte.find((x) => !x.barcode && gleichName(x.name, name));
    if (v) { id = v.id; perNameGefunden = true; }
  }

  if (id) {
    const alt = nachId('produkte', id);
    if (!alt) throw new Fehler('Produkt nicht gefunden.');
    const neuerBarcode = p.barcode !== undefined ? barcode : alt.barcode;
    if (neuerBarcode && z.produkte.some((x) => x.id !== alt.id && x.barcode === neuerBarcode))
      throw new Fehler('Dieser Barcode gehört schon zu einem anderen Produkt.');
    Object.assign(alt, {
      name: perNameGefunden ? alt.name : (name ?? alt.name),
      marke: p.marke !== undefined ? text(p.marke) : alt.marke,
      barcode: neuerBarcode,
      kategorie_id: p.kategorie_id !== undefined ? (p.kategorie_id ? Number(p.kategorie_id) : null) : alt.kategorie_id,
      einheit: text(p.einheit) ?? alt.einheit,
      mindestbestand: p.mindestbestand !== undefined ? zahl(p.mindestbestand) : alt.mindestbestand,
      bild_url: p.bild_url !== undefined ? text(p.bild_url) : alt.bild_url,
    });
    return alt.id;
  }

  if (!name) throw new Fehler('Bitte einen Produktnamen angeben.');
  const neu = {
    id: neueId('produkte'), name, marke: text(p.marke), barcode, kategorie_id: p.kategorie_id ? Number(p.kategorie_id) : null,
    einheit: text(p.einheit) ?? 'Stück', mindestbestand: zahl(p.mindestbestand), bild_url: text(p.bild_url),
  };
  z.produkte.push(neu);
  return neu.id;
}

function einkaufslisteAbgleichen() {
  const fehlend = new Map();
  for (const p of z.produkte) {
    if (p.mindestbestand > 0) {
      const g = gesamtMenge(p.id);
      if (g < p.mindestbestand) fehlend.set(p.id, p.mindestbestand - g);
    }
  }
  z.einkaufsliste = z.einkaufsliste.filter((e) => !(e.automatisch && !e.erledigt && !fehlend.has(e.produkt_id)));
  for (const e of z.einkaufsliste) {
    if (e.automatisch && !e.erledigt) e.menge = fehlend.get(e.produkt_id);
  }
  for (const [produktId, fehlt] of fehlend) {
    if (!z.einkaufsliste.some((e) => e.produkt_id === produktId)) {
      z.einkaufsliste.push({ id: neueId('einkaufsliste'), produkt_id: produktId, freier_text: null, menge: fehlt, erledigt: 0, automatisch: 1, erstellt_am: jetzt() });
    }
  }
}

function einbuchen(produktId, lagerortId, menge, mhd) {
  if (!lagerortId || !nachId('lagerorte', lagerortId)) throw new Fehler('Bitte einen Lagerort wählen.');
  if (!(menge > 0)) throw new Fehler('Die Menge muss größer als 0 sein.');
  const gleich = z.bestand.find((b) => b.produkt_id === produktId && b.lagerort_id === lagerortId && (b.mhd ?? null) === (mhd ?? null));
  if (gleich) {
    gleich.menge += menge;
    return gleich.id;
  }
  const id = neueId('bestand');
  z.bestand.push({ id, produkt_id: produktId, lagerort_id: lagerortId, menge, mhd, hinzugefuegt_am: jetzt() });
  return id;
}

function lagerorteListe() {
  return [...z.lagerorte]
    .sort((a, b) => a.sortierung - b.sortierung || vergleich(a.name, b.name))
    .map((l) => ({ ...l, anzahl: z.bestand.filter((b) => b.lagerort_id === l.id).length }));
}
function kategorienListe() {
  return [...z.kategorien]
    .sort((a, b) => vergleich(a.name, b.name))
    .map((k) => ({ ...k, anzahl: z.produkte.filter((p) => p.kategorie_id === k.id).length }));
}
function einstellungenLesen() {
  return { warnschwelle_tage: Number(einstellung('warnschwelle_tage', 7)), letzte_sicherung: einstellung('letzte_sicherung', null) };
}
function namePruefen(tabelle, name, ohneId) {
  if (!name) throw new Fehler('Bitte einen Namen angeben.');
  if (z[tabelle].some((x) => x.id !== ohneId && gleichName(x.name, name))) throw new Fehler('Diesen Namen gibt es schon.');
}

function suchtreffer(p, suche) {
  const s = suche.toLowerCase();
  return (p.name || '').toLowerCase().includes(s) || (p.marke || '').toLowerCase().includes(s) || p.barcode === suche;
}

function einkaufVoll(e) {
  const p = e.produkt_id ? nachId('produkte', e.produkt_id) : null;
  const k = p?.kategorie_id ? nachId('kategorien', p.kategorie_id) : null;
  const letzter = p ? [...z.bestand].filter((b) => b.produkt_id === p.id).sort((a, b) => b.id - a.id)[0] : null;
  return {
    ...e, name: p ? p.name : e.freier_text, marke: p?.marke ?? null, einheit: p?.einheit ?? null, mindestbestand: p?.mindestbestand ?? null,
    kategorie: k?.name ?? null, gesamt: p ? gesamtMenge(p.id) : 0, letzter_lagerort_id: letzter?.lagerort_id ?? null,
  };
}

// ---------- Open Food Facts (direkt vom Handy aus) ----------
function kategorieRaten(offKategorien) {
  if (!offKategorien) return null;
  const k = offKategorien.toLowerCase();
  const regeln = [
    ['Getränke', ['beverages', 'getränke', 'drinks', 'waters', 'juices', 'sodas']],
    ['Tiefkühl', ['frozen', 'tiefkühl']],
    ['Nudeln/Reis', ['pasta', 'nudeln', 'rice', 'reis']],
    ['Konserven', ['canned', 'konserv']],
    ['Backzutaten', ['flour', 'mehl', 'sugar', 'zucker', 'baking']],
  ];
  for (const [name, woerter] of regeln) {
    if (woerter.some((w) => k.includes(w))) {
      const kat = z.kategorien.find((x) => x.name === name);
      if (kat) return kat.id;
    }
  }
  return null;
}

async function openFoodFacts(barcode) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json` +
    '?fields=product_name,product_name_de,brands,image_front_small_url,quantity,categories';
  const antwort = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (antwort.status === 404) return null;
  if (!antwort.ok) throw new Error(`Open Food Facts antwortet mit ${antwort.status}`);
  const json = await antwort.json();
  if (json.status !== 1 || !json.product) return null;
  const p = json.product;
  const name = p.product_name_de || p.product_name;
  if (!name) return null;
  return {
    name: p.quantity ? `${name} (${p.quantity})` : name,
    marke: p.brands ? p.brands.split(',')[0].trim() : null,
    bild_url: p.image_front_small_url || null,
    kategorien: p.categories || null,
  };
}

async function barcodeNachschlagen(code) {
  const barcode = String(code).trim();
  if (!/^\d{6,14}$/.test(barcode)) throw new Fehler('Das sieht nicht wie ein Lebensmittel-Barcode aus.');
  const eigenes = z.produkte.find((p) => p.barcode === barcode);
  if (eigenes) return { quelle: 'eigene', produkt: kopie(eigenes) };

  const gespeichert = z.barcode_cache.find((c) => c.barcode === barcode);
  let daten;
  let quelle = 'zwischenspeicher';
  if (gespeichert) {
    daten = gespeichert.daten ? JSON.parse(gespeichert.daten) : null;
  } else {
    try {
      daten = await openFoodFacts(barcode);
      quelle = 'openfoodfacts';
      z.barcode_cache.push({ barcode, daten: daten ? JSON.stringify(daten) : null, abgerufen_am: jetzt() });
      await speichern();
    } catch {
      return { quelle: 'unbekannt', produkt: { barcode }, hinweis: 'Keine Internetverbindung zu Open Food Facts.' };
    }
  }
  if (!daten) return { quelle: 'unbekannt', produkt: { barcode } };
  return { quelle, produkt: { barcode, name: daten.name, marke: daten.marke, bild_url: daten.bild_url, kategorie_id: kategorieRaten(daten.kategorien) } };
}

// ---------- Schnittstelle ----------
const SICHERUNG_SPALTEN = {
  lagerorte: ['id', 'name', 'sortierung'],
  kategorien: ['id', 'name'],
  produkte: ['id', 'name', 'marke', 'barcode', 'kategorie_id', 'einheit', 'mindestbestand', 'bild_url'],
  bestand: ['id', 'produkt_id', 'lagerort_id', 'menge', 'mhd', 'hinzugefuegt_am'],
  einkaufsliste: ['id', 'produkt_id', 'freier_text', 'menge', 'erledigt', 'automatisch', 'erstellt_am'],
  einstellungen: ['schluessel', 'wert'],
};

// Führt eine Aktion aus. Bei Fehlern wird der vorherige Stand wiederhergestellt (wie eine Datenbank-Transaktion).
async function aendernUndSpeichern(fn) {
  const vorher = kopie(z);
  try {
    const ergebnis = fn();
    await speichern();
    return ergebnis;
  } catch (e) {
    z = vorher;
    throw e;
  }
}

export async function anfrage(pfadMitAbfrage, methode = 'GET', d = {}) {
  await laden();
  const [pfad, abfrage] = pfadMitAbfrage.split('?');
  const q = new URLSearchParams(abfrage || '');
  const teile = pfad.split('/').filter(Boolean);
  const [bereich, id, aktion] = teile;
  const M = methode.toUpperCase();
  d = d || {};

  switch (bereich) {
    // ----- Lagerorte -----
    case 'lagerorte':
      if (M === 'GET') return lagerorteListe();
      if (M === 'POST') return aendernUndSpeichern(() => {
        const name = text(d.name);
        namePruefen('lagerorte', name);
        const l = { id: neueId('lagerorte'), name, sortierung: z.lagerorte.reduce((m, x) => Math.max(m, x.sortierung), -1) + 1 };
        z.lagerorte.push(l);
        return kopie(l);
      });
      if (M === 'PUT') return aendernUndSpeichern(() => {
        const l = nachId('lagerorte', id);
        if (!l) throw new Fehler('Lagerort nicht gefunden.');
        const name = d.name !== undefined ? text(d.name) : l.name;
        namePruefen('lagerorte', name, l.id);
        l.name = name;
        if (d.sortierung !== undefined) l.sortierung = zahl(d.sortierung);
        return kopie(l);
      });
      if (M === 'DELETE') return aendernUndSpeichern(() => {
        const belegt = z.bestand.filter((b) => b.lagerort_id === Number(id)).length;
        if (belegt) throw new Fehler(`In diesem Lagerort liegen noch ${belegt} Einträge. Bitte erst verschieben oder entnehmen.`);
        if (z.lagerorte.length <= 1) throw new Fehler('Mindestens ein Lagerort muss bleiben.');
        z.lagerorte = z.lagerorte.filter((l) => l.id !== Number(id));
        return { ok: true };
      });
      break;

    // ----- Kategorien -----
    case 'kategorien':
      if (M === 'GET') return kategorienListe();
      if (M === 'POST') return aendernUndSpeichern(() => {
        const name = text(d.name);
        namePruefen('kategorien', name);
        const k = { id: neueId('kategorien'), name };
        z.kategorien.push(k);
        return kopie(k);
      });
      if (M === 'PUT') return aendernUndSpeichern(() => {
        const k = nachId('kategorien', id);
        if (!k) throw new Fehler('Kategorie nicht gefunden.');
        const name = text(d.name);
        namePruefen('kategorien', name, k.id);
        k.name = name;
        return kopie(k);
      });
      if (M === 'DELETE') return aendernUndSpeichern(() => {
        z.kategorien = z.kategorien.filter((k) => k.id !== Number(id));
        z.produkte.forEach((p) => { if (p.kategorie_id === Number(id)) p.kategorie_id = null; });
        return { ok: true };
      });
      break;

    // ----- Einstellungen -----
    case 'einstellungen':
      if (M === 'GET') return einstellungenLesen();
      if (M === 'PUT') return aendernUndSpeichern(() => {
        if (d.warnschwelle_tage !== undefined) {
          const tage = Math.round(zahl(d.warnschwelle_tage));
          if (tage < 0 || tage > 365) throw new Fehler('Die Warnschwelle muss zwischen 0 und 365 Tagen liegen.');
          einstellungSetzen('warnschwelle_tage', tage);
        }
        return einstellungenLesen();
      });
      break;

    // ----- Produkte -----
    case 'produkte':
      if (M === 'GET' && id) {
        const p = nachId('produkte', id);
        if (!p) throw new Fehler('Produkt nicht gefunden.');
        return produktVoll(p);
      }
      if (M === 'GET') {
        const suche = (q.get('suche') || '').trim();
        return z.produkte.filter((p) => !suche || suchtreffer(p, suche)).sort((a, b) => vergleich(a.name, b.name)).map(produktVoll);
      }
      if (M === 'POST') return aendernUndSpeichern(() => {
        const pid = produktSpeichern({ ...d, id: undefined });
        einkaufslisteAbgleichen();
        return produktVoll(nachId('produkte', pid));
      });
      if (M === 'PUT') return aendernUndSpeichern(() => {
        produktSpeichern({ ...d, id });
        einkaufslisteAbgleichen();
        return produktVoll(nachId('produkte', id));
      });
      if (M === 'DELETE') return aendernUndSpeichern(() => {
        const pid = Number(id);
        z.produkte = z.produkte.filter((p) => p.id !== pid);
        z.bestand = z.bestand.filter((b) => b.produkt_id !== pid);
        z.einkaufsliste = z.einkaufsliste.filter((e) => e.produkt_id !== pid);
        return { ok: true };
      });
      break;

    // ----- Bestand -----
    case 'bestand':
      if (M === 'GET') {
        const suche = (q.get('suche') || '').trim();
        let liste = z.bestand.map(bestandVoll).filter((b) =>
          (!q.get('lagerort') || b.lagerort_id === Number(q.get('lagerort'))) &&
          (!q.get('kategorie') || b.kategorie_id === Number(q.get('kategorie'))) &&
          (!suche || suchtreffer(b, suche)));
        const sortierung = q.get('sortierung') || 'mhd';
        const sortierer = {
          mhd: (a, b) => mhdVergleich(a, b) || vergleich(a.name, b.name),
          name: (a, b) => vergleich(a.name, b.name) || mhdVergleich(a, b),
          lagerort: (a, b) => a.lagerort_sortierung - b.lagerort_sortierung || vergleich(a.lagerort, b.lagerort) || vergleich(a.name, b.name),
          neu: (a, b) => (b.hinzugefuegt_am > a.hinzugefuegt_am ? 1 : b.hinzugefuegt_am < a.hinzugefuegt_am ? -1 : b.id - a.id),
        }[sortierung] || ((a, b) => mhdVergleich(a, b));
        return liste.sort(sortierer);
      }
      if (M === 'POST') return aendernUndSpeichern(() => {
        const produktId = d.produkt ? produktSpeichern(d.produkt) : Number(d.produkt_id);
        if (!produktId || !nachId('produkte', produktId)) throw new Fehler('Produkt fehlt.');
        const bid = einbuchen(produktId, Number(d.lagerort_id), zahl(d.menge, 1), datum(d.mhd));
        einkaufslisteAbgleichen();
        return bestandVoll(nachId('bestand', bid));
      });
      if (M === 'PUT') return aendernUndSpeichern(() => {
        const b = nachId('bestand', id);
        if (!b) throw new Fehler('Eintrag nicht gefunden.');
        const menge = d.menge !== undefined ? zahl(d.menge) : b.menge;
        if (menge <= 0) {
          z.bestand = z.bestand.filter((x) => x.id !== b.id);
          einkaufslisteAbgleichen();
          return { entfernt: true };
        }
        if (d.lagerort_id !== undefined) {
          if (!nachId('lagerorte', d.lagerort_id)) throw new Fehler('Bitte einen Lagerort wählen.');
          b.lagerort_id = Number(d.lagerort_id);
        }
        if (d.mhd !== undefined) b.mhd = datum(d.mhd);
        b.menge = menge;
        einkaufslisteAbgleichen();
        return bestandVoll(b);
      });
      if (M === 'DELETE') return aendernUndSpeichern(() => {
        z.bestand = z.bestand.filter((x) => x.id !== Number(id));
        einkaufslisteAbgleichen();
        return { ok: true };
      });
      break;

    // ----- Entnehmen (frühestes MHD zuerst) -----
    case 'entnehmen':
      return aendernUndSpeichern(() => {
        const barcode = text(d.barcode);
        const produkt = barcode ? z.produkte.find((p) => p.barcode === barcode) : nachId('produkte', d.produkt_id);
        if (!produkt) throw new Fehler(barcode ? `Der Barcode ${barcode} ist noch keinem Produkt zugeordnet.` : 'Produkt nicht gefunden.');
        let rest = zahl(d.menge, 1);
        if (!(rest > 0)) throw new Fehler('Die Menge muss größer als 0 sein.');
        const chargen = z.bestand.filter((b) => b.produkt_id === produkt.id).sort((a, b) => mhdVergleich(a, b) || a.id - b.id);
        if (!chargen.length) throw new Fehler(`„${produkt.name}“ ist nicht mehr im Vorrat.`);
        const entnommen = [];
        for (const c of chargen) {
          if (rest <= 0) break;
          const teil = Math.min(rest, c.menge);
          c.menge -= teil;
          entnommen.push({ lagerort: nachId('lagerorte', c.lagerort_id)?.name, mhd: c.mhd, menge: teil });
          rest -= teil;
        }
        z.bestand = z.bestand.filter((b) => b.menge > 0);
        einkaufslisteAbgleichen();
        return { produkt: { id: produkt.id, name: produkt.name, einheit: produkt.einheit }, entnommen, restbestand: gesamtMenge(produkt.id), fehlte: rest > 0 ? rest : 0 };
      });

    // ----- Übersicht -----
    case 'uebersicht': {
      const tage = Number(einstellung('warnschwelle_tage', 7));
      const h = heute();
      const grenze = heute(tage);
      const alle = z.bestand.map(bestandVoll).sort(mhdVergleich);
      const unterMindestbestand = z.produkte
        .filter((p) => p.mindestbestand > 0 && gesamtMenge(p.id) < p.mindestbestand)
        .sort((a, b) => vergleich(a.name, b.name))
        .map((p) => ({ id: p.id, name: p.name, marke: p.marke, einheit: p.einheit, mindestbestand: p.mindestbestand, gesamt: gesamtMenge(p.id) }));
      return {
        warnschwelle_tage: tage,
        abgelaufen: alle.filter((b) => b.mhd && b.mhd < h),
        baldAblaufend: alle.filter((b) => b.mhd && b.mhd >= h && b.mhd <= grenze),
        unterMindestbestand,
        eintraege: z.bestand.length,
        produkte: new Set(z.bestand.map((b) => b.produkt_id)).size,
        einkaufOffen: z.einkaufsliste.filter((e) => !e.erledigt).length,
        letzte_sicherung: einstellung('letzte_sicherung', null),
      };
    }

    // ----- Einkaufsliste -----
    case 'einkaufsliste':
      if (M === 'GET') {
        await aendernUndSpeichern(einkaufslisteAbgleichen);
        return z.einkaufsliste.map(einkaufVoll).sort((a, b) =>
          a.erledigt - b.erledigt || (a.kategorie == null) - (b.kategorie == null) || vergleich(a.kategorie, b.kategorie) || vergleich(a.name, b.name));
      }
      if (M === 'POST' && id === 'erledigte-entfernen') return aendernUndSpeichern(() => {
        const vorher = z.einkaufsliste.length;
        z.einkaufsliste = z.einkaufsliste.filter((e) => !e.erledigt);
        einkaufslisteAbgleichen();
        return { entfernt: vorher - z.einkaufsliste.length };
      });
      if (M === 'POST' && aktion === 'einbuchen') return aendernUndSpeichern(() => {
        const e = nachId('einkaufsliste', id);
        if (!e) throw new Fehler('Eintrag nicht gefunden.');
        const produktId = e.produkt_id || produktSpeichern({ name: e.freier_text });
        const bid = einbuchen(produktId, Number(d.lagerort_id), zahl(d.menge, e.menge), datum(d.mhd));
        z.einkaufsliste = z.einkaufsliste.filter((x) => x.id !== e.id);
        einkaufslisteAbgleichen();
        return { bestand_id: bid, produkt_id: produktId };
      });
      if (M === 'POST') return aendernUndSpeichern(() => {
        const menge = zahl(d.menge, 1);
        if (d.produkt_id) {
          const vorhanden = z.einkaufsliste.find((e) => e.produkt_id === Number(d.produkt_id));
          if (vorhanden) {
            Object.assign(vorhanden, { menge, erledigt: 0, automatisch: 0 });
            return einkaufVoll(vorhanden);
          }
          const e = { id: neueId('einkaufsliste'), produkt_id: Number(d.produkt_id), freier_text: null, menge, erledigt: 0, automatisch: 0, erstellt_am: jetzt() };
          z.einkaufsliste.push(e);
          return einkaufVoll(e);
        }
        const t = text(d.freier_text);
        if (!t) throw new Fehler('Bitte angeben, was gekauft werden soll.');
        const e = { id: neueId('einkaufsliste'), produkt_id: null, freier_text: t, menge, erledigt: 0, automatisch: 0, erstellt_am: jetzt() };
        z.einkaufsliste.push(e);
        return einkaufVoll(e);
      });
      if (M === 'PUT') return aendernUndSpeichern(() => {
        const e = nachId('einkaufsliste', id);
        if (!e) throw new Fehler('Eintrag nicht gefunden.');
        if (d.erledigt !== undefined) e.erledigt = d.erledigt ? 1 : 0;
        if (d.menge !== undefined) {
          const menge = zahl(d.menge, 1);
          if (menge !== e.menge) e.automatisch = 0;
          e.menge = menge;
        }
        return einkaufVoll(e);
      });
      if (M === 'DELETE') return aendernUndSpeichern(() => {
        z.einkaufsliste = z.einkaufsliste.filter((e) => e.id !== Number(id));
        return { ok: true };
      });
      break;

    // ----- Barcode -----
    case 'barcode':
      return barcodeNachschlagen(id);

    // ----- Datensicherung -----
    case 'backup':
      if (M === 'GET') {
        const s = { app: 'Vorratshaltung', version: 1, erstellt: new Date().toISOString() };
        for (const t of Object.keys(SICHERUNG_SPALTEN)) s[t] = kopie(z[t]);
        return s;
      }
      if (M === 'POST') {
        if (!d || d.app !== 'Vorratshaltung' || !Array.isArray(d.lagerorte))
          throw new Fehler('Das ist keine gültige Sicherungsdatei der Vorrats-App.');
        return aendernUndSpeichern(() => {
          for (const [t, spalten] of Object.entries(SICHERUNG_SPALTEN)) {
            z[t] = (d[t] || []).map((zeile) => Object.fromEntries(spalten.map((sp) => [sp, zeile[sp] ?? null])));
          }
          if (!z.lagerorte.length) z.lagerorte = leererZustand().lagerorte;
          einkaufslisteAbgleichen();
          return { ok: true, anzahl: z.bestand.length };
        });
      }
      if (M === 'PUT' && id === 'erledigt') return aendernUndSpeichern(() => {
        einstellungSetzen('letzte_sicherung', heute());
        return { ok: true };
      });
      break;
  }
  throw new Fehler('Unbekannte Aktion.');
}
