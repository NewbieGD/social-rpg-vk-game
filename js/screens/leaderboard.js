import { apiFetch } from "../api.js";
import { renderOtherProfile } from "./profile.js";

export async function renderLeaderboardScreen(root) {
    root.innerHTML = `
        <div class="title">🏆 Лидеры</div>
        <div class="tab-row">
            <button class="tab-btn active" id="tab-rating">⭐ По рейтингу</button>
            <button class="tab-btn" id="tab-duels">⚔️ По дуэлям</button>
        </div>
        <div id="leaderboard-body"><div class="loading">Загружаем…</div></div>
    `;

    root.querySelector("#tab-rating").onclick = () => switchTab(root, "rating");
    root.querySelector("#tab-duels").onclick = () => switchTab(root, "duels");

    await loadRating(root);
}

function switchTab(root, tab) {
    root.querySelector("#tab-rating").classList.toggle("active", tab === "rating");
    root.querySelector("#tab-duels").classList.toggle("active", tab === "duels");
    if (tab === "rating") loadRating(root);
    else loadDuels(root);
}

async function loadRating(root) {
    const body = root.querySelector("#leaderboard-body");
    body.innerHTML = `<div class="loading">Загружаем…</div>`;

    let rows;
    try {
        rows = await apiFetch("/api/leaderboard/rating");
    } catch (e) {
        body.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    renderRows(body, rows, (r, i) => ({
        title: `${medal(i)} ${nameOf(r)}${r.profession ? " — " + escapeHtml(r.profession) : ""}`,
        value: `⭐ ${r.rating.toFixed(1)}`,
        vkId: r.vk_id,
        movement: r.movement,
        cosmetics: r.cosmetics,
    }));
}

async function loadDuels(root) {
    const body = root.querySelector("#leaderboard-body");
    body.innerHTML = `<div class="loading">Загружаем…</div>`;

    let rows;
    try {
        rows = await apiFetch("/api/duels/leaderboard");
    } catch (e) {
        body.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    renderRows(body, rows, (r, i) => ({
        title: `${medal(i)} ${nameOf(r)}`,
        value: `⚔️ ${r.duel_wins}`,
        vkId: r.vk_id,
        movement: r.movement,
        cosmetics: r.cosmetics,
    }));
}

const MOVEMENT_ICON = { up: '<span class="lb-move-up">▲</span>', down: '<span class="lb-move-down">▼</span>', same: '<span class="lb-move-same">–</span>' };

function renderRows(body, rows, mapFn) {
    if (rows.length === 0) {
        body.innerHTML = `<div class="card"><div class="subtitle">Пока никого в списке.</div></div>`;
        return;
    }
    body.innerHTML = "";
    rows.forEach((r, i) => {
        const info = mapFn(r, i);
        const cosmetics = info.cosmetics || [];
        const nameClass = cosmetics.includes("gradient_name") ? "cosmetic-gradient-name" : cosmetics.includes("golden_name") ? "cosmetic-golden-name" : "";
        const badges = [cosmetics.includes("crown_badge") ? "👑" : "", cosmetics.includes("vip_badge") ? "💎" : ""].filter(Boolean).join(" ");

        const card = document.createElement("div");
        card.className = "shop-item lb-row";
        card.innerHTML = `
            ${MOVEMENT_ICON[info.movement] || MOVEMENT_ICON.same}
            <div class="shop-item-name"><span class="${nameClass}">${info.title}</span>${badges ? " " + badges : ""}</div>
            <div class="shop-item-price">${info.value}</div>
        `;
        card.onclick = () => showLeaderboardProfileOverlay(info.vkId);
        body.appendChild(card);
    });
}

function showLeaderboardProfileOverlay(vkId) {
    const overlay = document.createElement("div");
    overlay.className = "profile-overlay";
    const box = document.createElement("div");
    box.className = "profile-overlay-box";
    const closeBtn = document.createElement("button");
    closeBtn.className = "btn btn-secondary profile-overlay-close";
    closeBtn.textContent = "✕ Закрыть";
    closeBtn.onclick = () => overlay.remove();
    box.appendChild(closeBtn);
    const content = document.createElement("div");
    box.appendChild(content);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    renderOtherProfile(content, vkId);
}

function medal(index) {
    return ["🥇", "🥈", "🥉"][index] || `${index + 1}.`;
}

function nameOf(r) {
    return r.username ? "@" + escapeHtml(r.username) : "ID " + r.vk_id;
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
