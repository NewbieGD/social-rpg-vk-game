import { apiFetch } from "../api.js";

export async function renderThiefBankScreen(root) {
    root.innerHTML = `<div class="title">🏦 Банк воров</div><div class="loading">Загружаем…</div>`;

    let data;
    try {
        data = await apiFetch("/api/stash/thief_bank");
    } catch (e) {
        root.innerHTML = `<div class="title">🏦 Банк воров</div><div class="error">${e.message}</div>`;
        return;
    }

    const rows = data.leaderboard.map((r, i) => `
        <div class="crime-candidate-row">
            <span>#${i + 1} ${escapeHtml(r.username ? "@" + r.username : "ID " + r.vk_id)}</span>
            <span style="font-weight:600">${r.total_contributed.toFixed(2)}₭</span>
        </div>
    `).join("");

    root.innerHTML = `
        <div class="title">🏦 Банк воров</div>
        <div class="card">
            <div class="subtitle">Общая казна всех воров страны — управляется Боссом Мафии.</div>
            <div class="profile-row" style="font-size:20px">💰 Баланс: <b>${data.balance.toFixed(2)}₭</b></div>
        </div>
        <div class="card">
            <div class="gov-section-title">🏆 Топ вкладчиков</div>
            ${rows || `<div class="profile-dim">Пока никто не вносил вклад.</div>`}
        </div>
        <div class="card">
            <div class="profile-dim">Внести вклад можно прямо из попапа ограбления, если личность известна жертве — раздел Криминал.</div>
        </div>
    `;
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
