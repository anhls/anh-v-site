import { WORK, TALL, TRANSITION_POLICY_LITE } from '../timeline.js';
import { perfOn } from '../util/perf-mark.js';
import { initNav } from '../effects/nav.js';
import { buildProjectCards } from './cards.js';
import { createGuard } from './tall-guard.js';
import * as strip from './tall.js';

// R41 Part A: the tap-to-open gate for the lite Work strip. Pure state + checks, no listeners of its own (the core owns the pointer stream and the
// drag threshold; it calls these from its pointerdown / click handlers in Part B). `down` snapshots whether the strip was moving at touchdown,
// `accept` decides at the click, `rect` returns the image's on-screen rect in the shape the engine's runProjectTransition expects ({x, y, w, h}
// top-left + size in CSS px, the same as the desktop click call), `viewport` is the layout viewport captured at tap (innerHeight can change with
// the address bar during the motion, so the flight uses this, not live values). Numbers: TRANSITION_POLICY_LITE.
export function createTapGate(policy = TRANSITION_POLICY_LITE) {
  let downAt = 0, movingAtDown = true, openedAt = -1e9, vp = null;
  return {
    down({now = performance.now(), moving}) { downAt = now; movingAtDown = !!moving; },
    // c: { now, drag (the core's dragMoved), moving (inertia/snap/|vel|>5 now), centre: offset of the image centre from the viewport centre, share of the viewport along the strip }
    // reduced: prefers-reduced-motion. degraded: the frame-time guard (tall-guard.js) has already switched the warp off = a slow / low-power device
    // (iOS Low Power Mode has no web API; it shows up as 30 Hz frames, which the guard measures) -> plain page load
    accept({now = performance.now(), dragMoved = false, moving = false, centre = 0, reduced = false, degraded = false}) {
      if (!policy.enabled || reduced || degraded || dragMoved || moving || movingAtDown || navigator.connection?.saveData === true) return false;
      if (now - downAt > policy.maxPressMs || now - openedAt < policy.lockMs) return false;
      return Math.abs(centre) <= policy.centreTol;
    },
    lock(now = performance.now()) { openedAt = now; vp = { w: document.documentElement.clientWidth || innerWidth, h: innerHeight }; return vp; },
    get viewport() { return vp || { w: document.documentElement.clientWidth || innerWidth, h: innerHeight }; },
    unlock() { openedAt = -1e9; vp = null; }, // bfcache restore / failed navigation: the gate opens again
    rect: ({bx, by, bw, bh, ox = 0, oy = 0, scale = 1}) => ({ x: bx + ox - (bw * scale) / 2, y: by + oy - (bh * scale) / 2, w: bw * scale, h: bh * scale }),
  };
}

