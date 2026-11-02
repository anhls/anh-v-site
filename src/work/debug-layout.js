// R48 r7: ?debug=layout on the phone Work page: an on-screen readout of every width the page can use, the card rect and the title rect (for a real iPhone: card gap left = right, title centre = card centre).
export function mountLayoutDebug() {
  const box = document.createElement('pre');
  box.style.cssText = 'position:fixed;left:4px;right:4px;bottom:4px;z-index:99999;margin:0;padding:6px 8px;background:rgba(0,0,0,.78);color:#9f9;font:10px/1.35 ui-monospace,Menlo,monospace;pointer-events:none;white-space:pre-wrap';
  document.body.append(box);
  const r = (n) => (Math.round(n * 10) / 10);
  const tick = () => {
    const de = document.documentElement, vv = window.visualViewport, cv = document.querySelector('canvas.sw__gl') || document.querySelector('.work canvas'), cr = cv?.getBoundingClientRect();
    let card = null; for (const a of document.querySelectorAll('a.work__frame')) { const q = a.getBoundingClientRect(); const d = Math.abs(q.y + q.height / 2 - innerHeight / 2); if (!card || d < card.d) card = { d, x: q.x, w: q.width, y: q.y, h: q.height, el: a }; }
    const pr = card ? window.__workGl?.probeEl?.(card.el) : null; const bad = !!(pr && card && (Math.abs(pr.left - card.x) > 1 || Math.abs(pr.right - card.x - card.w) > 1 || pr.dbw !== pr.cw || pr.vp[2] !== pr.dbw)); box.style.color = bad ? '#f66' : '#9f9';
    const px = card ? window.__workGl?.probePx?.(card.y + card.h * 0.2) : null; const badPx = !!(px && card && (px.first == null || Math.abs(px.first - card.x) > 1.5 || Math.abs(px.last - card.x - card.w) > 1.5)); if (badPx) box.style.color = '#f66';
    const t = document.querySelector('.lite-title__text')?.getBoundingClientRect();
    box.textContent = [
      `innerWidth ${innerWidth}  clientWidth ${de.clientWidth}  vv.width ${vv ? r(vv.width) : '-'}  vv.scale ${vv ? r(vv.scale) : '-'}  dpr ${devicePixelRatio}`,
      `canvas css ${cv ? cv.style.width : '-'}  rect x ${cr ? r(cr.x) : '-'} w ${cr ? r(cr.width) : '-'}  bitmap ${cv ? cv.width : '-'}`,
      pr ? `GL drawn: buffer ${pr.dbw}x${pr.dbh}  viewport ${pr.vp.join(',')}  bitmap ${pr.cw}  gl W ${pr.W}  card x ${r(pr.left)} -> ${r(pr.right)}  ${bad ? 'MISMATCH ' + r(pr.left - card.x) + ' / ' + r(pr.right - card.x - card.w) : 'ok'}` : 'GL drawn -',
      pr ? `GL internals: idx ${pr.i} hs ${pr.hs} ox ${pr.ox == null ? '-' : r(pr.ox)} bx ${r(pr.bxi)} bw ${r(pr.bwi)}  fb ${pr.fb ? pr.fb.w + 'x' + pr.fb.h + ' m ' + pr.fb.mx + ',' + pr.fb.my : '-'}  warpScale ${pr.warpScale}  pixelFx ${pr.fx} ${pr.fxa}` : 'GL internals -',
      px ? `PIXELS (row y ${r(px.y)}): first lit x ${px.first == null ? '-' : r(px.first)}  last lit x ${px.last == null ? '-' : r(px.last)}  ${badPx ? 'MISMATCH vs card ' + (card ? r(card.x) + ' -> ' + r(card.x + card.w) : '') : 'ok'}` : 'PIXELS -',
      card ? `card x ${r(card.x)} -> ${r(card.x + card.w)}  gap L ${r(card.x)} R ${r(de.clientWidth - card.x - card.w)}  centre ${r(card.x + card.w / 2)}` : 'card -',
      t ? `title x ${r(t.x)} -> ${r(t.x + t.width)}  centre ${r(t.x + t.width / 2)}  (card centre ${card ? r(card.x + card.w / 2) : '-'})` : 'title -',
    ].join('\n');
  };
  setInterval(tick, 400); tick();
}
