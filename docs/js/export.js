// Bestandsliste als CSV-Tabelle (öffnet sich in Excel und Google Tabellen)
import { holen, stammdaten, mhdInfo, datumText, heuteISO, dateiWeitergeben, meldung } from './api.js';

const SPALTEN = ['Produkt', 'Marke', 'Kategorie', 'Lagerort', 'Menge', 'Einheit', 'MHD', 'Tage bis MHD', 'Status', 'Mindestbestand', 'Bemerkung', 'Barcode'];

// Text-Zelle: Anführungszeichen verdoppeln; Formelzeichen am Anfang entschärfen
function textZelle(wert) {
  let t = String(wert ?? '');
  if (/^[=+\-@]/.test(t)) t = ' ' + t;
  return /[";\r\n]/.test(t) || t !== t.trim() ? `"${t.replace(/"/g, '""')}"` : t;
}
// Zahl mit deutschem Komma
const zahlZelle = (n) => (n == null || n === '' ? '' : String(n).replace('.', ','));

function status(b, warnTage) {
  if (!b.mhd) return 'ohne MHD';
  const { tage } = mhdInfo(b.mhd, warnTage);
  if (tage < 0) return 'abgelaufen';
  if (tage <= warnTage) return 'läuft bald ab';
  return 'ok';
}

export async function bestandAlsCsv() {
  const [{ einstellungen }, bestand] = await Promise.all([stammdaten(true), holen('bestand?sortierung=lagerort')]);
  const warnTage = einstellungen.warnschwelle_tage;
  const zeilen = bestand.map((b) => [
    textZelle(b.name),
    textZelle(b.marke),
    textZelle(b.kategorie),
    textZelle(b.lagerort),
    zahlZelle(b.menge),
    textZelle(b.einheit),
    b.mhd ? datumText(b.mhd) : '',
    b.mhd ? zahlZelle(mhdInfo(b.mhd, warnTage).tage) : '',
    textZelle(status(b, warnTage)),
    zahlZelle(b.mindestbestand || ''),
    textZelle(b.bemerkung),
    b.barcode ? `="${b.barcode}"` : '', // so zeigt Excel lange Barcodes nicht als 4,00638E+12 an
  ].join(';'));
  // BOM + Semikolon + CRLF: so öffnet deutsches Excel die Datei direkt richtig
  return '﻿' + [SPALTEN.join(';'), ...zeilen].join('\r\n') + '\r\n';
}

export async function bestandExportieren() {
  try {
    const csv = await bestandAlsCsv();
    const anzahl = csv.split('\r\n').length - 2;
    if (anzahl < 1) return meldung('Der Vorrat ist leer, es gibt nichts zu exportieren.', 'fehler');
    const datei = new File([csv], `vorrat-bestand-${heuteISO()}.csv`, { type: 'text/csv' });
    if (await dateiWeitergeben(datei, 'Vorrat-Bestand')) meldung(`Tabelle mit ${anzahl} Einträgen erstellt.`);
  } catch (f) {
    meldung(f.message, 'fehler');
  }
}
