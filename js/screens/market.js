import { apiFetch } from "../api.js";
import { renderOtherProfile } from "./profile.js";
import { showGamePopupWithContent, showGameStylePopup } from "../gamePopup.js";

const MAX_OPEN_REQUESTS = 5;

function showMarketProfileOverlay(vkId) {
    showGamePopupWithContent(null, (content) => {
        renderOtherProfile(content, vkId);
    });
}

export async function renderMarketScreen(root) {
    root.innerHTML = `
        <div class="market-stall-sign">🏪 РЫНОК</div>
        <div class="title">Торговая площадь</div>
        <div class="market-section-card">
            <div class="subtitle">Нужна купленная Лицензия «Продавец». 1) жмёшь «Заказать товар»; 2) кто-то видит заявку и жмёт «Продать»; 3) тебе приходит уведомление, вещь уже у тебя. Купить — на 10% дешевле обычной цены; продать — 75% от цены (разница уходит в казну).</div>
            <button class="btn" id="request-btn">🛒 Заказать товар</button>
        </div>
        <div class="market-section-card">
            <div class="subtitle">📋 Заявки других покупателей — можно продать</div>
            <div id="requests-list"><div class="loading">Загружаем…</div></div>
        </div>
        <div class="market-section-card">
            <div class="subtitle">📤 Мои заявки (<span id="my-requests-count">…</span>/${MAX_OPEN_REQUESTS})</div>
            <div id="my-requests"><div class="loading">Загружаем…</div></div>
        </div>
        <div class="market-section-card">
            <div class="subtitle">🧾 Последние сделки на рынке</div>
            <div id="history-list"><div class="loading">Загружаем…</div></div>
        </div>
    `;

    root.querySelector("#request-btn").onclick = () => showOrderItemPopup(root);
    await loadRequests(root);
    await loadMyRequests(root);
    await loadHistory(root);
}

