// R49: the Ho Chi Minh City clock shared by the loader and the phone menu ("HH:MM GMT+7"). Always Asia/Ho_Chi_Minh, whatever the visitor's own zone.
// R48's tall-menu.js has the same function inline (hcmcTime): at the merge it should import this file instead.
const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export const hcmcTime = () => `${fmt.format(new Date())} GMT+7`;

// Writes the time into `el` now and again at every minute change. Returns a stop function.
export function mountClock(el) {
  let timer = 0;
  const tick = () => { el.textContent = hcmcTime(); timer = setTimeout(tick, 60000 - (Date.now() % 60000) + 50); };
  tick();
  return () => clearTimeout(timer);
}
