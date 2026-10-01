// Карта города в перспективе «три четверти»: улицы рядами слева направо,
// здания стоят к нам фасадом, видна крыша и боковая стена к центру,
// дальние ряды чуть меньше. Время суток — по часам игрока. На улицах только
// настоящие поездки игроков. Логика мира (кварталы, улицы, маршруты) — своя
// копия, как у изометрии, чтобы не зависеть от версий соседних файлов в кэше.
import { apiFetch } from "../api.js";
import { CITY_MAP_ASSETS } from "../cityMapAssets.js";
import { showGamePopupWithContent } from "../gamePopup.js";

// ---------- логика мира (своя копия, чтобы не зависеть от версии cityMap.js в кэше браузера) ----------
const W = 700;
export const H = 1000;
export const ROAD = 40;
export const V_STREETS = [233, 467];
export const H_STREETS = [200, 480, 760];
export const COLS = [[0, 213], [253, 447], [487, 700]];
export const ROWS = [[0, 180], [220, 460], [500, 740], [780, 1000]];



function cellRect(col, row, pad = 20) {
    const [x0, x1] = COLS[col];
    const [y0, y1] = ROWS[row];
    return { x: x0 + pad, y: y0 + pad, w: x1 - x0 - pad * 2, h: y1 - y0 - pad * 2 };
}



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



function hash(s) {
    let h = 2166136261;
    const str = String(s);
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
}



function showMovementInfo(mv, helpers, overlay) {
    if (mv.anonymous) {
        showGamePopupWithContent("🕶 Кто-то в капюшоне", (content) => {
            content.innerHTML = `<div class="profile-row">${escapeHtml(mv.message)}</div>
                <div class="profile-dim">Лица не разглядеть. Если жертва узнает вора — сможет заявить в полицию.</div>`;
        });
        return;
    }
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

export function showBuildingInfo(b, helpers, overlay) {
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
            st.code === "police" ? row("💰", "Подкуплено полицейских", `${st.bribes_accepted ?? 0}`) : "",
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



// ---------- проекция «три четверти»: ряды по горизонтали, дальние меньше ----------
const SKY = 150;           // полоса неба с силуэтом далёкого города
const PAD = 30;
const VW = W + PAD * 2;
const DEPTH = 0.62;        // насколько «сплющена» земля
const NEAR = 1.0, FAR = 0.8;
const sAt = (y) => FAR + (NEAR - FAR) * (y / H);
const yAt = (y) => SKY + DEPTH * (FAR * y + (NEAR - FAR) * y * y / (2 * H));
const VH = Math.ceil(yAt(H) + 70);
const CX = VW / 2;
const ZK = 0.6;            // высоты зданий ниже, чтобы ряды позади было видно
const P = (x, y, z = 0) => { const s = sAt(y); return [CX + (x - W / 2) * s, yAt(y) - z * ZK * s]; };
const pts = (arr) => arr.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
const quad = (a, b, c, d, fill, extra = "") => `<polygon points="${pts([a, b, c, d])}" fill="${fill}" ${extra}/>`;
const tile = (x, y, w, h, fill, extra = "") => quad(P(x, y), P(x + w, y), P(x + w, y + h), P(x, y + h), fill, extra);

// ---------- время суток (по часам игрока) ----------
// dark — насколько всё темнеет, lit — доля горящих окон, lamps — какие фонари горят
const PHASES = {
    dawn: { name: "Рассвет", dark: 0.18, lit: 0.15, lamps: "none", sky: ["#f3b28a", "#9db6d8"], far: "#7a7a9a" },
    day: { name: "День", dark: 0, lit: 0.05, lamps: "none", sky: ["#8fbde6", "#d6e7f4"], far: "#8aa0b8" },
    dusk: { name: "Закат", dark: 0.22, lit: 0.28, lamps: "all", sky: ["#e98a5a", "#7a5a8a"], far: "#5a4a6a" },
    evening: { name: "Вечер", dark: 0.45, lit: 0.72, lamps: "all", sky: ["#3a2f5a", "#1d1a33"], far: "#2a2440" },
    night: { name: "Ночь", dark: 0.62, lit: 0.08, lamps: "central", sky: ["#0f0d1c", "#1a1830"], far: "#1d1a2b" },
};

export function phaseFor(date = new Date()) {
    const h = date.getHours() + date.getMinutes() / 60;
    if (h >= 6 && h < 8) return "dawn";
    if (h >= 8 && h < 17) return "day";
    if (h >= 17 && h < 19) return "dusk";
    if (h >= 19 && h < 23) return "evening";
    return "night";
}

const NIGHT = [26, 24, 48];
function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v, i) => Math.round(v + (NIGHT[i] - v) * k));
    return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// ---------- примитивы ----------
let PH = PHASES.day;
const T = (hex) => shade(hex, PH.dark);

function box(x, y, w, h, Hh, c, z0 = 0) {
    const top = [P(x, y, Hh), P(x + w, y, Hh), P(x + w, y + h, Hh), P(x, y + h, Hh)];
    const front = [P(x, y + h, z0), P(x + w, y + h, z0), P(x + w, y + h, Hh), P(x, y + h, Hh)];
    // видна та боковая стена, что смотрит к центру
    const leftOfCenter = x + w / 2 < W / 2;
    const sx = leftOfCenter ? x + w : x;
    const side = [P(sx, y, z0), P(sx, y + h, z0), P(sx, y + h, Hh), P(sx, y, Hh)];
    return `<polygon points="${pts(side)}" fill="${T(c.side)}"/><polygon points="${pts(front)}" fill="${T(c.front)}"/><polygon points="${pts(top)}" fill="${T(c.top)}"/>`;
}

// двускатная крыша с коньком вдоль x
function gable(x, y, w, h, Hh, peak, color, dark) {
    const back = [P(x, y, Hh), P(x + w, y, Hh), P(x + w, y + h / 2, Hh + peak), P(x, y + h / 2, Hh + peak)];
    const fr = [P(x, y + h / 2, Hh + peak), P(x + w, y + h / 2, Hh + peak), P(x + w, y + h, Hh), P(x, y + h, Hh)];
    return `<polygon points="${pts(back)}" fill="${T(dark)}"/><polygon points="${pts(fr)}" fill="${T(color)}"/>`;
}

function windowsFront(x, y, w, h, Hh, cols, rows, seed, z0 = 0, margin = 0.12) {
    let out = "";
    const fy = y + h;
    const cw = (w * (1 - margin * 2)) / cols;
    const rh = (Hh - z0 - 14) / rows;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const wx = x + w * margin + c * cw + cw * 0.2;
            const wz = Hh - 8 - r * rh - rh * 0.2;
            const ww = cw * 0.6, wh = rh * 0.55;
            const t = (hash(`${seed}-${r}-${c}`) % 1000) / 1000;
            const lit = t < PH.lit;
            out += quad(P(wx, fy, wz), P(wx + ww, fy, wz), P(wx + ww, fy, wz - wh), P(wx, fy, wz - wh), lit ? "#f2c46a" : T("#3a4458"), lit ? 'class="v-lit"' : "");
        }
    }
    return out;
}

