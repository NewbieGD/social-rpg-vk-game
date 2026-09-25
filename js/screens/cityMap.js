import { apiFetch } from "../api.js";
import { showGamePopupWithContent } from "../gamePopup.js";
import { CITY_MAP_ASSETS } from "../cityMapAssets.js";

// ---------- План города ----------
// Вся карта 700×1000. Две вертикальные улицы и три горизонтальные делят
// город на 12 кварталов (3 колонки × 4 ряда). Координаты улиц — общая
// система для зданий и транспорта, поэтому маршрут всегда доходит до двери.

const W = 700;
const H = 1000;
const ROAD = 40;
const V_STREETS = [233, 467];
const H_STREETS = [200, 480, 760];
const COLS = [[0, 213], [253, 447], [487, 700]];
const ROWS = [[0, 180], [220, 460], [500, 740], [780, 1000]];

const C = {
    ground: "#1d1a2b", block: "#241f33", road: "#2b2740", walk: "#332f45",
    dash: "#6d5c3d", lamp: "#ffd08a", glow: "#f2a24a", text: "#efe6d8",
    sign: "#3a2426", signText: "#ffe3bd", window: "#f2c46a", windowOff: "#2a2540",
    tree: "#2f4a3a", treeDark: "#243a2e",
};

function cellRect(col, row, pad = 20) {
    const [x0, x1] = COLS[col];
    const [y0, y1] = ROWS[row];
    return { x: x0 + pad, y: y0 + pad, w: x1 - x0 - pad * 2, h: y1 - y0 - pad * 2 };
}

// Здания: где стоят, куда смотрит дверь, как называются в маршрутах сервера.
const BUILDINGS = [
    { code: "police", title: "Полицейский участок", cell: [0, 0], door: "bottom", labels: ["Полицейский участок"],
      info: "Сюда приезжают на смену полицейские, отсюда выезжают на вызовы об ограблениях." },
    { code: "government", title: "Гос. управление", cell: [1, 0], door: "bottom", labels: ["Гос. управление"],
      info: "Сердце страны: президент, министры, депутаты и государственная казна." },
    { code: "hospital", title: "Больница", cell: [2, 0], door: "bottom", labels: ["Больница"],
      info: "Отсюда выезжает скорая к заболевшим и раненым, здесь работают врачи." },
    { code: "fire", title: "Пожарная часть", cell: [0, 1], door: "right", labels: ["Пожарная часть"],
      info: "Пожарные и спасатели МЧС выезжают отсюда на пожары и спасение жителей." },
    { code: "school", title: "Школа", cell: [2, 1], door: "left", labels: ["Школа"],
      info: "Здесь учатся студенты и проходят пересдачи у учителей." },
    { code: "factory", title: "Завод", cell: [0, 2], door: "right", labels: ["Завод"],
      info: "Завод производит товары, которые потом появляются в магазине." },
    { code: "shop", title: "Магазин", cell: [2, 2], door: "left", labels: ["Магазин"],
      info: "Отсюда курьеры везут покупки жителям." },
    { code: "army", title: "Военная база", cell: [0, 3], door: "top", labels: ["Военная база"],
      info: "Здесь служат жители, подписавшие армейский контракт." },
    { code: "private_gate", title: "Частный сектор", cell: [1, 3], door: "top", labels: ["Дом"],
      info: "Въезд в частный сектор — здесь стоят купленные дома жителей." },
    { code: "office", title: "Деловой квартал", cell: [2, 3], door: "top", labels: ["Место работы"],
      info: "Офисы и стройки — сюда едут на работу остальные профессии." },
];

function doorPoints(rect, side) {
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    if (side === "bottom") {
        const y = Math.min(...H_STREETS.filter((s) => s > rect.y + rect.h));
        return { door: { x: cx, y: rect.y + rect.h }, curb: { x: cx, y } };
    }
    if (side === "top") {
        const y = Math.max(...H_STREETS.filter((s) => s < rect.y));
        return { door: { x: cx, y: rect.y }, curb: { x: cx, y } };
    }
    if (side === "right") {
        const x = Math.min(...V_STREETS.filter((s) => s > rect.x + rect.w));
        return { door: { x: rect.x + rect.w, y: cy }, curb: { x, y: cy } };
    }
    const x = Math.max(...V_STREETS.filter((s) => s < rect.x));
    return { door: { x: rect.x, y: cy }, curb: { x, y: cy } };
}

// ---------- Маршруты по улицам (как в навигаторе) ----------
// Узлы: перекрёстки + точки у дверей. Соседние узлы на одной улице связаны.
function shortestRoute(fromCurb, toCurb) {
    const nodes = [];
    const key = (p) => `${Math.round(p.x)},${Math.round(p.y)}`;
    const add = (p) => { if (!nodes.some((n) => key(n) === key(p))) nodes.push({ x: p.x, y: p.y }); };
    V_STREETS.forEach((x) => H_STREETS.forEach((y) => add({ x, y })));
    V_STREETS.forEach((x) => { add({ x, y: 0 }); add({ x, y: H }); });
    H_STREETS.forEach((y) => { add({ x: 0, y }); add({ x: W, y }); });
    add(fromCurb);
    add(toCurb);

    const edges = new Map(nodes.map((n) => [key(n), []]));
    const link = (list, axis) => {
        list.sort((a, b) => a[axis] - b[axis]);
        for (let i = 0; i + 1 < list.length; i++) {
            const a = list[i], b = list[i + 1];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            edges.get(key(a)).push({ to: b, d });
            edges.get(key(b)).push({ to: a, d });
        }
    };
    V_STREETS.forEach((x) => link(nodes.filter((n) => Math.abs(n.x - x) < 0.5), "y"));
    H_STREETS.forEach((y) => link(nodes.filter((n) => Math.abs(n.y - y) < 0.5), "x"));

    const dist = new Map([[key(fromCurb), 0]]);
    const prev = new Map();
    const todo = new Set(nodes.map(key));
    const byKey = new Map(nodes.map((n) => [key(n), n]));
    while (todo.size) {
        let best = null;
        todo.forEach((k) => { if (dist.has(k) && (best === null || dist.get(k) < dist.get(best))) best = k; });
        if (best === null) break;
        todo.delete(best);
        if (best === key(toCurb)) break;
        for (const e of edges.get(best)) {
            const nk = key(e.to);
            const nd = dist.get(best) + e.d;
            if (!dist.has(nk) || nd < dist.get(nk)) { dist.set(nk, nd); prev.set(nk, best); }
        }
    }
    const path = [];
    let k = key(toCurb);
    while (k) { path.unshift(byKey.get(k)); k = prev.get(k); }
    return path.length && key(path[0]) === key(fromCurb) ? path : [fromCurb, toCurb];
}

