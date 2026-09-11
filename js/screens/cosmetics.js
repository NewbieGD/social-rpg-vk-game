import { apiFetch } from "../api.js";
import { DEV_MODE } from "../config.js";

const PREVIEW_BUILDERS = {
    golden_name: () => `<div class="cosmetics-preview"><span class="cosmetic-golden-name">Имя Игрока</span></div>`,
    gradient_name: () => `<div class="cosmetics-preview"><span class="cosmetic-gradient-name">Имя Игрока</span></div>`,
    vip_badge: () => `<div class="cosmetics-preview">Имя Игрока 💎 VIP</div>`,
    crown_badge: () => `<div class="cosmetics-preview">👑 Имя Игрока</div>`,
    profile_frame_neon: () => `<div class="cosmetics-preview"><div class="profile-avatar profile-avatar-neon cosmetics-preview-avatar">👤</div></div>`,
    mansion: () => `<div class="cosmetics-preview" style="font-size:32px">🏰</div>`,
};

export async function renderCosmeticsScreen(root) {
    root.innerHTML = `<div class="loading">Загружаем…</div>`;

    let catalog;
    try {
        catalog = await apiFetch("/api/payments/catalog");
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    root.innerHTML = `
        <div class="title">✨ Косметика</div>
        <div class="subtitle">Покупается за настоящие деньги (голоса ВКонтакте). Никак не влияет на игру — только выделяет тебя среди других.</div>
        ${!catalog.payments_enabled ? `<div class="card"><div class="profile-row" style="color:#ffb454">⚠️ Приём платежей ещё не включён администратором игры — покупка пока недоступна.</div></div>` : ""}
        <div id="cosmetics-list"></div>
    `;

    const list = root.querySelector("#cosmetics-list");
    catalog.items.forEach((item) => {
        const card = document.createElement("div");
        card.className = "card";
        const preview = PREVIEW_BUILDERS[item.item_id] ? PREVIEW_BUILDERS[item.item_id]() : "";
        card.innerHTML = `
            <div class="title" style="font-size:17px">${escapeHtml(item.title)}</div>
            <div class="subtitle">${escapeHtml(item.description)}</div>
            ${preview}
            <div class="profile-row profile-balance">💎 ${item.price_votes} голосов</div>
        `;
        if (item.owned) {
            card.innerHTML += `<div class="profile-row" style="color:#7ee787">✅ Уже куплено</div>`;
        } else {
            const btn = document.createElement("button");
            btn.className = "btn";
            btn.textContent = "Купить";
            btn.disabled = !catalog.payments_enabled;
            btn.onclick = () => buyItem(root, item, btn);
            card.appendChild(btn);

            if (DEV_MODE) {
                const testBtn = document.createElement("button");
                testBtn.className = "btn btn-secondary";
                testBtn.textContent = "🧪 Получить бесплатно (тест)";
                const testResult = document.createElement("div");
                testBtn.onclick = () => grantCosmeticForTest(root, item.item_id, testBtn, testResult);
                card.appendChild(testBtn);
                card.appendChild(testResult);
            }
        }
        list.appendChild(card);
    });
}

async function grantCosmeticForTest(root, itemId, btn, resultEl) {
    btn.disabled = true;
    resultEl.innerHTML = `<div class="loading">Выдаём…</div>`;
    try {
        await apiFetch("/api/dev/grant_cosmetic", { method: "POST", body: { item_id: itemId } });
        resultEl.innerHTML = `<div class="profile-row" style="color:#7ee787">✅ Выдано — обновляем экран…</div>`;
        setTimeout(() => renderCosmeticsScreen(root), 600);
    } catch (e) {
        resultEl.innerHTML = `<div class="error">${e.message}</div>`;
        btn.disabled = false;
    }
}

async function buyItem(root, item, btn) {
    if (!window.vkBridge) {
        alert("Покупка доступна только внутри приложения ВКонтакте.");
        return;
    }
    btn.disabled = true;
    try {
        await window.vkBridge.send("VKWebAppShowOrderBox", {
            type: "item",
            item: item.item_id,
        });
        // VK сам обработает оплату и пришлёт колбэк на backend — товар появится
        // с небольшой задержкой, обновляем экран через пару секунд.
        setTimeout(() => renderCosmeticsScreen(root), 2000);
    } catch (e) {
        btn.disabled = false;
        // Пользователь мог просто закрыть окно оплаты — это не ошибка приложения.
    }
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
