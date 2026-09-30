import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Hero stack = 100vh pinned + 585vh of scrolling + 45vh tail = 730vh.
// Builds the DOM from data.hero, then wires the pin timeline from HANDOFF.md.
export function buildHero(root, hero) {
  const captions = hero.captions
    .map((c) => `<li><span>${c.title}</span><span>${c.client}</span><span>${c.role}</span></li>`)
    .join('');
  const dots = Array.from({ length: 12 }, () => `<span class="ticker__item"><img src="${hero.tickerDot}" alt="" />${hero.tickerText}</span>`).join('');

  root.innerHTML = `
    <section class="hero" id="hero">
      <div class="hero__pin">
        <div class="hero__wrapper">
          <video class="hero__video" src="${hero.video}" autoplay muted loop playsinline></video>
          <img class="hero__image" src="${hero.image}" alt="" />
          ${hero.gallery.map((src) => `<img class="hero__gallery" src="${src}" alt="" />`).join('')}
        </div>
        <div class="ticker" aria-hidden="true"><div class="ticker__track">${dots}${dots}</div></div>
        <img class="hero__wordmark" src="${hero.wordmark}" alt="Anh V" />
        <ul class="hero__captions">${captions}</ul>
      </div>
      <div class="hero__tail"></div>
    </section>`;

  const pin = root.querySelector('.hero__pin');
  const wrapper = root.querySelector('.hero__wrapper');
  const video = root.querySelector('.hero__video');
  const image = root.querySelector('.hero__image');
  const gallery = root.querySelectorAll('.hero__gallery');
  const wordmark = root.querySelector('.hero__wordmark');
  const fades = root.querySelectorAll('.ticker, .hero__captions');
  const track = root.querySelector('.ticker__track');

  // Ticker loops on its own (CSS-free: one tween, repeat forever).
  gsap.to(track, { xPercent: -50, duration: 40, ease: 'none', repeat: -1 });

  // 1 vh of scroll = 0.01s of timeline, so the timeline is 5.85s for +=585%.
  const tl = gsap.timeline({
    defaults: { overwrite: 'auto' },
    scrollTrigger: {
      trigger: pin,
      start: 'top top',
      end: '+=585%',
      scrub: 0.25,
      pin: true,
      pinSpacing: true,
      fastScrollEnd: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });

  // Wrapper size (spec).
  tl.fromTo(wrapper, { width: '100vw', height: '100vh' }, { width: '17vw', height: '50vh', ease: 'expo.inOut', duration: 0.7 }, 0)
    .to(wrapper, { width: '25vw', height: '40vh', ease: 'expo.out', duration: 0.35 }, 1.5)
    .to(wrapper, { width: '100vw', height: '100vh', ease: 'expo.inOut', duration: 0.85 }, 5.0);

  // Guessed details (not in the spec): what is inside the frame and what the overlays do.
  tl.fromTo(video, { scale: 1.3 }, { scale: 1, ease: 'power1.out', duration: 1.85 }, 0)
    .fromTo(fades, { autoAlpha: 1 }, { autoAlpha: 0, ease: 'none', duration: 0.4 }, 0)
    .fromTo(wordmark, { top: '68vh', left: '2vw', width: '96vw' }, { top: '1.5vw', left: '2vw', width: '5vw', ease: 'expo.inOut', duration: 0.7 }, 0)
    .fromTo(image, { autoAlpha: 0 }, { autoAlpha: 1, ease: 'none', duration: 0.35 }, 1.5)
    .fromTo(gallery, { autoAlpha: 0 }, { autoAlpha: 1, ease: 'none', duration: 0.05, stagger: 0.7 }, 2.0);

  tl.set({}, {}, 5.85); // make the timeline exactly 5.85s

  return ScrollTrigger;
}