// ---------- Картинки: своя (если задана) или встроенная векторная ----------
function customImage(src, r) {
    return `<image href="${src}" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" preserveAspectRatio="xMidYMid meet" />`;
}

function sign(r, text, y = null) {
    const sw = Math.min(r.w - 6, text.length * 11 + 24);
    const sx = r.x + (r.w - sw) / 2;
    const sy = y ?? r.y + 8;
    // шрифт уменьшается, если надпись длиннее таблички
    const fs = Math.min(16, (sw - 12) / (text.length * 0.62)).toFixed(1);
    return `<rect x="${sx}" y="${sy}" width="${sw}" height="26" rx="3" fill="${C.sign}" stroke="${C.glow}" stroke-width="1.5"/>
        <text x="${r.x + r.w / 2}" y="${sy + 18}" text-anchor="middle" font-size="${fs}" fill="${C.signText}" font-family="Russo One, Golos Text, sans-serif">${text}</text>`;
}

function windows(x, y, cols, rows, size, gap, seed, lit = 0.55) {
    let out = "";
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const h = hash(`${seed}-${r}-${c}`);
            const on = (h % 100) / 100 < lit;
            const flick = h % 7 === 0
                ? `<animate attributeName="fill" values="${C.window};${C.windowOff};${C.window}" dur="${4 + (h % 5)}s" repeatCount="indefinite"/>`
                : "";
            out += `<rect x="${x + c * (size + gap)}" y="${y + r * (size + gap)}" width="${size}" height="${Math.round(size * 0.8)}" fill="${on ? C.window : C.windowOff}">${flick}</rect>`;
        }
    }
    return out;
}