function windowsSide(x, y, w, h, Hh, cols, rows, seed) {
    const leftOfCenter = x + w / 2 < W / 2;
    const sx = leftOfCenter ? x + w : x;
    let out = "";
    const cw = (h * 0.8) / cols;
    const rh = (Hh - 14) / rows;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const wy = y + h * 0.1 + c * cw + cw * 0.2;
            const wz = Hh - 8 - r * rh - rh * 0.2;
            const t = (hash(`${seed}s-${r}-${c}`) % 1000) / 1000;
            const lit = t < PH.lit;
            out += quad(P(sx, wy, wz), P(sx, wy + cw * 0.6, wz), P(sx, wy + cw * 0.6, wz - rh * 0.55), P(sx, wy, wz - rh * 0.55), lit ? "#f2c46a" : T("#2f3848"));
        }
    }
    return out;
}

function frontSign(x, y, w, h, z, text, opts = {}) {
    const [ox, oy] = P(x, y + h, z);
    const s = sAt(y + h);
    const len = Math.min(w - 10, text.length * 8.5 + 22);
    const fs = Math.min(12, (len - 10) / (text.length * 0.62));
    return `<g transform="matrix(${s.toFixed(3)},0,0,${s.toFixed(3)},${ox.toFixed(1)},${oy.toFixed(1)})">
        <rect x="${(w - len) / 2}" y="0" width="${len}" height="17" rx="3" fill="${opts.bg || "#3a2426"}" stroke="${opts.stroke || "#f2a24a"}" stroke-width="1.2"/>
        <text x="${w / 2}" y="12.5" text-anchor="middle" font-size="${fs.toFixed(1)}" fill="${opts.fg || "#ffe3bd"}" font-family="Russo One, Golos Text, sans-serif">${text}</text></g>`;
}

function frontDoor(x, y, w, h, color = "#6b3f22") {
    const dx = x + w / 2 - 8;
    return quad(P(dx, y + h, 0), P(dx + 16, y + h, 0), P(dx + 16, y + h, 20), P(dx, y + h, 20), T(color)) +
        quad(P(dx + 2, y + h, 18), P(dx + 14, y + h, 18), P(dx + 14, y + h, 12), P(dx + 2, y + h, 12), PH.lit > 0.2 ? "#f2c46a" : T("#8a7a6a"));
}

function roofKit(x, y, w, h, Hh, opts = {}) {
    let s = "";
    if (opts.ac !== false) {
        s += box(x + w * 0.2, y + h * 0.25, 16, 12, Hh + 8, { top: "#b8bcc6", front: "#8a909e", side: "#6f7482" }, Hh);
        s += box(x + w * 0.6, y + h * 0.3, 12, 12, Hh + 6, { top: "#b8bcc6", front: "#8a909e", side: "#6f7482" }, Hh);
    }
    if (opts.tank) s += box(x + w * 0.4, y + h * 0.4, 18, 14, Hh + 20, { top: "#a0704a", front: "#8a5a3a", side: "#6e4a2a" }, Hh + 4);
    return s;
}

function flag(x, y, z, color) {
    const [fx, fy] = P(x, y, z);
    return `<rect x="${fx - 1}" y="${fy - 30}" width="2" height="30" fill="${T("#c8c0b0")}"/><rect class="iso-flag" x="${fx + 1}" y="${fy - 30}" width="18" height="11" fill="${color}"/>`;
}

function tree(x, y) {
    const [sx, sy] = P(x, y);
    const s = sAt(y);
    return `<g transform="translate(${sx.toFixed(1)},${sy.toFixed(1)}) scale(${s.toFixed(2)})"><ellipse rx="12" ry="5" fill="#000" opacity=".22"/>
        <rect x="-2" y="-16" width="4" height="16" fill="${T("#6a4a32")}"/>
        <circle cy="-26" r="13" fill="${T("#3f7a4a")}"/><circle cx="-4" cy="-30" r="8" fill="${T("#5a9a5a")}"/></g>`;
}

function lampAt(x, y, on) {
    const [sx, sy] = P(x, y);
    const s = sAt(y);
    return `<g transform="translate(${sx.toFixed(1)},${sy.toFixed(1)}) scale(${s.toFixed(2)})">
        ${on ? `<ellipse rx="30" ry="12" fill="#f2c46a" opacity=".22"/>` : ""}
        <rect x="-1.5" y="-36" width="3" height="36" fill="${T("#55566a")}"/><rect x="-6" y="-39" width="12" height="4" rx="2" fill="${T("#6d6a5a")}"/>
        <circle cy="-35" r="3.2" fill="${on ? "#ffe0a0" : T("#9a9aa8")}" ${on ? 'class="v-lamp"' : ""}/></g>`;
}

const PAL = {
    police: { top: "#5a6a8e", front: "#3f4f72", side: "#33405e" },
    hospital: { top: "#f4efe6", front: "#e2dbcf", side: "#c9c2b5" },
    fire: { top: "#b45a50", front: "#9a4038", side: "#7e342e" },
    school: { top: "#d8aa78", front: "#c8945e", side: "#a87a4c" },
    factory: { top: "#7a6a5c", front: "#62524a", side: "#4e413a" },
    shop: { top: "#7a6a92", front: "#5a4f72", side: "#4a405e" },
    army: { top: "#6a7a5c", front: "#52624a", side: "#43503c" },
    office: { top: "#7a88a8", front: "#5a6888", side: "#4a5672" },
    gov: { top: "#efe8da", front: "#d9d1c0", side: "#bfb7a6" },
    dorm: { top: "#7a6a8e", front: "#5e4f74", side: "#4c405e" },
    house: { top: "#efe2c6", front: "#e0d0b0", side: "#c4b494" },
};

