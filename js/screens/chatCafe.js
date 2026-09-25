// Сцена над чатом: последние 10 вошедших сидят за столами (аватарка с
// купленной рамкой над персонажем, напиток на столе), остальные — «у
// стойки». Когда кто-то пишет, над ним всплывает облачко с текстом.
// Интерьер зависит от чата: кафе (общий), бар (воровской), зал заседаний
// (правительственный). Картинки — в js/chatCafeAssets.js.
import { apiFetch } from "../api.js";
import { avatarHtml } from "../cosmeticFrames.js";
import { CHAT_SCENE_ASSETS } from "../chatCafeAssets.js";

const REFRESH_MS = 6000;
const BUBBLE_MS = 4500;
const COUNTER_SHOWN = 12;
const SHIRTS = ["#b8574a", "#4a6fa0", "#5a8a5a", "#8a5aa0", "#c98a3a", "#3a8a8a", "#a04a6a", "#6a6a8a"];
const SUITS = ["#2f3a55", "#3a3a44", "#2a4a44", "#4a3a2f", "#3a2f4a"];

// ---------- Интерьеры ----------
const THEMES = {
    general: {
        sign: "Кафе «Путь»",
        counterLabel: "У стойки",
        decor: () => `
            <div class="cafe-wall"></div>
            <div class="cafe-window"></div>
            <div class="cafe-bar"><span></span><span></span><span></span><span></span></div>
            <div class="cafe-door"><span class="cafe-bell" data-bell>🔔</span></div>`,
        table: () => `<svg viewBox="0 0 72 30" class="cafe-table-svg" aria-hidden="true">
            <ellipse cx="36" cy="7" rx="34" ry="6" fill="#8a5a3a"/>
            <rect x="33" y="10" width="6" height="16" fill="#6e4a3a"/>
            <ellipse cx="36" cy="27" rx="14" ry="3" fill="#5a3a2a"/></svg>`,
        drink: () => `<div class="cafe-cup">
            <span class="cafe-steam"></span><span class="cafe-steam cafe-steam-2"></span>
            <svg viewBox="0 0 28 22" class="cafe-cup-svg" aria-hidden="true">
                <rect x="4" y="4" width="16" height="14" rx="3" fill="#efe6d8"/>
                <rect x="6" y="5" width="12" height="3" rx="1" fill="#6b3f22"/>
                <path d="M20 8 q6 0 6 5 q0 5 -6 5" stroke="#efe6d8" stroke-width="2.5" fill="none"/>
                <ellipse cx="12" cy="19" rx="11" ry="2.5" fill="#d9c9ae"/></svg></div>`,
        clothes: SHIRTS,
    },
    thief: {
        sign: "Бар «Подворотня»",
        counterLabel: "У барной стойки",
        decor: () => `
            <div class="cafe-wall cafe-wall-brick"></div>
            <div class="cafe-window cafe-window-alley"><span class="cafe-bars"></span></div>
            <div class="cafe-lamp"><span></span></div>
            <div class="cafe-bar cafe-bar-dark"><span></span><span></span><span></span><span></span><span></span></div>
            <div class="cafe-door cafe-door-metal"><span class="cafe-bell" data-bell>🔔</span></div>`,
        table: () => `<svg viewBox="0 0 72 30" class="cafe-table-svg" aria-hidden="true">
            <rect x="18" y="2" width="36" height="27" rx="7" fill="#6e4a2a"/>
            <rect x="18" y="8" width="36" height="3" fill="#3a2a1a"/>
            <rect x="18" y="20" width="36" height="3" fill="#3a2a1a"/>
            <ellipse cx="36" cy="3" rx="18" ry="3" fill="#8a5a3a"/></svg>`,
        drink: () => `<div class="cafe-cup">
            <svg viewBox="0 0 28 22" class="cafe-cup-svg" aria-hidden="true">
                <path d="M6 6 L22 6 L20 20 L8 20 Z" fill="rgba(220,230,240,0.35)" stroke="#d9e2ea" stroke-width="1.2"/>
                <path d="M7.5 12 L20.5 12 L19.6 19 L8.4 19 Z" fill="#c9862a"/>
                <rect x="10" y="10" width="4" height="4" rx="1" fill="#e8f2fa" opacity="0.9"/>
                <rect x="14.5" y="11" width="3.5" height="3.5" rx="1" fill="#e8f2fa" opacity="0.8"/></svg></div>`,
        clothes: ["#2a2a30", "#3a2a2a", "#2a3a3a", "#4a3a2a", "#2f2f3f", "#5a2a2a"],
    },
    gov: {
        sign: "Зал заседаний",
        counterLabel: "На галёрке",
        decor: () => `
            <div class="cafe-wall cafe-wall-panel"></div>
            <div class="cafe-window cafe-window-gov"></div>
            <div class="cafe-emblem">★</div>
            <div class="cafe-flag cafe-flag-right"></div>
            <div class="cafe-door cafe-door-oak"><span class="cafe-bell" data-bell>🔔</span></div>`,
        table: () => `<svg viewBox="0 0 72 30" class="cafe-table-svg" aria-hidden="true">
            <rect x="4" y="3" width="64" height="25" rx="2" fill="#5a3a2a"/>
            <rect x="4" y="3" width="64" height="5" fill="#7a4e36"/>
            <rect x="22" y="13" width="28" height="9" rx="1" fill="#e8dcc0"/>
            <rect x="26" y="16.5" width="20" height="2" fill="#5a3a2a"/></svg>`,
        drink: () => `<div class="cafe-cup">
            <svg viewBox="0 0 28 22" class="cafe-cup-svg" aria-hidden="true">
                <line x1="3" y1="20" x2="8" y2="6" stroke="#9aa0ad" stroke-width="1.6"/>
                <ellipse cx="8.5" cy="5" rx="2.6" ry="3" fill="#3a3a44"/>
                <rect x="1" y="19" width="6" height="2" rx="1" fill="#3a3a44"/>
                <path d="M15 8 L25 8 L24 20 L16 20 Z" fill="rgba(200,225,245,0.35)" stroke="#d9e2ea" stroke-width="1.2"/>
                <path d="M15.6 12 L24.4 12 L23.8 19 L16.2 19 Z" fill="rgba(140,190,235,0.55)"/></svg></div>`,
        clothes: SUITS,
    },
};

