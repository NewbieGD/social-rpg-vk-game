// Изометрическая карта города. Логика мира (кварталы, улицы, двери,
// маршруты) — из cityMap.js, здесь только объёмная отрисовка и движение.
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


const C = Math.cos(Math.PI / 6);
const SLAB = 18;
const PAD_X = 40;
const PAD_TOP = 190;
const VIEW_W = Math.ceil((W + H) * C + PAD_X * 2);
const VIEW_H = Math.ceil((W + H) * 0.5 + PAD_TOP + SLAB + 40);
const OX = H * C + PAD_X;
const OY = PAD_TOP;
const ZOOMS = [1.0, 1.45, 2.0];

const P = (x, y, z = 0) => [(x - y) * C + OX, (x + y) * 0.5 - z + OY];
const pts = (arr) => arr.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
const tile = (x, y, w, h, fill, extra = "") =>
    `<polygon points="${pts([P(x, y), P(x + w, y), P(x + w, y + h), P(x, y + h)])}" fill="${fill}" ${extra}/>`;

let pollTimer = null;
let rafId = null;
const seen = new Set();

function stopAll() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
}

// ---------- примитивы ----------
function box(x, y, w, h, Hh, c, z0 = 0) {
    const top = [P(x, y, Hh), P(x + w, y, Hh), P(x + w, y + h, Hh), P(x, y + h, Hh)];
    const right = [P(x + w, y, z0), P(x + w, y + h, z0), P(x + w, y + h, Hh), P(x + w, y, Hh)];
    const left = [P(x, y + h, z0), P(x + w, y + h, z0), P(x + w, y + h, Hh), P(x, y + h, Hh)];
    const [ex, ey] = P(x + w, y + h, z0);
    const [tx, ty] = P(x + w, y + h, Hh);
    return `<polygon points="${pts(left)}" fill="${c.left}"/><polygon points="${pts(right)}" fill="${c.right}"/>
        <polygon points="${pts(top)}" fill="${c.top}"/>
        <line x1="${ex.toFixed(1)}" y1="${ey.toFixed(1)}" x2="${tx.toFixed(1)}" y2="${ty.toFixed(1)}" stroke="#fff" stroke-opacity=".12" stroke-width="1.2"/>`;
}

// двускатная крыша вдоль x
function gable(x, y, w, h, Hh, peak, color, dark) {
    const a = [P(x, y, Hh), P(x + w, y, Hh), P(x + w, y + h / 2, Hh + peak), P(x, y + h / 2, Hh + peak)];
    const b = [P(x, y + h / 2, Hh + peak), P(x + w, y + h / 2, Hh + peak), P(x + w, y + h, Hh), P(x, y + h, Hh)];
    const end = [P(x + w, y, Hh), P(x + w, y + h, Hh), P(x + w, y + h / 2, Hh + peak)];
    return `<polygon points="${pts(a)}" fill="${dark}"/><polygon points="${pts(b)}" fill="${color}"/><polygon points="${pts(end)}" fill="${dark}" opacity=".85"/>`;
}

// матрица для рисования «на стене»: left — вдоль x при y+h, right — вдоль y при x+w
function faceMatrix(face, x, y, w, h, z) {
    const [ox, oy] = face === "left" ? P(x, y + h, z) : P(x + w, y, z);
    const a = face === "left" ? C : -C;
    return `matrix(${a.toFixed(3)},0.5,0,1,${ox.toFixed(1)},${oy.toFixed(1)})`;
}

function windows(face, x, y, w, h, Hh, cols, rows, seed, lit = 0.55, z0 = 0) {
    const len = face === "left" ? w : h;
    let out = `<g transform="${faceMatrix(face, x, y, w, h, Hh)}">`;
    const cw = len / cols;
    const rh = (Hh - z0 - 14) / rows;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const hsh = hash(`${seed}-${face}-${r}-${c}`);
            const on = (hsh % 100) / 100 < lit;
            const flick = hsh % 9 === 0 ? ` class="iso-flicker" style="animation-delay:${hsh % 6}s"` : "";
            out += `<rect x="${(c * cw + cw * 0.22).toFixed(1)}" y="${(10 + r * rh + rh * 0.2).toFixed(1)}" width="${(cw * 0.56).toFixed(1)}" height="${(rh * 0.55).toFixed(1)}" fill="${on ? "#f2c46a" : "#2a2540"}"${flick}/>`;
        }
    }
    return out + "</g>";
}

function sign(x, y, w, h, z, text, opts = {}) {
    const len = Math.min(w - 10, text.length * 9 + 24);
    const fs = Math.min(13, (len - 10) / (text.length * 0.62));
    const bg = opts.bg || "#3a2426", fg = opts.fg || "#ffe3bd", st = opts.stroke || "#f2a24a";
    return `<g transform="${faceMatrix("left", x, y, w, h, z)}"><rect x="${(w - len) / 2}" y="0" width="${len}" height="18" rx="3" fill="${bg}" stroke="${st}" stroke-width="1.2"/>
        <text x="${w / 2}" y="13" text-anchor="middle" font-size="${fs.toFixed(1)}" fill="${fg}" font-family="Russo One, Golos Text, sans-serif">${text}</text></g>`;
}

function door(x, y, w, h, color = "#6b3f22", side = "left") {
    const dw = 16;
    const off = (side === "left" ? w : h) / 2 - dw / 2;
    return `<g transform="${faceMatrix(side, x, y, w, h, 18)}"><rect x="${off}" width="${dw}" height="18" fill="${color}"/><rect x="${off + 2}" y="2" width="${dw - 4}" height="6" fill="#f2c46a" opacity=".5"/></g>`;
}

