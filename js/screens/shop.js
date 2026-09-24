import { apiFetch } from "../api.js";
import { showGameStylePopup, showGamePopupWithContent } from "../gamePopup.js";

const ITEM_ICONS = {
    coffee: "☕", energy_drink: "⚡", energy_crash: "😵", alcohol: "🍺",
    phone: "📱", laptop: "💻", pepper_spray: "🌶", safe: "🔒", car: "🚗",
    house: "🏠", gym: "🏋", vitamins: "💊", pills: "🩹",
    fire_insurance: "🧯", legal_insurance: "⚖️", stats_subscription: "📊",
    seller_license: "🤝", candidate: "🗳", balaclava: "🕶", fake_passport: "🛂",
    blat: "🫱", lock: "🔐", license: "🪪",
    thief_note: "🕵️", recruitment_list: "📋", stash: "🗝",
};

function iconFor(code) {
    return ITEM_ICONS[code] || "📦";
}

async function loadStashBanner(root) {
    const el = root.querySelector("#stash-balance-banner");
    if (!el) return;
    try {
        const status = await apiFetch("/api/stash/status");
        el.innerHTML = `<div class="shop-balance-banner" style="opacity:0.85">🗝 Баланс тайника: <b>${status.total.toFixed(2)}₭</b>${status.matured > 0 ? ` (доступно к выводу: ${status.matured.toFixed(2)}₭)` : ""}</div>`;
    } catch (e) {
        // не критично — просто не покажем в этот раз
    }
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
    checkNewArrivals();
    if (profile.stage === "criminal") loadStashBanner(root);
}

async function checkNewArrivals() {
    try {
        const data = await apiFetch("/api/shop/new_arrivals");
        if (data.arrivals.length > 0) {
            const names = data.arrivals.map((a) => escapeHtml(a.name)).join(", ");
            showGameStylePopup("🆕 Новое поступление!", `В Магазине снова есть: <b>${names}</b> (раньше закончилось).`);
        }
    } catch (e) {
        // не критично — просто не покажем в этот раз
    }
}

export async function renderBlackMarket(root, profile) {
    root.innerHTML = `<div class="loading">Загружаем чёрный рынок…</div>`;
    let items;
    try {
        items = await apiFetch("/api/blackmarket/catalog");
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }
    renderShelves(root, items, profile, "blackmarket");
    if (profile.stage === "criminal") loadStashBanner(root);
}

async function showMyDeliveriesPopup() {
    const { content } = showGamePopupWithContent("📦 Что мне везут", (c) => {
        c.innerHTML = `<div class="loading">Загружаем…</div>`;
    });
    try {
        const data = await apiFetch("/api/shop/my_deliveries");
        if (!data.deliveries.length) {
            content.innerHTML = `<div class="profile-dim">Сейчас ничего не едет.</div>`;
            return;
        }
        content.innerHTML = data.deliveries.map((d) => `
            <div class="shop-item">
                <div class="shop-item-name">${escapeHtml(d.item_name)}</div>
                <div class="profile-dim">${d.has_courier ? "🚚 Курьер уже в пути" : "⏳ Курьера пока нет — доставят автоматически в течение часа, либо раньше, если найдётся свободный"}</div>
            </div>
        `).join("");
    } catch (e) {
        content.innerHTML = `<div class="error">${e.message}</div>`;
    }
}

