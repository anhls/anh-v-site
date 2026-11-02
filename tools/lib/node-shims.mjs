// Node shims so the site's layout modules (timeline.js, work/cards.js ...) can run offline (tools/layout-solve.mjs, layout-check.mjs, scratch tests)
export function installShims(search = '') {
  globalThis.window = globalThis;
  globalThis.location = { search, href: 'http://localhost/', pathname: '/' };
  globalThis.document = { documentElement: { style: { setProperty() {} } } };
  globalThis.localStorage = { getItem: () => null, setItem() {} };
  globalThis.sessionStorage = { getItem: () => null, setItem() {} };
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
  globalThis.innerWidth = 1920; globalThis.innerHeight = 1080;
}
