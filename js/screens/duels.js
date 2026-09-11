import { apiFetch } from "../api.js";
import { burstConfetti, playSuccessSound, playFailSound, shakeElement } from "../fx.js";

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

function vsCard(leftLabel, rightLabel) {
    return `
        <div class="duel-vs-row">
            <div class="duel-avatar">🥷</div>
            <div class="duel-vs-mid">
                <div class="duel-vs-badge">VS</div>
            </div>
            <div class="duel-avatar">🥷</div>
        </div>
        <div class="duel-names-row">
            <div class="duel-name">${leftLabel}</div>
            <div class="duel-name">${rightLabel}</div>
        </div>
    `;
}

async function sendChallenge(root) {
    const resultEl = root.querySelector("#challenge-result");
    resultEl.innerHTML = `<div class="loading">Ищем соперника…</div>`;
    try {
        const result = await apiFetch("/api/duels/challenge", { method: "POST" });
        resultEl.innerHTML = `
            ${vsCard("Ты", nameOf(result.opponent))}
            <div class="profile-row" style="color:#7ee787">✅ Вызов отправлен</div>
            <div class="profile-row profile-dim">${escapeHtml(result.stakes)}</div>
        `;
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
            ${vsCard("Ты", nameOf(duel.challenger))}
            <div class="profile-dim" style="text-align:center;margin-bottom:8px">${escapeHtml(duel.stakes)}</div>
        `;

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
            ${vsCard("Ты", nameOf(duel.opponent))}
            <div class="profile-dim" style="text-align:center">⏳ Ждёт ответа…</div>
        `;
        listEl.appendChild(card);
    });
}

function nameOf(p) {
    return (p.username ? "@" + escapeHtml(p.username) : "ID " + p.vk_id) + (p.profession ? " (" + escapeHtml(p.profession) + ")" : "");
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
