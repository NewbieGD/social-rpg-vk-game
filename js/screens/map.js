import { apiFetch } from "../api.js";

const VIEW_W = 700;
const VIEW_H = 820;

const LANDMARK_COORDS = {
    "Полицейский участок": { x: 65, y: 300, icon: "👮" },
    "Больница": { x: 65, y: 440, icon: "🚑" },
    "Пожарная часть": { x: 65, y: 580, icon: "🚒" },
    "Школа": { x: 635, y: 300, icon: "🏫" },
    "Магазин": { x: 635, y: 440, icon: "🛍" },
    "Офис": { x: 635, y: 580, icon: "🏢" },
};

const RESIDENCE_ZONE = { x0: 285, x1: 415, y0: 40, y1: 95 };
const OFFICIAL_HOUSE_ZONE = { x0: 240, x1: 460, y0: 115, y1: 165 };
const PRIVATE_HOUSE_ZONE = { x0: 175, x1: 330, y0: 260, y1: 620 };
const DORM_ZONE = { x0: 370, x1: 525, y0: 260, y1: 620 };
const HOME_FALLBACK_ZONE = { x0: 175, x1: 525, y0: 260, y1: 620 };

function mixHash(seed) {
    // FNV-1a + финальное перемешивание (как у murmur) — простая function из
    // прошлой версии давала похожие координаты для похожих ID (1001 и 1002
    // оказывались почти в одной точке), эта даёт честный разброс.
    let h = 2166136261;
    const s = String(seed);
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
}

function hashCoord(seed, zone) {
    const hx = mixHash(seed + ":x");
    const hy = mixHash(seed + ":y");
    const fx = (hx % 1000) / 1000;
    const fy = (hy % 1000) / 1000;
    return { x: zone.x0 + fx * (zone.x1 - zone.x0), y: zone.y0 + fy * (zone.y1 - zone.y0) };
}

function coordForLabel(label, movementVkId) {
    if (LANDMARK_COORDS[label]) return LANDMARK_COORDS[label];
    return hashCoord(movementVkId, HOME_FALLBACK_ZONE);
}