function drawBuilding(code, r, extra = {}) {
    const img = CITY_MAP_ASSETS.buildings[code];
    if (img) {
        const [lx, by] = P(r.x, r.y + r.h), [rx] = P(r.x + r.w, r.y + r.h), [, ty] = P(r.x, r.y, 120);
        return `<image href="${img}" x="${lx}" y="${ty}" width="${rx - lx}" height="${by - ty}" preserveAspectRatio="xMidYMax meet"/>`;
    }
    // Здание стоит у передней улицы и имеет разумную глубину — позади двор,
    // иначе дома превращаются в длинные плиты и закрывают ряды позади
    const MAX_DEPTH = 112;
    let { x, y, w, h } = r;
    if (!["army", "private_gate"].includes(code) && h > MAX_DEPTH) { y += h - MAX_DEPTH; h = MAX_DEPTH; }
    let s = "";
    switch (code) {
    case "police": {
        const Hh = 74;
        s += box(x, y, w, h, Hh, PAL.police) + roofKit(x, y, w, h, Hh) + windowsFront(x, y, w, h, Hh, 6, 2, "pol") + windowsSide(x, y, w, h, Hh, 4, 2, "pol");
        const [bx, by] = P(x + w / 2, y + h / 2, Hh);
        s += `<rect x="${bx - 14}" y="${by - 8}" width="10" height="7" rx="2" class="iso-siren-red"/><rect x="${bx + 4}" y="${by - 8}" width="10" height="7" rx="2" class="iso-siren-blue"/>`;
        return s + frontSign(x, y, w, h, Hh - 4, "ПОЛИЦИЯ", { bg: "#1d2640", fg: "#dfe8ff" }) + frontDoor(x, y, w, h, "#1d2640");
    }
    case "hospital": {
        const Hh = 70;
        s += box(x, y, w, h, Hh, PAL.hospital) + windowsFront(x, y, w, h, Hh, 6, 2, "hos") + windowsSide(x, y, w, h, Hh, 4, 2, "hos");
        const [cx, cy] = P(x + w / 2, y + h / 2, Hh);
        s += `<g class="iso-cross"><rect x="${cx - 5}" y="${cy - 14}" width="10" height="22" fill="#d64545"/><rect x="${cx - 12}" y="${cy - 8}" width="24" height="10" fill="#d64545"/></g>`;
        return s + frontSign(x, y, w, h, Hh - 4, "БОЛЬНИЦА", { bg: "#f4efe6", fg: "#8a2a2a", stroke: "#d64545" }) + frontDoor(x, y, w, h, "#7fb7ff");
    }
    case "fire": {
        const Hh = 58, tw = 38;
        s += box(x + w - tw, y, tw, h * 0.55, Hh + 48, PAL.fire) + windowsSide(x + w - tw, y, tw, h * 0.55, Hh + 48, 2, 4, "fire");
        s += box(x, y, w - tw, h, Hh, PAL.fire);
        const gw = (w - tw - 30) / 2;
        for (let i = 0; i < 2; i++) {
            const gx = x + 10 + i * (gw + 10);
            s += quad(P(gx, y + h, 0), P(gx + gw, y + h, 0), P(gx + gw, y + h, 40), P(gx, y + h, 40), T("#d9c9ae"));
            for (let k = 1; k < 4; k++) s += quad(P(gx, y + h, k * 10), P(gx + gw, y + h, k * 10), P(gx + gw, y + h, k * 10 + 1.5), P(gx, y + h, k * 10 + 1.5), T("#a89878"));
        }
        return s + frontSign(x, y, w - tw, h, Hh - 2, "ПОЖАРНАЯ ЧАСТЬ");
    }
    case "school": {
        const Hh = 60;
        s += box(x, y, w, h, Hh, PAL.school) + gable(x, y, w, h, Hh, 24, "#9a5a3a", "#7a4630") + windowsFront(x, y, w, h, Hh, 6, 2, "sch") + windowsSide(x, y, w, h, Hh, 4, 2, "sch");
        // башенка с часами над входом
        s += box(x + w / 2 - 16, y + h - 26, 32, 22, Hh + 44, PAL.school, Hh);
        s += gable(x + w / 2 - 16, y + h - 26, 32, 22, Hh + 44, 16, "#9a5a3a", "#7a4630");
        const [cx, cy] = P(x + w / 2, y + h - 4, Hh + 30);
        s += `<circle cx="${cx}" cy="${cy}" r="8" fill="#efe6d8" stroke="#6e3a26" stroke-width="2"/><line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - 5}" stroke="#3a2426" stroke-width="1.5"/><line class="iso-clock" x1="${cx}" y1="${cy}" x2="${cx + 4}" y2="${cy}" stroke="#3a2426" stroke-width="1.5" style="transform-origin:${cx}px ${cy}px"/>`;
        return s + frontSign(x, y, w, h, 56, "ШКОЛА") + frontDoor(x, y, w, h);
    }
    case "factory": {
        const Hh = 50;
        s += box(x, y, w - 34, h, Hh, PAL.factory);
        for (let i = 0; i < 4; i++) s += gable(x + i * ((w - 34) / 4), y, (w - 34) / 4, h, Hh, 12, "#8a7a6c", "#6a5a4e");
        s += box(x + w - 30, y + h * 0.35, 20, 20, Hh + 90, PAL.factory);
        const [cx, cy] = P(x + w - 20, y + h * 0.35 + 10, Hh + 90);
        s += `<circle class="iso-smoke" cx="${cx}" cy="${cy - 6}" r="8" fill="${T("#9a94a4")}"/><circle class="iso-smoke iso-smoke-2" cx="${cx + 3}" cy="${cy - 6}" r="8" fill="${T("#9a94a4")}"/>`;
        return s + windowsFront(x, y, w - 34, h, Hh, 5, 1, "fac") + frontSign(x, y, w - 34, h, Hh - 2, "ЗАВОД") + frontDoor(x, y, w - 34, h);
    }
    case "shop": {
        const Hh = 46;
        s += box(x, y, w, h, Hh, PAL.shop) + roofKit(x, y, w, h, Hh, { ac: false });
        const stripes = 10;
        for (let i = 0; i < stripes; i++) {
            const sx0 = x + (i * w) / stripes, sx1 = x + ((i + 1) * w) / stripes;
            s += quad(P(sx0, y + h, Hh - 10), P(sx1, y + h, Hh - 10), P(sx1, y + h + 8, Hh - 20), P(sx0, y + h + 8, Hh - 20), i % 2 ? "#efe6d8" : "#d64545");
        }
        s += quad(P(x + 14, y + h, 30), P(x + w - 14, y + h, 30), P(x + w - 14, y + h, 8), P(x + 14, y + h, 8), PH.dark > 0.3 ? "#f2c46a" : T("#9fc4dc"));
        return s + frontSign(x, y, w, h, Hh + 18, "МАГАЗИН");
    }
    case "army": {
        const Hh = 40;
        s += `<polygon points="${pts([P(x, y), P(x + w, y), P(x + w, y + h), P(x, y + h)])}" fill="none" stroke="${T("#7d7a68")}" stroke-width="2.5" stroke-dasharray="7 5"/>`;
        s += box(x + w - 40, y + 14, 18, 18, 82, { top: "#7d7a68", front: "#6a6a58", side: "#58584a" });
        const [lx, ly] = P(x + w - 31, y + 23, 82);
        s += `<circle class="iso-beacon" cx="${lx}" cy="${ly - 6}" r="4" fill="#ffd08a"/>`;
        s += box(x + 14, y + 50, w - 70, h - 64, Hh, PAL.army) + windowsFront(x + 14, y + 50, w - 70, h - 64, Hh, 5, 1, "arm");
        return s + flag(x + 26, y + 26, 0, "#5a8a3a") + frontSign(x + 14, y + 50, w - 70, h - 64, Hh - 4, "ВОЕННАЯ БАЗА");
    }
    case "office": {
        const w1 = w * 0.46;
        s += box(x, y, w1, h * 0.7, 125, PAL.office) + roofKit(x, y, w1, h * 0.7, 125) + windowsFront(x, y, w1, h * 0.7, 125, 3, 7, "offA") + windowsSide(x, y, w1, h * 0.7, 125, 2, 7, "offA");
        s += box(x + w1 + 12, y + 24, w - w1 - 12, h - 24, 88, { top: "#8a98b8", front: "#6a789a", side: "#56627e" }) + roofKit(x + w1 + 12, y + 24, w - w1 - 12, h - 24, 88);
        s += windowsFront(x + w1 + 12, y + 24, w - w1 - 12, h - 24, 88, 3, 5, "offB");
        return s + frontSign(x + w1 + 12, y + 24, w - w1 - 12, h - 24, 26, "ДЕЛОВОЙ КВАРТАЛ");
    }
    case "government": {
        const Hh = 64;
        s += box(x, y + 20, w, h - 20, Hh, PAL.gov) + gable(x, y + 20, w, h - 20, Hh, 18, "#cbc1ad", "#a99f8b");
        for (let i = 0; i < 6; i++) {
            const cx0 = x + 12 + i * ((w - 34) / 5);
            s += quad(P(cx0, y + h, 0), P(cx0 + 8, y + h, 0), P(cx0 + 8, y + h, Hh - 6), P(cx0, y + h, Hh - 6), T("#faf6ee"));
        }
        s += quad(P(x - 4, y + h + 6, 0), P(x + w + 4, y + h + 6, 0), P(x + w + 4, y + h, 0), P(x - 4, y + h, 0), T("#c9c0ae"));
        return s + flag(x + w / 2, y + 20 + (h - 20) / 2, Hh + 18, "#d4af37") + frontSign(x, y + 20, w, h - 20, 22, "ГОС. УПРАВЛЕНИЕ", { bg: "#2a2f45", fg: "#f3e2a8", stroke: "#d4af37" });
    }
    case "residence":
        return box(x, y, w, h, 32, { top: "#f4e8cc", front: "#e8dcc0", side: "#cdbfa2" }) + gable(x, y, w, h, 32, 14, "#9a6a46", "#7a5236") + windowsFront(x, y, w, h, 32, 3, 1, "res") + frontDoor(x, y, w, h);
    case "official_house":
        return box(x, y, w, h, 16, PAL.house) + gable(x, y, w, h, 16, 9, "#9a6a46", "#7a5236");
    case "dorm": {
        const Hh = extra.height || 110;
        s += box(x, y, w, h, Hh, PAL.dorm) + roofKit(x, y, w, h, Hh, { tank: extra.number % 2 === 1 });
        s += windowsFront(x, y, w, h, Hh, Math.max(3, Math.round(w / 22)), 5, `dorm${extra.number}`) + windowsSide(x, y, w, h, Hh, 3, 5, `dorm${extra.number}`);
        return s + frontSign(x, y, w, h, 58, `№${extra.number} · ${extra.count}/20`) + frontDoor(x, y, w, h);
    }
    case "private_gate": {
        for (let i = 0; i < 3; i++) {
            const hx = x + 12 + i * ((w - 24) / 3), hw = (w - 24) / 3 - 10;
            const roof = ["#c46a5a", "#5a82b4", "#6a9a6a"][i];
            s += box(hx, y + 40, hw, 50, 22, PAL.house) + gable(hx, y + 40, hw, 50, 22, 14, roof, roof) + frontDoor(hx, y + 40, hw, 50);
        }
        s += quad(P(x, y + 112), P(x + w, y + 112), P(x + w, y + 112, 10), P(x, y + 112, 10), T("#9a8060"));
        return s + frontSign(x, y + 112, w, 20, 34, "ЧАСТНЫЙ СЕКТОР");
    }
    default:
        return box(x, y, w, h, 40, PAL.dorm);
    }
}

