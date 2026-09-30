import './styles/base.css';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import data from './data/data.json';

gsap.registerPlugin(ScrollTrigger);

// Lenis drives the scroll; GSAP's ticker feeds it so pinned sections stay in sync.
const lenis = new Lenis();
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

// Sections are added here one by one (hero, about, archive, index, clients, footer).
console.log(`${data.projects.length} projects loaded`);
