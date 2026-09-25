import { apiFetch } from "../api.js";
import { screenHeader } from "../screenHeader.js";

export async function renderStashScreen(root) {
    root.innerHTML = `${screenHeader({ scene: "backyard", title: "Тайник", sub: "Спрятанные деньги", fallbackTitle: "🗝 Тайник" })}<div class="loading">Загружаем…</div>`;

    let status;
    try {
        status = await apiFetch("/api/stash/status");
    } catch (e) {
        root.innerHTML = `${screenHeader({ scene: "backyard", title: "Тайник", sub: "Спрятанные деньги", fallbackTitle: "🗝 Тайник" })}<div class="error">${e.message}</div>`;
        return;
    }

    root.innerHTML = `
        ${screenHeader({ scene: "backyard", title: "Тайник", sub: "Спрятанные деньги", fallbackTitle: "🗝 Тайник" })}
        <div class="card">
            <div class="profile-row">💰 Всего в тайнике: <b>${status.total.toFixed(2)}₭</b></div>
            <div class="profile-row" style="color:#7ee787">✅ Доступно к выводу: <b>${status.matured.toFixed(2)}₭</b></div>
            ${status.locked > 0 ? `<div class="profile-dim">⏳ Ещё отлёживается (менее суток): ${status.locked.toFixed(2)}₭</div>` : ""}
            <div class="profile-dim" style="margin-top:8px">Каждое поступление становится доступным для вывода только спустя 24 часа после того, как оно попало в тайник.</div>
            <input type="number" id="withdraw-amount-input" class="text-input" placeholder="Сумма для вывода" style="margin-top:10px" max="${status.matured}">
            <button class="btn" id="withdraw-btn" style="margin-top:6px" ${status.matured <= 0 ? "disabled" : ""}>Вывести на баланс</button>
            <div id="withdraw-result"></div>
        </div>
    `;

    root.querySelector("#withdraw-btn").onclick = async () => {
        const amount = Number(root.querySelector("#withdraw-amount-input").value);
        const resultEl = root.querySelector("#withdraw-result");
        if (!amount || amount <= 0) {
            resultEl.innerHTML = `<div class="error">Введи корректную сумму</div>`;
            return;
        }
        resultEl.innerHTML = `<div class="loading">…</div>`;
        try {
            await apiFetch("/api/stash/withdraw", { method: "POST", body: { amount } });
            resultEl.innerHTML = `<div class="profile-row" style="color:#7ee787">✅ Выведено ${amount.toFixed(2)}₭ на баланс!</div>`;
            await renderStashScreen(root);
        } catch (e) {
            resultEl.innerHTML = `<div class="error">${e.message}</div>`;
        }
    };
}