function roofKit(x, y, w, h, Hh, opts = {}) {
    let s = `<polygon points="${pts([P(x + 5, y + 5, Hh), P(x + w - 5, y + 5, Hh), P(x + w - 5, y + h - 5, Hh), P(x + 5, y + h - 5, Hh)])}" fill="#000" opacity=".12"/>`;
    if (opts.ac !== false) {
        s += box(x + w * 0.2, y + h * 0.25, 16, 12, Hh + 8, { top: "#9aa0ad", left: "#7a8090", right: "#5f6472" }, Hh);
        s += box(x + w * 0.58, y + h * 0.3, 12, 12, Hh + 6, { top: "#9aa0ad", left: "#7a8090", right: "#5f6472" }, Hh);
    }
    if (opts.tank) {
        const [kx, ky] = P(x + w * 0.35, y + h * 0.6, Hh + 22);
        s += `<rect x="${kx - 2}" y="${ky + 4}" width="3" height="16" fill="#47465c"/><rect x="${kx + 10}" y="${ky + 4}" width="3" height="16" fill="#47465c"/>
            <ellipse cx="${kx + 6}" cy="${ky + 4}" rx="11" ry="5" fill="#6e4a3a"/><rect x="${kx - 5}" y="${ky - 8}" width="22" height="12" fill="#8a5a3a"/><ellipse cx="${kx + 6}" cy="${ky - 8}" rx="11" ry="5" fill="#a0704a"/>`;
    }
    return s;
}

function flag(x, y, z, color = "#d64545") {
    const [fx, fy] = P(x, y, z);
    return `<rect x="${fx - 1}" y="${fy - 30}" width="2" height="30" fill="#b8ae9b"/>
        <rect class="iso-flag" x="${fx + 1}" y="${fy - 30}" width="18" height="11" fill="${color}"/>`;
}

function tree(x, y) {
    const [sx, sy] = P(x, y);
    return `<g><ellipse cx="${sx}" cy="${sy}" rx="11" ry="5.5" fill="#000" opacity=".25"/>
        <rect x="${sx - 2}" y="${sy - 16}" width="4" height="16" fill="#5a3a2a"/>
        <circle cx="${sx}" cy="${sy - 24}" r="12" fill="#2f5a3a"/><circle cx="${sx - 4}" cy="${sy - 28}" r="7" fill="#3f7a4a"/></g>`;
}

function lamp(x, y) {
    const [sx, sy] = P(x, y);
    return `<g><ellipse cx="${sx}" cy="${sy}" rx="28" ry="14" fill="#f2a24a" opacity=".12"/>
        <rect x="${sx - 1.5}" y="${sy - 34}" width="3" height="34" fill="#47465c"/>
        <rect x="${sx - 5}" y="${sy - 37}" width="10" height="4" rx="2" fill="#6d6a5a"/>
        <circle cx="${sx}" cy="${sy - 33}" r="3" fill="#ffd08a"/></g>`;
}

function customImage(src, r) {
    const [lx] = P(r.x, r.y + r.h);
    const [rx] = P(r.x + r.w, r.y);
    const [, ty] = P(r.x, r.y, 120);
    const [, by] = P(r.x + r.w, r.y + r.h);
    return `<image href="${src}" x="${lx}" y="${ty}" width="${rx - lx}" height="${by - ty}" preserveAspectRatio="xMidYMax meet"/>`;
}

// ---------- здания ----------
const PALETTE = {
    police: { top: "#4a5a7e", left: "#3b4a6b", right: "#2c3852" },
    hospital: { top: "#efe8dc", left: "#d9d2c5", right: "#b9b2a5" },
    fire: { top: "#a05048", left: "#8a3b32", right: "#6e2f28" },
    school: { top: "#c89a6a", left: "#b88a5a", right: "#94704a" },
    factory: { top: "#6a5a4e", left: "#5a4a3e", right: "#473a31" },
    shop: { top: "#6a5a80", left: "#4a3f5e", right: "#382f48" },
    army: { top: "#5a6a4e", left: "#4a5a3e", right: "#3a4830" },
    office: { top: "#56607a", left: "#46506a", right: "#363e54" },
    gov: { top: "#e8e0cf", left: "#cfc6b5", right: "#aba291" },
    dorm: { top: "#5a4f70", left: "#4a3f5e", right: "#382f48" },
};

