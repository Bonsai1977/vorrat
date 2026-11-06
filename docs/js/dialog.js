// Einfacher modaler Dialog. inhalt = HTML-Text. Gibt das <dialog>-Element zurück.
// Der Dialog wird nach dem Schließen automatisch entfernt.
export function dialogOeffnen(inhalt, { beimSchliessen } = {}) {
  const dlg = document.createElement('dialog');
  dlg.innerHTML = `<div class="dialog-innen">${inhalt}</div>`;
  document.body.appendChild(dlg);
  dlg.addEventListener('close', () => {
    beimSchliessen?.();
    dlg.remove();
  });
  // Klick auf den abgedunkelten Hintergrund schließt
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) dlg.close();
  });
  dlg.querySelectorAll('[data-schliessen]').forEach((b) => b.addEventListener('click', () => dlg.close()));
  dlg.showModal();
  return dlg;
}
