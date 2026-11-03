// R48 r7: ONE width for the phone / tablet Work page (strip, canvas, title, details). On a real iPhone Safari window.innerWidth can differ from the layout width (documentElement.clientWidth, what 100% / fixed
// inset:0 elements use) by a few px, which put the cards ~5 px off the screen's centre. Everything that places or draws the Work page reads the layout width from here.
export const viewW = () => document.documentElement.clientWidth || innerWidth;