export function createCafe(container, { onPersonClick, chatType = "general" }) {
    const theme = THEMES[chatType] || THEMES.general;
    const assets = CHAT_SCENE_ASSETS[chatType] || CHAT_SCENE_ASSETS.general;
    const known = new Set();
    let firstRender = true;
    let timer = null;

    container.innerHTML = `
        <div class="cafe-scene cafe-theme-${chatType}"${assets.background ? ` style="background-image:url('${assets.background}')"` : ""}>
            ${assets.background ? "" : theme.decor()}
            <div class="cafe-sign">${theme.sign}</div>
            <div class="cafe-tables" id="cafe-tables"></div>
        </div>
        <div class="cafe-counter-row" id="cafe-counter"></div>`;

    const tablesEl = container.querySelector("#cafe-tables");
    const counterEl = container.querySelector("#cafe-counter");

    // Флаги в зале заседаний — в цветах игрового флага страны (его выбирают
    // голосованием). Пока флага нет — нейтральные золото/бордо.
    if (chatType === "gov" && !assets.background) {
        apiFetch("/api/state").then((state) => {
            const hex = (state.flag_colors || []).map((c) => (state.flag_color_hex || {})[c]).filter(Boolean);
            if (!hex.length) return;
            const stops = hex.map((h, i) => `${h} ${(i * 100 / hex.length).toFixed(1)}% ${((i + 1) * 100 / hex.length).toFixed(1)}%`).join(", ");
            container.querySelector(".cafe-scene").style.setProperty("--flag-bg", `linear-gradient(${stops})`);
        }).catch(() => {});
    }

    function ringBell() {
        const bell = container.querySelector("[data-bell]");
        if (!bell) return;
        bell.classList.remove("cafe-bell-ring");
        void bell.offsetWidth;
        bell.classList.add("cafe-bell-ring");
    }

    function render(data) {
        const seated = data.seated || [];
        const slots = Math.max(5, Math.ceil(seated.length / 5) * 5);
        let anyNew = false;
        const html = [];
        for (let i = 0; i < slots; i++) {
            const p = seated[i];
            if (!p) {
                html.push(`<div class="cafe-seat cafe-seat-empty">${tableHtml(theme, assets, false)}</div>`);
                continue;
            }
            const key = p.vk_id ? `u${p.vk_id}` : `h${p.entered_at}`;
            const isNew = !known.has(key);
            known.add(key);
            if (isNew && !firstRender) anyNew = true;
            html.push(seatHtml(theme, assets, p, key, isNew && !firstRender));
        }
        tablesEl.innerHTML = html.join("");
        tablesEl.querySelectorAll(".cafe-seat[data-vk]").forEach((el) => {
            el.onclick = () => onPersonClick(Number(el.dataset.vk));
        });

        const rest = data.at_counter || [];
        counterEl.innerHTML = rest.length
            ? `<span class="cafe-counter-label">${theme.counterLabel}:</span>
               ${rest.slice(0, COUNTER_SHOWN).map((p) => `<button class="cafe-counter-person" ${p.vk_id ? `data-vk="${p.vk_id}"` : "disabled"} title="${escapeAttr(p.name)}">${p.hidden ? "🕶" : avatarHtml(p.photo_url, p.active_frame, false)}</button>`).join("")}
               ${rest.length > COUNTER_SHOWN ? `<span class="cafe-counter-more">+${rest.length - COUNTER_SHOWN}</span>` : ""}`
            : `<span class="cafe-counter-label">Здесь ${data.total || 0} ${plural(data.total || 0)}</span>`;
        counterEl.querySelectorAll(".cafe-counter-person[data-vk]").forEach((b) => {
            b.onclick = () => onPersonClick(Number(b.dataset.vk));
        });

        if (anyNew) ringBell();
        firstRender = false;
    }

    async function refresh() {
        if (!container.isConnected) { stop(); return; }
        try {
            render(await apiFetch("/api/chats/cafe"));
        } catch (e) {
            // не критично — сцена обновится на следующем круге
        }
    }

    function showBubble(vkId, text) {
        const seat = tablesEl.querySelector(`.cafe-seat[data-vk="${vkId}"]`);
        if (!seat) return;
        const bubble = seat.querySelector(".cafe-bubble");
        const clean = String(text || "").trim();
        bubble.textContent = clean.length > 60 ? clean.slice(0, 57) + "…" : clean;
        bubble.classList.remove("cafe-bubble-show");
        void bubble.offsetWidth;
        bubble.classList.add("cafe-bubble-show");
        clearTimeout(bubble._hideTimer);
        bubble._hideTimer = setTimeout(() => bubble.classList.remove("cafe-bubble-show"), BUBBLE_MS);
    }

    function stop() {
        if (timer) { clearInterval(timer); timer = null; }
    }

    refresh();
    timer = setInterval(refresh, REFRESH_MS);
    return { refresh, showBubble, stop };
}

