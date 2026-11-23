// The bar's icons: one line style (24 grid, 1.8 stroke, round caps), drawn for Pointer.

const ICON_PATHS = {
  page: '<path d="M6 3.5l12.5 6.2-5.6 1.9-2 5.9z"/><path d="M13 13l5 5"/>',
  move: '<path d="M12 3v18M3 12h18"/><path d="M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
  pick: '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
  comment: '<path d="M5 5.5h14a1.5 1.5 0 011.5 1.5v8a1.5 1.5 0 01-1.5 1.5H10l-4.5 3.5V16.5H5A1.5 1.5 0 013.5 15V7A1.5 1.5 0 015 5.5z"/>',
  crop: '<path d="M7 2.5V17h14.5"/><path d="M2.5 7H17v14.5"/>',
  idea: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0012 3z"/>',
  gap: '<path d="M3.5 6v12M20.5 6v12"/><path d="M6 12h12"/><path d="M8.5 9.5L6 12l2.5 2.5M15.5 9.5L18 12l-2.5 2.5"/>',
  pen: '<path d="M15.5 4.5l4 4L9 19l-5 1 1-5z"/><path d="M13.5 6.5l4 4"/>',
  arrow: '<path d="M5 19L19 5"/><path d="M10 5h9v9"/>',
  box: '<rect x="4" y="6" width="16" height="12" rx="2.5"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="8.5" ry="6.5"/>',
  text: '<path d="M5 7V5h14v2"/><path d="M12 5v14"/><path d="M9 19h6"/>',
  icons: '<circle cx="7.5" cy="7.5" r="3.5"/><path d="M14 4h6v6h-6z"/><path d="M7.5 13.5l4 7h-8z"/><path d="M17 14v6M14 17h6"/>',
  upload: '<rect x="3" y="5" width="13" height="14" rx="2.5"/><path d="M3 15.5l3.5-3.5 3 3 2-2 4.5 4.5"/><path d="M19.5 3v7M16.5 6l3-3 3 3"/>',
  styles: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  undo: '<path d="M9 14.5L4 9.5l5-5"/><path d="M4 9.5h10a5.5 5.5 0 010 11h-3"/>',
  redo: '<path d="M15 14.5l5-5-5-5"/><path d="M20 9.5H10a5.5 5.5 0 000 11h3"/>',
  clear: '<path d="M4 7h16"/><path d="M9.5 7V4.5h5V7"/><path d="M6.5 7l1 12.5h9l1-12.5"/>',
  picture: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-4.5-4.5-9 8"/>',
  textOnly: '<path d="M4 6.5h16M4 12h16M4 17.5h10"/>',
  copy: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.5"/><path d="M15.5 8.5V6A1.5 1.5 0 0014 4.5H6A1.5 1.5 0 004.5 6v8A1.5 1.5 0 006 15.5h2.5"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  /** The 021 mark (021is/021-site brand/icon.svg): the rounded "0" and its dot. */
  mark: '<rect x="2.5" y="7" width="19" height="10" rx="5"/><circle cx="15.6" cy="12" r="2.7" fill="currentColor" stroke="none"/>',
} as const;

export type IconName = keyof typeof ICON_PATHS;

export function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "icon");
  svg.innerHTML = ICON_PATHS[name];
  return svg;
}
