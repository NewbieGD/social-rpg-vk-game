// Иллюстрации предметов — каждый нарисован отдельно, в одном стиле
// (мягкие формы, тёплая палитра вечерней улицы, объём тенью и бликом).
// Если в assets/items/<код>.png лежит своя картинка — она важнее рисунка.
// Лёгкие анимации (пар, пузырьки, блики) отключаются при «уменьшить движение».

const ART = {
    coffee: `
        <ellipse cx="32" cy="55" rx="20" ry="4" fill="#000" opacity=".25"/>
        <path class="ia-steam" d="M26 18 q-4 -5 0 -10" stroke="#efe6d8" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path class="ia-steam ia-steam-2" d="M34 18 q-4 -5 0 -10" stroke="#efe6d8" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path d="M46 30 q10 0 10 8 q0 8 -10 8" stroke="#d9c9ae" stroke-width="4" fill="none"/>
        <path d="M14 24 h34 l-3 24 q-1 5 -6 5 h-16 q-5 0 -6 -5 z" fill="#efe6d8"/>
        <path d="M14 24 h34 l-1 6 h-32 z" fill="#6b3f22"/>
        <path d="M18 32 l2 15 q1 3 3 3" stroke="#fff" stroke-width="2" fill="none" opacity=".55" stroke-linecap="round"/>
        <path d="M40 30 l-2 18 q-1 4 -4 5 h4 q5 0 6 -5 l3 -18 z" fill="#c9b8a0" opacity=".6"/>`,
    energy_drink: `
        <ellipse cx="32" cy="57" rx="14" ry="3.5" fill="#000" opacity=".25"/>
        <rect x="19" y="10" width="26" height="46" rx="5" fill="#3ee6b5"/>
        <rect x="19" y="10" width="26" height="6" rx="3" fill="#b9b3c9"/>
        <rect x="19" y="50" width="26" height="6" rx="3" fill="#8f89a0"/>
        <path d="M34 20 l-7 13 h5 l-3 12 l9 -15 h-5 l4 -10 z" fill="#1d1a2b"/>
        <rect x="22" y="18" width="4" height="30" rx="2" fill="#fff" opacity=".35"/>
        <rect x="38" y="16" width="5" height="34" fill="#1f9e7a" opacity=".45"/>
        <circle class="ia-bubble" cx="27" cy="44" r="1.6" fill="#fff" opacity=".8"/>
        <circle class="ia-bubble ia-bubble-2" cx="36" cy="46" r="1.2" fill="#fff" opacity=".8"/>
        <circle class="ia-bubble ia-bubble-3" cx="31" cy="48" r="1.4" fill="#fff" opacity=".8"/>`,
    pills: `
        <ellipse cx="32" cy="55" rx="22" ry="4" fill="#000" opacity=".25"/>
        <rect x="8" y="16" width="48" height="36" rx="6" fill="#c9d0dc" transform="rotate(-8 32 34)"/>
        <g transform="rotate(-8 32 34)">
            <rect x="8" y="16" width="48" height="36" rx="6" fill="none" stroke="#9aa0ad" stroke-width="1.5"/>
            <ellipse cx="20" cy="27" rx="6" ry="4.5" fill="#f4f1ea"/><ellipse cx="32" cy="27" rx="6" ry="4.5" fill="#f4f1ea"/><ellipse cx="44" cy="27" rx="6" ry="4.5" fill="#f4f1ea"/>
            <ellipse cx="20" cy="41" rx="6" ry="4.5" fill="#f4f1ea"/><ellipse cx="32" cy="41" rx="6" ry="4.5" fill="#ff8a90"/><ellipse cx="44" cy="41" rx="6" ry="4.5" fill="#f4f1ea"/>
            <rect class="ia-glint" x="4" y="14" width="7" height="42" fill="#fff" opacity=".45"/>
        </g>`,
    lock: `
        <ellipse cx="32" cy="57" rx="17" ry="3.5" fill="#000" opacity=".25"/>
        <path class="ia-shackle" d="M21 30 v-8 a11 11 0 0 1 22 0 v8" stroke="#b8bcc6" stroke-width="6" fill="none" stroke-linecap="round"/>
        <rect x="14" y="28" width="36" height="28" rx="6" fill="#d4af37"/>
        <rect x="14" y="28" width="36" height="7" rx="4" fill="#e9c46a"/>
        <circle cx="32" cy="41" r="4" fill="#5a3a12"/>
        <rect x="30.5" y="42" width="3" height="8" rx="1.5" fill="#5a3a12"/>
        <rect x="17" y="36" width="3" height="16" rx="1.5" fill="#fff" opacity=".4"/>`,
    car: `
        <ellipse cx="32" cy="52" rx="27" ry="4" fill="#000" opacity=".3"/>
        <path d="M6 42 v-7 q0 -4 4 -5 l7 -2 l7 -8 q2 -2 5 -2 h13 q3 0 5 2 l7 8 q4 1 4 5 v9 z" fill="#b8574a"/>
        <path d="M21 28 l5 -7 h11 v7 z M40 28 v-7 h4 l5 7 z" fill="#8fd3ff" opacity=".85"/>
        <rect x="6" y="36" width="52" height="3" fill="#8e3f35"/>
        <circle cx="17" cy="45" r="6" fill="#1d1a2b"/><circle cx="17" cy="45" r="2.5" fill="#9aa0ad"/>
        <circle cx="47" cy="45" r="6" fill="#1d1a2b"/><circle cx="47" cy="45" r="2.5" fill="#9aa0ad"/>
        <circle class="ia-headlight" cx="57" cy="34" r="2.2" fill="#fff7d6"/>
        <path class="ia-beam" d="M59 33 l5 -1.5 v5 l-5 -1.5 z" fill="#fff7d6" opacity=".28"/>
        <rect x="9" y="31" width="3" height="3" rx="1" fill="#ff5a5f"/>`,
    fire_insurance: `
        <ellipse cx="32" cy="57" rx="16" ry="3.5" fill="#000" opacity=".25"/>
        <path d="M32 6 l20 7 v15 q0 17 -20 26 q-20 -9 -20 -26 v-15 z" fill="#3d6bc2"/>
        <path d="M32 6 l20 7 v15 q0 17 -20 26 z" fill="#2f55a0"/>
        <path class="ia-flame" d="M32 20 q7 7 4 14 q-1 4 -4 5 q-3 -1 -4 -5 q-2 -5 2 -9 q0 3 2 4 q1 -4 0 -9 z" fill="#f2a24a"/>
        <path d="M32 30 q3 3 1.5 6 q-1 2 -1.5 2 q-1 0 -1.5 -2 q-1 -2 1.5 -6 z" fill="#ffd08a"/>
        <path d="M20 16 v11 q0 8 5 14" stroke="#fff" stroke-width="2" fill="none" opacity=".35" stroke-linecap="round"/>`,
    prison_ransom: `
        <ellipse cx="32" cy="56" rx="20" ry="3.5" fill="#000" opacity=".25"/>
        <circle cx="20" cy="30" r="11" fill="none" stroke="#d4af37" stroke-width="5"/>
        <circle cx="20" cy="30" r="4" fill="#1d1a2b"/>
        <rect x="29" y="27.5" width="26" height="5" rx="2" fill="#d4af37"/>
        <rect x="45" y="32" width="4" height="8" fill="#d4af37"/><rect x="51" y="32" width="4" height="6" fill="#d4af37"/>
        <path d="M13 24 a9 9 0 0 1 8 -4" stroke="#fff3c4" stroke-width="2" fill="none" stroke-linecap="round" opacity=".8"/>
        <g class="ia-sparkle"><path d="M44 14 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1.5 z" fill="#fff"/></g>`,
    trade_permit: `
        <ellipse cx="32" cy="56" rx="21" ry="3.5" fill="#000" opacity=".25"/>
        <rect x="11" y="10" width="42" height="44" rx="3" fill="#efe2c6" transform="rotate(4 32 32)"/>
        <g transform="rotate(4 32 32)">
            <rect x="17" y="17" width="30" height="3" rx="1.5" fill="#b9a784"/>
            <rect x="17" y="24" width="24" height="2.5" rx="1.2" fill="#cdbd9c"/>
            <rect x="17" y="30" width="27" height="2.5" rx="1.2" fill="#cdbd9c"/>
            <circle class="ia-stamp" cx="40" cy="44" r="8" fill="none" stroke="#b8323a" stroke-width="2.5"/>
            <path d="M36 44 l3 3 l5 -6" stroke="#b8323a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
            <path d="M17 40 q5 -4 9 0 t8 0" stroke="#3a2a1a" stroke-width="1.6" fill="none"/>
        </g>`,
phone: `
        <ellipse cx="32" cy="57" rx="13" ry="3.5" fill="#000" opacity=".25"/>
        <rect x="19" y="6" width="26" height="50" rx="5" fill="#2a2540"/>
        <rect class="ia-screen" x="22" y="12" width="20" height="36" rx="2" fill="#5ec8f0"/>
        <rect x="25" y="17" width="14" height="3" rx="1.5" fill="#fff" opacity=".7"/>
        <rect x="25" y="23" width="10" height="3" rx="1.5" fill="#fff" opacity=".5"/>
        <circle cx="32" cy="52" r="1.8" fill="#47465c"/>
        <rect x="21" y="8" width="2.5" height="44" rx="1.2" fill="#fff" opacity=".2"/>`,
    laptop: `
        <ellipse cx="32" cy="54" rx="27" ry="3.5" fill="#000" opacity=".25"/>
        <rect x="12" y="14" width="40" height="28" rx="3" fill="#3a3a44"/>
        <rect class="ia-screen" x="15" y="17" width="34" height="22" rx="1.5" fill="#3d6bc2"/>
        <rect x="18" y="21" width="16" height="2.5" rx="1" fill="#8fe3ff"/><rect x="18" y="26" width="24" height="2.5" rx="1" fill="#c9f3ff" opacity=".7"/><rect x="18" y="31" width="12" height="2.5" rx="1" fill="#8fe3ff"/>
        <path d="M6 44 h52 l-4 6 h-44 z" fill="#9aa0ad"/>
        <rect x="27" y="44" width="10" height="2" rx="1" fill="#6a7080"/>`,
    pepper_spray: `
        <ellipse cx="32" cy="58" rx="12" ry="3" fill="#000" opacity=".25"/>
        <rect x="22" y="22" width="20" height="34" rx="6" fill="#d64545"/>
        <rect x="26" y="12" width="12" height="11" rx="2" fill="#2a2540"/>
        <rect x="38" y="15" width="7" height="4" rx="1" fill="#2a2540"/>
        <rect x="24" y="32" width="16" height="12" rx="2" fill="#efe6d8"/>
        <path d="M28 38 q4 -4 8 0" stroke="#d64545" stroke-width="2" fill="none"/>
        <rect x="25" y="24" width="3" height="28" rx="1.5" fill="#fff" opacity=".35"/>
        <circle class="ia-puff" cx="50" cy="17" r="3" fill="#ffb0a0" opacity="0"/>`,
    safe: `
        <ellipse cx="32" cy="57" rx="23" ry="3.5" fill="#000" opacity=".3"/>
        <rect x="10" y="10" width="44" height="44" rx="5" fill="#5a5f6b"/>
        <rect x="14" y="14" width="36" height="36" rx="3" fill="#45495a"/>
        <circle cx="32" cy="32" r="10" fill="#2a2d36" stroke="#9aa0ad" stroke-width="2"/>
        <g class="ia-dial"><rect x="31" y="23" width="2" height="6" rx="1" fill="#d4af37"/></g>
        <circle cx="32" cy="32" r="3" fill="#b8ae9b"/>
        <rect x="8" y="18" width="4" height="8" rx="1.5" fill="#2a2d36"/><rect x="8" y="38" width="4" height="8" rx="1.5" fill="#2a2d36"/>
        <rect x="16" y="16" width="3" height="32" rx="1.5" fill="#fff" opacity=".15"/>`,
    license: `
        <ellipse cx="32" cy="55" rx="24" ry="3.5" fill="#000" opacity=".25"/>
        <rect x="8" y="16" width="48" height="32" rx="4" fill="#e89a8a"/>
        <rect x="8" y="16" width="48" height="8" rx="4" fill="#c86a5a"/>
        <rect x="12" y="28" width="14" height="16" rx="2" fill="#efe6d8"/>
        <circle cx="19" cy="34" r="3.5" fill="#8a6a5a"/><path d="M13 44 q6 -7 12 0" fill="#8a6a5a"/>
        <rect x="30" y="29" width="22" height="3" rx="1.5" fill="#fff" opacity=".7"/>
        <rect x="30" y="35" width="16" height="3" rx="1.5" fill="#fff" opacity=".5"/>
        <rect x="30" y="41" width="19" height="3" rx="1.5" fill="#fff" opacity=".5"/>
        <rect class="ia-glint" x="6" y="15" width="6" height="34" fill="#fff" opacity=".4"/>`,
    house: `
        <ellipse cx="32" cy="57" rx="24" ry="3.5" fill="#000" opacity=".25"/>
        <path d="M6 30 l26 -20 l26 20 z" fill="#b8574a"/>
        <rect x="11" y="29" width="42" height="26" fill="#e8dcc0"/>
        <rect x="40" y="12" width="6" height="12" fill="#8e3f35"/>
        <rect x="27" y="40" width="10" height="15" rx="1" fill="#6b3f22"/>
        <rect class="ia-window" x="15" y="34" width="9" height="8" fill="#f2c46a"/>
        <rect x="41" y="34" width="9" height="8" fill="#f2c46a"/>
        <rect x="19" y="34" width="1" height="8" fill="#8a6a3a"/><rect x="45" y="34" width="1" height="8" fill="#8a6a3a"/>`,
    seller_license: `
        <ellipse cx="32" cy="56" rx="21" ry="3.5" fill="#000" opacity=".25"/>
        <rect x="12" y="10" width="40" height="44" rx="3" fill="#e8f0e0"/>
        <rect x="12" y="10" width="40" height="9" rx="3" fill="#5a8a5a"/>
        <path d="M24 30 h16 l-2 10 h-12 z" fill="#5a8a5a"/>
        <path d="M26 30 q0 -6 6 -6 q6 0 6 6" stroke="#5a8a5a" stroke-width="2" fill="none"/>
        <rect x="18" y="45" width="28" height="2.5" rx="1.2" fill="#b9c9b0"/>
        <g class="ia-sparkle"><path d="M46 24 l1.2 3 l3 1.2 l-3 1.2 l-1.2 3 l-1.2 -3 l-3 -1.2 l3 -1.2 z" fill="#f2c46a"/></g>`,
    candidate: `
        <ellipse cx="32" cy="57" rx="20" ry="3.5" fill="#000" opacity=".25"/>
        <rect x="12" y="26" width="40" height="30" rx="3" fill="#3d6bc2"/>
        <rect x="12" y="26" width="40" height="6" rx="3" fill="#2f55a0"/>
        <rect x="22" y="23" width="20" height="4" rx="1" fill="#1d2640"/>
        <g class="ia-ballot"><rect x="25" y="8" width="14" height="18" rx="1.5" fill="#efe6d8"/><path d="M28 17 l3 3 l5 -6" stroke="#3a8a4a" stroke-width="2.2" fill="none" stroke-linecap="round"/></g>
        <path d="M24 40 l3 -6 l3 6 l-5 -4 h7 z" fill="#f2c46a"/>`,
    gym: `
        <ellipse cx="32" cy="54" rx="26" ry="3.5" fill="#000" opacity=".25"/>
        <g class="ia-lift">
            <rect x="14" y="30" width="36" height="4" rx="2" fill="#9aa0ad"/>
            <rect x="8" y="22" width="7" height="20" rx="2" fill="#2a2d36"/><rect x="3" y="25" width="5" height="14" rx="2" fill="#3a3e4a"/>
            <rect x="49" y="22" width="7" height="20" rx="2" fill="#2a2d36"/><rect x="56" y="25" width="5" height="14" rx="2" fill="#3a3e4a"/>
            <rect x="9" y="24" width="2" height="16" rx="1" fill="#fff" opacity=".25"/>
        </g>`,
    vitamins: `
        <ellipse cx="32" cy="57" rx="14" ry="3.5" fill="#000" opacity=".25"/>
        <rect x="18" y="18" width="28" height="38" rx="5" fill="#f2a24a"/>
        <rect x="20" y="10" width="24" height="10" rx="2" fill="#efe6d8"/>
        <rect x="21" y="28" width="22" height="16" rx="2" fill="#fff4e0"/>
        <text x="32" y="41" text-anchor="middle" font-size="12" font-weight="700" fill="#d9731a" font-family="Arial">C</text>
        <rect x="21" y="20" width="3" height="32" rx="1.5" fill="#fff" opacity=".35"/>
        <g class="ia-sparkle"><path d="M48 14 l1 2.5 l2.5 1 l-2.5 1 l-1 2.5 l-1 -2.5 l-2.5 -1 l2.5 -1 z" fill="#ffd08a"/></g>`,
    alcohol: `
        <ellipse cx="32" cy="58" rx="12" ry="3" fill="#000" opacity=".25"/>
        <path d="M27 6 h10 v12 q7 5 7 14 v22 q0 3 -3 3 h-18 q-3 0 -3 -3 v-22 q0 -9 7 -14 z" fill="#5a8a3a" opacity=".92"/>
        <rect x="26" y="4" width="12" height="5" rx="1.5" fill="#8a5a3a"/>
        <rect x="23" y="34" width="18" height="14" rx="2" fill="#efe2c6"/>
        <rect x="26" y="38" width="12" height="2.5" rx="1" fill="#8a5a3a"/><rect x="28" y="43" width="8" height="2" rx="1" fill="#b9a784"/>
        <rect class="ia-glint" x="22" y="22" width="4" height="30" fill="#fff" opacity=".35"/>`,
    legal_insurance: `
        <ellipse cx="32" cy="57" rx="16" ry="3.5" fill="#000" opacity=".25"/>
        <path d="M32 6 l20 7 v15 q0 17 -20 26 q-20 -9 -20 -26 v-15 z" fill="#5a4a8a"/>
        <path d="M32 6 l20 7 v15 q0 17 -20 26 z" fill="#4a3a78"/>
        <g class="ia-scales"><rect x="31" y="18" width="2" height="18" fill="#f2c46a"/><rect x="21" y="20" width="22" height="2" rx="1" fill="#f2c46a"/>
        <path d="M22 22 l-4 8 h8 z" fill="#f2c46a"/><path d="M42 22 l-4 8 h8 z" fill="#f2c46a"/></g>
        <rect x="27" y="36" width="10" height="2.5" rx="1" fill="#f2c46a"/>`,
    stats_subscription: `
        <ellipse cx="32" cy="56" rx="23" ry="3.5" fill="#000" opacity=".25"/>
        <rect x="9" y="10" width="46" height="42" rx="4" fill="#2a2540"/>
        <rect class="ia-bar" x="16" y="34" width="7" height="12" rx="1.5" fill="#5ec8f0"/>
        <rect class="ia-bar ia-bar-2" x="28" y="24" width="7" height="22" rx="1.5" fill="#3ee6b5"/>
        <rect class="ia-bar ia-bar-3" x="40" y="16" width="7" height="30" rx="1.5" fill="#f2a24a"/>
        <rect x="14" y="46" width="36" height="1.5" fill="#6a6a8a"/>`,
    balaclava: `
        <ellipse cx="32" cy="57" rx="18" ry="3.5" fill="#000" opacity=".25"/>
        <path d="M14 30 q0 -22 18 -22 q18 0 18 22 v20 q0 6 -6 6 h-24 q-6 0 -6 -6 z" fill="#2a2a30"/>
        <rect x="20" y="24" width="24" height="9" rx="4.5" fill="#e8c4a0"/>
        <circle class="ia-eye" cx="26" cy="28.5" r="2.2" fill="#2a2a30"/><circle class="ia-eye" cx="38" cy="28.5" r="2.2" fill="#2a2a30"/>
        <rect x="27" y="40" width="10" height="5" rx="2.5" fill="#e8c4a0"/>
        <path d="M18 18 q6 -8 14 -8" stroke="#fff" stroke-width="2" fill="none" opacity=".15"/>`,
    thief_note: `
        <ellipse cx="32" cy="56" rx="20" ry="3.5" fill="#000" opacity=".25"/>
        <path d="M12 14 h40 v34 q-6 4 -12 0 q-6 -4 -12 0 q-6 4 -16 0 z" fill="#efe2c6" transform="rotate(-5 32 32)"/>
        <g transform="rotate(-5 32 32)">
            <path d="M18 22 q6 -3 10 0 t10 0 t8 0" stroke="#3a2a1a" stroke-width="1.6" fill="none"/>
            <path d="M18 29 q6 -3 10 0 t10 0" stroke="#3a2a1a" stroke-width="1.6" fill="none"/>
            <path d="M18 36 q4 -3 8 0 t8 0" stroke="#3a2a1a" stroke-width="1.6" fill="none"/>
        </g>
        <g class="ia-sway"><circle cx="46" cy="44" r="6" fill="#2a2a30"/><rect x="40" y="42" width="12" height="3" rx="1.5" fill="#2a2a30"/><rect x="42" y="47" width="3" height="3" rx="1" fill="#e8c4a0"/><rect x="47" y="47" width="3" height="3" rx="1" fill="#e8c4a0"/></g>`,
    recruitment_list: `
        <ellipse cx="32" cy="56" rx="21" ry="3.5" fill="#000" opacity=".25"/>
        <rect x="14" y="10" width="38" height="44" rx="2" fill="#c9b894"/>
        <rect x="12" y="8" width="38" height="44" rx="2" fill="#e8dcc0"/>
        <rect x="26" y="5" width="12" height="6" rx="2" fill="#8a6a3a"/>
        <g fill="#8a7a5a"><circle cx="18" cy="20" r="2"/><circle cx="18" cy="28" r="2"/><circle cx="18" cy="36" r="2"/><circle cx="18" cy="44" r="2"/></g>
        <rect x="23" y="19" width="20" height="2.5" rx="1" fill="#b9a784"/><rect x="23" y="27" width="16" height="2.5" rx="1" fill="#b9a784"/><rect x="23" y="35" width="22" height="2.5" rx="1" fill="#b9a784"/><rect x="23" y="43" width="14" height="2.5" rx="1" fill="#b9a784"/>
        <path class="ia-mark" d="M40 25 l2.5 2.5 l5 -6" stroke="#b8323a" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
    black_mark: `
        <ellipse cx="32" cy="56" rx="16" ry="3.5" fill="#000" opacity=".3"/>
        <circle cx="32" cy="31" r="21" fill="#16131f" stroke="#47465c" stroke-width="2"/>
        <circle class="ia-pulse" cx="32" cy="31" r="15" fill="none" stroke="#ff5a5f" stroke-width="1.5" opacity=".6"/>
        <path d="M24 38 q8 -18 16 0" stroke="#efe6d8" stroke-width="2.5" fill="none"/>
        <circle cx="27" cy="26" r="2.4" fill="#ff5a5f"/><circle cx="37" cy="26" r="2.4" fill="#ff5a5f"/>
        <path d="M20 16 q5 -5 12 -5" stroke="#fff" stroke-width="2" fill="none" opacity=".15"/>`,
    pager: `
        <ellipse cx="32" cy="55" rx="20" ry="3.5" fill="#000" opacity=".25"/>
        <rect x="12" y="18" width="40" height="32" rx="6" fill="#2a2d36"/>
        <rect x="16" y="22" width="32" height="13" rx="2" fill="#8fbf6a"/>
        <text class="ia-blink" x="32" y="32" text-anchor="middle" font-size="9" font-weight="700" font-family="monospace" fill="#2a3a1a">ЧАТ</text>
        <circle cx="22" cy="43" r="3" fill="#47465c"/><circle cx="32" cy="43" r="3" fill="#47465c"/><circle cx="42" cy="43" r="3" fill="#47465c"/>
        <rect x="40" y="12" width="4" height="8" rx="1" fill="#3a3e4a"/>`,
    stash: `
        <ellipse cx="32" cy="57" rx="22" ry="3.5" fill="#000" opacity=".3"/>
        <rect x="10" y="22" width="44" height="32" rx="3" fill="#6e4a2a"/>
        <path d="M10 22 q22 -16 44 0 z" fill="#8a5a3a"/>
        <rect x="10" y="30" width="44" height="3" fill="#4a3018"/><rect x="10" y="44" width="44" height="3" fill="#4a3018"/>
        <rect x="28" y="30" width="8" height="10" rx="2" fill="#d4af37"/>
        <circle cx="32" cy="34" r="1.5" fill="#4a3018"/>
        <g class="ia-sparkle"><path d="M48 12 l1.2 3 l3 1.2 l-3 1.2 l-1.2 3 l-1.2 -3 l-3 -1.2 l3 -1.2 z" fill="#f2c46a"/></g>`,
    veto: `
        <ellipse cx="32" cy="56" rx="20" ry="3.5" fill="#000" opacity=".25"/>
        <g class="ia-stamp2"><rect x="24" y="8" width="16" height="14" rx="3" fill="#8a5a3a"/><rect x="20" y="22" width="24" height="7" rx="2" fill="#6e4520"/></g>
        <rect x="12" y="34" width="40" height="20" rx="3" fill="#efe2c6"/>
        <rect x="16" y="37" width="32" height="14" rx="2" fill="none" stroke="#b8323a" stroke-width="2.5"/>
        <text x="32" y="48" text-anchor="middle" font-size="10" font-weight="700" fill="#b8323a" font-family="Arial">ВЕТО</text>`,
    incognito: `
        <ellipse cx="32" cy="56" rx="21" ry="3.5" fill="#000" opacity=".25"/>
        <path d="M10 26 h44 l-4 -12 q-2 -4 -6 -3 l-6 2 h-8 l-6 -2 q-4 -1 -6 3 z" fill="#2a2a30"/>
        <rect x="6" y="25" width="52" height="5" rx="2.5" fill="#1d1a2b"/>
        <circle cx="22" cy="40" r="8" fill="#16131f" stroke="#47465c" stroke-width="2"/><circle cx="42" cy="40" r="8" fill="#16131f" stroke="#47465c" stroke-width="2"/>
        <path d="M30 40 h4" stroke="#47465c" stroke-width="2"/>
        <path class="ia-glint2" d="M17 36 l4 -3" stroke="#fff" stroke-width="2" opacity=".5" stroke-linecap="round"/>`,
    oko: `
        <ellipse cx="32" cy="56" rx="20" ry="3.5" fill="#000" opacity=".25"/>
        <path d="M6 32 q26 -26 52 0 q-26 26 -52 0 z" fill="#efe6d8"/>
        <circle cx="32" cy="32" r="11" fill="#3d6bc2"/>
        <circle class="ia-pupil" cx="32" cy="32" r="5" fill="#16131f"/>
        <circle cx="35" cy="29" r="2" fill="#fff"/>
        <g class="ia-lid"><path d="M6 32 q26 -26 52 0 q-26 -12 -52 0 z" fill="#b9b3c9"/></g>`,
    accounting_book: `
        <ellipse cx="32" cy="56" rx="22" ry="3.5" fill="#000" opacity=".25"/>
        <rect x="12" y="10" width="40" height="44" rx="3" fill="#2f55a0"/>
        <rect x="16" y="10" width="36" height="44" rx="2" fill="#3d6bc2"/>
        <rect x="12" y="10" width="6" height="44" rx="2" fill="#1d3a70"/>
        <rect x="22" y="18" width="24" height="12" rx="2" fill="#efe6d8"/>
        <text x="34" y="27.5" text-anchor="middle" font-size="9" font-weight="700" fill="#2f55a0" font-family="Arial">₭</text>
        <rect x="22" y="36" width="24" height="2.5" rx="1" fill="#8fb4e8"/><rect x="22" y="42" width="18" height="2.5" rx="1" fill="#8fb4e8"/>
        <rect class="ia-glint" x="18" y="10" width="4" height="44" fill="#fff" opacity=".25"/>`,
    fake_passport: `
        <ellipse cx="32" cy="56" rx="19" ry="3.5" fill="#000" opacity=".25"/>
        <rect x="14" y="8" width="36" height="46" rx="4" fill="#7a1f2a"/>
        <rect x="14" y="8" width="36" height="46" rx="4" fill="none" stroke="#5a141c" stroke-width="2"/>
        <circle cx="32" cy="26" r="8" fill="none" stroke="#d4af37" stroke-width="2"/>
        <path d="M27 26 h10 M32 21 v10" stroke="#d4af37" stroke-width="1.5"/>
        <rect x="22" y="40" width="20" height="3" rx="1.5" fill="#d4af37"/>
        <rect x="25" y="46" width="14" height="2" rx="1" fill="#b8912a"/>
        <text class="ia-blink" x="44" y="16" text-anchor="middle" font-size="9" font-weight="700" fill="#ff8a90" font-family="Arial">?</text>`,

    sick: `
        <ellipse cx="32" cy="57" rx="16" ry="3.5" fill="#000" opacity=".25"/>
        <rect x="26" y="6" width="12" height="40" rx="6" fill="#efe6d8"/>
        <circle cx="32" cy="48" r="9" fill="#efe6d8"/>
        <circle cx="32" cy="48" r="6" fill="#d64545"/>
        <rect class="ia-mercury" x="30" y="14" width="4" height="34" rx="2" fill="#d64545"/>
        <g fill="#b9a784"><rect x="38" y="14" width="4" height="1.5"/><rect x="38" y="20" width="3" height="1.5"/><rect x="38" y="26" width="4" height="1.5"/><rect x="38" y="32" width="3" height="1.5"/></g>
        <g class="ia-germ"><circle cx="14" cy="20" r="6" fill="#5a8a3a"/><circle cx="12" cy="19" r="1.3" fill="#1d1a2b"/><circle cx="16" cy="19" r="1.3" fill="#1d1a2b"/>
        <path d="M14 12 v-3 M8 16 l-3 -2 M20 16 l3 -2 M8 25 l-3 2 M20 25 l3 2" stroke="#5a8a3a" stroke-width="2" stroke-linecap="round"/></g>`,
    wounded: `
        <ellipse cx="32" cy="56" rx="20" ry="3.5" fill="#000" opacity=".25"/>
        <rect x="8" y="24" width="48" height="16" rx="8" fill="#e8c49a" transform="rotate(-35 32 32)"/>
        <rect x="8" y="24" width="48" height="16" rx="8" fill="#e8c49a" transform="rotate(35 32 32)"/>
        <rect x="24" y="24" width="16" height="16" rx="3" fill="#f4e6cc"/>
        <g fill="#c9a882"><circle cx="28" cy="28" r="1"/><circle cx="36" cy="28" r="1"/><circle cx="28" cy="36" r="1"/><circle cx="36" cy="36" r="1"/></g>
        <path class="ia-drop" d="M32 42 q4 6 0 9 q-4 -3 0 -9 z" fill="#d64545"/>`,
    fire: `
        <ellipse cx="32" cy="57" rx="22" ry="3.5" fill="#000" opacity=".25"/>
        <path d="M10 32 l22 -18 l22 18 z" fill="#6e2f28"/>
        <rect x="14" y="31" width="36" height="24" fill="#8a4a3a"/>
        <rect x="27" y="41" width="10" height="14" fill="#3a2020"/>
        <g class="ia-flame"><path d="M22 34 q-8 -10 2 -22 q0 8 6 10 q2 -6 0 -12 q12 8 6 24 z" fill="#f2a24a"/>
        <path d="M24 32 q-3 -6 2 -12 q2 6 5 6 q2 4 -1 6 z" fill="#ffd08a"/></g>
        <g class="ia-flame ia-flame-2"><path d="M38 36 q-4 -8 2 -14 q2 6 6 6 q2 6 -2 8 z" fill="#ff5a3a"/></g>`,
    stove_fire: `
        <ellipse cx="32" cy="57" rx="22" ry="3.5" fill="#000" opacity=".25"/>
        <rect x="10" y="40" width="44" height="16" rx="3" fill="#9aa0ad"/>
        <circle cx="20" cy="48" r="3" fill="#47465c"/><circle cx="44" cy="48" r="3" fill="#47465c"/>
        <path d="M14 36 h36 l-3 6 h-30 z" fill="#2a2d36"/>
        <rect x="48" y="36" width="12" height="3" rx="1.5" fill="#2a2d36"/>
        <g class="ia-flame"><path d="M20 36 q-4 -12 4 -20 q0 8 5 9 q1 -6 -1 -11 q10 10 4 22 z" fill="#f2a24a"/>
        <path d="M24 34 q-2 -6 2 -10 q2 5 4 5 q1 4 -1 5 z" fill="#ffd08a"/></g>
        <g class="ia-flame ia-flame-2"><path d="M36 36 q-3 -8 2 -13 q2 5 5 5 q1 5 -2 8 z" fill="#ff5a3a"/></g>`,
    needs_rescue: `
        <ellipse cx="32" cy="57" rx="20" ry="3.5" fill="#000" opacity=".25"/>
        <g class="ia-spin"><circle cx="32" cy="31" r="21" fill="#efe6d8"/>
        <circle cx="32" cy="31" r="10" fill="#1d1a2b"/>
        <path d="M32 10 a21 21 0 0 1 14.8 6.2 l-7.8 7.8 a10 10 0 0 0 -7 -3 z M53 31 a21 21 0 0 1 -6.2 14.8 l-7.8 -7.8 a10 10 0 0 0 3 -7 z M32 52 a21 21 0 0 1 -14.8 -6.2 l7.8 -7.8 a10 10 0 0 0 7 3 z M11 31 a21 21 0 0 1 6.2 -14.8 l7.8 7.8 a10 10 0 0 0 -3 7 z" fill="#d64545"/></g>
        <circle class="ia-pulse" cx="32" cy="31" r="22" fill="none" stroke="#ff5a5f" stroke-width="2"/>`,
    needs_home_repair: `
        <ellipse cx="32" cy="57" rx="20" ry="3.5" fill="#000" opacity=".25"/>
        <g class="ia-hammer"><rect x="30" y="14" width="5" height="40" rx="2" fill="#8a5a3a" transform="rotate(35 32 34)"/>
        <rect x="20" y="10" width="22" height="9" rx="2" fill="#6a7080" transform="rotate(35 32 34)"/></g>
        <g transform="rotate(-35 32 34)"><rect x="29.5" y="20" width="5" height="36" rx="2.5" fill="#9aa0ad"/>
        <path d="M24 12 a8 8 0 1 0 16 0 l-5 0 l0 5 l-6 0 l0 -5 z" fill="#b8bcc6"/></g>`,
    robbed: `
        <ellipse cx="32" cy="57" rx="20" ry="3.5" fill="#000" opacity=".25"/>
        <path d="M10 26 h40 q4 0 4 4 v20 q0 4 -4 4 h-40 q-4 0 -4 -4 v-20 q0 -4 4 -4 z" fill="#8a5a2a"/>
        <path d="M10 26 l14 -12 h12 l-10 12 z" fill="#a8703a"/>
        <rect x="40" y="34" width="14" height="10" rx="2" fill="#6e4520"/>
        <circle cx="47" cy="39" r="2" fill="#f2c46a"/>
        <path d="M16 38 q6 4 14 0" stroke="#4a2a10" stroke-width="2" fill="none"/>
        <g class="ia-coinaway"><circle cx="32" cy="18" r="5" fill="#f2c46a"/><text x="32" y="21" text-anchor="middle" font-size="7" font-weight="700" fill="#8a6a1a" font-family="Arial">₭</text></g>
        <path class="ia-moth" d="M22 16 q-4 -4 -6 0 q2 4 6 0 q4 -4 6 0 q-2 4 -6 0" fill="#b9b3c9"/>`,
    energy_crash: `
        <ellipse cx="32" cy="55" rx="23" ry="3.5" fill="#000" opacity=".25"/>
        <rect x="8" y="18" width="42" height="28" rx="5" fill="none" stroke="#9aa0ad" stroke-width="4"/>
        <rect x="50" y="26" width="6" height="12" rx="2" fill="#9aa0ad"/>
        <rect class="ia-lowbar" x="13" y="23" width="7" height="18" rx="2" fill="#ff5a5f"/>
        <text x="33" y="37" text-anchor="middle" font-size="11" font-weight="700" fill="#9aa0ad" font-family="Arial">zZ</text>`,
    alcohol_hangover: `
        <ellipse cx="32" cy="57" rx="16" ry="3.5" fill="#000" opacity=".25"/>
        <path d="M18 18 h28 l-3 36 q0 3 -3 3 h-16 q-3 0 -3 -3 z" fill="#c9e2f5" opacity=".55"/>
        <path d="M19 28 h26 l-2 26 q0 2 -2 2 h-18 q-2 0 -2 -2 z" fill="#8fc3ea" opacity=".6"/>
        <circle cx="32" cy="46" r="5" fill="#efe6d8"/>
        <circle class="ia-bubble" cx="29" cy="42" r="1.4" fill="#fff" opacity=".9"/>
        <circle class="ia-bubble ia-bubble-2" cx="34" cy="43" r="1.1" fill="#fff" opacity=".9"/>
        <circle class="ia-bubble ia-bubble-3" cx="32" cy="40" r="1.2" fill="#fff" opacity=".9"/>
        <g class="ia-dizzy"><path d="M20 8 l1 2.5 l2.5 1 l-2.5 1 l-1 2.5 l-1 -2.5 l-2.5 -1 l2.5 -1 z" fill="#f2c46a"/><path d="M44 6 l1 2.5 l2.5 1 l-2.5 1 l-1 2.5 l-1 -2.5 l-2.5 -1 l2.5 -1 z" fill="#f2c46a"/></g>`,
    zavod: `
        <ellipse cx="32" cy="57" rx="24" ry="3.5" fill="#000" opacity=".25"/>
        <path d="M8 55 v-20 l12 -8 v8 l12 -8 v8 l12 -8 v28 z" fill="#5a4a3e"/>
        <rect x="44" y="14" width="10" height="41" fill="#4a3b31"/>
        <rect x="12" y="42" width="6" height="6" fill="#f2c46a"/><rect x="24" y="42" width="6" height="6" fill="#f2c46a"/><rect x="36" y="42" width="6" height="6" fill="#5a4a3a"/>
        <circle class="ia-smoke" cx="49" cy="10" r="4" fill="#8a8494"/>
        <circle class="ia-smoke ia-smoke-2" cx="51" cy="10" r="4" fill="#8a8494"/>`,
};

export function hasItemArt(code) {
    return Boolean(ART[code]);
}

// Рисунок предмета; если рисунка нет — картинка assets/items/<код>.png; если и её нет — эмодзи.
export function itemArtHtml(code, emoji = "📦", size = 44) {
    const art = ART[code];
    if (art) return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" class="item-art item-art-${code}" aria-hidden="true">${art}</svg>`;
    return `<img class="shop-item-img" src="assets/items/${code}.png" alt="" width="${size}" height="${size}" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';"><span class="item-art-wrap" style="display:none"><span class="item-art-emoji">${emoji}</span></span>`;
}
