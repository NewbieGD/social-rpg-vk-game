import { apiFetch } from "../api.js";

const ITEM_ICONS = {
    coffee: "☕", energy_drink: "⚡", energy_crash: "😵", alcohol: "🍺",
    phone: "📱", laptop: "💻", pepper_spray: "🌶", safe: "🔒", car: "🚗",
    house: "🏠", gym: "🏋", vitamins: "💊", pills: "🩹",
    fire_insurance: "🧯", legal_insurance: "⚖️", stats_subscription: "📊",
    seller_license: "🤝", candidate: "🗳", balaclava: "🕶", fake_passport: "🛂",
    blat: "🫱", lock: "🔐", license: "🪪",
};

function iconFor(code) {
    return ITEM_ICONS[code] || "📦";
}

export async function renderShopScreen(root) {
    root.innerHTML = `<div class="loading">Загружаем магазин…</div>`;

    let items, profile;
    try {
        [items, profile] = await Promise.all([apiFetch("/api/shop"), apiFetch("/api/profile")]);
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    renderShelves(root, items, profile, "shop");
}

async function renderBlackMarket(root, profile) {
    root.innerHTML = `<div class="loading">Загружаем чёрный рынок…</div>`;
    let items;
    try {
        items = await apiFetch("/api/blackmarket/catalog");
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }
    renderShelves(root, items, profile, "blackmarket");
}

function renderShelves(root, items, profile, mode) {
    const isBlackMarket = mode === "blackmarket";

    root.innerHTML = `
        <div class="shop-sign-wrap">
            <div class="shop-sign ${isBlackMarket ? "shop-sign-black" : ""}">${isBlackMarket ? "🕶 ЧЁРНЫЙ ВХОД" : "ОТКРЫТО"}</div>
        </div>
        <div class="title">${isBlackMarket ? "🕶 Чёрный рынок" : "🛍 Магазин"}</div>
        <div class="subtitle">Нажми на товар на полке, чтобы узнать, что он даёт</div>
        <div id="shelves" class="shop-shelves"></div>
        <div id="switch-btn"></div>
    `;

    const shelves = root.querySelector("#shelves");
    const perShelf = 4;
    for (let i = 0; i < items.length; i += perShelf) {
        const shelf = document.createElement("div");
        shelf.className = "shop-shelf";
        items.slice(i, i + perShelf).forEach((item) => {
            const slot = document.createElement("div");
            slot.className = "shop-slot";
            const priceUp = item.price > item.base_price;
            const priceDown = item.price < item.base_price;
            const trendBadge = priceUp ? "📈" : priceDown ? "📉" : "";
            if (priceUp) slot.classList.add("shop-slot-price-up");
            if (priceDown) slot.classList.add("shop-slot-price-down");
            const outOfStock = item.stock === 0;
            if (outOfStock) slot.classList.add("shop-slot-empty");
            slot.innerHTML = `
                <div class="shop-slot-icon">${iconFor(item.code)}</div>
                <div class="shop-slot-price">${Number(item.price).toFixed(0)}₭</div>
                ${trendBadge ? `<div class="shop-slot-badge">${trendBadge}</div>` : ""}
                ${item.stock !== null && item.stock !== undefined ? `<div class="shop-slot-stock">${outOfStock ? "нет в наличии" : "ост. " + item.stock}</div>` : ""}
            `;
            slot.title = item.name;
            slot.onclick = () => renderItemCard(root, item, items, profile, mode);
            shelf.appendChild(slot);
        });
        shelves.appendChild(shelf);
    }

    const switchBtn = root.querySelector("#switch-btn");
    if (!isBlackMarket && profile.stage === "criminal") {
        const btn = document.createElement("button");
        btn.className = "btn btn-secondary";
        btn.textContent = "🕶 Перейти на чёрный рынок";
        btn.onclick = () => renderBlackMarket(root, profile);
        switchBtn.appendChild(btn);
    } else if (isBlackMarket) {
        const btn = document.createElement("button");
        btn.className = "btn btn-secondary";
        btn.textContent = "🔙 Вернуться в обычный магазин";
        btn.onclick = () => renderShopScreen(root);
        switchBtn.appendChild(btn);
    }
}

function renderItemCard(root, item, allItems, profile, mode) {
    const stockText = item.stock === null || item.stock === undefined ? "∞" : String(item.stock);
    const priceLine = item.event
        ? `💰 ${Number(item.price).toFixed(0)} ₭ (обычно ${Number(item.base_price).toFixed(0)}₭) — остаток: ${stockText}`
        : `💰 ${Number(item.price).toFixed(0)} ₭ (остаток: ${stockText})`;

    root.innerHTML = `
        <div class="card">
            <div class="title">${iconFor(item.code)} ${escapeHtml(item.name)}</div>
            <div class="profile-row profile-balance">${priceLine}</div>
            ${item.event ? `<div class="profile-row" style="color:${item.event.multiplier < 1 ? "#7ee787" : "#ffb454"}">${item.event.multiplier < 1 ? "📉" : "📈"} ${escapeHtml(item.event.reason)}</div>` : ""}
            <div class="subtitle">${escapeHtml(item.description || "")}</div>
            <button class="btn" id="buy-btn">✅ Купить</button>
            <button class="btn btn-secondary" id="back-btn">🔙 Назад</button>
            <div id="buy-result"></div>
        </div>
    `;

    root.querySelector("#back-btn").onclick = () => renderShelves(root, allItems, profile, mode);
    root.querySelector("#buy-btn").onclick = () => buyItem(root, item, allItems, profile, mode);
}

async function buyItem(root, item, allItems, profile, mode) {
    const resultEl = root.querySelector("#buy-result");
    const buyBtn = root.querySelector("#buy-btn");
    buyBtn.disabled = true;
    resultEl.innerHTML = `<div class="loading">Покупаем…</div>`;

    const path = mode === "blackmarket" ? `/api/blackmarket/buy/${item.code}` : `/api/shop/buy/${item.code}`;

    try {
        const result = await apiFetch(path, { method: "POST" });
        let text = "";
        if (result.needs_courier) {
            text = result.courier_assigned
                ? `✅ Оплачено: ${escapeHtml(item.name)} (${result.delivery_fee ? "+" + result.delivery_fee.toFixed(0) + "₭ за доставку" : ""}) — заказ передан курьеру, он должен подтвердить и привезти. Следи за 🔔 Уведомлениями.`
                : `✅ Оплачено: ${escapeHtml(item.name)} (${result.delivery_fee ? "+" + result.delivery_fee.toFixed(0) + "₭ за доставку" : ""}) — свободных курьеров сейчас нет, доставят автоматически в течение часа.`;
        } else {
            text = `✅ Куплено: ${escapeHtml(item.name)}`;
        }
        if (result.cover_profession) {
            text += `<br>🪪 Твоё прикрытие на карте: ${escapeHtml(result.cover_profession)}`;
        }
        resultEl.innerHTML = `<div class="profile-row" style="color:#7ee787">${text}</div>`;
    } catch (e) {
        resultEl.innerHTML = `<div class="error">${e.message}</div>`;
        buyBtn.disabled = false;
    }
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