async function showOrderItemPopup(root) {
    const { content } = showGamePopupWithContent("🛒 Заказать товар", (c) => {
        c.innerHTML = `<div class="loading">Загружаем список доступных товаров…</div>`;
    });

    let items;
    try {
        items = await apiFetch("/api/market/available_items");
    } catch (e) {
        content.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    if (items.length === 0) {
        content.innerHTML = `<div class="error">Нет доступных товаров — проверь, есть ли у тебя Лицензия «Продавец» (или «Блат», если ты преступник).</div>`;
        return;
    }

    content.innerHTML = `<div class="subtitle" style="margin-bottom:8px">Выбери товар для заказа:</div><div id="item-picker"></div>`;
    const picker = content.querySelector("#item-picker");
    items.forEach((item) => {
        const btn = document.createElement("button");
        btn.className = "gov-vote-btn";
        btn.textContent = item.name;
        btn.onclick = () => placeOrder(root, item.code, item.name, btn);
        picker.appendChild(btn);
    });
}

async function placeOrder(root, code, name, btn) {
    btn.disabled = true;
    try {
        await apiFetch("/api/market/request", { method: "POST", body: { item_code: code } });
        showGameStylePopup("✅ Заказано!", `«${escapeHtml(name)}» — как только кто-то согласится продать, придёт уведомление.`);
        await loadMyRequests(root);
    } catch (e) {
        btn.disabled = false;
        showGameStylePopup("❌ Не получилось", e.message);
    }
}

async function loadRequests(root) {
    const listEl = root.querySelector("#requests-list");
    let rows;
    try {
        rows = await apiFetch("/api/market/requests");
    } catch (e) {
        listEl.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    if (rows.length === 0) {
        listEl.innerHTML = `<div class="profile-dim">Пока никто ничего не заказывал.</div>`;
        return;
    }

    listEl.innerHTML = "";
    rows.forEach((r, i) => {
        const card = document.createElement("div");
        card.className = "shop-item market-stall-item";
        const buyerName = r.buyer_vk_first_name || (r.buyer_username ? "@" + escapeHtml(r.buyer_username) : "ID " + r.buyer_vk_id);
        const buyerId = `market-buyer-${i}`;
        card.innerHTML = `<div class="shop-item-name">🛍 <span class="market-buyer-clickable" id="${buyerId}">${r.buyer_vk_photo_url ? `<img src="${r.buyer_vk_photo_url}" class="oko-clicker-photo" alt="">` : ""}${escapeHtml(buyerName)}</span> хочет купить: ${escapeHtml(r.item_name)}</div><div class="shop-item-price">Ты получишь: ${r.seller_price.toFixed(0)}₭</div>`;

        const sellBtn = document.createElement("button");
        sellBtn.className = "btn";
        sellBtn.textContent = "✅ Продать";

        sellBtn.onclick = () => fulfillRequest(root, r.request_id, r.item_code, r.item_name, sellBtn);
        card.appendChild(sellBtn);
        listEl.appendChild(card);
        card.querySelector(`#${buyerId}`).onclick = () => showMarketProfileOverlay(r.buyer_vk_id);
    });
}

async function fulfillRequest(root, requestId, itemCode, itemName, sellBtn) {
    sellBtn.disabled = true;

    let myInventory;
    try {
        myInventory = await apiFetch("/api/inventory");
    } catch (e) {
        sellBtn.disabled = false;
        showGameStylePopup("❌ Не получилось", e.message);
        return;
    }

    const match = myInventory.find((i) => i.code === itemCode && !i.in_safe);
    if (!match) {
        sellBtn.disabled = false;
        showGameStylePopup("❌ Не получилось", `У тебя нет «${escapeHtml(itemName)}» в инвентаре (или она в сейфе — сначала вытащи).`);
        return;
    }

    try {
        const result = await apiFetch(`/api/market/requests/${requestId}/fulfill`, { method: "POST", body: { inventory_id: match.id } });
        showGameStylePopup("✅ Продано!", `Получено ${result.seller_price.toFixed(0)}₭.`);
        await loadRequests(root);
        await loadHistory(root);
    } catch (e) {
        sellBtn.disabled = false;
        showGameStylePopup("❌ Не получилось", e.message);
    }
}

async function loadMyRequests(root) {
    const listEl = root.querySelector("#my-requests");
    const countEl = root.querySelector("#my-requests-count");
    let rows;
    try {
        rows = await apiFetch("/api/market/my_requests");
    } catch (e) {
        listEl.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    const openCount = rows.filter((r) => r.status === "open").length;
    countEl.textContent = openCount;

    if (rows.length === 0) {
        listEl.innerHTML = `<div class="profile-dim">Заявок пока нет.</div>`;
        return;
    }

    listEl.innerHTML = "";
    const statusLabels = { open: "⏳ Ждёт продавца", fulfilled: "✅ Выполнена", cancelled: "❌ Отменена" };
    rows.forEach((r) => {
        const card = document.createElement("div");
        card.className = "shop-item";
        card.innerHTML = `<div class="shop-item-name">${escapeHtml(r.item_name)} — ${statusLabels[r.status] || r.status}</div>`;
        if (r.status === "open") {
            const cancelBtn = document.createElement("button");
            cancelBtn.className = "btn btn-secondary";
            cancelBtn.textContent = "Отменить";
            cancelBtn.onclick = async () => {
                await apiFetch(`/api/market/requests/${r.request_id}/cancel`, { method: "POST" });
                await loadMyRequests(root);
            };
            card.appendChild(cancelBtn);
        }
        listEl.appendChild(card);
    });
}

async function loadHistory(root) {
    const listEl = root.querySelector("#history-list");
    let rows;
    try {
        rows = await apiFetch("/api/market/history");
    } catch (e) {
        listEl.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    if (rows.length === 0) {
        listEl.innerHTML = `<div class="profile-dim">Сделок пока не было.</div>`;
        return;
    }

    listEl.innerHTML = "";
    rows.forEach((r, i) => {
        const row = document.createElement("div");
        row.className = "profile-dim";
        const buyerName = r.buyer_vk_first_name || (r.buyer_username ? "@" + escapeHtml(r.buyer_username) : "ID " + r.buyer_vk_id);
        const time = r.fulfilled_at ? new Date(r.fulfilled_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
        const buyerId = `market-history-buyer-${i}`;
        row.innerHTML = `<span class="market-buyer-clickable" id="${buyerId}">${escapeHtml(buyerName)}</span> купил(а): ${escapeHtml(r.item_name)} · ${time}`;
        listEl.appendChild(row);
        row.querySelector(`#${buyerId}`).onclick = () => showMarketProfileOverlay(r.buyer_vk_id);
    });
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
