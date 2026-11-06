// Barcode-Scanner: Live-Kamera, Foto oder Nummer eintippen. Liefert den Code oder null.
import { esc } from './api.js';
import { dialogOeffnen } from './dialog.js';

const FORMATE_NATIV = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];

function zxingLeser() {
  const Z = window.ZXing;
  if (!Z) return null;
  const hinweise = new Map();
  hinweise.set(Z.DecodeHintType.POSSIBLE_FORMATS, [
    Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E, Z.BarcodeFormat.CODE_128,
  ]);
  hinweise.set(Z.DecodeHintType.TRY_HARDER, true);
  return new Z.BrowserMultiFormatReader(hinweise, 150);
}

async function nativerDetektor() {
  if (!('BarcodeDetector' in window)) return null;
  try {
    const unterstuetzt = await window.BarcodeDetector.getSupportedFormats();
    const formate = FORMATE_NATIV.filter((f) => unterstuetzt.includes(f));
    return formate.length ? new window.BarcodeDetector({ formats: formate }) : null;
  } catch {
    return null;
  }
}

// Großes Handyfoto verkleinern, damit die Erkennung schnell geht
async function fotoVerkleinern(datei, maxSeite = 1600) {
  const bild = await createImageBitmap(datei);
  const faktor = Math.min(1, maxSeite / Math.max(bild.width, bild.height));
  const leinwand = document.createElement('canvas');
  leinwand.width = Math.round(bild.width * faktor);
  leinwand.height = Math.round(bild.height * faktor);
  leinwand.getContext('2d').drawImage(bild, 0, 0, leinwand.width, leinwand.height);
  return leinwand;
}

async function codeAusFoto(datei) {
  const leinwand = await fotoVerkleinern(datei);
  const nativ = await nativerDetektor();
  if (nativ) {
    const treffer = await nativ.detect(leinwand).catch(() => []);
    if (treffer.length) return treffer[0].rawValue;
  }
  const leser = zxingLeser();
  if (!leser) return null;
  try {
    const ergebnis = await leser.decodeFromImageUrl(leinwand.toDataURL('image/jpeg', 0.9));
    return ergebnis.getText();
  } catch {
    return null;
  }
}

export function scanne(titel = 'Barcode scannen') {
  return new Promise((aufloesen) => {
    let ergebnis = null;
    let leser = null;
    let strom = null;
    let laeuft = true;

    const dlg = dialogOeffnen(`
      <h3>${esc(titel)}</h3>
      <div class="scanner-video"><video playsinline muted autoplay></video></div>
      <p class="scanner-hinweis" data-hinweis>Kamera wird gestartet …</p>
      <div class="knopfreihe" style="margin-top:12px">
        <button class="knopf" type="button" data-foto>Foto aufnehmen</button>
      </div>
      <input type="file" accept="image/*" capture="environment" hidden data-datei>
      <form data-manuell style="display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:12px">
        <input inputmode="numeric" autocomplete="off" placeholder="… oder Nummer unter dem Strichcode eintippen" aria-label="Barcode-Nummer">
        <button class="knopf">OK</button>
      </form>
      <div class="dialog-fuss"><button class="knopf" type="button" data-schliessen>Abbrechen</button></div>
    `, {
      beimSchliessen: () => {
        laeuft = false;
        try { leser?.reset(); } catch { /* egal */ }
        strom?.getTracks().forEach((t) => t.stop());
        aufloesen(ergebnis);
      },
    });

    const video = dlg.querySelector('video');
    const hinweis = dlg.querySelector('[data-hinweis]');
    const fertig = (code) => {
      if (!code || !laeuft) return;
      ergebnis = String(code).trim();
      navigator.vibrate?.(80);
      dlg.close();
    };

    dlg.querySelector('[data-foto]').addEventListener('click', () => dlg.querySelector('[data-datei]').click());
    dlg.querySelector('[data-datei]').addEventListener('change', async (e) => {
      const datei = e.target.files[0];
      if (!datei) return;
      hinweis.textContent = 'Foto wird ausgewertet …';
      const code = await codeAusFoto(datei);
      if (code) fertig(code);
      else hinweis.textContent = 'Auf dem Foto wurde kein Barcode erkannt. Bitte näher und gerade fotografieren.';
      e.target.value = '';
    });
    dlg.querySelector('[data-manuell]').addEventListener('submit', (e) => {
      e.preventDefault();
      const wert = e.target.querySelector('input').value.replace(/\D/g, '');
      if (wert.length >= 6) fertig(wert);
      else hinweis.textContent = 'Bitte die ganze Nummer eintippen (meist 8 oder 13 Ziffern).';
    });

    // Live-Kamera starten
    (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        video.parentElement.hidden = true;
        hinweis.textContent = 'Live-Kamera ist hier nicht verfügbar (App bitte über https:// öffnen). Foto aufnehmen geht trotzdem.';
        return;
      }
      try {
        const nativ = await nativerDetektor();
        if (nativ) {
          // Schneller Weg (Android/Chrome): eingebaute Barcode-Erkennung
          strom = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          });
          if (!laeuft) return strom.getTracks().forEach((t) => t.stop());
          video.srcObject = strom;
          await video.play();
          hinweis.textContent = 'Barcode in die Mitte halten …';
          const suchen = async () => {
            if (!laeuft) return;
            if (video.readyState >= 2) {
              const treffer = await nativ.detect(video).catch(() => []);
              if (treffer.length) return fertig(treffer[0].rawValue);
            }
            setTimeout(suchen, 120);
          };
          suchen();
        } else {
          // iPhone und andere: ZXing-Bibliothek
          leser = zxingLeser();
          if (!leser) throw new Error('Barcode-Bibliothek nicht geladen');
          await leser.decodeFromConstraints(
            { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
            video,
            (treffer) => { if (treffer) fertig(treffer.getText()); }
          );
          if (!laeuft) leser.reset();
          hinweis.textContent = 'Barcode in die Mitte halten …';
        }
      } catch (e) {
        video.parentElement.hidden = true;
        hinweis.textContent = e && e.name === 'NotAllowedError'
          ? 'Kamera-Zugriff wurde nicht erlaubt. Du kannst ihn in den Browser-Einstellungen freigeben oder ein Foto aufnehmen.'
          : 'Die Kamera konnte nicht gestartet werden. Bitte Foto aufnehmen oder Nummer eintippen.';
      }
    })();
  });
}