function drawBuilding(code, r, extra = {}) {
    const img = CITY_MAP_ASSETS.buildings[code];
    if (img) return customImage(img, r);
    const { x, y, w, h } = r;
    let s = "";
    switch (code) {
    case "police": {
        const Hh = 78;
        s += box(x, y, w, h, Hh, PALETTE.police) + roofKit(x, y, w, h, Hh);
        s += windows("left", x, y, w, h, Hh, 6, 2, "pol") + windows("right", x, y, w, h, Hh, 5, 2, "pol2");
        const [bx, by] = P(x + w / 2, y + h / 2, Hh);
        s += `<rect x="${bx - 14}" y="${by - 8}" width="10" height="7" rx="2" class="iso-siren-red"/><rect x="${bx + 4}" y="${by - 8}" width="10" height="7" rx="2" class="iso-siren-blue"/>`;
        s += sign(x, y, w, h, Hh - 6, "ПОЛИЦИЯ", { bg: "#1d2640", fg: "#dfe8ff" }) + door(x, y, w, h, "#1d2640");
        return s;
    }
    case "hospital": {
        const Hh = 72;
        s += box(x, y, w, h, Hh, PALETTE.hospital) + roofKit(x, y, w, h, Hh, { ac: false });
        s += windows("left", x, y, w, h, Hh, 6, 2, "hos", 0.7) + windows("right", x, y, w, h, Hh, 5, 2, "hos2", 0.7);
        const [cx, cy] = P(x + w / 2, y + h / 2, Hh);
        s += `<g class="iso-cross"><rect x="${cx - 5}" y="${cy - 16}" width="10" height="26" fill="#d64545"/><rect x="${cx - 13}" y="${cy - 8}" width="26" height="10" fill="#d64545"/></g>`;
        s += sign(x, y, w, h, Hh - 6, "БОЛЬНИЦА", { bg: "#efe8dc", fg: "#8a2a2a", stroke: "#d64545" }) + door(x, y, w, h, "#7fb7ff");
        return s;
    }
    case "fire": {
        const Hh = 62;
        const tw = 40;
        s += box(x, y, w - tw, h, Hh, PALETTE.fire) + roofKit(x, y, w - tw, h, Hh, { ac: false });
        s += box(x + w - tw, y, tw, h * 0.5, Hh + 50, PALETTE.fire);
        s += windows("right", x + w - tw, y, tw, h * 0.5, Hh + 50, 1, 4, "firet", 0.6);
        // ворота гаража на ближней стене
        s += `<g transform="${faceMatrix("left", x, y, w - tw, h, 46)}">${[0, 1].map((i) => `<rect x="${8 + i * ((w - tw - 24) / 2 + 8)}" width="${(w - tw - 24) / 2}" height="46" fill="#d9c9ae"/>${[1, 2, 3].map((k) => `<rect x="${8 + i * ((w - tw - 24) / 2 + 8)}" y="${k * 11}" width="${(w - tw - 24) / 2}" height="2" fill="#a89878"/>`).join("")}`).join("")}</g>`;
        s += sign(x, y, w - tw, h, Hh - 4, "ПОЖАРНАЯ ЧАСТЬ");
        return s;
    }
    case "school": {
        const Hh = 64;
        s += box(x, y, w, h, Hh, PALETTE.school) + gable(x, y, w, h, Hh, 26, "#8a4a32", "#6e3a26");
        s += windows("left", x, y, w, h, Hh, 6, 2, "sch", 0.6) + windows("right", x, y, w, h, Hh, 5, 2, "sch2", 0.6);
        const [cx, cy] = P(x + w, y + h / 2, Hh + 14);
        s += `<circle cx="${cx}" cy="${cy}" r="9" fill="#efe6d8" stroke="#6e3a26" stroke-width="2"/><line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - 6}" stroke="#3a2426" stroke-width="1.6"/><line class="iso-clock" x1="${cx}" y1="${cy}" x2="${cx + 5}" y2="${cy}" stroke="#3a2426" stroke-width="1.6" style="transform-origin:${cx}px ${cy}px"/>`;
        s += flag(x + w * 0.5, y + h * 0.5, Hh + 26, "#3d6bc2");
        s += sign(x, y, w, h, Hh - 6, "ШКОЛА") + door(x, y, w, h);
        return s;
    }
    case "factory": {
        const Hh = 54;
        s += box(x, y, w - 30, h, Hh, PALETTE.factory);
        for (let i = 0; i < 4; i++) {
            const sx = x + i * ((w - 30) / 4);
            s += gable(sx, y, (w - 30) / 4, h, Hh, 14, "#7a6a5e", "#5a4a3e");
        }
        s += box(x + w - 26, y + h * 0.3, 18, 18, Hh + 90, PALETTE.factory);
        const [cx, cy] = P(x + w - 17, y + h * 0.3 + 9, Hh + 90);
        s += `<circle class="iso-smoke" cx="${cx}" cy="${cy - 6}" r="8" fill="#8a8494"/><circle class="iso-smoke iso-smoke-2" cx="${cx + 3}" cy="${cy - 6}" r="8" fill="#8a8494"/>`;
        s += windows("left", x, y, w - 30, h, Hh, 5, 1, "fac", 0.7);
        s += sign(x, y, w - 30, h, Hh - 4, "ЗАВОД") + door(x, y, w - 30, h);
        return s;
    }
    case "shop": {
        const Hh = 46;
        s += box(x, y, w, h, Hh, PALETTE.shop) + roofKit(x, y, w, h, Hh, { ac: false });
        s += `<g transform="${faceMatrix("left", x, y, w, h, Hh - 10)}">${Array.from({ length: 10 }, (_, i) => `<rect x="${i * w / 10}" y="0" width="${w / 10}" height="12" fill="${i % 2 ? "#efe6d8" : "#d64545"}"/>`).join("")}</g>`;
        s += `<g transform="${faceMatrix("left", x, y, w, h, 30)}"><rect x="14" width="${w - 28}" height="22" fill="#f2c46a" opacity=".85"/></g>`;
        s += sign(x, y, w, h, Hh + 22, "МАГАЗИН");
        return s;
    }
    case "army": {
        const Hh = 40;
        s += `<polygon points="${pts([P(x, y), P(x + w, y), P(x + w, y + h), P(x, y + h)])}" fill="none" stroke="#6d6a5a" stroke-width="2.5" stroke-dasharray="7 5"/>`;
        s += box(x + 14, y + 50, w - 70, h - 64, Hh, PALETTE.army) + roofKit(x + 14, y + 50, w - 70, h - 64, Hh, { ac: false });
        s += windows("left", x + 14, y + 50, w - 70, h - 64, Hh, 5, 1, "arm", 0.5);
        s += box(x + w - 36, y + 18, 16, 16, 86, { top: "#6d6a5a", left: "#5a5a48", right: "#48483a" });
        const [lx, ly] = P(x + w - 28, y + 26, 86);
        s += `<circle class="iso-beacon" cx="${lx}" cy="${ly - 6}" r="4" fill="#ffd08a"/>`;
        s += flag(x + 30, y + 30, 0, "#5a8a3a");
        s += sign(x + 14, y + 50, w - 70, h - 64, Hh + 20, "ВОЕННАЯ БАЗА");
        return s;
    }
    case "office": {
        const H1 = 150, H2 = 110;
        const w1 = w * 0.48;
        s += box(x, y, w1, h * 0.7, H1, PALETTE.office) + roofKit(x, y, w1, h * 0.7, H1);
        s += windows("left", x, y, w1, h * 0.7, H1, 3, 8, "offA", 0.5) + windows("right", x, y, w1, h * 0.7, H1, 3, 8, "offA2", 0.5);
        s += box(x + w1 + 12, y + 20, w - w1 - 12, h - 20, H2, { top: "#62708e", left: "#505c7a", right: "#3e4760" }) + roofKit(x + w1 + 12, y + 20, w - w1 - 12, h - 20, H2);
        s += windows("left", x + w1 + 12, y + 20, w - w1 - 12, h - 20, H2, 3, 6, "offB", 0.5) + windows("right", x + w1 + 12, y + 20, w - w1 - 12, h - 20, H2, 4, 6, "offB2", 0.5);
        s += sign(x + w1 + 12, y + 20, w - w1 - 12, h - 20, 26, "ДЕЛОВОЙ КВАРТАЛ");
        return s;
    }
    case "government": {
        const Hh = 70;
        s += box(x, y + 20, w, h - 20, Hh, PALETTE.gov) + gable(x, y + 20, w, h - 20, Hh, 20, "#bdb39f", "#9a917e");
        s += `<g transform="${faceMatrix("left", x, y + 20, w, h - 20, Hh - 6)}">${Array.from({ length: 6 }, (_, i) => `<rect x="${10 + i * (w - 30) / 5}" width="8" height="${Hh - 10}" fill="#f4efe4"/>`).join("")}</g>`;
        s += flag(x + w / 2, y + 20 + (h - 20) / 2, Hh + 20, "#d4af37");
        s += sign(x, y + 20, w, h - 20, 24, "ГОС. УПРАВЛЕНИЕ", { bg: "#2a2f45", fg: "#f3e2a8", stroke: "#d4af37" });
        return s;
    }
    case "residence": {
        const Hh = 34;
        s += box(x, y, w, h, Hh, { top: "#efe2c6", left: "#e8dcc0", right: "#c9bda2" }) + gable(x, y, w, h, Hh, 14, "#8a5a3a", "#6e4a2a");
        s += windows("left", x, y, w, h, Hh, 3, 1, "res", 0.9) + door(x, y, w, h);
        return s;
    }
    case "official_house": {
        const Hh = 16;
        s += box(x, y, w, h, Hh, { top: "#e8dcc0", left: "#d9c9ae", right: "#b9a98e" }) + gable(x, y, w, h, Hh, 9, "#8a5a3a", "#6e4a2a");
        return s;
    }
    case "dorm": {
        const Hh = extra.height || 120;
        s += box(x, y, w, h, Hh, PALETTE.dorm) + roofKit(x, y, w, h, Hh, { tank: extra.number % 2 === 1 });
        s += windows("left", x, y, w, h, Hh, Math.max(3, Math.round(w / 20)), 5, `dorm${extra.number}`, 0.5);
        s += windows("right", x, y, w, h, Hh, Math.max(3, Math.round(h / 20)), 5, `dorm${extra.number}b`, 0.5);
        s += sign(x, y, w, h, 26, `№${extra.number} · ${extra.count}/20`) + door(x, y, w, h);
        return s;
    }
    case "private_gate": {
        for (let i = 0; i < 3; i++) {
            const hx = x + 12 + i * ((w - 24) / 3);
            const hw = (w - 24) / 3 - 10;
            const roof = ["#b8574a", "#4a6fa0", "#5a8a5a"][i];
            s += box(hx, y + 60, hw, 50, 24, { top: "#efe2c6", left: "#e0d0b0", right: "#c0b090" }) + gable(hx, y + 60, hw, 50, 24, 14, roof, roof);
        }
        s += `<polygon points="${pts([P(x, y + 10), P(x + w, y + 10), P(x + w, y + 14), P(x, y + 14)])}" fill="#8a7050"/>`;
        s += box(x + w / 2 - 34, y + 6, 6, 6, 30, { top: "#a08060", left: "#8a7050", right: "#6e5a40" });
        s += box(x + w / 2 + 28, y + 6, 6, 6, 30, { top: "#a08060", left: "#8a7050", right: "#6e5a40" });
        s += sign(x, y + 150, w, 10, 22, "ЧАСТНЫЙ СЕКТОР");
        return s;
    }
    default:
        return box(x, y, w, h, 40, PALETTE.dorm);
    }
}

