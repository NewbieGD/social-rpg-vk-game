import { apiFetch } from "../api.js";

export async function renderNotificationsScreen(root) {
    root.innerHTML = `
        <div class="title">🔔 Уведомления</div>
        <div class="tab-row">
            <button class="tab-btn active" id="tab-personal">🔔 Личные</button>
            <button class="tab-btn" id="tab-news">🌍 Новости страны</button>
        </div>
        <div id="notif-body"><div class="loading">Загружаем…</div></div>
    `;

    root.querySelector("#tab-personal").onclick = () => switchTab(root, "personal");
    root.querySelector("#tab-news").onclick = () => switchTab(root, "news");

    await loadPersonal(root);
}

function switchTab(root, tab) {
    root.querySelector("#tab-personal").classList.toggle("active", tab === "personal");
    root.querySelector("#tab-news").classList.toggle("active", tab === "news");
    if (tab === "personal") loadPersonal(root);
    else loadNews(root);
}

async function loadPersonal(root) {
    const body = root.querySelector("#notif-body");
    body.innerHTML = `<div class="loading">Загружаем…</div>`;

    let items;
    try {
        items = await apiFetch("/api/notifications");
    } catch (e) {
        body.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    if (items.length === 0) {
        body.innerHTML = `<div class="card"><div class="subtitle">Пока пусто — здесь будут появляться важные события лично про тебя: болезнь, пожар, ограбление, итоги дежурных вызовов и дуэлей.</div></div>`;
        return;
    }

    renderList(body, items);
}

async function loadNews(root) {
    const body = root.querySelector("#notif-body");
    body.innerHTML = `<div class="loading">Загружаем…</div>`;

    let items;
    try {
        items = await apiFetch("/api/news");
    } catch (e) {
        body.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    if (items.length === 0) {
        body.innerHTML = `<div class="card"><div class="subtitle">Пока новостей нет — здесь будут появляться крупные события страны: выборы, рыночные события, бунты. Нужен купленный Телефон.</div></div>`;
        return;
    }

    renderNewsTicker(body, items);

    const archiveLabel = document.createElement("div");
    archiveLabel.className = "profile-dim";
    archiveLabel.style.marginTop = "10px";
    archiveLabel.textContent = "Полный список последних новостей:";
    body.appendChild(archiveLabel);

    const archive = document.createElement("div");
    body.appendChild(archive);
    renderList(archive, items);
}

function renderList(body, items) {
    body.innerHTML = "";
    items.forEach((n, i) => {
        const card = document.createElement("div");
        card.className = "shop-item notif-card";
        card.style.animationDelay = `${i * 0.05}s`;
        const time = new Date(n.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
        card.innerHTML = `<div class="shop-item-name">${escapeHtml(n.text)}</div><div class="profile-dim">${time}</div>`;
        body.appendChild(card);
    });
}

function renderNewsTicker(body, items) {
    const headlines = items.map((n) => n.text);
    const combined = headlines.join("     •     ");
    // Дублирую строку, чтобы бегущая строка зацикливалась без видимого разрыва.
    body.innerHTML = `
        <div class="news-tv">
            <div class="news-tv-header">📺 НОВОСТИ СТРАНЫ <span class="news-tv-live">● LIVE</span></div>
            <div class="news-tv-screen">
                <div class="news-ticker-track">
                    <span class="news-ticker-content">${escapeHtml(combined)}</span>
                    <span class="news-ticker-content">${escapeHtml(combined)}</span>
                </div>
            </div>
        </div>
    `;
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
