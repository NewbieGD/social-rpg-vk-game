import { apiFetch } from "../api.js";
import { burstConfetti, playSuccessSound, playFailSound, shakeElement } from "../fx.js";
import { renderOtherProfile } from "./profile.js";

export async function renderDuelsScreen(root) {
    root.innerHTML = `
        <div class="title">⚔️ Дуэли</div>
        <div class="card duel-challenge-card">
            <div class="duel-challenge-icon">⚔️</div>
            <div class="subtitle">Соперника выбирает система случайно — из твоей же категории (граждане/преступники/чиновники). С одним и тем же игроком дуэль возможна только один раз за всё время.</div>
            <button class="btn" id="challenge-btn">Вызвать случайного соперника</button>
            <div id="challenge-result"></div>
        </div>
        <div class="card">
            <div class="subtitle">📥 Вызовы тебе</div>
            <div id="pending-list"><div class="loading">Загружаем…</div></div>
        </div>
        <div class="card">
            <div class="subtitle">📤 Твои вызовы (ждут ответа)</div>
            <div id="sent-list"><div class="loading">Загружаем…</div></div>
        </div>
    `;

    root.querySelector("#challenge-btn").onclick = () => sendChallenge(root);
    await loadPending(root);
    await loadSent(root);
}

let vsCardCounter = 0;

function vsCard(opponent) {
    const uid = `vs-opp-${vsCardCounter++}`;
    return `
        <div class="duel-vs-row">
            <div class="duel-avatar">🥷</div>
            <div class="duel-vs-mid">
                <div class="duel-vs-badge">VS</div>
            </div>
            <div class="duel-avatar">${opponent.vk_photo_url ? `<img src="${opponent.vk_photo_url}" class="duel-avatar-photo" alt="">` : "🥷"}</div>
        </div>
        <div class="duel-names-row">
            <div class="duel-name">Ты</div>
            <div class="duel-name duel-name-clickable" id="${uid}">${escapeHtml(nameOf(opponent))}</div>
        </div>
    `;
}

function wireVsCardClick(container, opponent) {
    container.querySelectorAll(".duel-name-clickable").forEach((el) => {
        el.onclick = () => showDuelProfileOverlay(opponent.vk_id);
    });
}

function showDuelProfileOverlay(vkId) {
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

async function sendChallenge(root) {
    const resultEl = root.querySelector("#challenge-result");
    resultEl.innerHTML = `<div class="loading">Ищем соперника…</div>`;
    try {
        const result = await apiFetch("/api/duels/challenge", { method: "POST" });
        resultEl.innerHTML = `
            ${vsCard(result.opponent)}
            <div class="profile-row" style="color:#7ee787">✅ Вызов отправлен</div>
            <div class="profile-row profile-dim">${escapeHtml(result.stakes)}</div>
        `;
        wireVsCardClick(resultEl, result.opponent);
        await loadSent(root);
    } catch (e) {
        resultEl.innerHTML = `<div class="error">${e.message}</div>`;
    }
}

async function loadPending(root) {
    const listEl = root.querySelector("#pending-list");
    let rows;
    try {
        rows = await apiFetch("/api/duels/pending");
    } catch (e) {
        listEl.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    if (rows.length === 0) {
        listEl.innerHTML = `<div class="profile-dim">Пока никто не вызывал.</div>`;
        return;
    }

    listEl.innerHTML = "";
    rows.forEach((duel) => {
        const card = document.createElement("div");
        card.className = "duel-card";
        card.innerHTML = `
            ${vsCard(duel.challenger)}
            <div class="profile-dim" style="text-align:center;margin-bottom:8px">${escapeHtml(duel.stakes)}</div>
        `;
        wireVsCardClick(card, duel.challenger);

        const btnRow = document.createElement("div");
        btnRow.className = "duel-btn-row";

        const acceptBtn = document.createElement("button");
        acceptBtn.className = "btn";
        acceptBtn.textContent = "⚔️ Принять бой";

        const declineBtn = document.createElement("button");
        declineBtn.className = "btn btn-secondary";
        declineBtn.textContent = "Отклонить";

        const rowResult = document.createElement("div");

        acceptBtn.onclick = () => resolveDuel(root, duel.duel_id, "accept", rowResult);
        declineBtn.onclick = () => resolveDuel(root, duel.duel_id, "decline", rowResult);

        btnRow.appendChild(acceptBtn);
        btnRow.appendChild(declineBtn);
        card.appendChild(btnRow);
        card.appendChild(rowResult);
        listEl.appendChild(card);
    });
}

async function resolveDuel(root, duelId, action, rowResult) {
    rowResult.innerHTML = `<div class="loading">Разбираем…</div>`;
    try {
        const result = await apiFetch(`/api/duels/${duelId}/${action}`, { method: "POST" });
        if (action === "decline") {
            rowResult.innerHTML = `<div class="profile-dim">Вызов отклонён.</div>`;
            return;
        }
        const color = result.you_won ? "#7ee787" : "#ff9eb5";
        rowResult.innerHTML = `
            <div class="duel-outcome-banner ${result.you_won ? "duel-outcome-win" : "duel-outcome-lose"}">
                ${result.you_won ? "🏆 ПОБЕДА" : "💀 ПОРАЖЕНИЕ"}
            </div>
            <div class="profile-row" style="color:${color}">${escapeHtml(result.summary)}</div>
        `;
        if (result.you_won) {
            playSuccessSound();
            burstConfetti(rowResult);
        } else {
            playFailSound();
            shakeElement(rowResult);
        }
    } catch (e) {
        rowResult.innerHTML = `<div class="error">${e.message}</div>`;
    }
}

async function loadSent(root) {
    const listEl = root.querySelector("#sent-list");
    let rows;
    try {
        rows = await apiFetch("/api/duels/sent");
    } catch (e) {
        listEl.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    if (rows.length === 0) {
        listEl.innerHTML = `<div class="profile-dim">Нет отправленных вызовов, ждущих ответа.</div>`;
        return;
    }

    listEl.innerHTML = "";
    rows.forEach((duel) => {
        const card = document.createElement("div");
        card.className = "duel-card";
        card.innerHTML = `
            ${vsCard(duel.opponent)}
            <div class="profile-dim" style="text-align:center">⏳ Ждёт ответа…</div>
        `;
        wireVsCardClick(card, duel.opponent);
        listEl.appendChild(card);
    });
}

function nameOf(p) {
    const base = p.vk_first_name || (p.username ? "@" + escapeHtml(p.username) : "ID " + p.vk_id);
    return base + (p.profession ? " (" + escapeHtml(p.profession) + ")" : "");
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