// ---------- транспорт и люди (2.5D-спрайты, масштаб по глубине) ----------
function sprite(kind, dx, dy, now) {
    const custom = CITY_MAP_ASSETS.vehicles[kind === "robbery" ? "thief" : kind];
    if (custom) return `<image href="${custom}" x="-22" y="-26" width="44" height="28" preserveAspectRatio="xMidYMax meet" ${dx < 0 ? 'transform="scale(-1,1)"' : ""}/>`;
    const blink = Math.floor(now / 280) % 2;
    const leg = Math.sin(now / 90) * 3;
    const night = PH.dark > 0.3;
    const car = (body, roof, extra = "", long = false) => {
        const L = long ? 34 : 28;
        if (dx !== 0) { // едет вбок — видим профиль
            const flip = dx < 0 ? 'transform="scale(-1,1)"' : "";
            return `<g ${flip}><ellipse cy="1" rx="${L / 2 + 2}" ry="4" fill="#000" opacity=".3"/>
                <rect x="${-L / 2}" y="-12" width="${L}" height="9" rx="3" fill="${body}"/>
                <path d="M${-L / 2 + 6} -12 l4 -7 h${L - 20} l5 7 z" fill="${roof}"/>
                <circle cx="${-L / 2 + 6}" cy="-3" r="3.2" fill="#1d1a2b"/><circle cx="${L / 2 - 6}" cy="-3" r="3.2" fill="#1d1a2b"/>
                <circle cx="${L / 2 - 1}" cy="-8" r="1.8" fill="#fff7d6"/>
                ${night ? `<path d="M${L / 2} -8 l16 -4 v8 z" fill="#fff7d6" opacity=".25"/>` : ""}${extra}</g>`;
        }
        // едет к нам или от нас — видим перед/зад
        const front = dy > 0;
        return `<g><ellipse cy="1" rx="12" ry="4" fill="#000" opacity=".3"/>
            <rect x="-10" y="-14" width="20" height="12" rx="3" fill="${body}"/>
            <rect x="-7" y="-20" width="14" height="7" rx="2" fill="${roof}"/>
            <circle cx="-6" cy="-6" r="2" fill="${front ? "#fff7d6" : "#ff5a5f"}"/><circle cx="6" cy="-6" r="2" fill="${front ? "#fff7d6" : "#ff5a5f"}"/>${extra}</g>`;
    };
    switch (kind) {
    case "taxi": return car("#f2c230", "#8fd3ff", `<rect x="-4" y="-24" width="8" height="4" rx="1" fill="#1d1a2b"/>`);
    case "doctor": return car("#f4f1ea", "#8fd3ff", `<rect x="-3" y="-25" width="6" height="4" fill="${blink ? "#ff4d4d" : "#3d7bff"}"/><rect x="-2" y="-10" width="4" height="5" fill="#d64545"/>`, true);
    case "firefighter": return car("#c8362d", "#f2a24a", `<rect x="-3" y="-25" width="6" height="4" fill="${blink ? "#ff4d4d" : "#ffd08a"}"/>`, true);
    case "police": return car("#e8ecf5", "#2a3552", `<rect x="-6" y="-24" width="5" height="4" fill="${blink ? "#ff4d4d" : "#6d2a2a"}"/><rect x="1" y="-24" width="5" height="4" fill="${blink ? "#2a3a6d" : "#3d7bff"}"/>`);
    case "car": return car("#5a93d8", "#8fd3ff");
    case "courier": {
        const flip = dx < 0 ? 'transform="scale(-1,1)"' : "";
        return `<g ${flip}><ellipse cy="1" rx="11" ry="3.5" fill="#000" opacity=".3"/>
            <rect x="-9" y="-8" width="18" height="5" rx="2.5" fill="#5ecfa0"/>
            <circle cx="-7" cy="-3" r="3" fill="#1d1a2b"/><circle cx="7" cy="-3" r="3" fill="#1d1a2b"/>
            <rect x="-11" y="-21" width="9" height="10" rx="1.5" fill="#f2a24a"/>
            <rect x="-1" y="-20" width="5" height="10" rx="2" fill="#3a3e4a"/><circle cx="1.5" cy="-23" r="4" fill="#d64545"/></g>`;
    }
    case "robbery": {
        const crouch = Math.abs(Math.sin(now / 400)) * 2;
        return `<ellipse cy="1" rx="6" ry="2.5" fill="#000" opacity=".3"/>
            <line x1="-1" y1="-7" x2="${-2 + leg}" y2="0" stroke="#16131f" stroke-width="2.5" stroke-linecap="round"/>
            <line x1="1" y1="-7" x2="${2 - leg}" y2="0" stroke="#16131f" stroke-width="2.5" stroke-linecap="round"/>
            <rect x="-5" y="${-17 + crouch}" width="10" height="11" rx="3" fill="#2a2a30"/>
            <path d="M-5 ${-19 + crouch} a5 5 0 0 1 10 0 v3 h-10 z" fill="#1d1a2b"/>
            <circle cx="-1.5" cy="${-18 + crouch}" r="0.9" fill="#ff5a5f"/><circle cx="1.5" cy="${-18 + crouch}" r="0.9" fill="#ff5a5f"/>`;
    }
    default: // пешком (учитель)
        return `<ellipse cy="1" rx="6" ry="2.5" fill="#000" opacity=".3"/>
            <line x1="-1" y1="-8" x2="${-2 + leg}" y2="0" stroke="#3a3e4a" stroke-width="2.5" stroke-linecap="round"/>
            <line x1="1" y1="-8" x2="${2 - leg}" y2="0" stroke="#3a3e4a" stroke-width="2.5" stroke-linecap="round"/>
            <rect x="-4" y="-18" width="8" height="11" rx="3" fill="#8a5aa0"/><circle cy="-22" r="4" fill="#e8c4a0"/>`;
    }
}