const DRAW = {
    police(r) {
        return `<rect x="${r.x}" y="${r.y + 14}" width="${r.w}" height="${r.h - 14}" fill="#3b4a6b"/>
            <rect x="${r.x - 4}" y="${r.y + 8}" width="${r.w + 8}" height="10" fill="#2a3552"/>
            <rect x="${r.x + 14}" y="${r.y}" width="10" height="9" fill="#ff4d4d"><animate attributeName="fill" values="#ff4d4d;#3d7bff;#ff4d4d" dur="0.9s" repeatCount="indefinite"/></rect>
            <rect x="${r.x + r.w - 24}" y="${r.y}" width="10" height="9" fill="#3d7bff"><animate attributeName="fill" values="#3d7bff;#ff4d4d;#3d7bff" dur="0.9s" repeatCount="indefinite"/></rect>
            ${sign(r, "Полиция", r.y + 24)}
            ${windows(r.x + 14, r.y + 62, 6, 1, 16, 10, "police")}
            <polygon points="${star(r.x + r.w / 2, r.y + r.h - 40, 14)}" fill="#c9d4f0"/>
            <rect x="${r.x + r.w / 2 - 11}" y="${r.y + r.h - 18}" width="22" height="18" fill="${C.glow}"/>`;
    },
    government(r) {
        const cols = [0, 1, 2, 3, 4].map((i) => `<rect x="${r.x + 22 + i * ((r.w - 56) / 4)}" y="${r.y + 60}" width="12" height="${r.h - 78}" fill="#e8e0cf"/>`).join("");
        return `<polygon points="${r.x + 6},${r.y + 52} ${r.x + r.w / 2},${r.y + 22} ${r.x + r.w - 6},${r.y + 52}" fill="#cfc6b5"/>
            <rect x="${r.x + 6}" y="${r.y + 52}" width="${r.w - 12}" height="8" fill="#b8ae9b"/>
            <rect x="${r.x + 12}" y="${r.y + 60}" width="${r.w - 24}" height="${r.h - 78}" fill="#8a8272"/>
            ${cols}
            <rect x="${r.x}" y="${r.y + r.h - 18}" width="${r.w}" height="18" fill="#b8ae9b"/>
            <line x1="${r.x + r.w / 2}" y1="${r.y + 22}" x2="${r.x + r.w / 2}" y2="${r.y - 4}" stroke="#d9d2c5" stroke-width="2"/>
            <rect x="${r.x + r.w / 2}" y="${r.y - 4}" width="22" height="13" fill="#d64545"><animate attributeName="width" values="22;18;22" dur="1.6s" repeatCount="indefinite"/></rect>
            ${sign(r, "Гос. управление", r.y + r.h - 44)}`;
    },
    residence(r) {
        return `<polygon points="${r.x},${r.y + 26} ${r.x + r.w / 2},${r.y + 6} ${r.x + r.w},${r.y + 26}" fill="#8a5a3a"/>
            <rect x="${r.x + 4}" y="${r.y + 26}" width="${r.w - 8}" height="${r.h - 26}" fill="#e8dcc0"/>
            ${windows(r.x + 12, r.y + 34, 2, 2, 12, 8, "res", 0.9)}
            <rect x="${r.x + r.w / 2 - 7}" y="${r.y + r.h - 16}" width="14" height="16" fill="#5a3a2a"/>`;
    },
    hospital(r) {
        return `<rect x="${r.x}" y="${r.y + 10}" width="${r.w}" height="${r.h - 10}" fill="#d9d2c5"/>
            ${sign(r, "Больница", r.y + 18)}
            <rect x="${r.x + r.w / 2 - 8}" y="${r.y + 52}" width="16" height="42" fill="#d64545"/>
            <rect x="${r.x + r.w / 2 - 21}" y="${r.y + 65}" width="42" height="16" fill="#d64545"/>
            ${windows(r.x + 12, r.y + 56, 2, 3, 14, 10, "hospL", 0.7)}
            ${windows(r.x + r.w - 50, r.y + 56, 2, 3, 14, 10, "hospR", 0.7)}
            <rect x="${r.x + r.w / 2 - 12}" y="${r.y + r.h - 20}" width="24" height="20" fill="#7fb7ff"/>`;
    },
    fire(r) {
        return `<rect x="${r.x}" y="${r.y + 22}" width="${r.w - 36}" height="${r.h - 22}" fill="#8a3b32"/>
            <rect x="${r.x + r.w - 34}" y="${r.y}" width="30" height="${r.h}" fill="#6e2f28"/>
            ${windows(r.x + r.w - 28, r.y + 10, 1, 4, 16, 14, "tower", 0.6)}
            ${sign(r, "Пожарная часть", r.y + 28)}
            <rect x="${r.x + 12}" y="${r.y + r.h - 70}" width="${(r.w - 60) / 2}" height="70" fill="#d9c9ae"/>
            <rect x="${r.x + 20 + (r.w - 60) / 2}" y="${r.y + r.h - 70}" width="${(r.w - 60) / 2}" height="70" fill="#d9c9ae"/>
            ${[0, 1, 2, 3].map((i) => `<line x1="${r.x + 12}" y1="${r.y + r.h - 56 + i * 14}" x2="${r.x + r.w - 40}" y2="${r.y + r.h - 56 + i * 14}" stroke="#a89878" stroke-width="2"/>`).join("")}`;
    },
    school(r) {
        return `<polygon points="${r.x},${r.y + 40} ${r.x + r.w / 2},${r.y + 8} ${r.x + r.w},${r.y + 40}" fill="#7a4a32"/>
            <rect x="${r.x + 6}" y="${r.y + 40}" width="${r.w - 12}" height="${r.h - 40}" fill="#b88a5a"/>
            <circle cx="${r.x + r.w / 2}" cy="${r.y + 28}" r="10" fill="#efe6d8"/>
            <line x1="${r.x + r.w / 2}" y1="${r.y + 28}" x2="${r.x + r.w / 2}" y2="${r.y + 21}" stroke="#3a2426" stroke-width="2"/>
            <line x1="${r.x + r.w / 2}" y1="${r.y + 28}" x2="${r.x + r.w / 2 + 5}" y2="${r.y + 28}" stroke="#3a2426" stroke-width="2"/>
            ${sign(r, "Школа", r.y + 48)}
            ${windows(r.x + 16, r.y + 86, 6, 2, 16, 8, "school", 0.6)}`;
    },
    factory(r) {
        const teeth = [0, 1, 2, 3].map((i) => {
            const tx = r.x + i * ((r.w - 30) / 4);
            const tw = (r.w - 30) / 4;
            return `${tx},${r.y + 70} ${tx + tw},${r.y + 46} ${tx + tw},${r.y + 70}`;
        }).join(" ");
        const smoke = (dx, delay) => `<circle cx="${r.x + r.w - 17 + dx}" cy="${r.y + 8}" r="6" fill="#8a8494" opacity="0.6">
            <animate attributeName="cy" values="${r.y + 8};${r.y - 34}" dur="3.2s" begin="${delay}s" repeatCount="indefinite"/>
            <animate attributeName="r" values="6;16" dur="3.2s" begin="${delay}s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.6;0" dur="3.2s" begin="${delay}s" repeatCount="indefinite"/></circle>`;
        return `<polygon points="${r.x},${r.h + r.y} ${r.x},${r.y + 70} ${teeth} ${r.x + r.w - 30},${r.y + 70} ${r.x + r.w - 30},${r.y + r.h}" fill="#5a4a3e"/>
            <rect x="${r.x + r.w - 30}" y="${r.y + 60}" width="30" height="${r.h - 60}" fill="#4a3b31"/>
            <rect x="${r.x + r.w - 24}" y="${r.y + 8}" width="14" height="60" fill="#4a3b31"/>
            ${smoke(0, 0)}${smoke(3, 1.6)}
            ${sign(r, "Завод", r.y + 80)}
            ${windows(r.x + 14, r.y + 116, 5, 2, 16, 10, "factory", 0.7)}`;
    },
    shop(r) {
        const stripes = Array.from({ length: 8 }, (_, i) => `<rect x="${r.x + i * (r.w / 8)}" y="${r.y + 56}" width="${r.w / 16}" height="18" fill="#d64545"/>`).join("");
        return `<rect x="${r.x}" y="${r.y + 20}" width="${r.w}" height="${r.h - 20}" fill="#4a3f5e"/>
            ${sign(r, "Магазин", r.y + 24)}
            <rect x="${r.x}" y="${r.y + 56}" width="${r.w}" height="18" fill="#efe6d8"/>${stripes}
            <rect x="${r.x + 14}" y="${r.y + 84}" width="${r.w / 2 - 22}" height="${r.h - 104}" fill="${C.window}" opacity="0.85"/>
            <rect x="${r.x + r.w / 2 + 8}" y="${r.y + 84}" width="${r.w / 2 - 22}" height="${r.h - 104}" fill="${C.window}" opacity="0.85"/>
            <rect x="${r.x - 0}" y="${r.y + r.h / 2 + 14}" width="6" height="24" fill="${C.glow}"/>`;
    },
    army(r) {
        return `<rect x="${r.x}" y="${r.y + 20}" width="${r.w}" height="${r.h - 20}" fill="none" stroke="#6d6a5a" stroke-width="3" stroke-dasharray="8 6"/>
            <rect x="${r.x + 16}" y="${r.y + 70}" width="${r.w - 70}" height="${r.h - 90}" fill="#4a5a3e"/>
            ${windows(r.x + 26, r.y + 84, 5, 2, 14, 10, "army", 0.5)}
            <rect x="${r.x + r.w - 44}" y="${r.y + 34}" width="24" height="${r.h - 54}" fill="#5a5a48"/>
            <rect x="${r.x + r.w - 52}" y="${r.y + 26}" width="40" height="14" fill="#6d6a5a"/>
            <circle cx="${r.x + r.w - 32}" cy="${r.y + 33}" r="4" fill="${C.lamp}"><animate attributeName="opacity" values="1;0.2;1" dur="2s" repeatCount="indefinite"/></circle>
            ${sign(r, "Военная база", r.y + 32)}`;
    },
    private_gate(r) {
        const houses = [0, 1, 2].map((i) => {
            const hx = r.x + 10 + i * ((r.w - 20) / 3);
            const hw = (r.w - 20) / 3 - 10;
            const roof = ["#b8574a", "#4a6fa0", "#5a8a5a"][i];
            return `<polygon points="${hx},${r.y + 70} ${hx + hw / 2},${r.y + 48} ${hx + hw},${r.y + 70}" fill="${roof}"/>
                <rect x="${hx + 4}" y="${r.y + 70}" width="${hw - 8}" height="34" fill="#d9c9ae"/>
                <rect x="${hx + 10}" y="${r.y + 78}" width="10" height="9" fill="${i === 1 ? C.windowOff : C.window}"/>`;
        }).join("");
        // забор по верху квартала с воротами посередине (вход с улицы), дома за ним
        const gx = r.x + r.w / 2;
        return `<line x1="${r.x}" y1="${r.y + 8}" x2="${gx - 28}" y2="${r.y + 8}" stroke="#6d5c3d" stroke-width="5"/>
            <line x1="${gx + 28}" y1="${r.y + 8}" x2="${r.x + r.w}" y2="${r.y + 8}" stroke="#6d5c3d" stroke-width="5"/>
            <rect x="${gx - 34}" y="${r.y - 6}" width="8" height="26" fill="#8a7050"/>
            <rect x="${gx + 26}" y="${r.y - 6}" width="8" height="26" fill="#8a7050"/>
            <path d="M${gx - 30},${r.y - 4} Q${gx},${r.y - 22} ${gx + 30},${r.y - 4}" fill="none" stroke="#8a7050" stroke-width="4"/>
            <g transform="translate(0, 10)">${houses}</g>
            ${sign(r, "Частный сектор", r.y + r.h - 32)}`;
    },
    office(r) {
        return `<rect x="${r.x + 10}" y="${r.y + 10}" width="${r.w / 2 - 14}" height="${r.h - 10}" fill="#3a4258"/>
            <rect x="${r.x + r.w / 2 + 4}" y="${r.y + 40}" width="${r.w / 2 - 14}" height="${r.h - 40}" fill="#46506a"/>
            ${windows(r.x + 18, r.y + 20, 3, 7, 12, 8, "officeA", 0.5)}
            ${windows(r.x + r.w / 2 + 12, r.y + 50, 3, 5, 12, 8, "officeB", 0.5)}
            ${sign(r, "Деловой квартал", r.y + r.h - 30)}`;
    },
    dorm(r, number, count) {
        return `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="#4a3f5e"/>
            <rect x="${r.x - 3}" y="${r.y - 4}" width="${r.w + 6}" height="6" fill="#3a3150"/>
            ${windows(r.x + 8, r.y + 30, Math.max(2, Math.floor((r.w - 12) / 18)), Math.max(2, Math.floor((r.h - 48) / 18)), 12, 6, `dorm${number}`, 0.5)}
            <rect x="${r.x + 6}" y="${r.y + 6}" width="${r.w - 12}" height="20" rx="3" fill="${C.sign}"/>
            <text x="${r.x + r.w / 2}" y="${r.y + 21}" text-anchor="middle" font-size="14" fill="${C.signText}" font-family="Russo One, Golos Text, sans-serif">№${number} · ${count}/20</text>`;
    },
    official_house(r) {
        return `<polygon points="${r.x},${r.y + 14} ${r.x + r.w / 2},${r.y} ${r.x + r.w},${r.y + 14}" fill="#8a5a3a"/>
            <rect x="${r.x + 3}" y="${r.y + 14}" width="${r.w - 6}" height="${r.h - 14}" fill="#d9c9ae"/>
            <rect x="${r.x + r.w / 2 - 4}" y="${r.y + r.h - 10}" width="8" height="10" fill="#5a3a2a"/>`;
    },
};

