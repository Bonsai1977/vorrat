// Kleine Helfer: Datenzugriff, Formatierung, Meldungen
import { anfrage } from './speicher.js';

// Alle Daten liegen auf dem Handy (siehe speicher.js)
export async function api(pfad, { methode = 'GET', daten } = {}) {
  // Kopie, damit Ansichten nie versehentlich den gespeicherten Zustand verändern
  const ergebnis = await anfrage(pfad, methode, daten);
  return ergebnis == null ? ergebnis : JSON.parse(JSON.stringify(ergebnis));
}
export const holen = (pfad) => api(pfad);
export const senden = (pfad, daten) => api(pfad, { methode: 'POST', daten });
export const aendern = (pfad, daten) => api(pfad, { methode: 'PUT', daten });
export const loeschen = (pfad) => api(pfad, { methode: 'DELETE' });

// Lagerorte, Kategorien, Einstellungen werden zwischengespeichert
let stamm = null;
export async function stammdaten(neuLaden = false) {
  if (!stamm || neuLaden) {
    const [lagerorte, kategorien, einstellungen] = await Promise.all([
      holen('lagerorte'), holen('kategorien'), holen('einstellungen'),
    ]);
    stamm = { lagerorte, kategorien, einstellungen };
  }
  return stamm;
}
export function stammVergessen() { stamm = null; }

// Text sicher in HTML einsetzen
export function esc(wert) {
  return String(wert ?? '').replace(/[&<>"']/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[z]));
}

export const EINHEITEN = ['Stück', 'Packung', 'Dose', 'Glas', 'Flasche', 'Beutel', 'g', 'kg', 'ml', 'l'];

export function zahlText(n) {
  return Number(n).toLocaleString('de-DE', { maximumFractionDigits: 2 });
}

export function mengeText(menge, einheit) {
  return `${zahlText(menge)} ${einheit || ''}`.trim();
}

export function heuteISO(plusTage = 0) {
  const d = new Date();
  d.setDate(d.getDate() + plusTage);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function datumText(iso) {
  if (!iso) return '';
  const [j, m, t] = iso.split('-');
  return `${t}.${m}.${j}`;
}

// Liefert Text und Farbe für das MHD
export function mhdInfo(mhd, warnTage = 7) {
  if (!mhd) return { text: 'ohne MHD', klasse: '' };
  const tage = Math.round((new Date(mhd + 'T00:00:00') - new Date(heuteISO() + 'T00:00:00')) / 86400000);
  if (tage < 0) return { text: `abgelaufen seit ${-tage === 1 ? '1 Tag' : -tage + ' Tagen'}`, klasse: 'rot', tage };
  if (tage === 0) return { text: 'läuft heute ab', klasse: 'rot', tage };
  if (tage === 1) return { text: 'läuft morgen ab', klasse: 'orange', tage };
  if (tage <= warnTage) return { text: `noch ${tage} Tage`, klasse: 'orange', tage };
  return { text: `MHD ${datumText(mhd)}`, klasse: 'gruen', tage };
}

export function meldung(text, art = 'info') {
  const box = document.getElementById('meldungen');
  const el = document.createElement('div');
  el.className = `meldung ${art === 'fehler' ? 'fehler' : ''}`;
  el.textContent = text;
  box.appendChild(el);
  setTimeout(() => el.remove(), art === 'fehler' ? 6000 : 3500);
}

export function optionen(liste, gewaehlt, leerText) {
  const leer = leerText !== undefined ? `<option value="">${esc(leerText)}</option>` : '';
  return leer + liste.map((x) => `<option value="${x.id}" ${String(x.id) === String(gewaehlt ?? '') ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
}

export function einheitOptionen(gewaehlt = 'Stück') {
  const liste = EINHEITEN.includes(gewaehlt) ? EINHEITEN : [gewaehlt, ...EINHEITEN];
  return liste.map((e) => `<option ${e === gewaehlt ? 'selected' : ''}>${esc(e)}</option>`).join('');
}

// Datei ans Handy übergeben: Teilen-Menü (z. B. Google Drive, Mail), sonst normaler Download.
// Gibt false zurück, wenn der Nutzer das Teilen abgebrochen hat.
export async function dateiWeitergeben(datei, titel) {
  if (navigator.canShare?.({ files: [datei] })) {
    try {
      await navigator.share({ files: [datei], title: titel });
      return true;
    } catch (f) {
      if (f.name === 'AbortError') return false;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(datei);
  a.download = datei.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  return true;
}

// Fehler einer async-Aktion als Meldung anzeigen
export function sicher(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (e) {
      meldung(e.message, 'fehler');
    }
  };
}

// Zähler an der Einkaufs-Schaltfläche aktualisieren
export async function einkaufZaehlerAktualisieren() {
  try {
    const u = await holen('uebersicht');
    const el = document.getElementById('einkauf-zaehler');
    el.textContent = u.einkaufOffen;
    el.hidden = !u.einkaufOffen;
  } catch { /* egal */ }
}

export const ICON = {
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>',
  scan: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M10 8v8M13 8v8M17 8v8"/></svg>',
  loeschen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  kiste: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8"/></svg>',
};
