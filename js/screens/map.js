import { apiFetch } from "../api.js";

const VIEW_W = 700;
const VIEW_H = 820;

// 7 основных зданий страны — от них зависят игровые профессии/механики.
const LANDMARK_COORDS = {
    "Полицейский участок": { x: 65, y: 260, icon: "👮" },
    "Больница": { x: 65, y: 400, icon: "🚑" },
    "Пожарная часть": { x: 65, y: 540, icon: "🚒" },
    "Школа": { x: 65, y: 680, icon: "🏫" },
    "Завод": { x: 635, y: 400, icon: "🏭" },
    "Гос. управление": { x: 635, y: 540, icon: "🏛" },
    "Военная база": { x: 635, y: 680, icon: "🎖" },
};

const RESIDENCE_ZONE = { x0: 285, x1: 415, y0: 40, y1: 95 };
const OFFICIAL_HOUSE_ZONE = { x0: 240, x1: 460, y0: 115, y1: 165 };
const DORM_ZONE = { x0: 260, x1: 440, y0: 260, y1: 700 };
const HOME_FALLBACK_ZONE = { x0: 175, x1: 525, y0: 260, y1: 700 };
const PRIVATE_SECTOR_MARKER = { x: 350, y: 760 };

let movementPoll = null;

function mixHash(seed) {
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
    // Карта открывается ПОЛНОЭКРАННЫМ оверлеем поверх всего приложения, а не
    // внутри обычной вкладки — так и было задумано ("на весь экран").
    const overlay = document.createElement("div");
    overlay.className = "map-fullscreen-overlay";
    overlay.innerHTML = `<div class="loading">Загружаем карту…</div>`;
    document.body.appendChild(overlay);
    await renderCityMap(overlay);
}

function stopMapPolling() {
    if (movementPoll) {
        clearInterval(movementPoll);
        movementPoll = null;
    }
}

async function renderCityMap(overlay) {
    stopMapPolling();
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
        <div class="map-svg-wrap" id="map-svg-wrap"></div>
        <div id="map-detail"></div>
    `;
    overlay.querySelector("#map-close-btn").onclick = () => {
        stopMapPolling();
        overlay.remove();
    };

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

    map.dormitories.forEach((dorm) => {
        const pos = hashCoord(`dorm-${dorm.number}`, DORM_ZONE);
        markers.push({ ...pos, icon: "🏢", label: `Общага №${dorm.number}`, dorm, kind: "dorm" });
    });

    markers.push({
        ...PRIVATE_SECTOR_MARKER, icon: "🏘", label: "Частный сектор", kind: "private_sector_link",
        houseCount: map.private_sector.house_count,
    });

    renderSvg(overlay, markers, movements);
    wireMarkerClicks(overlay, markers);

    // Движения живут всего минуту — опрашиваем каждые 10 секунд, чтобы новые
    // появлялись и исчезнувшие с сервера сами пропадали с карты.
    movementPoll = setInterval(async () => {
        try {
            const fresh = await apiFetch("/api/map/movements");
            updateMovements(overlay, fresh);
        } catch (e) {
            // не критично — просто оставим карту как есть до следующего опроса
        }
    }, 10000);
}

function renderSvg(overlay, markers, movements) {
    const wrap = overlay.querySelector("#map-svg-wrap");
    const markerEls = markers.map((m, i) => {
        const badge = m.kind === "dorm" ? `<text x="12" y="-10" font-size="11" class="map-dorm-count">${m.dorm.residents.length}/20</text>` : "";
        const houseBadge = m.kind === "private_sector_link" ? `<text x="14" y="-10" font-size="11" class="map-dorm-count">${m.houseCount}🏠</text>` : "";
        const iconEl = m.kind === "dorm"
            ? `<image href="assets/dorms/dorm-lights.gif" x="-16" y="-16" width="32" height="32" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" /><text text-anchor="middle" dominant-baseline="central" font-size="16" style="display:none">${m.icon}</text>`
            : `<text text-anchor="middle" dominant-baseline="central" font-size="16">${m.icon}</text>`;
        return `
        <g class="map-marker map-marker-${m.kind}" data-marker="${i}" transform="translate(${m.x},${m.y})">
            <circle r="16" class="map-marker-bg" />
            ${iconEl}
            ${badge}${houseBadge}
            <text text-anchor="middle" y="28" font-size="9" class="map-marker-label">${escapeHtml(m.label)}</text>
        </g>
    `;
    }).join("");

    wrap.innerHTML = `
        <svg viewBox="0 0 ${VIEW_W} ${VIEW_H}" class="map-svg" id="map-svg-root">
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
            <rect x="${DORM_ZONE.x0 - 10}" y="${DORM_ZONE.y0 - 10}" width="${DORM_ZONE.x1 - DORM_ZONE.x0 + 20}" height="${DORM_ZONE.y1 - DORM_ZONE.y0 + 20}" class="map-zone" />
            <text x="${(DORM_ZONE.x0 + DORM_ZONE.x1) / 2}" y="${DORM_ZONE.y0 - 16}" text-anchor="middle" class="map-zone-label">Общежития</text>
            <g id="map-movements-group"></g>
            ${markerEls}
        </svg>
        <div class="map-legend">Нажимай на здание/дом/общагу — узнать подробности. Точки в пути пропадают через минуту.</div>
    `;
    updateMovements(overlay, movements);
}