function star(cx, cy, R) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
        const rr = i % 2 === 0 ? R : R * 0.45;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
    }
    return pts.join(" ");
}

function hash(s) {
    let h = 2166136261;
    const str = String(s);
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
}

function drawBuilding(code, r, ...extra) {
    const img = CITY_MAP_ASSETS.buildings[code];
    return img ? customImage(img, r) : DRAW[code](r, ...extra);
}

// ---------- Транспорт ----------
function vehicleSvg(kind) {
    const img = CITY_MAP_ASSETS.vehicles[kind];
    if (img) return `<image href="${img}" x="-22" y="-12" width="44" height="24" preserveAspectRatio="xMidYMid meet"/>`;
    const car = (body, roof = "#2a2540", extra = "") => `
        <rect x="-18" y="-10" width="36" height="20" rx="5" fill="${body}"/>
        <rect x="-6" y="-8" width="12" height="16" rx="2" fill="${roof}"/>
        <circle cx="18" cy="-6" r="2.4" fill="#fff7d6"/><circle cx="18" cy="6" r="2.4" fill="#fff7d6"/>
        <rect x="-18" y="-8" width="3" height="4" fill="#ff5a5f"/><rect x="-18" y="4" width="3" height="4" fill="#ff5a5f"/>${extra}`;
    switch (kind) {
    case "taxi":
        return car("#f2c230", "#2a2540", `<rect x="-3" y="-13" width="6" height="4" fill="#2a2540"/>`);
    case "police":
        return car("#e8ecf5", "#2a3552", `<rect x="-5" y="-3" width="4" height="6" fill="#ff4d4d"><animate attributeName="fill" values="#ff4d4d;#3d7bff;#ff4d4d" dur="0.5s" repeatCount="indefinite"/></rect>
            <rect x="1" y="-3" width="4" height="6" fill="#3d7bff"><animate attributeName="fill" values="#3d7bff;#ff4d4d;#3d7bff" dur="0.5s" repeatCount="indefinite"/></rect>`);
    case "doctor":
        return `<rect x="-22" y="-11" width="44" height="22" rx="4" fill="#f4f1ea"/>
            <rect x="-2" y="-8" width="4" height="16" fill="#d64545"/><rect x="-8" y="-2" width="16" height="4" fill="#d64545"/>
            <rect x="12" y="-9" width="8" height="18" rx="2" fill="#2a2540"/>
            <circle cx="22" cy="-7" r="2.4" fill="#fff7d6"/><circle cx="22" cy="7" r="2.4" fill="#fff7d6"/>
            <rect x="-4" y="-14" width="8" height="4" fill="#ff4d4d"><animate attributeName="fill" values="#ff4d4d;#3d7bff;#ff4d4d" dur="0.5s" repeatCount="indefinite"/></rect>`;
    case "firefighter":
        return `<rect x="-24" y="-11" width="48" height="22" rx="3" fill="#c8362d"/>
            <rect x="-16" y="-3" width="26" height="6" fill="#d9d2c5"/>
            <rect x="12" y="-9" width="9" height="18" rx="2" fill="#2a2540"/>
            <circle cx="24" cy="-7" r="2.4" fill="#fff7d6"/><circle cx="24" cy="7" r="2.4" fill="#fff7d6"/>`;
    case "courier":
        return `<rect x="-12" y="-5" width="24" height="10" rx="4" fill="#5ecfa0"/>
            <rect x="-14" y="-9" width="12" height="18" rx="2" fill="${C.glow}"/>
            <circle cx="12" cy="0" r="2.4" fill="#fff7d6"/>`;
    case "teacher":
        return `<circle cx="0" cy="0" r="8" fill="#b9b3c9"/><circle cx="3" cy="0" r="3.5" fill="#efe6d8"/>`;
    default:
        return car("#7fb7ff");
    }
}

