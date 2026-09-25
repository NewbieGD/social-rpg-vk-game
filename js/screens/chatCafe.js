// Кафе в общем чате: последние 10 вошедших сидят за столиками (аватарка
// с купленной рамкой над персонажем, кофе с паром на столе), остальные —
// «у стойки». Когда кто-то пишет в чат, над ним на пару секунд появляется
// облачко с текстом, как в мультфильме. Картинки — в js/chatCafeAssets.js.
import { apiFetch } from "../api.js";
import { avatarHtml } from "../cosmeticFrames.js";
import { CAFE_ASSETS } from "../chatCafeAssets.js";

const REFRESH_MS = 6000;
const BUBBLE_MS = 4500;
const COUNTER_SHOWN = 12;
const SHIRTS = ["#b8574a", "#4a6fa0", "#5a8a5a", "#8a5aa0", "#c98a3a", "#3a8a8a", "#a04a6a", "#6a6a8a"];

export function createCafe(container, { onPersonClick }) {
    const known = new Set();
    let firstRender = true;
    let timer = null;

    container.innerHTML = `
        <div class="cafe-scene"${CAFE_ASSETS.background ? ` style="background-image:url('${CAFE_ASSETS.background}')"` : ""}>
            ${CAFE_ASSETS.background ? "" : `
            <div class="cafe-wall"></div>
            <div class="cafe-window"></div>
            <div class="cafe-sign">Кафе «Путь»</div>
            <div class="cafe-door"><span class="cafe-bell" id="cafe-bell">🔔</span></div>
            <div class="cafe-bar"><span></span><span></span><span></span><span></span></div>`}
            <div class="cafe-tables" id="cafe-tables"></div>
        </div>
        <div class="cafe-counter-row" id="cafe-counter"></div>`;

    const tablesEl = container.querySelector("#cafe-tables");
    const counterEl = container.querySelector("#cafe-counter");

    function ringBell() {
        const bell = container.querySelector("#cafe-bell");
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
                html.push(`<div class="cafe-seat cafe-seat-empty">${tableHtml(false)}</div>`);
                continue;
            }
            const key = p.vk_id ? `u${p.vk_id}` : `h${p.entered_at}`;
            const isNew = !known.has(key);
            known.add(key);
            if (isNew && !firstRender) anyNew = true;
            html.push(seatHtml(p, key, isNew && !firstRender));
        }
        tablesEl.innerHTML = html.join("");
        tablesEl.querySelectorAll(".cafe-seat[data-vk]").forEach((el) => {
            el.onclick = () => onPersonClick(Number(el.dataset.vk));
        });

        const rest = data.at_counter || [];
        counterEl.innerHTML = rest.length
            ? `<span class="cafe-counter-label">У стойки:</span>
               ${rest.slice(0, COUNTER_SHOWN).map((p) => `<button class="cafe-counter-person" ${p.vk_id ? `data-vk="${p.vk_id}"` : "disabled"} title="${escapeAttr(p.name)}">${p.hidden ? "🕶" : avatarHtml(p.photo_url, p.active_frame, false)}</button>`).join("")}
               ${rest.length > COUNTER_SHOWN ? `<span class="cafe-counter-more">+${rest.length - COUNTER_SHOWN}</span>` : ""}`
            : `<span class="cafe-counter-label">В кафе ${data.total || 0} ${plural(data.total || 0)}</span>`;
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
            // не критично — кафе обновится на следующем круге
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

function seatHtml(p, key, animateIn) {
    const shirt = SHIRTS[hash(key) % SHIRTS.length];
    const avatar = p.hidden
        ? `<div class="cafe-silhouette">🕶</div>`
        : avatarHtml(p.photo_url, p.active_frame, false);
    const badge = p.badge ? `<div class="cafe-badge">${escapeHtml(p.badge)}</div>` : "";
    return `
        <div class="cafe-seat${animateIn ? " cafe-seat-enter" : ""}${p.is_me ? " cafe-seat-me" : ""}" ${p.vk_id ? `data-vk="${p.vk_id}"` : ""}>
            <div class="cafe-bubble"></div>
            <div class="cafe-avatar">${avatar}</div>
            <div class="cafe-person">${personHtml(shirt)}</div>
            ${tableHtml(true)}
            <div class="cafe-name">${escapeHtml(p.is_me ? "Ты" : p.name)}</div>
            ${badge}
        </div>`;
}

function personHtml(shirt) {
    if (CAFE_ASSETS.character) return `<img src="${CAFE_ASSETS.character}" alt="" class="cafe-img-character">`;
    return `<svg viewBox="0 0 64 44" class="cafe-person-svg" aria-hidden="true">
        <path d="M14 44 C14 26 22 18 32 18 C42 18 50 26 50 44 Z" fill="${shirt}"/>
        <rect x="27" y="10" width="10" height="10" rx="3" fill="#e8c4a0"/>
        <path d="M18 34 Q12 38 20 42" stroke="${shirt}" stroke-width="6" fill="none" stroke-linecap="round" class="cafe-arm"/>
    </svg>`;
}

function tableHtml(withCup) {
    const tableImg = withCup ? CAFE_ASSETS.table : (CAFE_ASSETS.emptyTable || CAFE_ASSETS.table);
    const cup = !withCup ? "" : CAFE_ASSETS.cup
        ? `<img src="${CAFE_ASSETS.cup}" alt="" class="cafe-img-cup">`
        : `<div class="cafe-cup">
               <span class="cafe-steam"></span><span class="cafe-steam cafe-steam-2"></span>
               <svg viewBox="0 0 28 22" class="cafe-cup-svg" aria-hidden="true">
                   <rect x="4" y="4" width="16" height="14" rx="3" fill="#efe6d8"/>
                   <rect x="6" y="5" width="12" height="3" rx="1" fill="#6b3f22"/>
                   <path d="M20 8 q6 0 6 5 q0 5 -6 5" stroke="#efe6d8" stroke-width="2.5" fill="none"/>
                   <ellipse cx="12" cy="19" rx="11" ry="2.5" fill="#d9c9ae"/>
               </svg>
           </div>`;
    if (tableImg) return `<div class="cafe-table">${cup}<img src="${tableImg}" alt="" class="cafe-img-table"></div>`;
    return `<div class="cafe-table">${cup}
        <svg viewBox="0 0 72 30" class="cafe-table-svg" aria-hidden="true">
            <ellipse cx="36" cy="7" rx="34" ry="6" fill="#8a5a3a"/>
            <rect x="33" y="10" width="6" height="16" fill="#6e4a3a"/>
            <ellipse cx="36" cy="27" rx="14" ry="3" fill="#5a3a2a"/>
        </svg></div>`;
}

function plural(n) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return "человек";
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
