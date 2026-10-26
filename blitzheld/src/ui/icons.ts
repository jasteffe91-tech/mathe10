// Kleine SVG-Symbole – zuverlässiger als Emojis, die nicht auf jedem Gerät gleich aussehen.

const svg = (body: string, view = '0 0 24 24'): string =>
  `<svg class="ico" viewBox="${view}" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICONS = {
  heart: svg('<path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.2 0 3.6 1.3 5.3 3.2 1.7-1.9 3.1-3.2 5.3-3.2 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z" fill="#ff4f7a" stroke="#a01a43" stroke-width="1.6"/>'),
  heartEmpty: svg('<path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.2 0 3.6 1.3 5.3 3.2 1.7-1.9 3.1-3.2 5.3-3.2 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z" fill="rgba(255,255,255,0.35)" stroke="rgba(60,30,60,0.55)" stroke-width="1.6"/>'),
  coin: svg('<circle cx="12" cy="12" r="10" fill="#ffc928" stroke="#9a5a00" stroke-width="1.8"/><path d="M13.2 5.5 9 12.5h3l-1.6 6 4.6-7.6h-3l1.4-5.4z" fill="#fff7c2"/>'),
  star: svg('<path d="m12 2.5 2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" fill="#ffd23f" stroke="#a8650a" stroke-width="1.6" stroke-linejoin="round"/>'),
  starEmpty: svg('<path d="m12 2.5 2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" fill="rgba(255,255,255,0.3)" stroke="rgba(60,40,80,0.5)" stroke-width="1.6" stroke-linejoin="round"/>'),
  trophy: svg('<path d="M7 3h10v4a5 5 0 0 1-10 0z" fill="#ffd23f" stroke="#8a5a00" stroke-width="1.6"/><path d="M7 5H4a3 3 0 0 0 3 4M17 5h3a3 3 0 0 1-3 4" fill="none" stroke="#8a5a00" stroke-width="1.6"/><path d="M10 12h4v4h-4zM7 20h10v-2H7z" fill="#ffb800" stroke="#8a5a00" stroke-width="1.4"/>'),
  badge: svg('<circle cx="12" cy="10" r="7" fill="#3ddc84" stroke="#16603a" stroke-width="1.6"/><path d="m8 16-2 6 4-2 2 2 1-5M16 16l2 6-4-2-2 2" fill="#ff5a8a" stroke="#6b1033" stroke-width="1.2"/><path d="m9 10 2 2 4-4" fill="none" stroke="#fff" stroke-width="2"/>'),
  play: svg('<path d="M7 4.5v15l12.5-7.5z" fill="currentColor"/>'),
  map: svg('<path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 4v14M15 6v14" stroke="currentColor" stroke-width="2"/>'),
  help: svg('<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M9.2 9.3a2.9 2.9 0 1 1 4 2.7c-.8.4-1.2 1-1.2 1.9v.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.6" r="1.3" fill="currentColor"/>'),
  soundOn: svg('<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  soundOff: svg('<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="m16 9 5 6m0-6-5 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
  pause: svg('<rect x="6" y="4.5" width="4" height="15" rx="1.4" fill="currentColor"/><rect x="14" y="4.5" width="4" height="15" rx="1.4" fill="currentColor"/>'),
  lock: svg('<rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.4"/>'),
  back: svg('<path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'),
  restart: svg('<path d="M5 12a7 7 0 1 0 2.2-5.1" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M5 4v4.5h4.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'),
  home: svg('<path d="M3.5 11 12 4l8.5 7M6 9.5V20h4.5v-5.5h3V20H18V9.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>'),
  bolt: svg('<path d="M13.5 2 5 13.5h5.5L9 22l9.5-12.5H13z" fill="#ffd23f" stroke="#a8650a" stroke-width="1.5" stroke-linejoin="round"/>'),
  boltEmpty: svg('<path d="M13.5 2 5 13.5h5.5L9 22l9.5-12.5H13z" fill="rgba(255,255,255,0.3)" stroke="rgba(60,40,80,0.5)" stroke-width="1.5" stroke-linejoin="round"/>'),
  crown: svg('<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" fill="#ffd23f" stroke="#8a5a00" stroke-width="1.6" stroke-linejoin="round"/>'),
  check: svg('<path d="m5 12.5 4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>'),
  backspace: svg('<path d="M9 5h11v14H9l-6-7z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="m12 9.5 5 5m0-5-5 5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
  up: svg('<path d="M12 4 4 13h5v7h6v-7h5z" fill="currentColor"/>'),
} as const;

export type IconName = keyof typeof ICONS;