export function createMode({tall}) {
  const tap = createTapGate();
  // pageshow with persisted = restored from bfcache on back: the strip must accept taps again and no old renderer may linger
  addEventListener('pageshow', (e) => { if (e.persisted) tap.unlock(); });
  const kind = tall ? 'tall' : 'tablet', params = new URLSearchParams(location.search);
  const overrides = {};
  if (import.meta.env.DEV || perfOn) {
    const map = { fg: ['flingGain'], fr: ['dragFriction'], fm: ['dragMaxCoast'], sa: ['snapAfterSpeed'], wg: ['warpGain'], wp: ['warpPow'], wf: ['warpFall'], fw: ['frame'], fn: ['flingMin'], sd: ['snapDelay'] };
    for (const [k, [name]] of Object.entries(map)) { const v = parseFloat(params.get(k)); if (Number.isFinite(v)) { TALL[name] = v; overrides[k] = v; } }
    const ws = parseFloat(params.get('ws')); if (Number.isFinite(ws)) { TALL.warpStrength = ws; TALL.frameWarp.strength = WORK.frameWarp.strength * ws; overrides.ws = ws; }
    const ln = parseFloat(params.get('ln')); if (Number.isFinite(ln)) { TALL.frameWarp.lean = ln; overrides.ln = ln; }
    const ls = parseFloat(params.get('ls')); if (Number.isFinite(ls)) { TALL.frameWarp.leanSign = ls < 0 ? -1 : 1; overrides.ls = ls; }
    const lb = parseFloat(params.get('lb')); if (Number.isFinite(lb)) { TALL.frameWarp.leanBuf = lb; overrides.lb = lb; }
    for (const [k, f] of [['sr', 'speedRef'], ['sp', 'speedPow'], ['sk', 'speedKnee']]) { const v = parseFloat(params.get(k)); if (Number.isFinite(v)) { TALL.frameWarp[f] = v; overrides[k] = v; } }
    const fk = parseFloat(params.get('fk')); if (Number.isFinite(fk)) { TALL.flingKnee = fk; overrides.fk = fk; }
    const wr = parseFloat(params.get('wr')); if (Number.isFinite(wr)) { TALL.frameWarp.riseSec = wr; overrides.wr = wr; }
  }
  const cardsMax = strip.cardsMaxFor(kind, innerWidth, innerHeight), noCards = cardsMax <= 0;
  const warpSpeed = (v, along) => { const vn = (v * TALL.warpRefPx) / Math.max(along, 1), r = (Math.abs(vn) * TALL.warpGain) / TALL.warpVRef; return Math.sign(vn) * TALL.warpVRef * r ** TALL.warpPow; };
  return {
    tap, transitionPolicy: TRANSITION_POLICY_LITE, // R41: read by the core / engine in Part B
    v2:false, geometry:WORK, noCards, showToggle:false, allowPointer:!tall, applyFocus:!tall,
    validateStored:false, rendererOptions:{lite:true}, dragSamples:30,
    diagnosticKind:{lite:true, kind}, debugSettings:TALL, overrides,
    loadLayouts: async () => noCards ? null : (tall ? (await import('../data/layouts-tall.json')).default : (await import('../data/layouts-tablet.json')).default),
    initialVertical: () => tall,
    mountMenu() {
      if (tall) { import('../effects/tall-menu.js').then(m => m.mountTallMenu()); return; }
      const nav = document.createElement('nav'); nav.className = 'nav';
      nav.innerHTML = [['About', '/#2section'], ['Works', '/work/'], ['Contact', '/#contact']]
        .map(([n,h]) => `<a href="${h}" data-link="${n}"><span class="roll"><span>${n}</span><span>${n}</span></span></a>`).join('');
      document.body.prepend(nav);
    },
    async earlyNav(wordmark, lenis) {
      if (!tall) return;
      initNav(wordmark, lenis, {gateFrame:false, position:() => 1e9, startSmall:true, small:{x:5,y:3.4,width:28}});
      await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
    },
    lateNav(wordmark,lenis,scrolled,back) { if (!tall) initNav(wordmark,lenis,{gateFrame:false,position:() => scrolled() ? 1e9 : 0,startBig:!!back && !back.leave.wm}); },
    cards: (pool,slugs) => strip.liteCards(buildProjectCards,pool,slugs,WORK.seed,cardsMax),
    metrics: (W,H) => strip.liteMetrics(kind,W,H), pick:strip.pickTall, signature:strip.tallSignature,
    imageWidth: () => Math.round((tall ? TALL.frame : .75) * 100),
    scale: (W,H) => strip.liteScale(kind,W,H), frame:(W,H) => strip.liteFrame(kind,W,H),
    layouts:[strip.liteMode(kind)], layoutMetrics:(mode,W,H) => strip.liteMetrics(kind,W,H)[mode],
    linkLayouts(LAY) { const only=LAY[strip.liteMode(kind)]; LAY.side=only; LAY.vertical=only; },
    guard: (setScale,warpForce) => createGuard({setScale,enabled:TALL.guard && !warpForce}),
    capBend(bend) { bend.dprCap=Math.min(bend.dprCap,TALL.dprCap);bend.dprCapLarge=Math.min(bend.dprCapLarge,TALL.dprCap); },
    syncWarp({warpP,warpImg,bendImg,guard,copyWarp}) {
      warpP.strengthUp=warpP.strengthDown=0;
      const fw=TALL.frameWarp,on=TALL.warp && guard.state.warp;
      copyWarp(warpImg,{...fw,strength:on ? fw.strength : 0});
      bendImg.riseSpeed=7/Math.max(fw.riseSec,.02);bendImg.settleSpeed=7/Math.max(TALL.warpFall,.02);
    },
    guardFrame: (guard,delta,moving) => guard.frame(delta,moving),
    drawSpeed(v,along) {
      if(import.meta.env.DEV){const m=(window.__vl ||= {raw:0,out:0});m.raw=Math.max(m.raw,Math.abs(v));m.out=Math.max(m.out,Math.abs(warpSpeed(v,along)));}
      return warpSpeed(v,along);
    },
    glOffReason: () => navigator.connection?.saveData === true ? 'saveData' : 'noWebGL2',
    ambient: () => !tall || TALL.ambient, lead: () => !tall || TALL.lead,
    snapSec: () => 2, snapDelay: () => TALL.snapDelay,
    snapVelocity(delta,dt,swipe) {if(swipe && swipe.landedPx === null) swipe.snapCorrectionPx=+(swipe.snapCorrectionPx+Math.abs(delta)).toFixed(1);return delta/Math.max(dt,1e-3);},
    rest({now,vel,drag,inertia,snap,S,pt,motionAt,curSwipe,cur}) {
      if(Math.abs(vel)>5 || drag || inertia || snap) motionAt=now;
      const ok=!snap && !inertia && !drag && Math.abs(S-Math.round(S/pt)*pt)<.5 && now-motionAt>TALL.focusDelay*1000;
      if(curSwipe && curSwipe.landedPx===null && ok && now-motionAt>400){const pt0=cur().pitch;curSwipe.landedPx=+(S-Math.round(S/pt0)*pt0).toFixed(2);}
      return {ok,motionAt};
    },
    perFrame({gl,vel,drag,now,diag,curSwipe,swipePeak}) {
      const a=Math.abs(gl.bendImg().amt||0),mv=Math.abs(vel)>5 || !!drag;
      diag.now=a;if(a>diag.peakAll)diag.peakAll=a;
      if(mv && now-diag.moving>1500)diag.peakLast=0;
      if(mv)diag.moving=now;if(a>diag.peakLast)diag.peakLast=a;
      if(drag || (curSwipe && now-curSwipe.at<9000)){if(a>swipePeak)swipePeak=a;if(curSwipe)curSwipe.peak=+swipePeak.toFixed(3);}
      return swipePeak;
    },
    release(d,now,by,{S,cur,ampHist,touchLog,swipePeak}) {
      const len=Math.max(cur().M.viewAlong,1),pitch=cur().pitch;
      const s=d.samples.filter(q=>now-q[0]<=100),last=d.samples[d.samples.length-1];
      const entry={releaseLenPerS:0,fling:false,coastPitches:0,peak:swipePeak,at:Math.round(now),endedBy:by,landedPx:null,snapCorrectionPx:0,gapFromPrevMs:touchLog.length ? Math.round(now-touchLog[touchLog.length-1].at) : null};
      entry.durationMs=Math.round(now-d.samples[0][0]);
      const h=ampHist.filter(q=>now-q[0]>=100).pop()||ampHist[0];entry.ampAtRelease=h ? +Math.min(1,h[1]).toFixed(2) : 0;
      let inertia=null;
      if(s.length>=2 && now-last[0]<=80 && entry.durationMs>=60){
        const raw=-((s[s.length-1][1]-s[0][1])/Math.max((s[s.length-1][0]-s[0][0])/1000,.008));
        entry.releaseLenPerS=+(raw/len).toFixed(2);
        if(Math.abs(raw)/len>=TALL.flingMin){const pl=strip.flingPlan({raw,len,pitch,from:S});inertia={from:S,D:pl.D,T:pl.T,p:pl.p,v0:pl.v0,t0:now};entry.fling=true;entry.coastPitches=+pl.pitches.toFixed(2);entry.landsOn=pl.k;}
      }
      touchLog.push(entry);if(touchLog.length>10)touchLog.shift();return {inertia,entry};
    },
    coast({inertia,now}) {
      const u=Math.min(1,(now-inertia.t0)/1000/inertia.T),S=inertia.from+inertia.D*(1-Math.pow(1-u,inertia.p));
      return {S,inertia:u>=1 ? null : inertia,snap:null};
    },
  };
}
