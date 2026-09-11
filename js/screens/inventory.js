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
    if (code.startsWith("cert_")) return "🎓";
    return ITEM_ICONS[code] || "📦";
}

export async function renderInventoryScreen(root) {
    root.innerHTML = `<div class="loading">Загружаем инвентарь…</div>`;

    let items, profile, pending;
    try {
        [items, profile, pending] = await Promise.all([
            apiFetch("/api/inventory"),
            apiFetch("/api/profile"),
            apiFetch("/api/inventory/pending_deliveries"),
        ]);
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    const isCriminal = profile.stage === "criminal";
    renderGrid(root, items, isCriminal, pending, profile.has_license);
}

function renderGrid(root, items, isCriminal, pending, hasLicense) {
    if (items.length === 0 && pending.length === 0 && !hasLicense) {
        root.innerHTML = `
            <div class="title">🎒 Инвентарь</div>
            <div class="card"><div class="subtitle">Пусто. Загляни в 🛍 Магазин.</div></div>
        `;
        return;
    }

    root.innerHTML = `
        <div class="title">🎒 Инвентарь</div>
        <div class="subtitle">Нажми на ячейку, чтобы посмотреть, что с вещью можно сделать. Полупрозрачные ячейки — товар уже оплачен и едет к тебе.</div>
        <div id="inv-grid" class="inv-grid"></div>
    `;

    const grid = root.querySelector("#inv-grid");

    if (hasLicense) {
        const slot = document.createElement("div");
        slot.className = "inv-slot inv-slot-license";
        slot.innerHTML = `<div class="inv-slot-icon">🪪</div>`;
        slot.title = "Права (ВУ) — навсегда, нельзя украсть, продать или потерять";
        grid.appendChild(slot);
    }

    pending.forEach((p) => {
        const slot = document.createElement("div");
        slot.className = "inv-slot inv-slot-pending";
        slot.innerHTML = `
            <div class="inv-slot-icon">${iconFor(p.code)}</div>
            <div class="inv-slot-eta">${formatEta(p.seconds_left)}</div>
        `;
        slot.title = `${p.name} — ${p.courier_assigned ? "курьер назначен" : "ждём курьера или автовыдачи"}`;
        grid.appendChild(slot);
    });

    groupItems(items).forEach((group) => {
        const slot = document.createElement("div");
        slot.className = "inv-slot";
        if (group.item.in_safe) slot.classList.add("inv-slot-safe");
        slot.innerHTML = `
            <div class="inv-slot-icon">${iconFor(group.item.code)}</div>
            ${group.count > 1 ? `<div class="inv-slot-count">${group.count}</div>` : ""}
            ${group.item.in_safe ? `<div class="inv-slot-lock">🔒</div>` : ""}
        `;
        slot.title = group.item.name;
        slot.onclick = () => renderItemCard(root, group, items, isCriminal);
        grid.appendChild(slot);
    });
}

function formatEta(seconds) {
    const mins = Math.ceil(seconds / 60);
    if (mins >= 60) return `${Math.floor(mins / 60)}ч${mins % 60}м`;
    return `${mins}м`;
}

function groupItems(items) {
    const groups = new Map();
    items.forEach((item) => {
        const key = `${item.code}:${item.in_safe}`;
        if (!groups.has(key)) {
            groups.set(key, { item, count: 0, instances: [] });
        }
        const group = groups.get(key);
        group.count += 1;
        group.instances.push(item);
    });
    for (const group of groups.values()) {
        group.instances.sort((a, b) => {
            if (!a.expires_at) return 1;
            if (!b.expires_at) return -1;
            return new Date(a.expires_at) - new Date(b.expires_at);
        });
        group.item = group.instances[0];
    }
    return [...groups.values()];
}

function renderItemCard(root, group, allItems, isCriminal) {
    const item = group.item;
    const isCert = item.code.startsWith("cert_");

    const expiryLines = group.instances
        .filter((i) => i.expires_at)
        .map((i) => `<div class="profile-dim">до ${new Date(i.expires_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>`)
        .join("");

    root.innerHTML = `
        <div class="card">
            <div class="title">${iconFor(item.code)} ${escapeHtml(item.name)}${group.count > 1 ? ` × ${group.count}` : ""}</div>
            <div class="subtitle">${escapeHtml(item.description || "")}</div>
            ${expiryLines}
            ${item.in_safe ? '<div class="profile-dim">🔒 Сейчас в сейфе</div>' : ""}
            <div id="actions"></div>
            <button class="btn btn-secondary" id="back-btn">🔙 Назад</button>
            <div id="action-result"></div>
        </div>
    `;

    const actions = root.querySelector("#actions");
    const hasSafe = allItems.some((i) => i.code === "safe");
    if (item.in_safe) {
        addActionButton(actions, "📤 Вытащить из сейфа", () => doAction(root, `/api/inventory/${item.id}/unsafe`));
    } else if (!isCert) {
        addActionButton(actions, "💸 Продать магазину (50%)", () => doAction(root, `/api/inventory/${item.id}/sell`));
        if (hasSafe) {
            addActionButton(actions, "🔒 Убрать в сейф", () => doAction(root, `/api/inventory/${item.id}/safe`));
        }
        if (isCriminal) {
            addActionButton(actions, "🕶 Сдать на чёрный рынок (30%)", () => doAction(root, `/api/blackmarket/sell/${item.id}`));
        }
    }

    root.querySelector("#back-btn").onclick = () => renderInventoryScreen(root);
}

function addActionButton(container, label, onClick) {
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = label;
    btn.onclick = onClick;
    container.appendChild(btn);
}

async function doAction(root, path) {
    const resultEl = root.querySelector("#action-result");
    resultEl.innerHTML = `<div class="loading">Выполняем…</div>`;
    try {
        await apiFetch(path, { method: "POST" });
        resultEl.innerHTML = `<div class="profile-row" style="color:#7ee787">✅ Готово</div>`;
        setTimeout(() => renderInventoryScreen(root), 600);
    } catch (e) {
        resultEl.innerHTML = `<div class="error">${e.message}</div>`;
    }
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
