// Startseite: Was ist abgelaufen, was läuft bald ab, was fehlt?
import { holen, esc, mengeText, ICON } from '../api.js';
import { bestandZeile, listeVerdrahten } from '../bearbeiten.js';

// Erinnerung, wenn es Daten gibt, aber seit 30 Tagen (oder noch nie) gesichert wurde
function sicherungFaellig(u) {
  if (u.eintraege < 5) return false;
  if (!u.letzte_sicherung) return true;
  return (Date.now() - new Date(u.letzte_sicherung + 'T00:00:00')) / 86400000 > 30;
}

export default async function uebersicht(el) {
  const u = await holen('uebersicht');
  const t = u.warnschwelle_tage;

  if (!u.eintraege && !u.unterMindestbestand.length) {
    el.innerHTML = `
      <div class="karte stapel" style="text-align:center;padding:28px 18px">
        <div style="color:var(--akzent)">${ICON.kiste.replace('<svg', '<svg style="width:48px;height:48px"')}</div>
        <h2 style="margin:0">Willkommen!</h2>
        <p class="leise">Noch ist der Vorrat leer. Scanne den Barcode eines Lebensmittels oder lege es von Hand an.</p>
        <a class="knopf haupt breit scan-gross" href="#/hinzufuegen?scan=1">${ICON.scan} Ersten Artikel scannen</a>
        <a class="knopf breit" href="#/hinzufuegen">Von Hand anlegen</a>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div class="kacheln">
      <a class="kachel ${u.abgelaufen.length ? 'rot' : ''}" href="#abgelaufen"><b>${u.abgelaufen.length}</b><span>abgelaufen</span></a>
      <a class="kachel ${u.baldAblaufend.length ? 'orange' : ''}" href="#bald"><b>${u.baldAblaufend.length}</b><span>läuft in ${t} Tagen ab</span></a>
      <a class="kachel ${u.unterMindestbestand.length ? 'orange' : 'gruen'}" href="#/einkauf"><b>${u.unterMindestbestand.length}</b><span>unter Mindestbestand</span></a>
    </div>
    <p class="leise" style="margin:10px 2px 0">${u.produkte} Produkte in ${u.eintraege} Einträgen im Vorrat.</p>
    ${sicherungFaellig(u) ? `<a class="vorschlag" href="#/einstellungen" style="margin-top:12px;text-decoration:none;color:inherit">
      <div><b>Zeit für eine Sicherung</b><br><span class="leise">${u.letzte_sicherung ? 'Die letzte ist über einen Monat her.' : 'Deine Daten liegen nur auf diesem Handy.'} Unter „Mehr“ → „Sicherung speichern“.</span></div></a>` : ''}

    <section id="abgelaufen-bereich" ${u.abgelaufen.length ? '' : 'hidden'}>
      <h2>Abgelaufen</h2>
      <ul class="liste" data-liste="abgelaufen">${u.abgelaufen.map((e) => bestandZeile(e, t, { mitKnoepfen: false })).join('')}</ul>
    </section>

    <section id="bald-bereich">
      <h2>Läuft bald ab</h2>
      ${u.baldAblaufend.length
        ? `<ul class="liste" data-liste="bald">${u.baldAblaufend.map((e) => bestandZeile(e, t, { mitKnoepfen: false })).join('')}</ul>`
        : `<p class="leer karte">In den nächsten ${t} Tagen läuft nichts ab.</p>`}
    </section>

    <section ${u.unterMindestbestand.length ? '' : 'hidden'}>
      <div class="abschnitt-kopf"><h2>Unter Mindestbestand</h2><a href="#/einkauf" class="leise">zur Einkaufsliste</a></div>
      <ul class="liste">${u.unterMindestbestand.map((p) => `
        <li><div class="haupt"><div class="name">${esc(p.name)}</div>
          <div class="unter"><span>vorhanden ${esc(mengeText(p.gesamt, p.einheit))}</span><span>Minimum ${esc(mengeText(p.mindestbestand, p.einheit))}</span></div></div></li>`).join('')}
      </ul>
    </section>

    <div class="knopfreihe" style="margin-top:20px">
      <a class="knopf haupt" href="#/hinzufuegen?scan=1">${ICON.scan} Einkauf einscannen</a>
      <a class="knopf" href="#/vorrat">Ganzer Vorrat</a>
    </div>`;

  // Sprung-Kacheln innerhalb der Seite
  el.querySelector('a[href="#abgelaufen"]').addEventListener('click', (e) => {
    e.preventDefault(); el.querySelector('#abgelaufen-bereich').scrollIntoView({ behavior: 'smooth' });
  });
  el.querySelector('a[href="#bald"]').addEventListener('click', (e) => {
    e.preventDefault(); el.querySelector('#bald-bereich').scrollIntoView({ behavior: 'smooth' });
  });

  const neu = () => uebersicht(el);
  const ab = el.querySelector('[data-liste="abgelaufen"]');
  if (ab) listeVerdrahten(ab, u.abgelaufen, neu);
  const bald = el.querySelector('[data-liste="bald"]');
  if (bald) listeVerdrahten(bald, u.baldAblaufend, neu);
}
