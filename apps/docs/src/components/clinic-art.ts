export const ink = "#17204d";

export const monitor = (x: number, top: number, surface: number, label: string, fill: string): string => `
<rect x="${x + 49}" y="${top + 80}" width="20" height="${surface - top - 86}" fill="#8d95b8"/>
<rect x="${x + 28}" y="${surface - 7}" width="62" height="7" rx="3" fill="#8d95b8"/>
<rect x="${x}" y="${top}" width="118" height="84" rx="8" fill="#8d95b8"/>
<rect x="${x + 6}" y="${top + 6}" width="106" height="72" rx="4" fill="#fff" stroke-width="2"/>
<rect x="${x + 6}" y="${top + 6}" width="106" height="13" rx="4" fill="#2236b8" stroke-width="2"/>
<circle cx="${x + 15}" cy="${top + 12.5}" r="2.2" fill="#fff" stroke="none"/>
<circle cx="${x + 23}" cy="${top + 12.5}" r="2.2" fill="#fff" stroke="none"/>
<rect x="${x + 12}" y="${top + 26}" width="94" height="34" rx="17" fill="${fill}" stroke-width="2.5"/>
<text x="${x + 59}" y="${top + 50}" text-anchor="middle" font-size="20" font-weight="800" fill="${ink}" stroke="none">${label}</text>
<rect x="${x + 14}" y="${top + 66}" width="52" height="4" rx="2" fill="#cfd4ee" stroke="none"/>`;

export const dog = (x: number, y: number): string => `
<g transform="translate(${x} ${y})">
<path d="M-33 -36 Q-54 -42 -49 -62" fill="none" stroke-width="9"/>
<path d="M-33 -36 Q-54 -42 -49 -62" fill="none" stroke="#f4b86a" stroke-width="3.5"/>
<rect x="-28" y="-24" width="11" height="24" rx="5" fill="#e0a050"/>
<rect x="-12" y="-24" width="11" height="24" rx="5" fill="#e0a050"/>
<rect x="12" y="-24" width="11" height="24" rx="5" fill="#f4b86a"/>
<rect x="26" y="-24" width="11" height="24" rx="5" fill="#f4b86a"/>
<ellipse cx="0" cy="-32" rx="35" ry="18" fill="#f4b86a"/>
<ellipse cx="-12" cy="-37" rx="10" ry="6" fill="#c98a3f" stroke="none"/>
<circle cx="40" cy="-54" r="16" fill="#f4b86a"/>
<path d="M30 -66 Q15 -62 19 -41 Q32 -40 36 -54 Z" fill="#c98a3f"/>
<ellipse cx="52" cy="-49" rx="9" ry="7" fill="#fde3b8"/>
<circle cx="58" cy="-51" r="3" fill="${ink}" stroke="none"/>
<circle cx="45" cy="-58" r="2.4" fill="${ink}" stroke="none"/>
<path d="M29 -45 Q35 -36 46 -40" fill="none" stroke="#ff4f93" stroke-width="6"/>
</g>`;

export const person = (
  x: number,
  head: number,
  top: number,
  width: number,
  bottom: number,
  cloth: string,
  skin: string,
  hair: string,
): string => `
<rect x="${x - width / 2}" y="${top}" width="${width}" height="${bottom - top}" rx="16" fill="${cloth}"/>
<rect x="${x - 6}" y="${head + 14}" width="12" height="${top - head - 8}" fill="${skin}"/>
<circle cx="${x}" cy="${head}" r="20" fill="${skin}"/>
<path d="M${x - 21} ${head - 2} A21 21 0 0 1 ${x + 21} ${head - 2} Q${x} ${head - 14} ${x - 21} ${head - 2}Z" fill="${hair}"/>
<circle cx="${x - 7}" cy="${head + 3}" r="2.4" fill="${ink}" stroke="none"/>
<circle cx="${x + 7}" cy="${head + 3}" r="2.4" fill="${ink}" stroke="none"/>
<path d="M${x - 5} ${head + 10} Q${x} ${head + 14} ${x + 5} ${head + 10}" fill="none" stroke-width="2.5"/>`;

export const arm = (x1: number, y1: number, x2: number, y2: number, cloth: string, skin: string): string => `
<path d="M${x1} ${y1} L${x2} ${y2}" fill="none" stroke-width="16"/>
<path d="M${x1} ${y1} L${x2} ${y2}" fill="none" stroke="${cloth}" stroke-width="10"/>
<circle cx="${x2}" cy="${y2}" r="6.5" fill="${skin}" stroke-width="2.5"/>`;

export const legs = (x: number, top: number, bottom: number, fill: string): string => `
<rect x="${x - 18}" y="${top}" width="15" height="${bottom - top}" rx="5" fill="${fill}"/>
<rect x="${x + 3}" y="${top}" width="15" height="${bottom - top}" rx="5" fill="${fill}"/>`;

