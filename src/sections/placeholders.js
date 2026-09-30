import { SECTIONS } from '../timeline.js';

// Empty stand-ins so the page has its final 730vh structure. Each gets built out in its own request.
// Heights and offsets come from src/timeline.js (vh of page).
const len = ([a, b]) => `${b - a}vh`;

export function buildPlaceholders(root) {
  const { index, archive, clients, footer } = SECTIONS;
  root.insertAdjacentHTML('beforeend', `
    <section class="index" id="index" style="height:${len(index)}">
      <div class="index__blank"></div>
      <div class="index__sticky"></div>
    </section>
    <section class="clients" id="clients" style="height:${len(clients)}">
      <div class="clients__sticky"></div>
    </section>
    <section class="archive" id="archive" style="top:${archive[0]}vh;height:${len(archive)}"></section>
    <footer class="footer" id="contact" style="height:${len(footer)}"></footer>`);
}
