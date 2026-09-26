import { apiFetch } from "../api.js";
import { infoButton, bindInfoButtons } from "../infoPopups.js";
import { screenHeader } from "../screenHeader.js";

export async function renderThiefBankScreen(root) {
    root.innerHTML = `${screenHeader({ scene: "crime", title: "Банк воров", sub: "Общая казна воров", fallbackTitle: "🏦 Банк воров" })}<div class="loading">Загружаем…</div>`;

    let data;
    try {
        data = await apiFetch("/api/stash/thief_bank");
    } catch (e) {
        root.innerHTML = `${screenHeader({ scene: "crime", title: "Банк воров", sub: "Общая казна воров", fallbackTitle: "🏦 Банк воров" })}<div class="error">${e.message}</div>`;
        return;
    }

    const rows = data.leaderboard.map((r, i) => `
        <div class="crime-candidate-row">
            <span>#${i + 1} ${escapeHtml(r.username ? "@" + r.username : "ID " + r.vk_id)}</span>
            <span style="font-weight:600">${r.total_contributed.toFixed(2)}₭</span>
        </div>
    `).join("");

    root.innerHTML = `
        ${screenHeader({ scene: "crime", title: "Банк воров", sub: "Общая казна воров", fallbackTitle: "🏦 Банк воров" })}
        <div class="card">
            <div class="subtitle">Общая казна всех воров страны ${infoButton("thief_bank")}</div>
            <div class="profile-row" style="font-size:20px">💰 Баланс: <b>${data.balance.toFixed(2)}₭</b></div>
        </div>
        <div class="card">
            <div class="gov-section-title">🏆 Топ вкладчиков</div>
            ${rows || `<div class="profile-dim">Пока никто не вносил вклад.</div>`}
        </div>
        <div class="card">
            <div class="profile-dim">Как пополнить: после любого успешного ограбления в разделе Криминал появится выбор — внести 10% добычи в банк, спрятать 30% в тайник, сделать и то и другое или пропустить. Решить можно в течение часа.</div>
            <div class="profile-dim" style="margin-top:6px">Зачем: внесённое в банк не вернут жертве, даже если тебя поймают, а твой вклад виден всем ворам в топе. Распоряжаться банком Босс Мафии сможет в одном из следующих обновлений.</div>
        </div>
    `;
    bindInfoButtons(root);
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
