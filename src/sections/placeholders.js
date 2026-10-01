import { SECTIONS } from '../timeline.js';

// Empty stand-ins so the page has its final 730vh structure. Each gets built out in its own request.
// Heights and offsets come from src/timeline.js (vh of page).
const len = ([a, b]) => `${b - a}vh`;

export function buildPlaceholders(root) {
  const { index, selectedWork, moreProjects, footer } = SECTIONS;
  root.insertAdjacentHTML('beforeend', `
    <section class="index" id="index" style="height:${len(index)}">
      <div class="index__blank"></div>
      <div class="index__sticky"></div>
    </section>
    <section class="more-projects" id="more-projects" style="height:${len(moreProjects)}">
      <div class="more-projects__sticky"></div>
    </section>
    <section class="selected-work" id="selected-work" style="height:${len(selectedWork)}"></section>
    <footer class="footer" id="contact" style="height:${len(footer)}"></footer>`);
}
