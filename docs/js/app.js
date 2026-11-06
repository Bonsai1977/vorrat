// Navigation zwischen den Ansichten (über die Adresse nach dem #)
import { senden, meldung, einkaufZaehlerAktualisieren } from './api.js';
import { scanne } from './scanner.js';
import uebersicht from './views/uebersicht.js';
import vorrat from './views/vorrat.js';
import hinzufuegen from './views/hinzufuegen.js';
import einkauf from './views/einkaufsliste.js';
import einstellungen from './views/einstellungen.js';

const ANSICHTEN = {
  uebersicht: { titel: 'Übersicht', zeigen: uebersicht },
  vorrat: { titel: 'Vorrat', zeigen: vorrat },
  hinzufuegen: { titel: 'Hinzufügen', zeigen: hinzufuegen },
  einkauf: { titel: 'Einkaufsliste', zeigen: einkauf },
  einstellungen: { titel: 'Einstellungen', zeigen: einstellungen },
};

const bereich = document.getElementById('ansicht');

export async function anzeigen() {
  const [pfad, abfrage] = location.hash.replace(/^#\/?/, '').split('?');
  const name = ANSICHTEN[pfad] ? pfad : 'uebersicht';
  const ansicht = ANSICHTEN[name];
  document.getElementById('titel').textContent = ansicht.titel;
  document.title = `${ansicht.titel} – Vorrat`;
  document.querySelectorAll('.leiste a').forEach((a) => {
    const aktiv = a.dataset.ansicht === name;
    a.classList.toggle('aktiv', aktiv);
    if (aktiv) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  bereich.innerHTML = '<p class="leer">Lädt …</p>';
  try {
    await ansicht.zeigen(bereich, new URLSearchParams(abfrage || ''));
  } catch (e) {
    bereich.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'leer';
    p.textContent = e.message;
    bereich.appendChild(p);
  }
  einkaufZaehlerAktualisieren();
}

window.addEventListener('hashchange', () => { anzeigen(); window.scrollTo(0, 0); });

// Kopf-Schaltfläche: scannen und eine Einheit entnehmen
document.getElementById('schnell-entnehmen').addEventListener('click', async () => {
  const code = await scanne('Scannen & entnehmen');
  if (!code) return;
  try {
    const r = await senden('entnehmen', { barcode: code, menge: 1 });
    const wo = r.entnommen.map((x) => x.lagerort).join(', ');
    meldung(`1 ${r.produkt.einheit} „${r.produkt.name}“ entnommen (${wo}). Noch da: ${r.restbestand.toLocaleString('de-DE')}`);
    anzeigen();
  } catch (e) {
    if (/keinem Produkt zugeordnet/.test(e.message)) {
      if (confirm('Diesen Barcode kennt die App noch nicht. Jetzt als neues Produkt anlegen?')) {
        location.hash = `#/hinzufuegen?barcode=${encodeURIComponent(code)}`;
      }
    } else {
      meldung(e.message, 'fehler');
    }
  }
});

// Offline-Unterstützung: App startet auch ohne Internet
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

anzeigen();
