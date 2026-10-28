// Generates the crew portraits in assets/crew/*.svg: `node scripts/gen-crew.mjs`.
// One shared cartoon / sci-fi style; each character gets skin, hair, accent colour and a role gadget.
import fs from "node:fs";

const OUT = new URL("../assets/crew/", import.meta.url);

// -- building blocks ------------------------------------------------------------

const face = ({ skin, iris = "#1e1b4b", brow = "#1f1712", browLeft = "M78 82 Q87 77 95 81", browRight = "M105 81 Q113 77 122 82",
  mouth = "M89 115 Q100 124 111 115", lash = false }) => `
  <ellipse cx="68" cy="96" rx="6" ry="9" fill="${skin}"/><ellipse cx="132" cy="96" rx="6" ry="9" fill="${skin}"/>
  <ellipse cx="100" cy="92" rx="32" ry="36" fill="${skin}"/>
  <ellipse cx="100" cy="92" rx="32" ry="36" fill="url(#shade)"/>
  <g>
    <ellipse cx="87" cy="96" rx="7.5" ry="8.5" fill="#fff"/><ellipse cx="113" cy="96" rx="7.5" ry="8.5" fill="#fff"/>
    <circle cx="88" cy="97" r="4.6" fill="${iris}"/><circle cx="114" cy="97" r="4.6" fill="${iris}"/>
    <circle cx="88" cy="97" r="2.2" fill="#0b0a1f"/><circle cx="114" cy="97" r="2.2" fill="#0b0a1f"/>
    <circle cx="89.8" cy="94.6" r="1.6" fill="#fff"/><circle cx="115.8" cy="94.6" r="1.6" fill="#fff"/>
    ${lash ? `<path d="M79 91 L76 88 M95 90 L97 87 M105 90 L103 87 M121 91 L124 88" stroke="#0b0a1f" stroke-width="1.8" stroke-linecap="round"/>` : ""}
  </g>
  <path d="${browLeft}" stroke="${brow}" stroke-width="3.2" fill="none" stroke-linecap="round"/>
  <path d="${browRight}" stroke="${brow}" stroke-width="3.2" fill="none" stroke-linecap="round"/>
  <path d="M100 100 Q96.5 107.5 101 108.5" stroke="rgba(0,0,0,0.25)" stroke-width="2" fill="none" stroke-linecap="round"/>
  <circle cx="79" cy="109" r="5" fill="#fb7185" opacity="0.18"/><circle cx="121" cy="109" r="5" fill="#fb7185" opacity="0.18"/>
  <path d="${mouth}" stroke="#7c2d12" stroke-width="3" fill="none" stroke-linecap="round"/>`;

const body = ({ suit, accent, emblem }) => `
  <rect x="88" y="118" width="24" height="32" rx="6" fill="url(#neck)"/>
  <path d="M34 200 C38 160 66 143 100 143 C134 143 162 160 166 200 Z" fill="${suit}"/>
  <path d="M34 200 C38 160 66 143 100 143 C134 143 162 160 166 200 Z" fill="url(#suitShine)"/>
  <path d="M78 147 L100 170 L122 147" stroke="${accent}" stroke-width="3" fill="none" stroke-linejoin="round" filter="url(#glow)"/>
  <path d="M50 176 Q58 160 74 152 M150 176 Q142 160 126 152" stroke="${accent}" stroke-width="2.2" fill="none" opacity="0.7" stroke-linecap="round"/>
  <circle cx="100" cy="184" r="10" fill="#0b0a1f" stroke="${accent}" stroke-width="2.5" filter="url(#glow)"/>
  <g transform="translate(100 184)" fill="none" stroke="${accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${emblem}</g>`;