function seatHtml(theme, assets, p, key, animateIn) {
    const clothes = theme.clothes[hash(key) % theme.clothes.length];
    const avatar = p.hidden
        ? `<div class="cafe-silhouette">🕶</div>`
        : avatarHtml(p.photo_url, p.active_frame, false);
    const badge = p.badge ? `<div class="cafe-badge">${escapeHtml(p.badge)}</div>` : "";
    return `
        <div class="cafe-seat${animateIn ? " cafe-seat-enter" : ""}${p.is_me ? " cafe-seat-me" : ""}" ${p.vk_id ? `data-vk="${p.vk_id}"` : ""}>
            <div class="cafe-bubble"></div>
            <div class="cafe-avatar">${avatar}</div>
            <div class="cafe-person">${personHtml(assets, clothes)}</div>
            ${tableHtml(theme, assets, true)}
            <div class="cafe-name">${escapeHtml(p.is_me ? "Ты" : p.name)}</div>
            ${badge}
        </div>`;
}

function personHtml(assets, clothes) {
    if (assets.character) return `<img src="${assets.character}" alt="" class="cafe-img-character">`;
    return `<svg viewBox="0 0 64 44" class="cafe-person-svg" aria-hidden="true">
        <path d="M14 44 C14 26 22 18 32 18 C42 18 50 26 50 44 Z" fill="${clothes}"/>
        <rect x="27" y="10" width="10" height="10" rx="3" fill="#e8c4a0"/>
        <path d="M18 34 Q12 38 20 42" stroke="${clothes}" stroke-width="6" fill="none" stroke-linecap="round"/>
    </svg>`;
}

function tableHtml(theme, assets, withDrink) {
    const tableImg = withDrink ? assets.table : (assets.emptyTable || assets.table);
    const drink = !withDrink ? "" : assets.cup
        ? `<img src="${assets.cup}" alt="" class="cafe-img-cup">`
        : theme.drink();
    if (tableImg) return `<div class="cafe-table">${drink}<img src="${tableImg}" alt="" class="cafe-img-table"></div>`;
    return `<div class="cafe-table">${drink}${theme.table()}</div>`;
}

function plural(n) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "человека";
    return "человек";
}

function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str ?? "");
    return div.innerHTML;
}

function escapeAttr(str) {
    return String(str ?? "").replace(/"/g, "&quot;");
}