// ---------- сцена ----------
function skySvg() {
    const [top, bottom] = PH.sky;
    let s = `<defs><linearGradient id="v-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>
        <rect width="${VW}" height="${VH}" fill="url(#v-sky)"/>`;
    // солнце или луна
    const phase = Object.keys(PHASES).find((k) => PHASES[k] === PH);
    if (phase === "night" || phase === "evening") {
        for (let i = 0; i < 40; i++) {
            const hx = hash(`star${i}`);
            s += `<circle cx="${hx % VW}" cy="${(hx >> 8) % (SKY - 30)}" r="${(hx % 3) * 0.4 + 0.6}" fill="#fff" opacity="${0.3 + ((hx >> 4) % 6) / 10}" class="${i % 5 ? "" : "v-star"}"/>`;
        }
        s += `<circle cx="${VW * 0.82}" cy="44" r="16" fill="#efe6c8"/><circle cx="${VW * 0.82 + 6}" cy="40" r="14" fill="${top}"/>`;
    } else if (phase === "dusk" || phase === "dawn") {
        s += `<circle cx="${phase === "dusk" ? VW * 0.8 : VW * 0.18}" cy="${SKY - 30}" r="26" fill="#ffd08a" opacity=".9"/>`;
    } else {
        s += `<circle cx="${VW * 0.85}" cy="42" r="20" fill="#fff4c8" opacity=".95"/>`;
    }
    // силуэт далёкого города
    let x = 0;
    while (x < VW) {
        const hx = hash(`sky${x}`);
        const bw = 26 + (hx % 40), bh = 30 + ((hx >> 6) % 70);
        s += `<rect x="${x}" y="${SKY - bh + 6}" width="${bw}" height="${bh}" fill="${PH.far}"/>`;
        if (PH.lit > 0.2) for (let k = 0; k < 4; k++) if (((hx >> k) & 3) === 0) s += `<rect x="${x + 6 + k * 5}" y="${SKY - bh + 14 + k * 9}" width="3" height="3" fill="#f2c46a" opacity=".7"/>`;
        x += bw + 2;
    }
    return s;
}

function groundSvg() {
    let g = "";
    const bg = CITY_MAP_ASSETS.background;
    g += quad(P(-420, -20), P(W + 420, -20), P(W + 420, H + 60), P(-420, H + 60), T("#5e5a6e"));
    if (bg) {
        const [lx, ty] = P(0, 0), [rx] = P(W, H), [, by] = P(0, H);
        g += `<image href="${bg}" x="${P(0, H)[0]}" y="${ty}" width="${rx - P(0, H)[0]}" height="${by - ty}" preserveAspectRatio="none"/>`;
        if (CITY_MAP_ASSETS.hideDrawnGround) return g;
    }
    COLS.forEach(([x0, x1]) => ROWS.forEach(([y0, y1]) => {
        g += tile(x0 + 2, y0 + 2, x1 - x0 - 4, y1 - y0 - 4, T("#8a8496"));
        g += tile(x0 + 8, y0 + 8, x1 - x0 - 16, y1 - y0 - 16, T("#6e6a7e"));
    }));
    H_STREETS.forEach((y) => { g += tile(-420, y - ROAD / 2, W + 840, ROAD, T("#3e3b48")); });
    V_STREETS.forEach((x) => { g += tile(x - ROAD / 2, -20, ROAD, H + 50, T("#3e3b48")); });
    const cross = (v, list) => list.some((c) => Math.abs(v - c) < 26);
    H_STREETS.forEach((y) => { for (let x = -410; x < W + 410; x += 26) if (!cross(x, V_STREETS)) g += tile(x, y - 1.2, 13, 2.4, T("#d8c27a")); });
    V_STREETS.forEach((x) => { for (let y = -10; y < H + 20; y += 26) if (!cross(y, H_STREETS)) g += tile(x - 1.2, y, 2.4, 13, T("#d8c27a")); });
    V_STREETS.forEach((vx) => H_STREETS.forEach((hy) => {
        for (let i = 0; i < 6; i++) {
            g += tile(vx - 18 + i * 7, hy + 22, 4, 12, T("#e8e4ee"), 'opacity=".8"');
            g += tile(vx - 18 + i * 7, hy - 34, 4, 12, T("#e8e4ee"), 'opacity=".8"');
            g += tile(vx + 22, hy - 18 + i * 7, 12, 4, T("#e8e4ee"), 'opacity=".8"');
            g += tile(vx - 34, hy - 18 + i * 7, 12, 4, T("#e8e4ee"), 'opacity=".8"');
        }
    }));
    return g;
}