function renderShelves(root, items, profile, mode) {
    const isBlackMarket = mode === "blackmarket";

    root.innerHTML = `
        <div class="shop-sign-wrap">
            <div class="shop-sign ${isBlackMarket ? "shop-sign-black" : ""}">${isBlackMarket ? "🕶 ЧЁРНЫЙ ВХОД" : "ОТКРЫТО"}</div>
        </div>
        <div class="title">${isBlackMarket ? "🕶 Чёрный рынок" : "🛍 Магазин"}</div>
        <div class="shop-balance-banner">💰 Твой баланс: <b>${Number(profile.balance).toFixed(2)}₭</b></div>
        <div id="stash-balance-banner"></div>
        <div class="subtitle">Нажми на товар на полке, чтобы узнать, что он даёт</div>
        ${isBlackMarket ? "" : `<button class="btn btn-secondary" id="my-deliveries-btn" style="margin-bottom:10px">📦 Что мне везут</button>`}
        <div id="shelves" class="shop-shelves"></div>
        <div id="switch-btn"></div>
    `;

    if (!isBlackMarket) {
        root.querySelector("#my-deliveries-btn").onclick = () => showMyDeliveriesPopup();
    }

    const shelves = root.querySelector("#shelves");
    const perShelf = 4;
    for (let i = 0; i < items.length; i += perShelf) {
        const shelf = document.createElement("div");
        shelf.className = "shop-shelf";
        items.slice(i, i + perShelf).forEach((item) => {
            const slot = document.createElement("div");
            slot.className = "shop-slot";
            // Сравниваем ОКРУГЛЁННЫЕ (то, что реально видит игрок) значения,
            // а не сырые числа — иначе почти любой товар после хоть одной
            // покупки навсегда обведён красным из-за микроскопического
            // (десятые доли ₭) отличия спроса от 1.0, невидимого на экране.
            const displayedPrice = Math.round(item.price);
            const displayedBase = Math.round(item.base_price);
            const priceUp = displayedPrice > displayedBase;
            const priceDown = displayedPrice < displayedBase;
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
            slot.onclick = () => showItemPopup(item, items, profile, mode);
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

function showItemPopup(item, allItems, profile, mode) {
    const stockText = item.stock === null || item.stock === undefined ? "∞" : String(item.stock);
    const priceLine = item.event
        ? `💰 ${Number(item.price).toFixed(0)} ₭ (обычно ${Number(item.base_price).toFixed(0)}₭) — остаток: ${stockText}`
        : `💰 ${Number(item.price).toFixed(0)} ₭ (остаток: ${stockText})`;

    const { content } = showGamePopupWithContent(`${iconFor(item.code)} ${escapeHtml(item.name)}`, (c) => {
        c.innerHTML = `
            <div class="profile-row profile-balance">${priceLine}</div>
            ${item.event ? `<div class="profile-row" style="color:${item.event.multiplier < 1 ? "#7ee787" : "#ffb454"}">${item.event.multiplier < 1 ? "📉" : "📈"} ${escapeHtml(item.event.reason)}</div>` : ""}
            <div class="subtitle">${escapeHtml(item.description || "")}</div>
            <button class="btn" id="buy-btn" style="margin-top:10px">✅ Купить</button>
        `;
    });
    content.querySelector("#buy-btn").onclick = () => buyItem(content, item, allItems, profile, mode);
}

async function buyItem(content, item, allItems, profile, mode) {
    const buyBtn = content.querySelector("#buy-btn");
    buyBtn.disabled = true;

    const path = mode === "blackmarket" ? `/api/blackmarket/buy/${item.code}` : `/api/shop/buy/${item.code}`;

    try {
        const result = await apiFetch(path, { method: "POST" });
        let text = "";
        if (result.house_dispatch) {
            text = "🏗 Заявка на постройку отправлена Строителю — жди уведомления об исходе (деньги уже списаны, если Строитель провалит попытку, они не сгорят, просто запроси повтор в разделе Помощь).";
        } else if (result.needs_courier) {
            text = result.courier_assigned
                ? `Заказ передан курьеру, он должен подтвердить и привезти. Следи за 🔔 Уведомлениями.`
                : `Свободных курьеров сейчас нет — доставят автоматически в течение часа.`;
            if (result.delivery_fee) text += `<br>💸 За доставку списано ${result.delivery_fee.toFixed(0)}₭.`;
        } else {
            text = `Товар сразу у тебя в инвентаре.`;
        }
        if (result.cover_profession) {
            text += `<br>🪪 Твоё прикрытие на карте: ${escapeHtml(result.cover_profession)}`;
        }
        buyBtn.disabled = false;
        showGameStylePopup(`✅ Куплено: ${escapeHtml(item.name)}`, text);
    } catch (e) {
        buyBtn.disabled = false;
        showGameStylePopup("❌ Не получилось", e.message);
    }
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