// ---------- транспорт и люди ----------
function carBox(dx, dy, body, cabTop, extra = "", long = false) {
    const Pc = (x, y, z = 0) => [(x - y) * C, (x + y) * 0.5 - z];
    const boxL = (x, y, w, h, Hh, c, z0 = 0) => {
        const top = [Pc(x, y, Hh), Pc(x + w, y, Hh), Pc(x + w, y + h, Hh), Pc(x, y + h, Hh)];
        const right = [Pc(x + w, y, z0), Pc(x + w, y + h, z0), Pc(x + w, y + h, Hh), Pc(x + w, y, Hh)];
        const left = [Pc(x, y + h, z0), Pc(x + w, y + h, z0), Pc(x + w, y + h, Hh), Pc(x, y + h, Hh)];
        return `<polygon points="${pts(left)}" fill="${c.left}"/><polygon points="${pts(right)}" fill="${c.right}"/><polygon points="${pts(top)}" fill="${c.top}"/>`;
    };
    const alongX = dx !== 0;
    const L = long ? 34 : 26, Wd = 13, Hc = long ? 12 : 9;
    const [w, h] = alongX ? [L, Wd] : [Wd, L];
    const x = -w / 2, y = -h / 2;
    const fwd = alongX ? dx : dy;
    const cabOff = fwd > 0 ? L - 16 : 4;
    const cab = alongX ? [x + cabOff, y + 1, 12, Wd - 2] : [x + 1, y + cabOff, Wd - 2, 12];
    const front = alongX ? (dx > 0 ? [x + w, y + h / 2] : [x, y + h / 2]) : (dy > 0 ? [x + w / 2, y + h] : [x + w / 2, y]);
    const [fx, fy] = Pc(front[0], front[1], 4);
    return `<ellipse cx="0" cy="3" rx="${long ? 22 : 18}" ry="8" fill="#000" opacity=".3"/>
        ${boxL(x, y, w, h, Hc, body)}
        ${boxL(cab[0], cab[1], cab[2], cab[3], Hc + 6, { top: cabTop, left: "#8fd3ff", right: "#6fb3df" }, Hc)}
        ${extra}
        <circle cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" r="2.2" fill="#fff7d6"/>`;
}