// ---------- Экран ----------
let movementPoll = null;
const seenMovements = new Set();

function stopPolling() {
    if (movementPoll) { clearInterval(movementPoll); movementPoll = null; }
}

export async function renderNewCityMap(overlay, helpers) {
    stopPolling();
    seenMovements.clear();
    let map, movements;
    try {
        [map, movements] = await Promise.all([apiFetch("/api/map"), apiFetch("/api/map/movements")]);
    } catch (e) {
        overlay.innerHTML = `<div class="error">${e.message}</div><button class="btn" id="map-close-err">Закрыть</button>`;
        overlay.querySelector("#map-close-err").onclick = () => overlay.remove();
        return;
    }

    overlay.innerHTML = `
        <div class="map-fullscreen-header">
            <div class="map-fullscreen-title">🗺 Карта города</div>
            <button class="btn btn-secondary" id="map-close-btn">✕ Закрыть карту</button>
        </div>
        <div class="map-svg-wrap city-map-wrap" id="map-svg-wrap"></div>
        <div class="map-legend">Нажимай на здания, общаги и машины — узнаешь подробности. Машины едут по улицам от двери до двери.</div>
    `;
    overlay.querySelector("#map-close-btn").onclick = () => { stopPolling(); overlay.remove(); };

    // Здания и их двери
    const places = {};
    const objects = [];
    let svgBody = "";

    BUILDINGS.forEach((b) => {
        let r = cellRect(b.cell[0], b.cell[1]);
        if (b.code === "government") {
            r = { ...r, w: map.president_residence ? r.w - 56 : r.w };
        }
        const pts = doorPoints(r, b.door);
        b.labels.forEach((l) => { places[l] = pts; });
        places[b.code] = pts;
        const idx = objects.push({ kind: "building", b }) - 1;
        svgBody += `<g class="city-obj" data-obj="${idx}">${drawBuilding(b.code, r)}</g>`;
    });

    // Резиденция президента и дома чиновников — рядом с Гос. управлением
    const gov = cellRect(1, 0);
    if (map.president_residence) {
        const rr = { x: gov.x + gov.w - 48, y: gov.y + 60, w: 48, h: 64 };
        const idx = objects.push({ kind: "person", person: map.president_residence, title: "Резиденция Президента" }) - 1;
        svgBody += `<g class="city-obj" data-obj="${idx}">${drawBuilding("residence", rr)}</g>`;
    }
    map.official_houses.slice(0, 5).forEach((p, i) => {
        const rr = { x: COLS[1][0] + 1, y: ROWS[0][0] + 26 + i * 29, w: 18, h: 24 };
        const idx = objects.push({ kind: "person", person: p, title: p.role }) - 1;
        svgBody += `<g class="city-obj" data-obj="${idx}">${drawBuilding("official_house", rr)}</g>`;
    });

    // Общаги — в двух средних кварталах, двери на ближайшую улицу
    const dormBlocks = [cellRect(1, 1, 16), cellRect(1, 2, 16)];
    const dorms = map.dormitories;
    const perBlock = Math.max(1, Math.ceil(dorms.length / 2));
    dorms.forEach((dorm, i) => {
        const blk = dormBlocks[Math.floor(i / perBlock)] || dormBlocks[1];
        const j = i % perBlock;
        const cols = perBlock > 1 ? 2 : 1;
        const rowsN = Math.ceil(perBlock / cols);
        const gap = 12;
        const dw = (blk.w - gap * (cols - 1)) / cols;
        const dh = (blk.h - gap * (rowsN - 1)) / rowsN;
        const r = { x: blk.x + (j % cols) * (dw + gap), y: blk.y + Math.floor(j / cols) * (dh + gap), w: dw, h: dh };
        const side = Math.floor(j / cols) < rowsN / 2 ? "top" : "bottom";
        places[`dorm-${dorm.number}`] = doorPoints(r, side);
        const idx = objects.push({ kind: "dorm", dorm }) - 1;
        svgBody += `<g class="city-obj" data-obj="${idx}">${drawBuilding("dorm", r, dorm.number, dorm.residents.length)}</g>`;
    });

    const wrap = overlay.querySelector("#map-svg-wrap");
    wrap.innerHTML = `
        <svg viewBox="0 0 ${W} ${H}" class="map-svg city-map-svg" id="map-svg-root">
            ${groundSvg()}
            ${svgBody}
            <g id="city-vehicles"></g>
        </svg>`;

    wrap.querySelectorAll(".city-obj").forEach((g) => {
        const o = objects[Number(g.dataset.obj)];
        g.addEventListener("click", () => {
            if (o.kind === "building" && o.b.code === "private_gate") renderPrivateSector(overlay, helpers);
            else if (o.kind === "building") showBuildingInfo(o.b, helpers, overlay);
            else if (o.kind === "dorm") helpers.showDormPeople(overlay, o.dorm);
            else if (o.kind === "person") helpers.showPublicProfile(overlay, o.person.vk_id);
        });
    });

    const resolve = (label, mv) => {
        if (places[label]) return places[label];
        if (label === "Общежитие") {
            const mine = dorms.find((d) => d.residents.some((p) => p.vk_id === mv.vk_id));
            const d = mine || dorms[hash(mv.vk_id) % Math.max(1, dorms.length)];
            if (d && places[`dorm-${d.number}`]) return places[`dorm-${d.number}`];
            return places.private_gate;
        }
        return places.office;
    };

    const spawn = (list) => list.forEach((mv) => {
        if (seenMovements.has(mv.id)) return;
        seenMovements.add(mv.id);
        driveVehicle(wrap, mv, resolve(mv.from_label, mv), resolve(mv.to_label, mv), helpers, overlay);
    });
    spawn(movements);

    // Новые поездки подхватываются раз в 10 секунд; каждая машина едет один раз
    movementPoll = setInterval(async () => {
        if (!overlay.isConnected) { stopPolling(); return; }
        try { spawn(await apiFetch("/api/map/movements")); } catch (e) { /* подождём следующего раза */ }
    }, 10000);
}

