// R46 Part A: the tiny always-loaded part of the contact card: a click on any [data-contact] link opens the card (its code + css load on the first click). The link keeps its mailto: href,
// so without JS (or if the chunk fails to load) it is still a mail link.
let loading = null;
document.addEventListener('click', (e) => {
  const a = e.target.closest?.('[data-contact]');
  if (!a || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.defaultPrevented) return;
  e.preventDefault();
  (loading ||= import('./contact-card.js')).then((m) => m.openContact(a)).catch(() => { loading = null; location.href = a.getAttribute('href') || '/'; });
}, true);