function sprite(kind, dx, dy, now) {
    const custom = CITY_MAP_ASSETS.vehicles[kind === "robbery" ? "thief" : kind];
    if (custom) return `<image href="${custom}" x="-22" y="-24" width="44" height="28" preserveAspectRatio="xMidYMax meet" ${dx < 0 || dy > 0 ? 'transform="scale(-1,1)"' : ""}/>`;
    const blink = Math.floor(now / 280) % 2;
    const legA = Math.sin(now / 90) * 3;
    switch (kind) {
    case "taxi": return carBox(dx, dy, { top: "#f7d24a", left: "#e0b830", right: "#c49c20" }, "#2a2540", `<rect x="-4" y="-23" width="8" height="4" rx="1" fill="#1d1a2b"/>`);
    case "doctor": return carBox(dx, dy, { top: "#f4f1ea", left: "#dcd8cf", right: "#bdb9b0" }, "#d64545", `<rect x="-3" y="-25" width="6" height="4" fill="${blink ? "#ff4d4d" : "#3d7bff"}"/>`, true);
    case "firefighter": return carBox(dx, dy, { top: "#d64535", left: "#c8362d", right: "#a02a22" }, "#efe6d8", `<rect x="-10" y="-20" width="20" height="3" fill="#d9d2c5"/><rect x="-3" y="-26" width="6" height="4" fill="${blink ? "#ff4d4d" : "#ffd08a"}"/>`, true);
    case "police": return carBox(dx, dy, { top: "#e8ecf5", left: "#c9cfdc", right: "#a9afbc" }, "#2a3552", `<rect x="-6" y="-24" width="5" height="4" fill="${blink ? "#ff4d4d" : "#6d2a2a"}"/><rect x="1" y="-24" width="5" height="4" fill="${blink ? "#2a3a6d" : "#3d7bff"}"/>`);
    case "car": return carBox(dx, dy, { top: "#7fb7ff", left: "#5a93d8", right: "#4274b0" }, "#2a2540");
    case "courier": return `<ellipse cx="0" cy="3" rx="11" ry="5" fill="#000" opacity=".3"/>
        <rect x="-9" y="-6" width="18" height="6" rx="3" fill="#5ecfa0"/>
        <circle cx="-7" cy="1" r="3" fill="#1d1a2b"/><circle cx="7" cy="1" r="3" fill="#1d1a2b"/>
        <rect x="-11" y="-19" width="9" height="10" rx="1.5" fill="#f2a24a"/>
        <rect x="-1" y="-18" width="5" height="10" rx="2" fill="#3a3e4a"/><circle cx="1.5" cy="-21" r="4" fill="#d64545"/>`;
    case "robbery": {
        const crouch = Math.abs(Math.sin(now / 400)) * 2;
        return `<ellipse cx="0" cy="2" rx="6" ry="3" fill="#000" opacity=".3"/>
            <line x1="-1" y1="-7" x2="${-2 + legA}" y2="1" stroke="#16131f" stroke-width="2.5" stroke-linecap="round"/>
            <line x1="1" y1="-7" x2="${2 - legA}" y2="1" stroke="#16131f" stroke-width="2.5" stroke-linecap="round"/>
            <rect x="-5" y="${-17 + crouch}" width="10" height="11" rx="3" fill="#2a2a30"/>
            <path d="M-5 ${-19 + crouch} a5 5 0 0 1 10 0 v3 h-10 z" fill="#1d1a2b"/>
            <circle cx="-1.5" cy="${-18 + crouch}" r="0.9" fill="#ff5a5f"/><circle cx="1.5" cy="${-18 + crouch}" r="0.9" fill="#ff5a5f"/>`;
    }
    default: { // пешеход (учитель, прохожие)
        const shirt = kind === "teacher" ? "#8a5aa0" : ["#4a6fa0", "#5a8a5a", "#b8574a", "#c98a3a"][Math.abs(dx * 3 + dy) % 4];
        return `<ellipse cx="0" cy="2" rx="6" ry="3" fill="#000" opacity=".3"/>
            <line x1="-1" y1="-8" x2="${-2 + legA}" y2="1" stroke="#3a3e4a" stroke-width="2.5" stroke-linecap="round"/>
            <line x1="1" y1="-8" x2="${2 - legA}" y2="1" stroke="#3a3e4a" stroke-width="2.5" stroke-linecap="round"/>
            <rect x="-4" y="-18" width="8" height="11" rx="3" fill="${shirt}"/><circle cx="0" cy="-22" r="4" fill="#e8c4a0"/>`;
    }
    }
}