function groundSvg() {
    const bg = CITY_MAP_ASSETS.background ? `<image href="${CITY_MAP_ASSETS.background}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>` : "";
    if (CITY_MAP_ASSETS.hideDrawnGround) return bg || `<rect width="${W}" height="${H}" fill="${C.ground}"/>`;
    let s = `<rect width="${W}" height="${H}" fill="${C.ground}"/>${bg}`;
    COLS.forEach(([x0, x1]) => ROWS.forEach(([y0, y1]) => {
        s += `<rect x="${x0 + 4}" y="${y0 + 4}" width="${x1 - x0 - 8}" height="${y1 - y0 - 8}" rx="6" fill="${C.block}"/>`;
    }));
    // деревья в углах кварталов
    COLS.forEach(([x0, x1], ci) => ROWS.forEach(([y0, y1], ri) => {
        const tx = (ci + ri) % 2 ? x0 + 14 : x1 - 14;
        const ty = y1 - 14;
        s += `<circle cx="${tx}" cy="${ty}" r="9" fill="${C.treeDark}"/><circle cx="${tx - 2}" cy="${ty - 2}" r="6" fill="${C.tree}"/>`;
    }));
    H_STREETS.forEach((y) => {
        s += `<rect x="0" y="${y - ROAD / 2 - 5}" width="${W}" height="${ROAD + 10}" fill="${C.walk}"/>`;
    });
    V_STREETS.forEach((x) => {
        s += `<rect x="${x - ROAD / 2 - 5}" y="0" width="${ROAD + 10}" height="${H}" fill="${C.walk}"/>`;
    });
    H_STREETS.forEach((y) => {
        s += `<rect x="0" y="${y - ROAD / 2}" width="${W}" height="${ROAD}" fill="${C.road}"/>`;
    });
    V_STREETS.forEach((x) => {
        s += `<rect x="${x - ROAD / 2}" y="0" width="${ROAD}" height="${H}" fill="${C.road}"/>`;
    });
    H_STREETS.forEach((y) => {
        s += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${C.dash}" stroke-width="2" stroke-dasharray="14 12"/>`;
    });
    V_STREETS.forEach((x) => {
        s += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${C.dash}" stroke-width="2" stroke-dasharray="14 12"/>`;
    });
    // перекрёстки: чистый асфальт + зебры + фонари
    V_STREETS.forEach((x) => H_STREETS.forEach((y) => {
        s += `<rect x="${x - ROAD / 2}" y="${y - ROAD / 2}" width="${ROAD}" height="${ROAD}" fill="${C.road}"/>`;
        for (let i = 0; i < 5; i++) {
            s += `<rect x="${x - 16 + i * 7}" y="${y - ROAD / 2 - 12}" width="4" height="10" fill="#5a5470"/>`;
            s += `<rect x="${x - 16 + i * 7}" y="${y + ROAD / 2 + 2}" width="4" height="10" fill="#5a5470"/>`;
        }
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dy]) => {
            const lx = x + dx * (ROAD / 2 + 12);
            const ly = y + dy * (ROAD / 2 + 12);
            s += `<circle cx="${lx}" cy="${ly}" r="16" fill="${C.glow}" opacity="0.1"/><circle cx="${lx}" cy="${ly}" r="3.5" fill="${C.lamp}"/>`;
        });
    }));
    return s;
}