let pollTimer = null, rafId = null, phaseTimer = null;
const seen = new Set();
function stopAll() {
    [pollTimer, phaseTimer].forEach((t) => t && clearInterval(t));
    pollTimer = phaseTimer = null;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
}

function goToShopHouse(overlay) {
    stopAll();
    overlay.remove();
    window.__openShopItem = "house";
    const btn = document.getElementById("nav-shop");
    if (btn) btn.click();
    else showGamePopupWithContent("Магазин недоступен", (c) => { c.innerHTML = `<div class="profile-dim">Сейчас магазин тебе недоступен (например, ты в тюрьме).</div>`; });
}

export async function renderCityView(overlay, helpers) {
    stopAll();
    seen.clear();
    let map, movements;
    try {
        [map, movements] = await Promise.all([apiFetch("/api/map"), apiFetch("/api/map/movements")]);
    } catch (e) {
        overlay.innerHTML = `<div class="error">${e.message}</div><button class="btn" id="map-close-err">Закрыть</button>`;
        overlay.querySelector("#map-close-err").onclick = () => overlay.remove();
        return;
    }
    PH = PHASES[phaseFor()];
    overlay.innerHTML = `
        <div class="map-fullscreen-header">
            <div class="map-fullscreen-title">🗺 Карта города</div>
            <button class="btn btn-secondary" id="map-close-btn">✕ Закрыть карту</button>
        </div>
        <div class="v-topbar"><span class="v-phase" id="v-phase"></span><span class="v-traffic" id="v-traffic"></span>
            <span class="v-zoom"><button class="iso-zoom-btn" data-z="-1" aria-label="Отдалить">−</button><button class="iso-zoom-btn" data-z="1" aria-label="Приблизить">+</button></span></div>
        <div class="iso-scroll" id="iso-scroll"></div>
        <div class="map-legend">Двигай карту пальцем, приближай кнопками. Нажимай на здания, общаги и машины — узнаешь подробности.</div>`;
    overlay.querySelector("#map-close-btn").onclick = () => { stopAll(); overlay.remove(); };

    const places = {};
    const objects = [];
    const solids = [];
    const addSolid = (r, svgFn, obj) => {
        const idx = obj ? objects.push(obj) - 1 : -1;
        solids.push({ depth: r.y + r.h, svgFn, idx });
    };
    BUILDINGS.forEach((b) => {
        let r = cellRect(b.cell[0], b.cell[1]);
        if (b.code === "government" && map.president_residence) r = { ...r, w: r.w - 56 };
        const d = doorPoints(r, b.door);
        b.labels.forEach((l) => { places[l] = d; });
        places[b.code] = d;
        addSolid(r, () => drawBuilding(b.code, r), { kind: "building", b });
    });
    const gov = cellRect(1, 0);
    if (map.president_residence) {
        const rr = { x: gov.x + gov.w - 48, y: gov.y + 60, w: 48, h: 64 };
        addSolid(rr, () => drawBuilding("residence", rr), { kind: "person", person: map.president_residence });
    }
    map.official_houses.slice(0, 5).forEach((p, i) => {
        const rr = { x: COLS[1][0] + 2, y: ROWS[0][0] + 24 + i * 30, w: 20, h: 22 };
        addSolid(rr, () => drawBuilding("official_house", rr), { kind: "person", person: p });
    });
    const dormBlocks = [cellRect(1, 1, 16), cellRect(1, 2, 16)];
    const dorms = map.dormitories;
    const perBlock = Math.max(1, Math.ceil(dorms.length / 2));
    dorms.forEach((dorm, i) => {
        const blk = dormBlocks[Math.floor(i / perBlock)] || dormBlocks[1];
        const j = i % perBlock;
        const cols = perBlock > 1 ? 2 : 1;
        const rowsN = Math.ceil(perBlock / cols);
        const gap = 14;
        const dw = (blk.w - gap * (cols - 1)) / cols, dh = (blk.h - gap * (rowsN - 1)) / rowsN;
        const r = { x: blk.x + (j % cols) * (dw + gap), y: blk.y + Math.floor(j / cols) * (dh + gap), w: dw, h: dh };
        places[`dorm-${dorm.number}`] = doorPoints(r, Math.floor(j / cols) < rowsN / 2 ? "top" : "bottom");
        addSolid(r, () => drawBuilding("dorm", r, { number: dorm.number, count: dorm.residents.length, height: 86 + (dorm.number % 3) * 20 }), { kind: "dorm", dorm });
    });
    COLS.forEach(([x0, x1], ci) => ROWS.forEach(([y0, y1], ri) => {
        const tx = (ci + ri) % 2 ? x0 + 12 : x1 - 12, ty = y1 - 10;
        solids.push({ depth: ty, svgFn: () => tree(tx, ty), idx: -1 });
    }));
    // фонари на углах перекрёстков; «центральные» — на средней улице (ночью горят только они)
    V_STREETS.forEach((vx) => H_STREETS.forEach((hy) => {
        [[-1, 1], [1, 1]].forEach(([dx, dy]) => {
            const lx = vx + dx * (ROAD / 2 + 10), ly = hy + dy * (ROAD / 2 + 8);
            const central = hy === H_STREETS[1];
            solids.push({ depth: ly, svgFn: () => lampAt(lx, ly, PH.lamps === "all" || (PH.lamps === "central" && central)), idx: -1 });
        });
    }));
    solids.sort((a, b) => a.depth - b.depth);

    const scroll = overlay.querySelector("#iso-scroll");
    const draw = () => {
        scroll.querySelector("#v-static")?.remove();
        const html = `${skySvg()}${groundSvg()}`;
        if (!scroll.querySelector("svg")) {
            scroll.innerHTML = `<svg viewBox="0 0 ${VW} ${VH}" class="iso-city iso-city-full" id="iso-svg"><g id="v-static">${html}</g><g id="iso-objects"></g></svg>`;
        } else {
            scroll.querySelector("svg").insertAdjacentHTML("afterbegin", `<g id="v-static">${html}</g>`);
        }
        const layer = scroll.querySelector("#iso-objects");
        layer.querySelectorAll(".iso-obj").forEach((n) => n.remove());
        const movers = [...layer.children];
        layer.insertAdjacentHTML("afterbegin", solids.map((o) => `<g class="iso-obj${o.idx >= 0 ? " city-obj" : ""}" data-depth="${o.depth.toFixed(0)}" ${o.idx >= 0 ? `data-obj="${o.idx}"` : ""}>${o.svgFn()}</g>`).join(""));
        movers.forEach((m) => layer.appendChild(m));
        layer.querySelectorAll(".city-obj").forEach((g) => {
            const o = objects[Number(g.dataset.obj)];
            g.onclick = () => {
                if (o.kind === "building" && o.b.code === "private_gate") renderSectorView(overlay, helpers);
                else if (o.kind === "building") showBuildingInfo(o.b, helpers, overlay);
                else if (o.kind === "dorm") helpers.showDormPeople(overlay, o.dorm);
                else if (o.kind === "person") helpers.showPublicProfile(overlay, o.person.vk_id);
            };
        });
        overlay.querySelector("#v-phase").textContent = `${{ dawn: "🌅", day: "☀️", dusk: "🌇", evening: "🌆", night: "🌙" }[phaseFor()]} ${PH.name}`;
    };
    draw();

    const svg = scroll.querySelector("#iso-svg");
    const ZOOMS = [1.0, 1.5, 2.1];
    let zi = window.innerWidth < 700 ? 1 : 0;
    const applyZoom = () => { svg.style.width = `${Math.round(Math.min(scroll.clientWidth || 360, 1100) * ZOOMS[zi])}px`; };
    applyZoom();
    requestAnimationFrame(() => { scroll.scrollLeft = (svg.clientWidth - scroll.clientWidth) / 2; });
    overlay.querySelectorAll(".iso-zoom-btn").forEach((b) => {
        b.onclick = () => {
            const cx = (scroll.scrollLeft + scroll.clientWidth / 2) / svg.clientWidth, cy = (scroll.scrollTop + scroll.clientHeight / 2) / svg.clientHeight;
            zi = Math.max(0, Math.min(ZOOMS.length - 1, zi + Number(b.dataset.z)));
            applyZoom();
            scroll.scrollLeft = cx * svg.clientWidth - scroll.clientWidth / 2;
            scroll.scrollTop = cy * svg.clientHeight - scroll.clientHeight / 2;
        };
    });

    // смена времени суток — раз в минуту сверяемся с часами игрока
    phaseTimer = setInterval(() => {
        if (!overlay.isConnected) { stopAll(); return; }
        const next = PHASES[phaseFor()];
        if (next !== PH) { PH = next; draw(); }
    }, 60000);

    // ---------- только настоящие поездки ----------
    const layer = scroll.querySelector("#iso-objects");
    const movers = [];
    const traffic = overlay.querySelector("#v-traffic");
    const updateTraffic = () => { traffic.textContent = movers.length ? `🚦 Сейчас в пути: ${movers.length}` : "🌃 Сейчас на улицах тихо"; };
    const resolve = (label, mv) => {
        if (places[label]) return places[label];
        if (label === "Переулок") {
            const edges = [...V_STREETS.map((x) => ({ x, y: 0 })), ...V_STREETS.map((x) => ({ x, y: H })), ...H_STREETS.map((y) => ({ x: 0, y })), ...H_STREETS.map((y) => ({ x: W, y }))];
            const e = edges[Math.floor(Math.random() * edges.length)];
            return { door: e, curb: e };
        }
        if (label === "Общежитие") {
            const mine = dorms.find((d) => d.residents.some((p) => p.vk_id === mv.vk_id));
            const d = mine || dorms[hash(mv.vk_id) % Math.max(1, dorms.length)];
            return (d && places[`dorm-${d.number}`]) || places.private_gate;
        }
        return places.office;
    };
    const spawn = (list) => {
        list.forEach((mv) => {
            if (seen.has(mv.id)) return;
            seen.add(mv.id);
            const from = resolve(mv.from_label, mv), to = resolve(mv.to_label, mv);
            if (!from || !to) return;
            const path = [from.door, ...shortestRoute(from.curb, to.curb), to.door];
            const walker = ["teacher", "robbery"].includes(mv.kind);
            const el = document.createElementNS("http://www.w3.org/2000/svg", "g");
            el.setAttribute("class", "iso-mover city-vehicle");
            el.addEventListener("click", () => showMovementInfo(mv, helpers, overlay));
            layer.appendChild(el);
            let len = 0;
            const segs = [];
            for (let i = 1; i < path.length; i++) {
                const d = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
                segs.push({ a: path[i - 1], b: path[i], d, start: len });
                len += d;
            }
            movers.push({ kind: mv.kind, el, segs, len, dist: 0, speed: walker ? 34 : 95, lane: walker ? 26 : 9 });
        });
        updateTraffic();
    };
    spawn(movements);

    let last = performance.now();
    const frame = (now) => {
        if (!overlay.isConnected) { stopAll(); return; }
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        const solidEls = [...layer.querySelectorAll(".iso-obj")];
        for (let i = movers.length - 1; i >= 0; i--) {
            const m = movers[i];
            m.dist += m.speed * dt;
            if (m.dist >= m.len) {
                m.el.style.transition = "opacity .8s";
                m.el.style.opacity = "0";
                const el = m.el;
                setTimeout(() => el.remove(), 900);
                movers.splice(i, 1);
                updateTraffic();
                continue;
            }
            const seg = m.segs.find((s) => m.dist <= s.start + s.d) || m.segs[m.segs.length - 1];
            const t = seg.d ? (m.dist - seg.start) / seg.d : 1;
            const dx = Math.sign(seg.b.x - seg.a.x), dy = Math.sign(seg.b.y - seg.a.y);
            const x = seg.a.x + (seg.b.x - seg.a.x) * t - dy * m.lane;
            const y = seg.a.y + (seg.b.y - seg.a.y) * t + dx * m.lane;
            const [sx, sy] = P(x, y);
            m.el.innerHTML = sprite(m.kind, dx, dy, now);
            m.el.setAttribute("transform", `translate(${sx.toFixed(1)},${sy.toFixed(1)}) scale(${sAt(y).toFixed(2)})`);
            const next = solidEls.find((o) => Number(o.dataset.depth) > y + 6);
            if (next) { if (m.el.nextSibling !== next) layer.insertBefore(m.el, next); }
            else if (m.el !== layer.lastChild) layer.appendChild(m.el);
        }
        rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);

    pollTimer = setInterval(async () => {
        if (!overlay.isConnected) { stopAll(); return; }
        try { spawn(await apiFetch("/api/map/movements")); } catch (e) { /* следующий круг */ }
    }, 10000);
}