// ---------- экран ----------
export async function renderIsoCityMap(overlay, helpers) {
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
    overlay.innerHTML = `
        <div class="map-fullscreen-header">
            <div class="map-fullscreen-title">🗺 Карта города</div>
            <button class="btn btn-secondary" id="map-close-btn">✕ Закрыть карту</button>
        </div>
        <div class="iso-zoom"><button class="iso-zoom-btn" data-z="-1" aria-label="Отдалить">−</button><button class="iso-zoom-btn" data-z="1" aria-label="Приблизить">+</button></div>
        <div class="iso-scroll" id="iso-scroll"></div>
        <div class="map-legend">Двигай карту пальцем, приближай кнопками. Нажимай на здания, общаги и машины — узнаешь подробности.</div>`;
    overlay.querySelector("#map-close-btn").onclick = () => { stopAll(); overlay.remove(); };

    const places = {};
    const objects = [];
    const solids = []; // {depth, svg, idx}
    const addSolid = (r, svg, obj) => {
        const idx = obj ? objects.push(obj) - 1 : -1;
        solids.push({ depth: r.x + r.w / 2 + r.y + r.h / 2, svg, idx });
    };

    BUILDINGS.forEach((b) => {
        let r = cellRect(b.cell[0], b.cell[1]);
        if (b.code === "government" && map.president_residence) r = { ...r, w: r.w - 56 };
        const pts2 = doorPoints(r, b.door);
        b.labels.forEach((l) => { places[l] = pts2; });
        places[b.code] = pts2;
        addSolid(r, drawBuilding(b.code, r), { kind: "building", b });
    });
    const gov = cellRect(1, 0);
    if (map.president_residence) {
        const rr = { x: gov.x + gov.w - 48, y: gov.y + 60, w: 48, h: 64 };
        addSolid(rr, drawBuilding("residence", rr), { kind: "person", person: map.president_residence });
    }
    map.official_houses.slice(0, 5).forEach((p, i) => {
        const rr = { x: COLS[1][0] + 2, y: ROWS[0][0] + 24 + i * 30, w: 20, h: 22 };
        addSolid(rr, drawBuilding("official_house", rr), { kind: "person", person: p });
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
        const dw = (blk.w - gap * (cols - 1)) / cols;
        const dh = (blk.h - gap * (rowsN - 1)) / rowsN;
        const r = { x: blk.x + (j % cols) * (dw + gap), y: blk.y + Math.floor(j / cols) * (dh + gap), w: dw, h: dh };
        const side = Math.floor(j / cols) < rowsN / 2 ? "top" : "bottom";
        places[`dorm-${dorm.number}`] = doorPoints(r, side);
        addSolid(r, drawBuilding("dorm", r, { number: dorm.number, count: dorm.residents.length, height: 90 + (dorm.number % 3) * 22 }), { kind: "dorm", dorm });
    });
    // деревья и фонари — тоже объекты с глубиной
    COLS.forEach(([x0, x1], ci) => ROWS.forEach(([y0, y1], ri) => {
        const tx = (ci + ri) % 2 ? x0 + 12 : x1 - 12;
        const ty = y1 - 12;
        solids.push({ depth: tx + ty, svg: tree(tx, ty), idx: -1 });
    }));
    V_STREETS.forEach((vx) => H_STREETS.forEach((hy) => {
        [[-1, -1], [1, 1]].forEach(([dx, dy]) => {
            const lx = vx + dx * (ROAD / 2 + 10), ly = hy + dy * (ROAD / 2 + 10);
            solids.push({ depth: lx + ly + 1, svg: lamp(lx, ly), idx: -1 });
        });
    }));
    solids.sort((a, b) => a.depth - b.depth);

    const scroll = overlay.querySelector("#iso-scroll");
    scroll.innerHTML = `
        <svg viewBox="0 0 ${VIEW_W} ${VIEW_H}" class="iso-city iso-city-full" id="iso-svg">
            ${groundSvg()}
            <g id="iso-objects">${solids.map((o) => `<g class="iso-obj${o.idx >= 0 ? " city-obj" : ""}" data-depth="${o.depth.toFixed(0)}" ${o.idx >= 0 ? `data-obj="${o.idx}"` : ""}>${o.svg}</g>`).join("")}</g>
        </svg>`;

    // масштаб: на телефоне по умолчанию приближено, центр — Госуправление
    const svg = scroll.querySelector("#iso-svg");
    let zi = window.innerWidth < 700 ? 1 : 0;
    const applyZoom = () => {
        const base = Math.min(scroll.clientWidth || 360, 1100);
        svg.style.width = `${Math.round(base * ZOOMS[zi])}px`;
    };
    applyZoom();
    const [gx, gy] = P(W / 2, H * 0.35);
    requestAnimationFrame(() => {
        const k = svg.clientWidth / VIEW_W;
        scroll.scrollLeft = gx * k - scroll.clientWidth / 2;
        scroll.scrollTop = gy * k - scroll.clientHeight / 2;
    });
    overlay.querySelectorAll(".iso-zoom-btn").forEach((b) => {
        b.onclick = () => {
            const cx = (scroll.scrollLeft + scroll.clientWidth / 2) / svg.clientWidth;
            const cy = (scroll.scrollTop + scroll.clientHeight / 2) / svg.clientHeight;
            zi = Math.max(0, Math.min(ZOOMS.length - 1, zi + Number(b.dataset.z)));
            applyZoom();
            scroll.scrollLeft = cx * svg.clientWidth - scroll.clientWidth / 2;
            scroll.scrollTop = cy * svg.clientHeight - scroll.clientHeight / 2;
        };
    });

    scroll.querySelectorAll(".city-obj").forEach((g) => {
        const o = objects[Number(g.dataset.obj)];
        g.addEventListener("click", () => {
            if (o.kind === "building" && o.b.code === "private_gate") renderIsoPrivateSector(overlay, helpers);
            else if (o.kind === "building") showBuildingInfo(o.b, helpers, overlay);
            else if (o.kind === "dorm") helpers.showDormPeople(overlay, o.dorm);
            else if (o.kind === "person") helpers.showPublicProfile(overlay, o.person.vk_id);
        });
    });

    // ---------- движение ----------
    const layer = scroll.querySelector("#iso-objects");
    const movers = [];
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
            if (d && places[`dorm-${d.number}`]) return places[`dorm-${d.number}`];
            return places.private_gate;
        }
        return places.office;
    };
    const addMover = (kind, path, speed, opts = {}) => {
        const el = document.createElementNS("http://www.w3.org/2000/svg", "g");
        el.setAttribute("class", `iso-mover${opts.mv ? " city-vehicle" : ""}`);
        layer.appendChild(el);
        if (opts.mv) el.addEventListener("click", () => showMovementInfo(opts.mv, helpers, overlay));
        let len = 0;
        const segs = [];
        for (let i = 1; i < path.length; i++) {
            const d = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
            segs.push({ a: path[i - 1], b: path[i], d, start: len });
            len += d;
        }
        movers.push({ kind, el, segs, len, dist: opts.startAt ? len * opts.startAt : 0, speed, loop: !!opts.loop, lane: opts.lane || 0 });
    };
    const spawn = (list) => list.forEach((mv) => {
        if (seen.has(mv.id)) return;
        seen.add(mv.id);
        const from = resolve(mv.from_label, mv), to = resolve(mv.to_label, mv);
        if (!from || !to) return;
        const path = [from.door, ...shortestRoute(from.curb, to.curb), to.door];
        const walker = ["teacher", "robbery"].includes(mv.kind);
        addMover(mv.kind, path, walker ? 34 : 95, { mv, lane: walker ? 26 : 9 });
    });
    spawn(movements);

    // фоновая жизнь: прохожие по тротуарам и машины по кругу
    const ringRoute = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }, { x: x0, y: y0 }];
    addMover("car", ringRoute(V_STREETS[0], H_STREETS[0], V_STREETS[1], H_STREETS[1]), 60, { loop: true, lane: 9, startAt: 0.1 });
    addMover("car", ringRoute(V_STREETS[0], H_STREETS[1], V_STREETS[1], H_STREETS[2]), 55, { loop: true, lane: 9, startAt: 0.6 });
    addMover("taxi", ringRoute(V_STREETS[0], H_STREETS[0], V_STREETS[1], H_STREETS[2]), 70, { loop: true, lane: 9, startAt: 0.35 });
    [0.05, 0.3, 0.55, 0.8].forEach((t, i) => addMover("walker", ringRoute(V_STREETS[0], H_STREETS[i % 2], V_STREETS[1], H_STREETS[(i % 2) + 1]), 18, { loop: true, lane: 28, startAt: t }));

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
                if (m.loop) m.dist %= m.len;
                else {
                    m.el.style.transition = "opacity .8s";
                    m.el.style.opacity = "0";
                    const el = m.el;
                    setTimeout(() => el.remove(), 900);
                    movers.splice(i, 1);
                    continue;
                }
            }
            const seg = m.segs.find((s) => m.dist <= s.start + s.d) || m.segs[m.segs.length - 1];
            const t = seg.d ? (m.dist - seg.start) / seg.d : 1;
            const dx = Math.sign(seg.b.x - seg.a.x), dy = Math.sign(seg.b.y - seg.a.y);
            // правостороннее движение: смещаемся от оси улицы вправо по ходу
            const ox = -dy * m.lane, oy = dx * m.lane;
            const x = seg.a.x + (seg.b.x - seg.a.x) * t + ox;
            const y = seg.a.y + (seg.b.y - seg.a.y) * t + oy;
            const [sx, sy] = P(x, y);
            m.el.innerHTML = sprite(m.kind, dx, dy, now);
            m.el.setAttribute("transform", `translate(${sx.toFixed(1)},${sy.toFixed(1)})`);
            const depth = x + y;
            const next = solidEls.find((o) => Number(o.dataset.depth) > depth + 40);
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

