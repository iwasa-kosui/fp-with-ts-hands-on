import {
  arm,
  dog,
  dogBack,
  hamster,
  hedgehog,
  ink,
  legs,
  monitor,
  person,
  shadow,
  turtle,
} from "./clinic-art";

export type EpisodeScene = Readonly<{ label: string; art: string }>;

const mono = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

type TextOptions = Readonly<{ fill?: string; anchor?: "start" | "middle" | "end"; mono?: boolean; fit?: number; outline?: boolean }>;

const text = (x: number, y: number, size: number, body: string, options: TextOptions = {}): string => {
  const fill = options.fill ?? ink;
  const anchor = options.anchor ?? "start";
  const family = options.mono ? ` font-family="${mono}"` : "";
  const fit = options.fit === undefined ? "" : ` textLength="${options.fit}" lengthAdjust="spacingAndGlyphs"`;
  const outline = options.outline ? ` stroke="${ink}" stroke-width="3" paint-order="stroke"` : ` stroke="${fill}" stroke-width="0.6"`;
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="800" text-anchor="${anchor}" fill="${fill}"${family}${fit}${outline}>${body}</text>`;
};

const room = (wall: string, floor: string, line: string, horizon = 172): string => `
<rect width="360" height="${horizon}" fill="${wall}" stroke="none"/>
<rect y="${horizon}" width="360" height="${260 - horizon}" fill="${floor}" stroke="none"/>
<path d="M0 ${horizon}H360"/>
<path d="M0 ${horizon + 28}H360M0 ${horizon + 60}H360" stroke="${line}" stroke-width="2"/>`;

const screen = (x: number, top: number, w: number, h: number, surface: number): string => `
<rect x="${x + w / 2 - 10}" y="${top + h - 6}" width="20" height="${surface - top - h + 2}" fill="#8d95b8"/>
<rect x="${x + w / 2 - 31}" y="${surface - 7}" width="62" height="7" rx="3" fill="#8d95b8"/>
<rect x="${x}" y="${top}" width="${w}" height="${h}" rx="8" fill="#8d95b8"/>
<rect x="${x + 6}" y="${top + 6}" width="${w - 12}" height="${h - 12}" rx="4" fill="#fff" stroke-width="2"/>
<rect x="${x + 6}" y="${top + 6}" width="${w - 12}" height="13" rx="4" fill="#2236b8" stroke-width="2"/>
<circle cx="${x + 15}" cy="${top + 12.5}" r="2.2" fill="#fff" stroke="none"/>
<circle cx="${x + 23}" cy="${top + 12.5}" r="2.2" fill="#fff" stroke="none"/>`;

const cursor = (x: number, y: number): string =>
  `<path d="M${x} ${y}L${x} ${y + 19}L${x + 5} ${y + 14}L${x + 9} ${y + 23}L${x + 13} ${y + 21}L${x + 9} ${y + 12}L${x + 16} ${y + 12}Z" fill="#fff" stroke-width="2.2"/>`;

const shocked = (x: number, head: number): string => `
<circle cx="${x - 7}" cy="${head + 3}" r="5" fill="#fff" stroke-width="2"/>
<circle cx="${x + 7}" cy="${head + 3}" r="5" fill="#fff" stroke-width="2"/>
<circle cx="${x - 7}" cy="${head + 3}" r="2.2" fill="${ink}" stroke="none"/>
<circle cx="${x + 7}" cy="${head + 3}" r="2.2" fill="${ink}" stroke="none"/>
<ellipse cx="${x}" cy="${head + 13}" rx="4.5" ry="6" fill="#5a1a2e" stroke-width="2.5"/>`;

const sparks = (x: number, y: number): string =>
  `<path d="M${x - 30} ${y} L${x - 22} ${y + 4} M${x - 24} ${y - 14} L${x - 17} ${y - 9} M${x} ${y - 24} L${x} ${y - 16} M${x + 24} ${y - 14} L${x + 17} ${y - 9} M${x + 30} ${y} L${x + 22} ${y + 4}" fill="none" stroke-width="2.5"/>`;

const queuer = (x: number, y: number, scale: number, hair: string): string => `
<g transform="translate(${x} ${y}) scale(${scale})" stroke-width="${(2.4 / scale).toFixed(2)}">${legs(0, -26, 0, ink)}${person(0, -122, -100, 48, -20, "#ff4f93", "#f6c9a0", hair)}</g>`;

const check = (x: number, y: number, r: number): string => `
<circle cx="${x}" cy="${y}" r="${r}" fill="#12dbb1"/>
<path d="M${x - r * 0.5} ${y + r * 0.05}L${x - r * 0.1} ${y + r * 0.45}L${x + r * 0.55} ${y - r * 0.4}" fill="none" stroke="#fff" stroke-width="3.5"/>`;

const turnArrow = (x: number, y: number): string => `
<path d="M${x + 7} ${y - 3} A8 8 0 1 0 ${x + 6} ${y + 5}" fill="none" stroke="${ink}" stroke-width="6.5"/>
<path d="M${x + 7} ${y - 3} A8 8 0 1 0 ${x + 6} ${y + 5}" fill="none" stroke="#ff4f93" stroke-width="3"/>
<path d="M${x + 1} ${y - 4} L${x + 12} ${y - 4} L${x + 8} ${y - 13}Z" fill="#ff4f93" stroke-width="2"/>`;

const handover = `
${room("#fff8ce", "#f0d5a0", "#d9b87c", 196)}
<rect x="104" y="20" width="56" height="48" rx="4" fill="#bfe6ff"/>
<path d="M132 20V68M104 44H160" stroke-width="2"/>

${shadow(48, 254, 34)}
${legs(48, 196, 256, "#2236b8")}
${person(48, 112, 134, 52, 204, "#12dbb1", "#d9a37c", "#6b3f2a")}
${shocked(48, 112)}
${arm(26, 152, 10, 124, "#12dbb1", "#d9a37c")}
${arm(70, 154, 100, 168, "#12dbb1", "#d9a37c")}
${sparks(48, 82)}

${shadow(118, 254, 56)}
${dog(118, 254)}

${person(330, 94, 116, 48, 176, "#ff4f93", "#f6c9a0", "#e0a030")}
${monitor(190, 66, 172, "診察中", "#ff4f93")}
<g transform="rotate(-6 150 146)">
<rect x="126" y="118" width="48" height="60" fill="#fff"/>
${text(132, 136, 12, "請求書")}
<path d="M132 146H168M132 156H168" stroke="#cfd4ee" stroke-width="3"/>
<rect x="132" y="164" width="22" height="9" rx="3" fill="#ffd21b" stroke-width="2"/>
</g>
<rect x="124" y="104" width="40" height="18" rx="9" fill="#ff4f93" stroke-width="2.5"/>
${text(144, 117, 11, "2枚目", { anchor: "middle" })}
${arm(312, 142, 176, 156, "#ff4f93", "#f6c9a0")}

<rect x="172" y="172" width="190" height="10" rx="2" fill="#e8b46a"/>
<rect x="176" y="182" width="184" height="62" fill="#c98a3f"/>
<rect x="186" y="190" width="164" height="46" rx="4" fill="none" stroke="#e8b46a" stroke-width="2"/>
${shadow(268, 250, 92)}`;

const handoverPii = `
${room("#fff8ce", "#f0d5a0", "#d9b87c")}
<rect x="14" y="16" width="56" height="52" rx="4" fill="#bfe6ff"/>
<path d="M42 16V68M14 42H70" stroke-width="2"/>

${person(40, 120, 142, 52, 204, "#12dbb1", "#d9a37c", "#6b3f2a")}
${shocked(40, 120)}
${arm(16, 164, 6, 132, "#12dbb1", "#d9a37c")}
${arm(64, 166, 88, 180, "#12dbb1", "#d9a37c")}
${sparks(40, 90)}

<rect x="-2" y="184" width="364" height="12" fill="#ffd21b"/>
<rect x="-2" y="196" width="364" height="42" fill="#2236b8"/>
<rect x="12" y="204" width="180" height="26" rx="6" fill="none" stroke="#5b70e6" stroke-width="2"/>
${screen(100, 24, 240, 146, 184)}
${text(134, 41, 10, "監査記録", { fill: "#fff" })}
<rect x="112" y="50" width="216" height="24" rx="5" fill="#eef1ff" stroke-width="2"/>
${text(120, 66, 12, "操作")}
${text(160, 66, 11, "examination.started", { mono: true })}
<rect x="112" y="78" width="216" height="24" rx="5" fill="#eef1ff" stroke-width="2"/>
${text(120, 94, 12, "時刻")}
<path d="M160 90H240" stroke="#9aa6e0" stroke-width="6"/>
<rect x="112" y="106" width="216" height="24" rx="5" fill="#ffe0ee" stroke-width="2.5"/>
${text(120, 122, 12, "氏名")}
<path d="M160 118H230" stroke="#ff4f93" stroke-width="6"/>
<rect x="112" y="134" width="216" height="24" rx="5" fill="#ffe0ee" stroke-width="2.5"/>
${text(120, 150, 12, "電話番号")}
<path d="M176 146H260" stroke="#ff4f93" stroke-width="6"/>
${shadow(220, 252, 60)}`;

const stateTransitions = `
${room("#fff8ce", "#f0d5a0", "#d9b87c", 198)}
<rect x="30" y="30" width="74" height="168" fill="#bfe6ff"/>
<rect x="30" y="160" width="74" height="38" fill="#bcebd7" stroke="none"/>
<rect x="64" y="120" width="8" height="42" fill="#c98a3f" stroke-width="2.5"/>
<circle cx="68" cy="104" r="22" fill="#12dbb1" stroke-width="2.5"/>
<rect x="30" y="30" width="74" height="168" fill="none"/>
<path d="M30 30L10 42V186L30 198Z" fill="#c98a3f"/>
<circle cx="18" cy="118" r="3" fill="#ffd21b" stroke-width="2"/>
<rect x="30" y="204" width="76" height="18" rx="3" fill="#2236b8"/>

${shadow(76, 232, 52)}
<g transform="translate(76 228) scale(-1 1)" stroke-width="3">${dog(0, 0)}</g>
<path d="M118 196H136M122 208H142M118 220H132" fill="none" stroke-width="2.5"/>

<rect x="146" y="190" width="224" height="12" fill="#ffd21b"/>
<rect x="142" y="202" width="224" height="58" fill="#2236b8"/>
<rect x="154" y="212" width="200" height="36" rx="6" fill="none" stroke="#5b70e6" stroke-width="2"/>
${screen(150, 14, 200, 164, 190)}
<rect x="160" y="130" width="78" height="9" rx="2" fill="#cfd8e8" stroke-width="2.5"/>
<rect x="166" y="139" width="66" height="30" fill="#fff" stroke-width="2.5"/>
<g transform="translate(199 130) scale(0.5 0.5)" stroke-width="4.8">${dog(0, 0)}</g>
<rect x="164" y="48" width="70" height="26" rx="13" fill="#ff4f93" stroke-width="2.5"/>
${text(199, 67, 15, "診察中", { anchor: "middle" })}
<g transform="rotate(5 294 100)"><rect x="252" y="56" width="84" height="104" fill="#fff"/></g>
<g transform="rotate(-3 284 100)">
<rect x="246" y="46" width="84" height="104" fill="#fff"/>
${text(253, 68, 13, "請求書")}
<path d="M253 80H322M253 92H322M253 104H304" stroke="#cfd4ee" stroke-width="3"/>
<rect x="253" y="124" width="34" height="14" rx="3" fill="#ffd21b" stroke-width="2"/>
</g>
<rect x="292" y="37" width="46" height="20" rx="10" fill="#ff4f93" stroke-width="2.5"/>
${text(315, 52, 12, "2枚目", { anchor: "middle" })}`;

const adtAndExhaustiveness = `
${room("#fff1cf", "#f0d5a0", "#d9b87c")}
<path d="M14 78H78L92 184H-2Z" fill="#fff3a8" opacity="0.6" stroke="none"/>
<rect x="14" y="16" width="64" height="62" rx="4" fill="#bfe6ff"/>
<path d="M46 16V78M14 47H78" stroke-width="2"/>
<circle cx="30" cy="32" r="8" fill="#ffd21b" stroke-width="2"/>
<path d="M30 17V20M45 32H42M18 20L20 22" stroke-width="2.5" fill="none"/>

<rect x="-2" y="184" width="364" height="12" fill="#ffd21b"/>
<rect x="-2" y="196" width="364" height="42" fill="#2236b8"/>
<rect x="12" y="204" width="180" height="26" rx="6" fill="none" stroke="#5b70e6" stroke-width="2"/>
${screen(92, 24, 240, 146, 184)}
<rect x="106" y="50" width="212" height="54" rx="8" fill="#eef1ff" stroke-width="2.5"/>
${hedgehog(140, 99, 0.7)}
<path d="M174 68H214M174 84H200" stroke="#cfd4ee" stroke-width="7"/>
<rect x="226" y="58" width="84" height="38" rx="19" fill="#ff4f93" stroke-width="2.5"/>
${text(268, 85, 22, "不明", { anchor: "middle" })}
<rect x="106" y="112" width="212" height="40" rx="8" fill="#f6f7fd" stroke="#cfd4ee" stroke-width="2.5"/>
<path d="M122 126H170M122 138H150" stroke="#cfd4ee" stroke-width="6"/>
<rect x="226" y="122" width="70" height="20" rx="10" fill="#cfd4ee" stroke="none"/>

<rect x="198" y="203" width="152" height="30" rx="6" fill="#fff" stroke-width="2.5"/>
${check(218, 218, 10)}
${text(234, 224, 15, "型検査 成功")}
${shadow(180, 252, 60)}`;

const boundariesAndPii = `
${room("#fff8ce", "#f0d5a0", "#d9b87c")}
<circle cx="44" cy="38" r="26" fill="#fff"/>
<path d="M44 14V19M68 38H63M44 62V57M20 38H25" stroke-width="2.5" fill="none"/>
<path d="M44 38L56 41" stroke-width="4.5" fill="none"/>
<path d="M44 38V56" stroke-width="3" fill="none"/>
<circle cx="44" cy="38" r="3" fill="${ink}" stroke="none"/>

${person(34, 112, 134, 50, 172, "#12dbb1", "#d9a37c", "#6b3f2a")}
<path d="M26 134L34 148L42 134Z" fill="#fff" stroke-width="2"/>
${arm(14, 150, 8, 166, "#12dbb1", "#d9a37c")}
${arm(52, 150, 60, 168, "#12dbb1", "#d9a37c")}
<rect x="-2" y="158" width="176" height="12" fill="#ffd21b"/>
<rect x="-2" y="170" width="176" height="66" fill="#2236b8"/>
<rect x="10" y="180" width="152" height="44" rx="6" fill="none" stroke="#5b70e6" stroke-width="2"/>
${screen(64, 66, 108, 86, 158)}
<rect x="76" y="92" width="84" height="20" rx="4" fill="#dbe4ff" stroke="#2236b8" stroke-width="2.5"/>
${text(82, 106, 12, "予約")}
<path d="M110 102H150" stroke="#9aa6e0" stroke-width="6"/>
<rect x="76" y="118" width="84" height="22" rx="4" fill="#ffd21b" stroke-width="2.5"/>
${text(80, 133, 12, "診察を開始する", { fit: 76 })}
${cursor(140, 128)}

<path d="M180 132H198V118L218 146L198 174V160H180Z" fill="#ffd21b" stroke-width="2.5"/>

${shadow(287, 240, 66)}
<rect x="222" y="62" width="14" height="176" fill="#8d95b8"/>
<rect x="338" y="62" width="14" height="176" fill="#8d95b8"/>
<rect x="216" y="54" width="142" height="26" rx="4" fill="#2236b8"/>
${text(287, 73, 14, "サーバーの入口", { anchor: "middle", fill: "#fff" })}
<rect x="262" y="16" width="50" height="30" rx="15" fill="#12dbb1"/>
${text(287, 38, 20, "通過", { anchor: "middle" })}
<g transform="rotate(-3 287 140)">
<path d="M236 122 L248 110 H338 V170 H236 Z" fill="#fff"/>
<circle cx="248" cy="122" r="3.5" fill="#fff8ce" stroke-width="2"/>
<path d="M236 146H338" stroke-width="2"/>
<rect x="238" y="148" width="98" height="20" fill="#ffe0ee" stroke="none"/>
${text(251, 138, 11, "veterinarianId", { mono: true, fit: 82 })}
${text(244, 162, 11, "night-shift", { mono: true, fit: 72 })}
</g>`;

const workflowErrors = `
${room("#fff8ce", "#e6dcc0", "#cbbf9d", 150)}
<rect x="0" y="76" width="118" height="9" fill="#e8b46a"/>
${screen(14, 14, 92, 56, 76)}
${text(60, 60, 12, "診察中", { anchor: "middle" })}

${queuer(254, 150, 0.44, "#e0a030")}
${queuer(292, 150, 0.44, "#3b2a4f")}
${queuer(330, 150, 0.44, "#6b3f2a")}

<rect x="-2" y="236" width="240" height="10" fill="#e8b46a"/>
<rect x="-2" y="246" width="240" height="16" fill="#c98a3f"/>
${screen(8, 88, 218, 132, 236)}
${hamster(54, 178, 0.62)}
<rect x="24" y="186" width="88" height="24" rx="6" fill="#ffd21b" stroke-width="2.5"/>
${text(62, 204, 14, "診察開始", { anchor: "middle" })}
${cursor(100, 192)}
${text(168, 188, 54, "500", { anchor: "middle", fill: "#ff4f93", outline: true })}

${shadow(298, 240, 52)}
<g transform="translate(300 236) scale(-0.82 0.82)" stroke-width="3.66">${dog(0, 0)}</g>
<path d="M236 188L246 194L236 200L247 208L237 216" fill="none" stroke-width="2.5"/>
<path d="M244 150H298Q304 150 304 156V168Q304 174 298 174H258L244 186L246 174H244Q238 174 238 168V156Q238 150 244 150Z" fill="#fff" stroke-width="2.5"/>
${text(271, 167, 14, "ワン!", { anchor: "middle" })}`;

const businessEvents = `
${room("#fff8ce", "#f0d5a0", "#d9b87c")}
${person(34, 112, 134, 50, 172, "#12dbb1", "#d9a37c", "#6b3f2a")}
${shocked(34, 112)}
<path d="M26 134L34 148L42 134Z" fill="#fff" stroke-width="2"/>
${arm(12, 150, 6, 128, "#12dbb1", "#d9a37c")}
${arm(54, 152, 62, 168, "#12dbb1", "#d9a37c")}
${sparks(34, 82)}
<rect x="-2" y="164" width="364" height="10" fill="#ffd21b"/>
<rect x="-2" y="174" width="364" height="62" fill="#2236b8"/>
<rect x="10" y="184" width="340" height="40" rx="6" fill="none" stroke="#5b70e6" stroke-width="2"/>

${screen(68, 72, 124, 86, 164)}
<rect x="78" y="106" width="104" height="20" rx="10" fill="#12dbb1" stroke-width="2.5"/>
${text(130, 121, 14, "会計済み", { anchor: "middle" })}
<rect x="78" y="130" width="90" height="20" rx="10" fill="#ff4f93" stroke-width="2.5"/>
${text(118, 145, 13, "キャンセル", { anchor: "middle" })}
${cursor(158, 138)}

<path d="M196 130H210V120L228 138L210 156V146H196Z" fill="#ffd21b" stroke-width="2.5"/>

<rect x="238" y="50" width="104" height="90" fill="#fff"/>
${text(246, 72, 13, "キャンセル")}
${text(246, 100, 13, "理由:")}
<rect x="282" y="86" width="52" height="20" rx="3" fill="none" stroke-width="2.5" stroke-dasharray="5 4"/>
<path d="M246 120H300" stroke="#cfd4ee" stroke-width="3"/>
<rect x="226" y="124" width="126" height="46" rx="4" fill="#e8b46a"/>
<rect x="222" y="118" width="134" height="10" rx="3" fill="#c98a3f"/>
<rect x="262" y="136" width="62" height="26" rx="3" fill="#fff" stroke-width="2.5"/>
${text(293, 155, 15, "Store", { anchor: "middle", mono: true })}
<g transform="rotate(12 334 60)">${text(334, 70, 56, "?", { anchor: "middle", fill: "#ec3a82", outline: true })}</g>`;

const effectsAndConsistency = `
${room("#fff8ce", "#e6dcc0", "#cbbf9d")}
<rect y="112" width="360" height="60" fill="#bcebd7" stroke="none"/>
<path d="M0 112H360M0 172H360"/>

<rect x="10" y="176" width="112" height="10" rx="3" fill="#cfd8e8"/>
<rect x="20" y="186" width="92" height="50" fill="#fff"/>
<path d="M66 186V236" stroke-width="2"/>
<circle cx="58" cy="210" r="2.5" fill="${ink}" stroke="none"/>
<circle cx="74" cy="210" r="2.5" fill="${ink}" stroke="none"/>
${shadow(66, 238, 56)}
${turtle(66, 176, 0.95)}

<rect x="124" y="176" width="124" height="10" rx="3" fill="#e8b46a"/>
<rect x="132" y="186" width="108" height="50" fill="#f3d29b"/>
<rect x="142" y="194" width="88" height="16" rx="3" fill="none" stroke-width="2"/>
<rect x="142" y="214" width="88" height="16" rx="3" fill="none" stroke-width="2"/>
${monitor(130, 78, 176, "診察中", "#ff4f93")}

<rect x="276" y="32" width="58" height="52" rx="2" fill="none" stroke-width="2.5" stroke-dasharray="5 4"/>
<rect x="258" y="72" width="94" height="14" rx="3" fill="#c98a3f"/>
<rect x="264" y="86" width="82" height="42" fill="#e8b46a"/>
<rect x="272" y="94" width="70" height="26" rx="3" fill="#fff" stroke-width="2.5"/>
${text(307, 113, 14, "監査記録", { anchor: "middle" })}

<rect x="252" y="144" width="102" height="96" rx="6" fill="#fff"/>
<rect x="252" y="144" width="102" height="24" rx="6" fill="#2236b8"/>
<rect x="252" y="158" width="102" height="10" fill="#2236b8" stroke="none"/>
<path d="M252 168H354" stroke-width="2.5"/>
${text(303, 162, 13, "再現テスト", { anchor: "middle", fill: "#fff" })}
${text(262, 194, 14, "時刻")}
${turnArrow(338, 189)}
<path d="M258 206H348" stroke="#cfd4ee" stroke-width="2"/>
${text(262, 228, 12, "イベントID")}
${turnArrow(338, 223)}`;

const finalScene = `
${room("#fff8ce", "#f0d5a0", "#d9b87c", 184)}
<rect x="30" y="30" width="74" height="154" fill="#bfe6ff"/>
<rect x="30" y="150" width="74" height="34" fill="#bcebd7" stroke="none"/>
<rect x="82" y="108" width="7" height="42" fill="#c98a3f" stroke-width="2.5"/>
<circle cx="86" cy="96" r="18" fill="#12dbb1" stroke-width="2.5"/>
<rect x="30" y="30" width="74" height="154" fill="none"/>
<path d="M30 30L12 42V172L30 184Z" fill="#c98a3f"/>
<circle cx="20" cy="108" r="3" fill="#ffd21b" stroke-width="2"/>

${shadow(64, 190, 30)}
${dogBack(64, 188, 0.85)}

${person(146, 108, 130, 54, 180, "#ffd21b", "#f6c9a0", "#3b2a4f")}
<circle cx="139" cy="111" r="4.5" fill="#fff" stroke-width="2"/>
<circle cx="153" cy="111" r="4.5" fill="#fff" stroke-width="2"/>
<circle cx="140.5" cy="111" r="2" fill="${ink}" stroke="none"/>
<circle cx="154.5" cy="111" r="2" fill="${ink}" stroke="none"/>
${arm(122, 148, 138, 168, "#ffd21b", "#f6c9a0")}
${arm(170, 148, 162, 168, "#ffd21b", "#f6c9a0")}
<rect x="112" y="172" width="252" height="10" rx="2" fill="#e8b46a"/>
<rect x="116" y="182" width="248" height="58" fill="#c98a3f"/>
<rect x="128" y="190" width="224" height="42" rx="4" fill="none" stroke="#e8b46a" stroke-width="2"/>
<rect x="136" y="166" width="46" height="6" rx="2" fill="#fff" stroke-width="2"/>
${screen(190, 22, 164, 144, 172)}
${[
  ["入力", 46],
  ["失敗", 67],
  ["イベント", 88],
  ["保存", 109],
  ["例外", 130],
].map(([label, y]) => `
<rect x="200" y="${y}" width="144" height="19" rx="4" fill="#eef1ff" stroke-width="2"/>
${text(208, Number(y) + 14.5, 12, String(label))}
<path d="M326 ${Number(y) + 3}L335 ${Number(y) + 17}H317Z" fill="#ffd21b" stroke-width="2"/>
<path d="M326 ${Number(y) + 8}V${Number(y) + 12}" fill="none" stroke-width="2"/>
<circle cx="326" cy="${Number(y) + 14.5}" r="1" fill="${ink}" stroke-width="1"/>`).join("")}`;

export const episodeScenes = {
  "00-system-handover": {
    label: "会計カウンターで、会計担当が犬の飼い主へ2枚目の請求書を差し出している。カウンターの画面には診察中と表示されている。飼い主は驚いた顔をしている",
    art: handover,
  },
  "00-system-handover-pii": {
    label: "担当者が監査記録の画面を見て驚いている。画面には操作の行のほかに、氏名と電話番号の行が並んでいる",
    art: handoverPii,
  },
  "01-state-transitions": {
    label: "会計を終えた犬の Mugi がドアから帰っていく。受付の大きな画面の中では、同じ Mugi の予約が診察中に戻って表示され、2枚目の請求書まで用意されている",
    art: stateTransitions,
  },
  "02-adt-and-exhaustiveness": {
    label: "朝の受付カウンターに置かれた画面で、ハリネズミの予約に「不明」と表示されている。その横の札には型検査成功と緑のチェックが付いている",
    art: adtAndExhaustiveness,
  },
  "03-boundaries-and-pii": {
    label: "15時30分、獣医師が診察開始画面で予約を選んで「診察を開始する」ボタンを押すと、veterinarianId の欄に night-shift が入ったカードが作られ、サーバーの入口をそのまま通り抜けていく",
    art: boundariesAndPii,
  },
  "04-workflow-errors": {
    label: "古い画面でハムスターの診察開始ボタンを押すと、大きく500と表示されて止まった。奥の別の端末には診察中と出ており、後ろでは犬が吠え、飼い主の列が伸びている",
    art: workflowErrors,
  },
  "05-business-events-and-workflows": {
    label: "受付担当者が会計済みの予約のキャンセルを押して驚いている。Store の箱に入った記録の紙は、キャンセルとだけあり、理由の欄が空のままで、大きな疑問符が付いている",
    art: businessEvents,
  },
  "06-effects-and-consistency": {
    label: "診察台のカメの診察が始まり、画面は診察中に変わった。監査記録の箱は空のままで、再現テストのカードでは時刻とイベント ID が毎回変わっている",
    art: effectsAndConsistency,
  },
  final: {
    label: "犬の Mugi がドアから帰っていき、開発者だけが画面に向かっている。画面には入力、失敗、イベント、保存、例外の5つの行が並び、それぞれの行に注意の印が置かれている",
    art: finalScene,
  },
} as const satisfies Readonly<Record<string, EpisodeScene>>;