function driveVehicle(wrap, mv, from, to, helpers, overlay) {
    const layer = wrap.querySelector("#city-vehicles");
    if (!layer || !from || !to) return;
    const route = shortestRoute(from.curb, to.curb);
    const pts = [from.door, ...route, to.door];
    const d = "M" + pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L");
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    const dur = Math.min(14, Math.max(4, len / 110));
    const isWalker = mv.kind === "teacher";

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "city-vehicle");
    g.innerHTML = `
        <animateMotion dur="${dur.toFixed(2)}s" begin="indefinite" fill="freeze" ${isWalker ? "" : `rotate="auto"`} path="${d}" />
        ${vehicleSvg(mv.kind)}`;
    g.addEventListener("click", () => showMovementInfo(mv, helpers, overlay));
    layer.appendChild(g);
    const anim = g.querySelector("animateMotion");
    if (anim && anim.beginElement) anim.beginElement();

    // доехал — постоял у двери и исчез
    setTimeout(() => {
        g.style.transition = "opacity 0.8s";
        g.style.opacity = "0";
        setTimeout(() => g.remove(), 900);
    }, (dur + 1.2) * 1000);
}

function showMovementInfo(mv, helpers, overlay) {
    showGamePopupWithContent(`${mv.icon} В пути`, (content) => {
        content.innerHTML = `<div class="profile-row">${escapeHtml(mv.message)}</div>
            <div class="profile-dim">${escapeHtml(mv.from_label)} → ${escapeHtml(mv.to_label)}</div>`;
        const btn = document.createElement("button");
        btn.className = "btn";
        btn.style.marginTop = "10px";
        btn.textContent = "👤 Открыть профиль";
        btn.onclick = () => helpers.showPublicProfile(overlay, mv.vk_id);
        content.appendChild(btn);
    });
}

function showBuildingInfo(b, helpers, overlay) {
    showGamePopupWithContent(b.title, async (content) => {
        content.innerHTML = `<div class="profile-dim" style="margin-bottom:10px">${escapeHtml(b.info)}</div><div class="loading">Загружаем сводку…</div>`;
        let st;
        try {
            st = await apiFetch(`/api/map/building/${b.code}`);
        } catch (e) {
            content.querySelector(".loading").outerHTML = `<div class="error">${escapeHtml(e.message)}</div>`;
            return;
        }
        content.querySelector(".loading").outerHTML = `<div class="building-stats">${buildingStatsHtml(st)}</div>`;
        content.querySelectorAll("[data-person]").forEach((el) => {
            el.onclick = () => helpers.showPublicProfile(overlay, Number(el.dataset.person));
        });
    });
}

const money = (n) => `${Number(n || 0).toFixed(2)} ₭`;
const person = (p) => p ? `<button class="building-person" data-person="${p.vk_id}">${escapeHtml(p.username ? "@" + p.username : "ID " + p.vk_id)}</button>` : "пока никто";
const row = (icon, label, value) => `<div class="building-stat-row"><span>${icon} ${label}</span><b>${value}</b></div>`;

function buildingStatsHtml(st) {
    if (st.kind === "profession") {
        return [
            row("👥", `Работают (${escapeHtml(st.profession_name)})`, `${st.workers}${st.students ? ` + ${st.students} стаж.` : ""}`),
            row("✅", "Выполнено заявок", `${st.done_total}`),
            row("📅", "Выполнено сегодня", `${st.done_today} из ${st.requests_today}`),
            st.code === "police" ? row("🚔", "Поймано воров", `${st.thieves_caught}`) : "",
            row("💰", "Налоги в казну от вызовов", money(st.taxes)),
            `<div class="building-stat-row"><span>🏅 Последним справился</span>${person(st.last_worker)}</div>`,
        ].join("");
    }
    if (st.kind === "factory") {
        const recent = st.recent.length
            ? st.recent.map((r) => `<div class="building-stat-row"><span>📦 ${escapeHtml(r.item_name)}</span>${person(r)}</div>`).join("")
            : `<div class="profile-dim">Пока ничего не произведено.</div>`;
        const top = st.top.length
            ? st.top.map((r, i) => `<div class="building-stat-row"><span>${["🥇", "🥈", "🥉", "4.", "5."][i]} ${person(r)}</span><b>${r.count} шт.</b></div>`).join("")
            : `<div class="profile-dim">Рейтинг появится после первых смен.</div>`;
        return row("👷", "Работают на заводе", `${st.workers}`)
            + `<div class="building-stat-title">Последние 5 товаров</div>${recent}`
            + `<div class="building-stat-title">Лучшие сотрудники</div>${top}`;
    }
    if (st.kind === "shop") {
        return row("🛍", "Продано сегодня", `${st.sold_today}`) + row("📈", "Продано за всё время", `${st.sold_total}`);
    }
    if (st.kind === "army") {
        return row("🎖", "Служат по контракту", `${st.soldiers}`);
    }
    if (st.kind === "government") {
        return [
            row("🏛", "Страна", escapeHtml(st.country_name)),
            `<div class="building-stat-row"><span>🎖 Президент</span>${person(st.president)}</div>`,
            row("💰", "Казна", money(st.treasury)),
            row("📊", "Налог", `${(st.tax_rate * 100).toFixed(1)}%`),
            row("👥", "Жителей", `${st.population}`),
            row("🕶", "Воров", `${st.criminals}`),
        ].join("");
    }
    return "";
}

// ---------- Частный сектор ----------
const PS_PER_ROW = 4;
const PLOT_W = 150;
const PLOT_H = 130;