function groundSvg() {
    const bg = CITY_MAP_ASSETS.background;
    let g = `<rect width="${VIEW_W}" height="${VIEW_H}" fill="#16131f"/>`;
    // остров с толщиной
    g += `<polygon points="${pts([P(0, H, 0), P(W, H, 0), P(W, H, -SLAB), P(0, H, -SLAB)])}" fill="#1b1726"/>`;
    g += `<polygon points="${pts([P(W, 0, 0), P(W, H, 0), P(W, H, -SLAB), P(W, 0, -SLAB)])}" fill="#141120"/>`;
    g += tile(0, 0, W, H, "#241f33");
    if (bg) {
        const [lx] = P(0, H), [rx] = P(W, 0), [, ty] = P(0, 0), [, by] = P(W, H);
        g += `<image href="${bg}" x="${lx}" y="${ty}" width="${rx - lx}" height="${by - ty}" preserveAspectRatio="none" opacity=".9"/>`;
        if (CITY_MAP_ASSETS.hideDrawnGround) return g;
    }
    COLS.forEach(([x0, x1]) => ROWS.forEach(([y0, y1]) => {
        g += tile(x0 + 2, y0 + 2, x1 - x0 - 4, y1 - y0 - 4, "#3a3550");
        g += tile(x0 + 7, y0 + 7, x1 - x0 - 14, y1 - y0 - 14, "#2e2940");
    }));
    H_STREETS.forEach((y) => { g += tile(0, y - ROAD / 2, W, ROAD, "#2b2830"); });
    V_STREETS.forEach((x) => { g += tile(x - ROAD / 2, 0, ROAD, H, "#2b2830"); });
    // разметка: пунктир по осям, вне перекрёстков
    const isCross = (v, list) => list.some((c) => Math.abs(v - c) < 26);
    H_STREETS.forEach((y) => { for (let x = 6; x < W; x += 26) if (!isCross(x, V_STREETS)) { const [a, b] = P(x, y), [c, d] = P(x + 13, y); g += `<line x1="${a.toFixed(1)}" y1="${b.toFixed(1)}" x2="${c.toFixed(1)}" y2="${d.toFixed(1)}" stroke="#c9b87a" stroke-width="2" opacity=".7"/>`; } });
    V_STREETS.forEach((x) => { for (let y = 6; y < H; y += 26) if (!isCross(y, H_STREETS)) { const [a, b] = P(x, y), [c, d] = P(x, y + 13); g += `<line x1="${a.toFixed(1)}" y1="${b.toFixed(1)}" x2="${c.toFixed(1)}" y2="${d.toFixed(1)}" stroke="#c9b87a" stroke-width="2" opacity=".7"/>`; } });
    // зебры на всех четырёх подходах к перекрёстку
    V_STREETS.forEach((vx) => H_STREETS.forEach((hy) => {
        for (let i = 0; i < 6; i++) {
            g += tile(vx - 18 + i * 7, hy + 22, 4, 12, "#d9d3e3", 'opacity=".75"');
            g += tile(vx - 18 + i * 7, hy - 34, 4, 12, "#d9d3e3", 'opacity=".75"');
            g += tile(vx + 22, hy - 18 + i * 7, 12, 4, "#d9d3e3", 'opacity=".75"');
            g += tile(vx - 34, hy - 18 + i * 7, 12, 4, "#d9d3e3", 'opacity=".75"');
        }
    }));
    return g;
}