export const shadow = (x: number, y: number, rx: number): string =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="5" fill="${ink}" opacity="0.14" stroke="none"/>`;

const pet = (x: number, y: number, scale: number, flip: boolean, body: string): string => {
  const effective = scale >= 0.8 ? 3 : 2.4;
  return `
<g transform="translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})" stroke-width="${(effective / scale).toFixed(2)}">${body}
</g>`;
};

export const rabbit = (x: number, y: number, scale = 1, flip = false): string =>
  pet(x, y, scale, flip, `
<g transform="rotate(-8 24 -62)"><ellipse cx="24" cy="-82" rx="7" ry="20" fill="#fff"/><ellipse cx="24" cy="-80" rx="3" ry="12" fill="#ffb3d0" stroke="none"/></g>
<g transform="rotate(14 40 -62)"><ellipse cx="40" cy="-84" rx="7" ry="20" fill="#fff"/><ellipse cx="40" cy="-82" rx="3" ry="12" fill="#ffb3d0" stroke="none"/></g>
<circle cx="-32" cy="-30" r="9" fill="#fff"/>
<ellipse cx="-4" cy="-26" rx="32" ry="24" fill="#fff"/>
<ellipse cx="-14" cy="-24" rx="14" ry="12" fill="#fff" stroke-width="2"/>
<ellipse cx="-8" cy="-5" rx="18" ry="6" fill="#fff"/>
<rect x="20" y="-18" width="10" height="18" rx="5" fill="#fff"/>
<circle cx="32" cy="-50" r="17" fill="#fff"/>
<circle cx="35" cy="-44" r="4" fill="#ffb3d0" stroke="none"/>
<circle cx="38" cy="-54" r="2.6" fill="${ink}" stroke="none"/>
<circle cx="47" cy="-49" r="3.2" fill="#ff4f93" stroke-width="2"/>
<path d="M47 -46 Q44 -41 40 -42" fill="none" stroke-width="2"/>`);

export const hedgehog = (x: number, y: number, scale = 1, flip = false): string => {
  const cx = -2;
  const cy = -26;
  const points: string[] = [];
  const count = 15;
  for (let i = 0; i <= count * 2; i += 1) {
    const angle = Math.PI * 0.98 - (Math.PI * 0.9 * i) / (count * 2);
    const r = i % 2 === 0 ? 1 : 0.8;
    points.push(`${(cx + 42 * r * Math.cos(angle)).toFixed(1)} ${(cy - 36 * r * Math.sin(angle)).toFixed(1)}`);
  }
  return pet(x, y, scale, flip, `
<rect x="-24" y="-14" width="12" height="14" rx="5" fill="#f6d4a8"/>
<rect x="14" y="-14" width="12" height="14" rx="5" fill="#f6d4a8"/>
<path d="M-40 -8 L${points.join(" L")} L32 -8 Z" fill="#9a6a45" stroke-linejoin="miter"/>
<ellipse cx="30" cy="-18" rx="19" ry="14" fill="#f6d4a8"/>
<circle cx="20" cy="-34" r="5" fill="#f6d4a8"/>
<circle cx="37" cy="-24" r="2.6" fill="${ink}" stroke="none"/>
<circle cx="48" cy="-17" r="4" fill="${ink}" stroke="none"/>
<circle cx="32" cy="-12" r="4" fill="#ffb3d0" stroke="none"/>`);
};

export const hamster = (x: number, y: number, scale = 1, flip = false): string =>
  pet(x, y, scale, flip, `
<circle cx="-22" cy="-54" r="9" fill="#f4c48a"/>
<circle cx="-22" cy="-54" r="4" fill="#ffb3d0" stroke="none"/>
<circle cx="22" cy="-54" r="9" fill="#f4c48a"/>
<circle cx="22" cy="-54" r="4" fill="#ffb3d0" stroke="none"/>
<ellipse cx="0" cy="-28" rx="36" ry="28" fill="#f4c48a"/>
<ellipse cx="0" cy="-17" rx="20" ry="16" fill="#fff3dc" stroke="none"/>
<ellipse cx="-24" cy="-32" rx="10" ry="8" fill="#ffc2d8" stroke="none"/>
<ellipse cx="24" cy="-32" rx="10" ry="8" fill="#ffc2d8" stroke="none"/>
<circle cx="-12" cy="-43" r="2.8" fill="${ink}" stroke="none"/>
<circle cx="12" cy="-43" r="2.8" fill="${ink}" stroke="none"/>
<ellipse cx="0" cy="-37" rx="4" ry="3" fill="#ff4f93" stroke-width="2"/>
<path d="M-6 -30 Q0 -25 6 -30" fill="none" stroke-width="2"/>
<ellipse cx="-14" cy="-3" rx="11" ry="5" fill="#fff3dc"/>
<ellipse cx="14" cy="-3" rx="11" ry="5" fill="#fff3dc"/>`);

export const turtle = (x: number, y: number, scale = 1, flip = false): string =>
  pet(x, y, scale, flip, `