async function renderPrivateSector(overlay, helpers) {
    stopPolling();
    overlay.innerHTML = `<div class="loading">Загружаем частный сектор…</div>`;
    let data;
    try {
        data = await apiFetch("/api/map/private_sector");
    } catch (e) {
        overlay.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }
    overlay.innerHTML = `
        <div class="map-fullscreen-header">
            <div class="map-fullscreen-title">🏘 Частный сектор</div>
            <button class="btn btn-secondary" id="map-back-btn">← Назад на карту города</button>
        </div>
        <div class="map-svg-wrap city-map-wrap" id="map-svg-wrap"></div>
        <div class="map-legend">Нажми на дом — откроется профиль владельца. Свободные участки ждут новых хозяев.</div>`;
    overlay.querySelector("#map-back-btn").onclick = () => renderNewCityMap(overlay, helpers);

    const houses = data.houses;
    const totalPlots = Math.max(8, Math.ceil((houses.length + 2) / PS_PER_ROW) * PS_PER_ROW);
    const rows = totalPlots / PS_PER_ROW;
    const groups = Math.ceil(rows / 2);
    const groupH = PLOT_H * 2 + 70;
    const viewH = groups * groupH + 30;
    const marginX = (W - PS_PER_ROW * PLOT_W) / 2;

    let s = `<rect width="${W}" height="${viewH}" fill="${C.ground}"/>`;
    if (CITY_MAP_ASSETS.privateSectorBackground) {
        s += `<image href="${CITY_MAP_ASSETS.privateSectorBackground}" x="0" y="0" width="${W}" height="${viewH}" preserveAspectRatio="xMidYMid slice"/>`;
    }
    for (let gi = 0; gi < groups; gi++) {
        const roadY = 20 + gi * groupH + PLOT_H + 35;
        s += `<rect x="0" y="${roadY - 25}" width="${W}" height="50" fill="${C.walk}"/>
              <rect x="0" y="${roadY - 20}" width="${W}" height="40" fill="${C.road}"/>
              <line x1="0" y1="${roadY}" x2="${W}" y2="${roadY}" stroke="${C.dash}" stroke-width="2" stroke-dasharray="14 12"/>`;
        for (let k = 0; k <= PS_PER_ROW; k++) {
            const lx = marginX + k * PLOT_W;
            s += `<circle cx="${lx}" cy="${roadY - 28}" r="14" fill="${C.glow}" opacity="0.1"/><circle cx="${lx}" cy="${roadY - 28}" r="3" fill="${C.lamp}"/>`;
        }
    }

    const plots = [];
    for (let i = 0; i < totalPlots; i++) {
        const row = Math.floor(i / PS_PER_ROW);
        const col = i % PS_PER_ROW;
        const gi = Math.floor(row / 2);
        const top = row % 2 === 0;
        const x = marginX + col * PLOT_W + 8;
        const y = 20 + gi * groupH + (top ? 0 : PLOT_H + 70);
        plots.push({ x, y, w: PLOT_W - 16, h: PLOT_H - 10, top, house: houses[i] || null });
    }
    plots.forEach((p, i) => {
        s += `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="4" fill="${C.block}"/>`;
        if (!p.house) {
            s += `<rect x="${p.x + 10}" y="${p.y + 10}" width="${p.w - 20}" height="${p.h - 40}" rx="4" fill="none" stroke="#6d5c3d" stroke-width="2" stroke-dasharray="6 6"/>
                  <text x="${p.x + p.w / 2}" y="${p.y + p.h / 2 - 6}" text-anchor="middle" font-size="15" fill="#b9b3c9">продаётся</text>`;
            return;
        }
        s += `<g class="city-obj" data-house="${i}">${houseSvg(p)}
              <rect x="${p.x + 10}" y="${p.y + p.h - 24}" width="${p.w - 20}" height="20" rx="3" fill="${C.sign}"/>
              <text x="${p.x + p.w / 2}" y="${p.y + p.h - 9}" text-anchor="middle" font-size="13" fill="${C.signText}">${escapeHtml(p.house.username ? "@" + p.house.username : "ID " + p.house.vk_id)}</text></g>`;
    });

    const wrap = overlay.querySelector("#map-svg-wrap");
    wrap.innerHTML = `<svg viewBox="0 0 ${W} ${viewH}" class="map-svg city-map-svg">${s}</svg>`;
    wrap.querySelectorAll("[data-house]").forEach((g) => {
        const p = plots[Number(g.dataset.house)];
        g.addEventListener("click", () => helpers.showPublicProfile(overlay, p.house.vk_id));
    });
}

function houseSvg(p) {
    const area = { x: p.x + 10, y: p.y + 6, w: p.w - 20, h: p.h - 34 };
    if (p.house.house_skin) {
        return `<image href="assets/houses/${p.house.house_skin}.png" x="${area.x}" y="${area.y}" width="${area.w}" height="${area.h}" preserveAspectRatio="xMidYMid meet"/>`;
    }
    if (CITY_MAP_ASSETS.defaultHouse) return customImage(CITY_MAP_ASSETS.defaultHouse, area);
    const h = hash(p.house.vk_id);
    const roof = ["#b8574a", "#4a6fa0", "#5a8a5a", "#8a5aa0", "#a0784a"][h % 5];
    const wall = ["#d9c9ae", "#e8e2d8", "#c9b8a0", "#d8cfc0"][(h >> 3) % 4];
    const hw = area.w * (0.7 + ((h >> 5) % 3) * 0.1);
    const hx = area.x + (area.w - hw) / 2;
    const roofTop = area.y + 4;
    const wallTop = area.y + area.h * 0.42;
    const chimney = (h >> 7) % 2 ? `<rect x="${hx + hw * 0.7}" y="${roofTop + 6}" width="10" height="20" fill="#6e4a3a"/>` : "";
    const litA = (h >> 9) % 3 !== 0;
    const litB = (h >> 11) % 2 === 0;
    return `${chimney}<polygon points="${hx - 6},${wallTop} ${hx + hw / 2},${roofTop} ${hx + hw + 6},${wallTop}" fill="${roof}"/>
        <rect x="${hx}" y="${wallTop}" width="${hw}" height="${area.y + area.h - wallTop}" fill="${wall}"/>
        <rect x="${hx + 10}" y="${wallTop + 10}" width="16" height="13" fill="${litA ? C.window : C.windowOff}"/>
        <rect x="${hx + hw - 26}" y="${wallTop + 10}" width="16" height="13" fill="${litB ? C.window : C.windowOff}"/>
        <rect x="${hx + hw / 2 - 8}" y="${area.y + area.h - 22}" width="16" height="22" fill="#5a3a2a"/>`;
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str ?? "");
    return div.innerHTML;
}