export async function renderMapScreen(root) {
    root.innerHTML = `<div class="loading">Загружаем карту…</div>`;

    let map, movements;
    try {
        [map, movements] = await Promise.all([apiFetch("/api/map"), apiFetch("/api/map/movements")]);
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    root.innerHTML = `<div class="title">🗺 Карта города</div>`;

    const svgCard = document.createElement("div");
    svgCard.className = "card map-svg-card";
    root.appendChild(svgCard);

    const markers = [];

    Object.entries(LANDMARK_COORDS).forEach(([name, pos]) => {
        markers.push({ x: pos.x, y: pos.y, icon: pos.icon, label: name, kind: "landmark" });
    });

    if (map.president_residence) {
        const pos = { x: (RESIDENCE_ZONE.x0 + RESIDENCE_ZONE.x1) / 2, y: (RESIDENCE_ZONE.y0 + RESIDENCE_ZONE.y1) / 2 };
        markers.push({ ...pos, icon: "🏰", label: "Резиденция Президента", person: map.president_residence, kind: "residence" });
    }

    map.official_houses.forEach((p) => {
        const pos = hashCoord(p.vk_id, OFFICIAL_HOUSE_ZONE);
        markers.push({ ...pos, icon: p.role === "Министр" ? "🏛" : "🏠", label: p.role, person: p, kind: "official" });
    });

    map.private_houses.forEach((p) => {
        const pos = hashCoord(p.vk_id, PRIVATE_HOUSE_ZONE);
        markers.push({ ...pos, icon: p.has_mansion ? "🏰" : "🏠", label: p.has_mansion ? "Особняк" : "Дом", person: p, kind: "house" });
    });

    map.dormitories.forEach((dorm) => {
        const pos = hashCoord(`dorm-${dorm.number}`, DORM_ZONE);
        markers.push({ ...pos, icon: "🏢", label: `Общага №${dorm.number}`, dorm, kind: "dorm" });
    });

    svgCard.innerHTML = buildSvg(markers, movements);
    wireMarkerClicks(root, svgCard, markers);

    renderDetailsBelow(root, map);
}

function buildSvg(markers, movements) {
    const markerEls = markers.map((m, i) => `
        <g class="map-marker" data-marker="${i}" transform="translate(${m.x},${m.y})">
            <circle r="16" class="map-marker-bg" />
            <text text-anchor="middle" dominant-baseline="central" font-size="16">${m.icon}</text>
        </g>
    `).join("");

    const movementEls = movements.map((mv, i) => {
        const from = coordForLabel(mv.from_label, mv.vk_id);
        const to = coordForLabel(mv.to_label, mv.vk_id);
        const pathId = `move-path-${i}`;
        return `
            <path id="${pathId}" d="M${from.x},${from.y} L${to.x},${to.y}" class="map-route-line" />
            <circle r="5" class="map-route-dot" data-movement="${i}">
                <animateMotion dur="3.5s" repeatCount="indefinite">
                    <mpath href="#${pathId}" />
                </animateMotion>
            </circle>
        `;
    }).join("");

    return `
        <svg viewBox="0 0 ${VIEW_W} ${VIEW_H}" class="map-svg">
            <defs>
                <radialGradient id="map-bg-gradient" cx="30%" cy="20%" r="90%">
                    <stop offset="0%" stop-color="#1a2340" />
                    <stop offset="55%" stop-color="#111830" />
                    <stop offset="100%" stop-color="#0a0f1e" />
                </radialGradient>
            </defs>
            <rect x="0" y="0" width="${VIEW_W}" height="${VIEW_H}" class="map-bg" />
            <rect x="210" y="25" width="280" height="155" class="map-zone" />
            <text x="350" y="18" text-anchor="middle" class="map-zone-label">Центр власти</text>
            <rect x="${PRIVATE_HOUSE_ZONE.x0 - 10}" y="${PRIVATE_HOUSE_ZONE.y0 - 10}" width="${PRIVATE_HOUSE_ZONE.x1 - PRIVATE_HOUSE_ZONE.x0 + 20}" height="${PRIVATE_HOUSE_ZONE.y1 - PRIVATE_HOUSE_ZONE.y0 + 20}" class="map-zone" />
            <text x="${(PRIVATE_HOUSE_ZONE.x0 + PRIVATE_HOUSE_ZONE.x1) / 2}" y="${PRIVATE_HOUSE_ZONE.y0 - 16}" text-anchor="middle" class="map-zone-label">Частные дома</text>
            <rect x="${DORM_ZONE.x0 - 10}" y="${DORM_ZONE.y0 - 10}" width="${DORM_ZONE.x1 - DORM_ZONE.x0 + 20}" height="${DORM_ZONE.y1 - DORM_ZONE.y0 + 20}" class="map-zone" />
            <text x="${(DORM_ZONE.x0 + DORM_ZONE.x1) / 2}" y="${DORM_ZONE.y0 - 16}" text-anchor="middle" class="map-zone-label">Общежития</text>
            ${movementEls}
            ${markerEls}
        </svg>
        <div class="map-legend">🔵 мигающая точка — кто-то в пути прямо сейчас (такси/машина/вызов службы)</div>
    `;
}

function wireMarkerClicks(root, svgCard, markers) {
    const groups = svgCard.querySelectorAll(".map-marker");
    groups.forEach((g) => {
        const idx = Number(g.getAttribute("data-marker"));
        const m = markers[idx];
        g.style.cursor = "pointer";
        g.addEventListener("click", () => {
            if (m.person) showPublicProfile(root, m.person.vk_id);
            else if (m.dorm) showDormPeople(root, m.dorm);
        });
    });
}

function renderDetailsBelow(root, map) {
    const buildingsSection = document.createElement("div");
    buildingsSection.className = "card";
    buildingsSection.innerHTML = `<div class="subtitle">Нажимай на точки на карте — здание/дом/общагу, чтобы узнать подробности.</div>`;
    root.appendChild(buildingsSection);

    const detail = document.createElement("div");
    detail.id = "map-detail";
    root.appendChild(detail);
}

async function showDormPeople(root, dorm) {
    const detail = root.querySelector("#map-detail");
    detail.innerHTML = "";
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<div class="subtitle">Общага №${dorm.number} — жильцы:</div>`;
    dorm.residents.forEach((p) => {
        const row = document.createElement("div");
        row.className = "map-person";
        const name = p.username ? "@" + escapeHtml(p.username) : "ID " + p.vk_id;
        row.textContent = `👤 ${name} — ${p.display_profession}`;
        row.onclick = () => showPublicProfile(root, p.vk_id);
        card.appendChild(row);
    });
    detail.appendChild(card);
    card.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function showPublicProfile(root, vkId) {
    const detail = root.querySelector("#map-detail");
    detail.innerHTML = "";
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<div class="loading">Загружаем профиль…</div>`;
    detail.appendChild(card);
    card.scrollIntoView({ behavior: "smooth", block: "nearest" });

    try {
        const p = await apiFetch(`/api/map/player/${vkId}`);
        const badges = [];
        if (p.founder_number) badges.push(`🏆 Основатель города №${p.founder_number}`);
        if (p.is_deputy) badges.push(`🏛 Депутат`);
        card.innerHTML = `
            <div class="title">${p.username ? "@" + escapeHtml(p.username) : "ID " + p.vk_id}</div>
            <div class="profile-row">💼 ${escapeHtml(p.display_profession)}</div>
            <div class="profile-row">⭐ Рейтинг: ${p.rating.toFixed(2)}</div>
            <div class="profile-row">⚔️ Побед в дуэлях: ${p.duel_wins}</div>
            ${badges.map((b) => `<div class="profile-row">${b}</div>`).join("")}
        `;
    } catch (e) {
        card.innerHTML = `<div class="error">${e.message}</div>`;
    }
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