<path d="M-40 -14 L-56 -8 L-40 -4 Z" fill="#b9e07a"/>
<rect x="-26" y="-16" width="14" height="16" rx="6" fill="#b9e07a"/>
<rect x="12" y="-16" width="14" height="16" rx="6" fill="#b9e07a"/>
<rect x="30" y="-28" width="14" height="16" rx="6" fill="#b9e07a"/>
<ellipse cx="50" cy="-30" rx="15" ry="12" fill="#b9e07a"/>
<path d="M-44 -14 Q-44 -56 0 -56 Q44 -56 44 -14 Z" fill="#12dbb1"/>
<path d="M-16 -53 L-26 -34 L-14 -16 M18 -53 L28 -34 L16 -16 M-26 -34 H28" fill="none" stroke="#0b9c7e" stroke-width="2.5"/>
<rect x="-46" y="-16" width="92" height="9" rx="4.5" fill="#f4e2a6"/>
<circle cx="56" cy="-34" r="2.6" fill="${ink}" stroke="none"/>
<path d="M54 -25 Q60 -22 64 -26" fill="none" stroke-width="2"/>`);

export const cat = (x: number, y: number, scale = 1, flip = false): string =>
  pet(x, y, scale, flip, `
<path d="M-32 -34 Q-64 -38 -56 -74" fill="none" stroke-width="10"/>
<path d="M-32 -34 Q-64 -38 -56 -74" fill="none" stroke="#b9bfd8" stroke-width="4"/>
<rect x="-28" y="-20" width="11" height="20" rx="5" fill="#8d95b8"/>
<rect x="-12" y="-20" width="11" height="20" rx="5" fill="#8d95b8"/>
<rect x="12" y="-20" width="11" height="20" rx="5" fill="#b9bfd8"/>
<rect x="26" y="-20" width="11" height="20" rx="5" fill="#b9bfd8"/>
<ellipse cx="0" cy="-32" rx="36" ry="20" fill="#b9bfd8"/>
<path d="M-12 -50 L-8 -38 M0 -52 L2 -40 M12 -50 L12 -38" fill="none" stroke="#8d95b8" stroke-width="3"/>
<path d="M26 -66 L28 -88 L42 -70 Z" fill="#b9bfd8"/>
<path d="M46 -70 L58 -86 L58 -62 Z" fill="#b9bfd8"/>
<circle cx="42" cy="-54" r="18" fill="#b9bfd8"/>
<path d="M30 -70 L30 -80 L38 -71 Z" fill="#ffb3d0" stroke="none"/>
<circle cx="47" cy="-58" r="2.6" fill="${ink}" stroke="none"/>
<circle cx="36" cy="-58" r="2.6" fill="${ink}" stroke="none"/>
<path d="M44 -50 L48 -50 L46 -47 Z" fill="#ff4f93" stroke-width="2"/>
<path d="M56 -52 L68 -55 M56 -48 L68 -47" fill="none" stroke-width="2"/>`);

export const catBack = (x: number, y: number, scale = 1, flip = false): string =>
  pet(x, y, scale, flip, `
<path d="M10 -14 Q48 -8 40 -50 Q38 -64 30 -70" fill="none" stroke-width="12"/>
<path d="M10 -14 Q48 -8 40 -50 Q38 -64 30 -70" fill="none" stroke="#b9bfd8" stroke-width="6"/>
<path d="M32 -56 L46 -52 M36 -40 L48 -38" fill="none" stroke="#8d95b8" stroke-width="3"/>
<ellipse cx="-12" cy="-4" rx="10" ry="6" fill="#8d95b8"/>
<ellipse cx="12" cy="-4" rx="10" ry="6" fill="#8d95b8"/>
<path d="M-28 -6 Q-30 -56 0 -58 Q30 -56 28 -6 Z" fill="#b9bfd8"/>
<path d="M-10 -50 L-8 -34 M0 -52 L0 -32 M10 -50 L8 -34" fill="none" stroke="#8d95b8" stroke-width="3"/>
<path d="M-20 -76 L-24 -98 L-6 -84 Z" fill="#b9bfd8"/>
<path d="M20 -76 L24 -98 L6 -84 Z" fill="#b9bfd8"/>
<circle cx="0" cy="-70" r="20" fill="#b9bfd8"/>
<path d="M-6 -88 L-5 -80 M0 -90 L0 -81 M6 -88 L5 -80" fill="none" stroke="#8d95b8" stroke-width="3"/>`);
