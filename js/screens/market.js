import { apiFetch } from "../api.js";

const MAX_OPEN_REQUESTS = 5;

export async function renderMarketScreen(root) {
    root.innerHTML = `
        <div class="market-stall-sign">🏪 РЫНОК</div>
        <div class="title">Торговая палатка</div>
        <div class="card">
            <div class="subtitle">Нужна купленная Лицензия «Продавец». 1) жмёшь «Заказать товар»; 2) кто-то видит заявку и жмёт «Продать»; 3) тебе приходит уведомление, вещь уже у тебя. Купить — на 10% дешевле обычной цены; продать — 75% от цены (разница уходит в казну).</div>
            <button class="btn" id="request-btn">🛒 Заказать товар</button>
            <div id="request-btn-result"></div>
        </div>
        <div class="card">
            <div class="subtitle">📋 Заявки других покупателей — можно продать</div>
            <div id="requests-list"><div class="loading">Загружаем…</div></div>
        </div>
        <div class="card">
            <div class="subtitle">📤 Мои заявки (<span id="my-requests-count">…</span>/${MAX_OPEN_REQUESTS})</div>
            <div id="my-requests"><div class="loading">Загружаем…</div></div>
        </div>
        <div class="card">
            <div class="subtitle">🧾 Последние сделки на рынке</div>
            <div id="history-list"><div class="loading">Загружаем…</div></div>
        </div>
    `;

    root.querySelector("#request-btn").onclick = () => sendRequest(root);
    await loadRequests(root);
    await loadMyRequests(root);
    await loadHistory(root);
}

async function sendRequest(root) {
    const resultEl = root.querySelector("#request-btn-result");
    resultEl.innerHTML = `<div class="loading">Загружаем список доступных товаров…</div>`;

    let items;
    try {
        items = await apiFetch("/api/market/available_items");
    } catch (e) {
        resultEl.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    if (items.length === 0) {
        resultEl.innerHTML = `<div class="error">Нет доступных товаров — проверь, есть ли у тебя Лицензия «Продавец» (или «Блат», если ты преступник).</div>`;
        return;
    }

    resultEl.innerHTML = `<div class="subtitle" style="margin-top:8px">Выбери товар для заказа:</div><div id="item-picker"></div>`;
    const picker = resultEl.querySelector("#item-picker");
    items.forEach((item) => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        btn.textContent = item.name;
        btn.onclick = () => placeOrder(root, resultEl, item.code, item.name, btn);
        picker.appendChild(btn);
    });
}

async function placeOrder(root, resultEl, code, name, btn) {
    btn.disabled = true;
    try {
        await apiFetch("/api/market/request", { method: "POST", body: { item_code: code } });
        resultEl.innerHTML = `<div class="profile-row" style="color:#7ee787">✅ Заказан «${escapeHtml(name)}» — как только кто-то согласится продать, придёт уведомление.</div>`;
        await loadMyRequests(root);
    } catch (e) {
        resultEl.innerHTML = `<div class="error">${e.message}</div>`;
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
    rows.forEach((r) => {
        const card = document.createElement("div");
        card.className = "shop-item market-stall-item";
        const buyerName = r.buyer_username ? "@" + escapeHtml(r.buyer_username) : "ID " + r.buyer_vk_id;
        card.innerHTML = `<div class="shop-item-name">🛍 ${buyerName} хочет купить: ${escapeHtml(r.item_name)}</div><div class="shop-item-price">Ты получишь: ${r.seller_price.toFixed(0)}₭</div>`;

        const sellBtn = document.createElement("button");
        sellBtn.className = "btn";
        sellBtn.textContent = "✅ Продать";
        const resultEl = document.createElement("div");

        sellBtn.onclick = () => fulfillRequest(root, r.request_id, r.item_code, r.item_name, resultEl);
        card.appendChild(sellBtn);
        card.appendChild(resultEl);
        listEl.appendChild(card);
    });
}

async function fulfillRequest(root, requestId, itemCode, itemName, resultEl) {
    resultEl.innerHTML = `<div class="loading">Ищем эту вещь у тебя в инвентаре…</div>`;

    let myInventory;
    try {
        myInventory = await apiFetch("/api/inventory");
    } catch (e) {
        resultEl.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    const match = myInventory.find((i) => i.code === itemCode && !i.in_safe);
    if (!match) {
        resultEl.innerHTML = `<div class="error">У тебя нет «${escapeHtml(itemName)}» в инвентаре (или она в сейфе — сначала вытащи).</div>`;
        return;
    }

    resultEl.innerHTML = `<div class="loading">Оформляем…</div>`;
    try {
        const result = await apiFetch(`/api/market/requests/${requestId}/fulfill`, { method: "POST", body: { inventory_id: match.id } });
        resultEl.innerHTML = `<div class="profile-row" style="color:#7ee787">✅ Продано за ${result.seller_price.toFixed(0)}₭</div>`;
        await loadRequests(root);
        await loadHistory(root);
    } catch (e) {
        resultEl.innerHTML = `<div class="error">${e.message}</div>`;
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
    rows.forEach((r) => {
        const row = document.createElement("div");
        row.className = "profile-dim";
        const buyerName = r.buyer_username ? "@" + escapeHtml(r.buyer_username) : "ID " + r.buyer_vk_id;
        const time = r.fulfilled_at ? new Date(r.fulfilled_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
        row.textContent = `${buyerName} купил(а): ${r.item_name} · ${time}`;
        listEl.appendChild(row);
    });
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