// ---------- частный сектор в изометрии ----------
async function renderIsoPrivateSector(overlay, helpers) {
    stopAll();
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
        <div class="iso-scroll" id="iso-scroll"></div>
        <div class="map-legend">Нажми на дом — откроется профиль владельца. Свободные участки ждут новых хозяев.</div>`;
    overlay.querySelector("#map-back-btn").onclick = () => renderIsoCityMap(overlay, helpers);

    const houses = data.houses;
    const perRow = 4;
    const total = Math.max(8, Math.ceil((houses.length + 2) / perRow) * perRow);
    const rows = total / perRow;
    const PW = 150, PH = 130, ROADY = 50;
    const SW = perRow * PW;
    const SH = Math.ceil(rows / 2) * (PH * 2 + ROADY) + 20;
    const sx0 = SH * C + 40, sy0 = 120;
    const Q = (x, y, z = 0) => [(x - y) * C + sx0, (x + y) * 0.5 - z + sy0];
    const qtile = (x, y, w, h, fill, extra = "") => `<polygon points="${pts([Q(x, y), Q(x + w, y), Q(x + w, y + h), Q(x, y + h)])}" fill="${fill}" ${extra}/>`;
    const vw = Math.ceil((SW + SH) * C + 80), vh = Math.ceil((SW + SH) * 0.5 + 200);

    let g = `<rect width="${vw}" height="${vh}" fill="#16131f"/>`;
    g += `<polygon points="${pts([Q(0, SH, 0), Q(SW, SH, 0), Q(SW, SH, -SLAB), Q(0, SH, -SLAB)])}" fill="#1b1726"/>`;
    g += `<polygon points="${pts([Q(SW, 0, 0), Q(SW, SH, 0), Q(SW, SH, -SLAB), Q(SW, 0, -SLAB)])}" fill="#141120"/>`;
    g += qtile(0, 0, SW, SH, "#243a2e");
    for (let gi = 0; gi < Math.ceil(rows / 2); gi++) {
        const ry = 10 + gi * (PH * 2 + ROADY) + PH;
        g += qtile(0, ry, SW, ROADY, "#2b2830");
        for (let x = 6; x < SW; x += 26) { const [a, b] = Q(x, ry + ROADY / 2), [c, d] = Q(x + 13, ry + ROADY / 2); g += `<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="#c9b87a" stroke-width="2" opacity=".7"/>`; }
    }
    const items = [];
    for (let i = 0; i < total; i++) {
        const row = Math.floor(i / perRow), col = i % perRow;
        const gi = Math.floor(row / 2), top = row % 2 === 0;
        const x = col * PW + 10, y = 10 + gi * (PH * 2 + ROADY) + (top ? 0 : PH + ROADY);
        const house = houses[i] || null;
        let s = qtile(x, y, PW - 20, PH - 20, "#2f4a3a");
        // забор по краю участка
        s += `<polygon points="${pts([Q(x, y + PH - 22), Q(x + PW - 20, y + PH - 22), Q(x + PW - 20, y + PH - 22, 8), Q(x, y + PH - 22, 8)])}" fill="#8a7050" opacity=".9"/>`;
        if (!house) {
            const [tx, ty] = Q(x + (PW - 20) / 2, y + (PH - 20) / 2);
            s += `<rect x="${tx - 25}" y="${ty - 26}" width="50" height="16" rx="2" fill="#efe2c6"/><rect x="${tx - 1}" y="${ty - 10}" width="2" height="12" fill="#8a7050"/>
                <text x="${tx}" y="${ty - 15}" text-anchor="middle" font-size="8" fill="#3a2a1a" font-family="Golos Text, sans-serif">продаётся</text>`;
            items.push({ depth: x + y, svg: s, house: null });
            continue;
        }
        const h = hash(house.vk_id);
        const roof = ["#b8574a", "#4a6fa0", "#5a8a5a", "#8a5aa0", "#a0784a"][h % 5];
        const wall = [{ top: "#efe2c6", left: "#e0d0b0", right: "#c0b090" }, { top: "#e8e2d8", left: "#d8d2c8", right: "#b8b2a8" }, { top: "#d8c8b0", left: "#c9b8a0", right: "#a99880" }][(h >> 3) % 3];
        const hw = 70 + ((h >> 5) % 3) * 10, hd = 55;
        const hx = x + (PW - 20 - hw) / 2, hy = y + 20;
        const Hh = 26 + ((h >> 7) % 2) * 10;
        const Pq = Q;
        const boxQ = (bx, by, bw, bh, bH, c, z0 = 0) => {
            const t = [Pq(bx, by, bH), Pq(bx + bw, by, bH), Pq(bx + bw, by + bh, bH), Pq(bx, by + bh, bH)];
            const r = [Pq(bx + bw, by, z0), Pq(bx + bw, by + bh, z0), Pq(bx + bw, by + bh, bH), Pq(bx + bw, by, bH)];
            const l = [Pq(bx, by + bh, z0), Pq(bx + bw, by + bh, z0), Pq(bx + bw, by + bh, bH), Pq(bx, by + bh, bH)];
            return `<polygon points="${pts(l)}" fill="${c.left}"/><polygon points="${pts(r)}" fill="${c.right}"/><polygon points="${pts(t)}" fill="${c.top}"/>`;
        };
        if (house.house_skin) {
            const [ix, iy] = Q(hx + hw / 2, hy + hd / 2, 30);
            s += `<image href="assets/houses/${house.house_skin}.png" x="${ix - 50}" y="${iy - 50}" width="100" height="90" preserveAspectRatio="xMidYMax meet"/>`;
        } else if (CITY_MAP_ASSETS.defaultHouse) {
            const [ix, iy] = Q(hx + hw / 2, hy + hd / 2, 30);
            s += `<image href="${CITY_MAP_ASSETS.defaultHouse}" x="${ix - 50}" y="${iy - 50}" width="100" height="90" preserveAspectRatio="xMidYMax meet"/>`;
        } else {
            s += boxQ(hx, hy, hw, hd, Hh, wall);
            const a = [Pq(hx, hy, Hh), Pq(hx + hw, hy, Hh), Pq(hx + hw, hy + hd / 2, Hh + 18), Pq(hx, hy + hd / 2, Hh + 18)];
            const b = [Pq(hx, hy + hd / 2, Hh + 18), Pq(hx + hw, hy + hd / 2, Hh + 18), Pq(hx + hw, hy + hd, Hh), Pq(hx, hy + hd, Hh)];
            s += `<polygon points="${pts(a)}" fill="${roof}" opacity=".8"/><polygon points="${pts(b)}" fill="${roof}"/>`;
            const [wx, wy] = Pq(hx + 10, hy + hd, Hh - 6);
            const lit = (h >> 9) % 3 !== 0;
            s += `<g transform="matrix(${C},0.5,0,1,${wx},${wy})"><rect width="14" height="11" fill="${lit ? "#f2c46a" : "#2a2540"}"/><rect x="${hw - 34}" width="14" height="11" fill="#f2c46a"/><rect x="${hw / 2 - 12}" y="4" width="12" height="16" fill="#5a3a2a"/></g>`;
            if ((h >> 11) % 2) s += boxQ(hx + hw * 0.7, hy + 8, 8, 8, Hh + 26, { top: "#8e3f35", left: "#6e4a3a", right: "#5a3a2a" }, Hh);
        }
        const [nx, ny] = Q(x + (PW - 20) / 2, y + PH - 22, 22);
        const label = house.username ? "@" + house.username : "ID " + house.vk_id;
        s += `<rect x="${nx - 34}" y="${ny - 11}" width="68" height="15" rx="3" fill="#3a2426" stroke="#f2a24a" stroke-width="1"/>
            <text x="${nx}" y="${ny}" text-anchor="middle" font-size="9" fill="#ffe3bd" font-family="Golos Text, sans-serif">${escapeHtml(label.slice(0, 14))}</text>`;
        items.push({ depth: x + y, svg: s, house });
    }
    items.sort((a, b) => a.depth - b.depth);
    const scroll = overlay.querySelector("#iso-scroll");
    scroll.innerHTML = `<svg viewBox="0 0 ${vw} ${vh}" class="iso-city iso-city-full" style="width:${Math.max(scroll.clientWidth || 360, 720)}px">${g}${items.map((it, i) => `<g ${it.house ? `class="city-obj" data-house="${i}"` : ""}>${it.svg}</g>`).join("")}</svg>`;
    scroll.querySelectorAll("[data-house]").forEach((el) => {
        const it = items[Number(el.dataset.house)];
        el.addEventListener("click", () => helpers.showPublicProfile(overlay, it.house.vk_id));
    });
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str ?? "");
    return div.innerHTML;
}
