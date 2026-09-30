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
          <!-- Strip inside the mask (measured on anh-v.com, see requests.md R4 part 1).
               Stacking: s1 on top, s3 middle, s2 bottom. Each fills the mask. -->
          <div class="hero__sec hero__s2"><img src="${hero.image}" alt="" /></div>
          <div class="hero__sec hero__s3">
            ${hero.gallery.map((src, i) => `<img class="hero__gallery" style="z-index:${i}" src="${src}" alt="" />`).join('')}
            <div class="hero__overlay2"></div>
            <div class="hero__overlay"></div>
          </div>
          <div class="hero__sec hero__s1">
            <video class="hero__video" src="${hero.video}" autoplay muted loop playsinline></video>
            <div class="ticker" aria-hidden="true"><div class="ticker__track">${dots}${dots}</div></div>
          </div>
        </div>
      </div>
      <div class="hero__tail"></div>
      <ul class="hero__captions">${captions}</ul>
    </section>`;

  const section = root.querySelector('.hero');
  const pin = root.querySelector('.hero__pin');
  const wrapper = root.querySelector('.hero__wrapper');
  const s1 = root.querySelector('.hero__s1');
  const s2 = root.querySelector('.hero__s2');
  const s3 = root.querySelector('.hero__s3');
  const gallery = root.querySelectorAll('.hero__gallery');
  const overlays = root.querySelectorAll('.hero__overlay, .hero__overlay2');
  const track = root.querySelector('.ticker__track');
  const vh = (n) => () => (window.innerHeight * n) / 100;

  // Ticker loops on its own (CSS-free: one tween, repeat forever).
  gsap.to(track, { xPercent: -50, duration: 40, ease: 'none', repeat: -1 });

  // 1 vh of scroll = 0.01s of timeline, so the timeline is 5.85s for +=585%.
  const tl = gsap.timeline({
    defaults: { overwrite: false },
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

  // Strip motion inside the mask. Measured on the live site (Framer scroll transforms, linear).
  // Times are scroll vh / 100. px values from 1080px viewport converted to vh.
  tl.fromTo(s1, { y: 0, scale: 1.3 }, { y: vh(-185.2), scale: 1, ease: 'none', duration: 1.0 }, 0.4)
    .fromTo(s2, { y: vh(55.6), scale: 2 }, { y: 0, scale: 1, ease: 'none', duration: 0.9 }, 0)
    .fromTo(s3, { y: vh(125), scale: 1.2 }, { y: 0, scale: 1.1, ease: 'none', duration: 0.4 }, 1.9)
    .to(s3, { scale: 1.2, ease: 'none', duration: 2.2 }, 3.0)
    .fromTo(gallery[2], { y: 0 }, { y: vh(-138.9), ease: 'none', duration: 0.6 }, 3.15)
    .fromTo(gallery[1], { y: 0 }, { y: vh(-138.9), ease: 'none', duration: 0.55 }, 4.05);

  // Overlays darken from 490vh to 630vh of page scroll: runs past the pin end (585vh), so its own trigger.
  gsap.fromTo(overlays, { opacity: 0 }, {
    opacity: 1,
    ease: 'none',
    scrollTrigger: {
      trigger: section,
      start: () => `top+=${window.innerHeight * 4.9} top`,
      end: () => `top+=${window.innerHeight * 6.3} top`,
      scrub: 0.25,
      invalidateOnRefresh: true,
    },
  });

  tl.set({}, {}, 5.85); // make the timeline exactly 5.85s

  return ScrollTrigger;
}
