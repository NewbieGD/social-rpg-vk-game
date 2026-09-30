import { apiFetch } from "../api.js";
import { showGameStylePopup } from "../gamePopup.js";
import { infoButton, bindInfoButtons } from "../infoPopups.js";
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

    if (!status.has_stash && status.total <= 0) {
        root.innerHTML = `
            ${screenHeader({ scene: "backyard", title: "Тайник", sub: "Спрятанные деньги", fallbackTitle: "🗝 Тайник" })}
            <div class="card">
                <div class="subtitle">У тебя ещё нет тайника ${infoButton("stash")}</div>
                <div class="profile-dim">Купи предмет «Тайник» на чёрном рынке (один раз, навсегда). После этого после каждого ограбления можно будет прятать 30% добычи — её не вернут жертве, даже если тебя поймают.</div>
            </div>`;
        bindInfoButtons(root);
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
            <button class="btn" id="withdraw-btn" style="margin-top:6px">Вывести на баланс</button>
            <div id="withdraw-result"></div>
        </div>
    `;

    root.querySelector("#withdraw-btn").onclick = async () => {
        const amount = Number(root.querySelector("#withdraw-amount-input").value);
        const resultEl = root.querySelector("#withdraw-result");
        // Кнопка всегда нажимается — а если вывести нельзя, объясняем почему
        if (status.matured <= 0) {
            const next = status.next_mature;
            let when = "";
            if (next) {
                const mins = Math.max(1, Math.ceil((new Date(next.ready_at) - Date.now()) / 60000));
                when = ` Ближайшие ${next.amount.toFixed(2)}₭ станут доступны через ${mins >= 60 ? `${Math.floor(mins / 60)} ч ${mins % 60} мин` : `${mins} мин`}.`;
            }
            showGameStylePopup("Пока нечего вывести", status.total > 0
                ? `Каждое поступление в тайник «отлёживается» 24 часа, прежде чем его можно вывести.${when}`
                : "Тайник пуст. Спрятать сюда 30% добычи можно после любого ограбления.");
            return;
        }
        if (!amount || amount <= 0) {
            showGameStylePopup("Впиши сумму", `Сколько вывести? Сейчас доступно ${status.matured.toFixed(2)}₭.`);
            return;
        }
        if (amount > status.matured) {
            showGameStylePopup("Слишком много", `Сейчас можно вывести не больше ${status.matured.toFixed(2)}₭ — остальное ещё «отлёживается» (24 часа с момента поступления).`);
            return;
        }
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