function updateMovements(overlay, movements) {
    const svg = overlay.querySelector("#map-svg-root");
    if (!svg) return;
    const group = overlay.querySelector("#map-movements-group");
    if (!group) return;
    group.innerHTML = movements.map((mv, i) => {
        const from = coordForLabel(mv.from_label, mv.vk_id);
        const to = coordForLabel(mv.to_label, mv.vk_id);
        const pathId = `move-path-${i}`;
        return `
            <path id="${pathId}" d="M${from.x},${from.y} L${to.x},${to.y}" class="map-route-line" />
            <g class="map-moving-icon" data-movement="${i}">
                <animateMotion dur="4s" repeatCount="indefinite">
                    <mpath href="#${pathId}" />
                </animateMotion>
                <circle r="13" class="map-moving-bg" />
                <text text-anchor="middle" dominant-baseline="central" font-size="14">${mv.icon}</text>
                <circle r="7" cy="-18" class="map-moving-info-dot" />
                <text x="0" y="-18" text-anchor="middle" dominant-baseline="central" font-size="9" class="map-moving-info-i">i</text>
            </g>
        `;
    }).join("");

    group.querySelectorAll(".map-moving-icon").forEach((g) => {
        const idx = Number(g.getAttribute("data-movement"));
        const mv = movements[idx];
        g.style.cursor = "pointer";
        g.addEventListener("click", () => showMovementInfo(overlay, mv));
    });
}

function showMovementInfo(overlay, mv) {
    const detail = overlay.querySelector("#map-detail");
    detail.innerHTML = "";
    const card = document.createElement("div");
    card.className = "card map-detail-card";
    card.innerHTML = `<div class="subtitle">${mv.icon} ${escapeHtml(mv.message)}</div>`;
    const btn = document.createElement("button");
    btn.className = "btn btn-secondary";
    btn.textContent = "👤 Открыть профиль";
    btn.onclick = () => showPublicProfile(overlay, mv.vk_id);
    card.appendChild(btn);
    detail.appendChild(card);
}

function wireMarkerClicks(overlay, markers) {
    const groups = overlay.querySelectorAll(".map-marker");
    groups.forEach((g) => {
        const idx = Number(g.getAttribute("data-marker"));
        const m = markers[idx];
        g.style.cursor = "pointer";
        g.addEventListener("click", async () => {
            if (m.kind === "private_sector_link") await renderPrivateSectorMap(overlay);
            else if (m.person) await showPublicProfile(overlay, m.person.vk_id);
            else if (m.dorm) await showDormPeople(overlay, m.dorm);
        });
    });
}

async function showDormPeople(overlay, dorm) {
    const detail = overlay.querySelector("#map-detail");
    detail.innerHTML = "";
    const card = document.createElement("div");
    card.className = "card map-detail-card";
    card.innerHTML = `<div class="subtitle">Общага №${dorm.number} — жильцы (${dorm.residents.length}/20):</div>`;
    dorm.residents.forEach((p) => {
        const row = document.createElement("div");
        row.className = "map-person";
        const name = p.username ? "@" + escapeHtml(p.username) : "ID " + p.vk_id;
        row.textContent = `👤 ${name} — ${p.display_profession}`;
        row.onclick = () => showPublicProfile(overlay, p.vk_id);
        card.appendChild(row);
    });
    detail.appendChild(card);
}

async function renderPrivateSectorMap(overlay) {
    stopMapPolling();
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
        <div class="map-svg-wrap" id="map-svg-wrap"></div>
        <div id="map-detail"></div>
    `;
    overlay.querySelector("#map-back-btn").onclick = () => renderCityMap(overlay);

    const cols = Math.max(1, Math.ceil(Math.sqrt(data.houses.length || 1)));
    const cellW = VIEW_W / (cols + 1);
    const cellH = 110;
    const markers = data.houses.map((h, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        return {
            x: cellW * (col + 1), y: 70 + row * cellH, icon: h.house_skin ? null : "🏠",
            houseSkin: h.house_skin, label: h.username ? "@" + h.username : "ID " + h.vk_id,
            person: h, kind: "private_house",
        };
    });

    const wrap = overlay.querySelector("#map-svg-wrap");
    const viewH = Math.max(VIEW_H, 140 + Math.ceil(data.houses.length / cols) * cellH);
    const markerEls = markers.map((m, i) => `
        <g class="map-marker map-marker-private_house" data-marker="${i}" transform="translate(${m.x},${m.y})">
            ${m.houseSkin
                ? `<image href="assets/houses/${m.houseSkin}.png" x="-24" y="-24" width="48" height="48" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" /><text text-anchor="middle" dominant-baseline="central" font-size="22" style="display:none">🏠</text>`
                : `<text text-anchor="middle" dominant-baseline="central" font-size="22">🏠</text>`}
            <text text-anchor="middle" y="32" font-size="9" class="map-marker-label">${escapeHtml(m.label)}</text>
        </g>
    `).join("");

    wrap.innerHTML = `
        <svg viewBox="0 0 ${VIEW_W} ${viewH}" class="map-svg" id="map-svg-root">
            <rect x="0" y="0" width="${VIEW_W}" height="${viewH}" class="map-bg" />
            ${markerEls}
        </svg>
        <div class="map-legend">${data.houses.length ? "Нажимай на дом, чтобы узнать, кто владелец." : "Пока никто не купил себе дом."}</div>
    `;

    overlay.querySelectorAll(".map-marker").forEach((g) => {
        const idx = Number(g.getAttribute("data-marker"));
        const m = markers[idx];
        g.style.cursor = "pointer";
        g.addEventListener("click", () => showPublicProfile(overlay, m.person.vk_id));
    });
}

async function showPublicProfile(overlay, vkId) {
    const detail = overlay.querySelector("#map-detail");
    detail.innerHTML = "";
    const card = document.createElement("div");
    card.className = "card map-detail-card";
    card.innerHTML = `<div class="loading">Загружаем профиль…</div>`;
    detail.appendChild(card);

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