function portrait({ id, name, position, skin, suit, accent, hairBack = "", hairFront = "", faceOpts = {}, gadget = "", over = "", emblem }) {
  const neckShade = `<linearGradient id="neck" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.25"/><stop offset="0.5" stop-color="${skin}"/></linearGradient>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200" role="img" aria-label="${name} (${position})">
  <title>${name} (${position})</title>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e1b4b"/><stop offset="1" stop-color="#3b0764"/></linearGradient>
    <radialGradient id="aura" cx="0.5" cy="0.45" r="0.55"><stop offset="0" stop-color="${accent}" stop-opacity="0.45"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
    <radialGradient id="shade" cx="0.35" cy="0.3" r="0.9"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.18"/></radialGradient>
    <linearGradient id="suitShine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0.12"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.2"/></linearGradient>
    ${neckShade.replace(`<stop offset="0.5" stop-color="${skin}"/>`, `<stop offset="0.5" stop-color="${skin}"/><stop offset="1" stop-color="${skin}"/>`)}
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <clipPath id="badge"><rect width="200" height="200" rx="44"/></clipPath>
  </defs>
  <g clip-path="url(#badge)">
    <rect width="200" height="200" fill="url(#bg)"/>
    <g stroke="#a5b4fc" stroke-opacity="0.08" stroke-width="1">${[40, 80, 120, 160].map((v) => `<path d="M${v} 0 V200 M0 ${v} H200"/>`).join("")}</g>
    <circle cx="100" cy="92" r="78" fill="url(#aura)"/>
    <circle cx="100" cy="92" r="70" fill="none" stroke="${accent}" stroke-opacity="0.35" stroke-width="1.5" stroke-dasharray="3 7"/>
    <g fill="#e0e7ff"><circle cx="24" cy="30" r="1.4"/><circle cx="176" cy="40" r="1.2"/><circle cx="168" cy="132" r="1.1"/><circle cx="30" cy="140" r="1.1"/></g>
    ${gadget}
    ${hairBack}
    ${body({ suit, accent, emblem })}
    ${face({ skin, ...faceOpts })}
    ${hairFront}
    ${over}
  </g>
</svg>
`;
}

// -- the crew ---------------------------------------------------------------------