// ---------- частный сектор: тот же вид, кнопка «Купить дом» ----------
async function renderSectorView(overlay, helpers) {
    stopAll();
    overlay.innerHTML = `<div class="loading">Загружаем частный сектор…</div>`;
    let data;
    try {
        data = await apiFetch("/api/map/private_sector");
    } catch (e) {
        overlay.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }
    PH = PHASES[phaseFor()];
    overlay.innerHTML = `
        <div class="map-fullscreen-header">
            <div class="map-fullscreen-title">🏘 Частный сектор</div>
            <button class="btn btn-secondary" id="map-back-btn">← Назад на карту города</button>
        </div>
        <div class="v-topbar"><span class="v-phase">Домов: ${data.houses.length}</span><button class="btn v-buy-btn" id="v-buy">🏠 Купить дом</button></div>
        <div class="iso-scroll" id="iso-scroll"></div>
        <div class="map-legend">Нажми на дом — откроется профиль владельца. Нажми на свободный участок или «Купить дом» — перейдёшь в магазин.</div>`;
    overlay.querySelector("#map-back-btn").onclick = () => renderCityView(overlay, helpers);
    overlay.querySelector("#v-buy").onclick = () => goToShopHouse(overlay);

    const houses = data.houses;
    const perRow = 4;
    const PW = W / perRow, PHt = 225, ROADH = 50;
    const GROUP = PHt * 2 + ROADH;
    const fitRows = Math.floor((H + 40) / GROUP) * 2;
    const total = Math.max(fitRows * perRow, Math.ceil((houses.length + 2) / perRow) * perRow);
    const rows = total / perRow;
    const items = [];
    let g = quad(P(-420, -20), P(W + 420, -20), P(W + 420, H + 60), P(-420, H + 60), T("#4a6a4a"));
    const rowY = (row) => 10 + Math.floor(row / 2) * GROUP + (row % 2 ? PHt + ROADH : 0);
    for (let gi = 0; gi < Math.ceil(rows / 2); gi++) {
        const ry = 10 + gi * GROUP + PHt;
        g += tile(-420, ry, W + 840, ROADH, T("#3e3b48"));
        for (let x = -410; x < W + 410; x += 26) g += tile(x, ry + ROADH / 2 - 1.2, 13, 2.4, T("#d8c27a"));
    }
    for (let i = 0; i < total; i++) {
        const row = Math.floor(i / perRow), col = i % perRow;
        const x = col * PW + 8, y = rowY(row);
        const house = houses[i] || null;
        // верхний ряд пары смотрит фасадом на улицу ниже, нижний — тоже вниз (к нам)
        let s = tile(x, y, PW - 16, PHt - 14, T(house ? "#5a8a5a" : "#6a8a5a"));
        s += quad(P(x, y + PHt - 18), P(x + PW - 16, y + PHt - 18), P(x + PW - 16, y + PHt - 18, 10), P(x, y + PHt - 18, 10), T("#9a8060"));
        // деревья во дворе
        s += tree(x + 18, y + 30) + tree(x + PW - 34, y + 46);
        if (!house) {
            const [tx, ty] = P(x + (PW - 16) / 2, y + PHt * 0.6);
            const k = sAt(y + PHt * 0.6);
            s += `<g class="v-forsale" transform="translate(${tx.toFixed(1)},${ty.toFixed(1)}) scale(${k.toFixed(2)})"><rect x="-1.5" y="-16" width="3" height="16" fill="#8a7050"/>
                <rect x="-34" y="-36" width="68" height="22" rx="3" fill="#efe2c6" stroke="#9a8060" stroke-width="1.5"/>
                <text y="-20" text-anchor="middle" font-size="11" font-weight="700" fill="#3a2a1a" font-family="Golos Text, sans-serif">Купить</text></g>`;
            items.push({ depth: y + PHt, svg: s, house: null });
            continue;
        }
        const h = hash(house.vk_id);
        const roof = ["#c46a5a", "#5a82b4", "#6a9a6a", "#9a6ab0", "#b08a5a"][h % 5];
        const hw = 96 + ((h >> 5) % 3) * 12, hd = 86, Hh = 46 + ((h >> 7) % 2) * 14;
        const hx = x + (PW - 16 - hw) / 2, hy = y + PHt - 18 - 38 - hd;
        if (house.house_skin || CITY_MAP_ASSETS.defaultHouse) {
            const src = house.house_skin ? `assets/houses/${house.house_skin}.png` : CITY_MAP_ASSETS.defaultHouse;
            const [ix, iy] = P(hx + hw / 2, hy + hd);
            s += `<image href="${src}" x="${ix - 60}" y="${iy - 110}" width="120" height="110" preserveAspectRatio="xMidYMax meet"/>`;
        } else {
            s += box(hx, hy, hw, hd, Hh, PAL.house) + gable(hx, hy, hw, hd, Hh, 30, roof, shade(roof, 0.25));
            s += windowsFront(hx, hy, hw, hd, Hh, 2, 1, `h${house.vk_id}`, 0, 0.12) + frontDoor(hx, hy, hw, hd);
            if ((h >> 11) % 2) s += box(hx + hw * 0.72, hy + 14, 10, 10, Hh + 40, { top: "#9e4f45", front: "#7e4a3a", side: "#6a3a2a" }, Hh);
        }
        // табличка с именем — на земле перед забором, не налезает на дом
        const [nx, ny] = P(x + (PW - 16) / 2, y + PHt - 4);
        const k = sAt(y + PHt - 4);
        const label = house.username ? "@" + house.username : "ID " + house.vk_id;
        s += `<g transform="translate(${nx.toFixed(1)},${ny.toFixed(1)}) scale(${k.toFixed(2)})"><rect x="-44" y="-9" width="88" height="17" rx="3" fill="#3a2426" stroke="#f2a24a" stroke-width="1"/>
            <text y="3.5" text-anchor="middle" font-size="10" fill="#ffe3bd" font-family="Golos Text, sans-serif">${escapeHtml(label.slice(0, 16))}</text></g>`;
        items.push({ depth: y + PHt, svg: s, house });
    }
    items.sort((a, b) => a.depth - b.depth);
    const scroll = overlay.querySelector("#iso-scroll");
    scroll.innerHTML = `<svg viewBox="0 0 ${VW} ${VH}" class="iso-city iso-city-full" style="width:${Math.max(scroll.clientWidth || 360, 720)}px">${skySvg()}${g}${items.map((it, i) => `<g class="city-obj" data-plot="${i}">${it.svg}</g>`).join("")}</svg>`;
    scroll.querySelectorAll("[data-plot]").forEach((el) => {
        const it = items[Number(el.dataset.plot)];
        el.addEventListener("click", () => (it.house ? helpers.showPublicProfile(overlay, it.house.vk_id) : goToShopHouse(overlay)));
    });
    requestAnimationFrame(() => { scroll.scrollLeft = (scroll.scrollWidth - scroll.clientWidth) / 2; });
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str ?? "");
    return div.innerHTML;
}
