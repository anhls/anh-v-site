import './styles/base.css';
import Lenis from 'lenis';
import data from './data/data.json';

// Project pages use Lenis + IntersectionObserver reveals only (no GSAP).
const slug = document.body.dataset.project;
const project = data.projects.find((p) => p.slug === slug);

const lenis = new Lenis();
function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

console.log('project page:', project?.title);