const CREW = [
  {
    id: "captain", name: "Captain", position: "Leader", skin: "#c68642", suit: "#1f2937", accent: "#fbbf24",
    faceOpts: { iris: "#92400e", mouth: "M90 116 Q100 122 110 116" },
    hairFront: `<path d="M66 92 C64 58 82 48 100 48 C118 48 136 58 134 92 L128 84 C126 66 114 60 100 60 C86 60 74 66 72 84 Z" fill="#334155"/>
      <path d="M66 92 C64 58 82 48 100 48 C118 48 136 58 134 92" fill="none" stroke="#94a3b8" stroke-width="2.5"/>
      <rect x="95" y="46" width="10" height="16" rx="3" fill="#fbbf24" filter="url(#glow)"/>`,
    over: `<rect x="72" y="88" width="56" height="14" rx="7" fill="#fbbf24" opacity="0.55" filter="url(#glow)"/>
      <rect x="72" y="88" width="56" height="14" rx="7" fill="none" stroke="#fde68a" stroke-width="1.5"/>
      <path d="M78 93 H98 M104 93 H122" stroke="#fffbeb" stroke-width="1.5" opacity="0.8"/>`,
    emblem: `<path d="M0 -5 L1.5 -1.5 L5.3 -1.4 L2.3 1 L3.3 4.8 L0 2.6 L-3.3 4.8 L-2.3 1 L-5.3 -1.4 L-1.5 -1.5 Z" fill="#fbbf24" stroke="none"/>`,
  },
  {
    id: "shirin", name: "Shirin", position: "Researcher", skin: "#e0ac69", suit: "#164e63", accent: "#22d3ee",
    faceOpts: { iris: "#5b3a1a", lash: true },
    hairBack: `<path d="M62 92 C58 50 80 46 100 46 C122 46 144 52 138 96 C142 130 148 150 140 168 L60 168 C52 150 58 128 62 92 Z" fill="#2b1a12"/>`,
    hairFront: `<path d="M66 90 C66 58 82 50 102 50 C122 50 136 62 134 88 C124 70 108 64 96 62 C86 72 76 80 66 90 Z" fill="#3b2418"/>`,
    over: `<circle cx="113" cy="96" r="12" fill="#22d3ee" opacity="0.22" filter="url(#glow)"/>
      <circle cx="113" cy="96" r="12" fill="none" stroke="#67e8f9" stroke-width="2"/>
      <path d="M125 96 H138 L144 88" stroke="#67e8f9" stroke-width="2" fill="none"/>
      <path d="M150 52 h22 v14 h-22 z M154 57 h10 M154 61 h14" stroke="#67e8f9" stroke-width="1.6" fill="#22d3ee" fill-opacity="0.12" filter="url(#glow)"/>`,
    emblem: `<circle r="3.5"/><path d="M2.5 2.5 L5.5 5.5"/>`,
  },
  {
    id: "jake", name: "Jake", position: "Creative Thinker", skin: "#f1c27d", suit: "#4a044e", accent: "#f472b6",
    faceOpts: { iris: "#1d4ed8", brow: "#a16207", mouth: "M87 113 Q100 128 113 113" },
    hairFront: `<path d="M64 84 L70 58 L78 70 L82 46 L92 64 L100 40 L108 62 L118 46 L122 68 L132 56 L136 84 C126 70 112 66 100 66 C88 66 74 70 64 84 Z" fill="#facc15"/>
      <path d="M82 46 L92 64 M100 40 L108 62 M118 46 L122 68" stroke="#ca8a04" stroke-width="1.5"/>`,
    gadget: `<g filter="url(#glow)"><circle cx="152" cy="40" r="12" fill="#f472b6" fill-opacity="0.18" stroke="#f9a8d4" stroke-width="2"/>
      <path d="M148 52 h8 M149 56 h6" stroke="#f9a8d4" stroke-width="2" stroke-linecap="round"/>
      <path d="M152 33 v8 M148 38 l4 3 l4 -3" stroke="#fdf2f8" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <path d="M134 30 l-5 -4 M170 30 l5 -4 M152 22 v-5" stroke="#f9a8d4" stroke-width="2" stroke-linecap="round"/></g>`,
    emblem: `<path d="M-3 3 C-6 -1 -4 -6 0 -6 C4 -6 6 -1 3 3 Z M-2 5 H2"/>`,
  },
  {
    id: "kaveh", name: "Kaveh", position: "Analyst", skin: "#c8946a", suit: "#064e3b", accent: "#34d399",
    faceOpts: { iris: "#3f2a1a", mouth: "M91 117 Q100 121 109 117" },
    hairFront: `<path d="M66 86 C64 56 84 48 100 48 C118 48 138 56 134 86 C130 74 124 66 112 64 C104 70 92 70 84 64 C74 68 68 76 66 86 Z" fill="#1f1712"/>
      <path d="M72 66 q6 -6 12 -2 q6 -6 12 -1 q6 -6 12 -1 q6 -5 12 1" stroke="#3b2a20" stroke-width="2" fill="none"/>`,
    over: `<path d="M74 106 C76 128 90 132 100 132 C110 132 124 128 126 106 C118 116 110 112 100 112 C90 112 82 116 74 106 Z" fill="#1f1712"/>
      <path d="M91 117 Q100 121 109 117" stroke="#e7c9a9" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <g fill="#34d399" fill-opacity="0.15" stroke="#6ee7b7" stroke-width="2" filter="url(#glow)">
        <circle cx="87" cy="96" r="10"/><circle cx="113" cy="96" r="10"/></g>
      <path d="M97 96 H103" stroke="#6ee7b7" stroke-width="2"/>
      <g stroke="#6ee7b7" stroke-width="2" filter="url(#glow)"><path d="M150 70 V50 M158 70 V42 M166 70 V56 M174 70 V36" stroke-width="5" stroke-linecap="round"/><path d="M146 72 H178"/></g>`,
    emblem: `<path d="M-5 4 V0 M-1.5 4 V-3 M2 4 V-1 M5 4 V-5"/>`,
  },
  {
    id: "mike", name: "Mike", position: "Builder", skin: "#f0c8a0", suit: "#7c2d12", accent: "#fb923c",
    faceOpts: { iris: "#365314", brow: "#5b3a1a", mouth: "M88 114 Q100 126 112 114" },
    hairFront: `<path d="M68 82 C66 58 84 52 100 52 C116 52 134 58 132 82 C126 70 114 66 100 66 C86 66 74 70 68 82 Z" fill="#6b4423"/>`,
    over: `<rect x="70" y="60" width="60" height="16" rx="8" fill="#334155"/>
      <circle cx="86" cy="68" r="9" fill="#fb923c" fill-opacity="0.7" stroke="#fed7aa" stroke-width="2" filter="url(#glow)"/>
      <circle cx="114" cy="68" r="9" fill="#fb923c" fill-opacity="0.7" stroke="#fed7aa" stroke-width="2" filter="url(#glow)"/>
      <path d="M83 65 l4 4 M111 65 l4 4" stroke="#fff7ed" stroke-width="2" stroke-linecap="round"/>`,
    gadget: `<g transform="translate(150 150) rotate(-35)"><rect x="-4" y="-34" width="8" height="40" rx="3" fill="#94a3b8"/>
      <path d="M-11 -42 a11 11 0 1 0 22 0 l-5 0 l0 6 l-12 0 l0 -6 Z" fill="#cbd5e1" stroke="#fb923c" stroke-width="2" filter="url(#glow)"/></g>`,
    emblem: `<path d="M-4 4 L3 -3 M1 -5 a3 3 0 1 0 4 4"/>`,
  },
  {
    id: "neda", name: "Neda", position: "Challenger", skin: "#d9a066", suit: "#2e1065", accent: "#a78bfa",
    faceOpts: { iris: "#4c1d95", lash: true, browLeft: "M78 84 Q87 80 95 83", browRight: "M105 78 Q113 72 122 77", mouth: "M90 117 Q102 121 111 113" },
    hairBack: `<path d="M60 92 C56 52 80 44 100 44 C122 44 146 52 140 92 L142 128 L128 128 L126 96 L74 96 L72 128 L58 128 Z" fill="#111827"/>`,
    hairFront: `<path d="M64 96 C60 56 84 48 104 48 C124 48 140 60 136 96 C130 74 118 62 98 62 C84 70 72 80 64 96 Z" fill="#1f2937"/>
      <path d="M112 50 C128 54 136 66 136 92 C132 76 124 66 114 60 Z" fill="#a78bfa" filter="url(#glow)"/>`,
    gadget: `<text x="150" y="58" font-family="system-ui, sans-serif" font-size="40" font-weight="800" fill="#c4b5fd" filter="url(#glow)">?</text>
      <text x="28" y="54" font-family="system-ui, sans-serif" font-size="22" font-weight="800" fill="#a78bfa" opacity="0.6">?</text>`,
    emblem: `<path d="M-2.5 -2.5 a3 3 0 1 1 3 3 v1.5 M0.5 4.5 v0.3"/>`,
  },
  {
    id: "emily", name: "Emily", position: "Specialist", skin: "#f5d0b5", suit: "#134e4a", accent: "#2dd4bf",
    faceOpts: { iris: "#047857", brow: "#9a3412", lash: true },
    hairBack: `<path d="M64 90 C60 52 82 46 100 46 C120 46 142 54 136 90 L134 104 L66 104 Z" fill="#c2410c"/>
      <circle cx="140" cy="52" r="16" fill="#c2410c"/>`,
    hairFront: `<path d="M66 88 C64 58 84 50 100 50 C118 50 136 58 134 86 C124 66 106 62 92 62 C82 68 72 76 66 88 Z" fill="#ea580c"/>`,
    over: `<path d="M66 96 C62 70 76 52 100 52 C124 52 138 70 134 96" stroke="#e2e8f0" stroke-width="3.5" fill="none"/>
      <rect x="60" y="88" width="12" height="18" rx="5" fill="#475569" stroke="#2dd4bf" stroke-width="2"/>
      <rect x="128" y="88" width="12" height="18" rx="5" fill="#475569" stroke="#2dd4bf" stroke-width="2"/>
      <path d="M134 90 L150 70" stroke="#94a3b8" stroke-width="2"/><circle cx="150" cy="70" r="4" fill="#2dd4bf" filter="url(#glow)"/>`,
    gadget: `<g filter="url(#glow)" stroke="#5eead4" stroke-width="2" fill="none"><circle cx="40" cy="48" r="14" fill="#2dd4bf" fill-opacity="0.12"/>
      <path d="M40 38 L44 48 L40 58 L36 48 Z" fill="#5eead4" fill-opacity="0.6"/></g>`,
    emblem: `<circle r="5"/><path d="M0 -3 L1.5 0 L0 3 L-1.5 0 Z" fill="#2dd4bf"/>`,
  },
  {
    id: "dariush", name: "Dariush", position: "Communicator", skin: "#b07a4f", suit: "#1e3a8a", accent: "#60a5fa",
    faceOpts: { iris: "#2d1b10", mouth: "M90 118 Q100 124 110 118" },
    hairFront: `<path d="M66 88 C62 54 86 46 104 48 C126 50 138 60 134 88 C128 70 116 62 98 62 C80 60 70 74 66 88 Z" fill="#111827"/>
      <path d="M74 64 C88 50 112 48 130 60" stroke="#374151" stroke-width="3" fill="none"/>`,
    over: `<path d="M84 113 Q92 108 100 112 Q108 108 116 113 Q108 116 100 115 Q92 116 84 113 Z" fill="#111827"/>
      <path d="M68 100 C70 120 80 124 92 122" stroke="#cbd5e1" stroke-width="2.5" fill="none"/>
      <circle cx="94" cy="122" r="3.5" fill="#60a5fa" filter="url(#glow)"/>`,
    gadget: `<g stroke="#93c5fd" stroke-width="2.5" fill="none" stroke-linecap="round" filter="url(#glow)">
      <path d="M146 80 q8 12 0 24"/><path d="M154 74 q13 18 0 36"/><path d="M162 68 q18 24 0 48"/></g>`,
    emblem: `<rect x="-2" y="-5" width="4" height="7" rx="2"/><path d="M-4 0 a4 4 0 0 0 8 0 M0 4 v2"/>`,
  },
  {
    id: "sarah", name: "Sarah", position: "Organizer", skin: "#8d5524", suit: "#365314", accent: "#a3e635",
    faceOpts: { iris: "#1c1917", lash: true },
    hairBack: `<circle cx="100" cy="42" r="18" fill="#1c1917"/>`,
    hairFront: `<path d="M66 88 C64 56 84 52 100 52 C116 52 136 56 134 88 C128 72 116 64 100 64 C84 64 72 72 66 88 Z" fill="#1c1917"/>
      <path d="M86 40 q14 -10 28 0" stroke="#a3e635" stroke-width="3" fill="none" filter="url(#glow)"/>`,
    gadget: `<g transform="translate(146 52) rotate(8)" filter="url(#glow)"><rect x="-14" y="-18" width="30" height="38" rx="4" fill="#a3e635" fill-opacity="0.12" stroke="#bef264" stroke-width="2"/>
      <path d="M-8 -9 l3 3 l5 -6 M-8 1 l3 3 l5 -6 M-8 11 l3 3 l5 -6" stroke="#d9f99d" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M4 -7 h7 M4 3 h7 M4 13 h7" stroke="#bef264" stroke-width="2"/></g>`,
    emblem: `<path d="M-4 0 l3 3 l5 -6"/>`,
  },
  {
    id: "parisa", name: "Parisa", position: "Quality Reviewer", skin: "#e8b88a", suit: "#4c0519", accent: "#fb7185",
    faceOpts: { iris: "#3f2a1a", lash: true, browRight: "M105 80 Q113 76 122 80" },
    hairBack: `<path d="M60 94 C54 52 80 44 100 44 C124 44 148 54 140 96 C146 120 140 146 146 166 L54 166 C60 146 54 120 60 94 Z" fill="#3b1d12"/>`,
    hairFront: `<path d="M64 92 C62 56 84 48 100 48 C120 48 138 58 136 92 C130 72 116 62 100 64 C96 70 78 76 64 92 Z" fill="#4a2617"/>
      <path d="M64 92 q-6 20 2 40 M136 92 q6 20 -2 40" stroke="#5b2f1d" stroke-width="3" fill="none"/>`,
    over: `<circle cx="113" cy="96" r="13" fill="#fb7185" fill-opacity="0.18" stroke="#fda4af" stroke-width="2.2" filter="url(#glow)"/>
      <path d="M113 80 V87 M113 105 V112 M97 96 H104 M122 96 H129" stroke="#fecdd3" stroke-width="2"/>
      <path d="M126 96 H140 L142 102" stroke="#fda4af" stroke-width="2" fill="none"/>`,
    gadget: `<g stroke="#fda4af" stroke-width="2" fill="none" filter="url(#glow)" opacity="0.8">
      <circle cx="40" cy="48" r="12"/><circle cx="40" cy="48" r="5"/><path d="M40 32 v6 M40 58 v6 M24 48 h6 M50 48 h6"/></g>`,
    emblem: `<circle r="5"/><circle r="1.5" fill="#fb7185"/>`,
  },
];

fs.mkdirSync(OUT, { recursive: true });
for (const c of CREW) fs.writeFileSync(new URL(`${c.id}.svg`, OUT), portrait(c));
console.log(`wrote ${CREW.length} portraits to assets/crew/`);
