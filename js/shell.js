import { apiFetch } from "./api.js";
import { renderProfileScreen } from "./screens/profile.js";
import { renderShopScreen } from "./screens/shop.js";
import { renderWorkScreen } from "./screens/work.js";
import { renderCrimeScreen } from "./screens/crime.js";
import { renderPrisonScreen } from "./screens/prison.js";
import { renderPresidentDealsScreen } from "./screens/president.js";
import { renderChatsScreen, leaveChatOnNavigateAway } from "./screens/chat.js";
import { renderStateScreen } from "./screens/state.js";
import { renderLeaderboardScreen } from "./screens/leaderboard.js";
import { renderMapScreen } from "./screens/map.js";
import { renderMarketScreen } from "./screens/market.js";
import { renderLicenseScreen } from "./screens/license.js";
import { renderArmyScreen } from "./screens/army.js";
import { renderModernizationScreen } from "./screens/modernization.js";
import { renderRiotScreen } from "./screens/riot.js";
import { renderNotificationsScreen } from "./screens/notifications.js";

const BASE_NAV_ITEMS = [
    { id: "profile", icon: "👤", label: "Профиль", render: renderProfileScreen },
    { id: "notifications", icon: "🔔", label: "Уведомления", render: renderNotificationsScreen },
    { id: "shop", icon: "🛍", label: "Магазин", render: renderShopScreen },
    { id: "work", icon: "💼", label: "Работа", render: renderWorkScreen },
    { id: "state", icon: "🏛", label: "Государство", render: renderStateScreen },
    { id: "chats", icon: "💬", label: "Чаты", render: renderChatsScreen },
    { id: "leaderboard", icon: "🏆", label: "Лидеры", render: renderLeaderboardScreen },
    { id: "map", icon: "🗺", label: "Карта", render: renderMapScreen },
    { id: "market", icon: "🏪", label: "Рынок", render: renderMarketScreen },
    { id: "license", icon: "🪪", label: "Права", render: renderLicenseScreen },
    { id: "army", icon: "🎖", label: "Армия", render: renderArmyScreen },
    { id: "modernization", icon: "🏗", label: "Модернизация", render: renderModernizationScreen },
    { id: "riot", icon: "🔥", label: "Бунт", render: renderRiotScreen },
];

const CRIME_NAV_ITEM = { id: "crime", icon: "🚨", label: "Криминал", render: renderCrimeScreen };
const PRISON_NAV_ITEM = { id: "prison", icon: "🔒", label: "Тюрьма", render: renderPrisonScreen };
const PRESIDENT_NAV_ITEM = { id: "president", icon: "🎖", label: "Дела президентские", render: renderPresidentDealsScreen };

export async function renderShell(appRoot) {
    let isCriminal = false;
    let isPrisoner = false;
    let hasLicense = false;
    let isArmy = false;
    let isPresident = false;
    try {
        const profile = await apiFetch("/api/profile");
        isCriminal = profile.stage === "criminal";
        isPrisoner = profile.stage === "prison";
        hasLicense = profile.has_license;
        isArmy = !!profile.army_contract_active;
        isPresident = !!profile.is_president;
    } catch (e) {
        // Профиль не получили — покажем меню без вкладки Криминал, сама вкладка
        // Профиль сообщит об ошибке подробнее при открытии.
    }

    // У преступников/Вора нет обычной работы — вкладка "Работа" заменяется на
    // "Криминал" прямо на том же месте. У того, кого поймали и посадили —
    // ни работы, ни криминала, вместо этого "Тюрьма" с отсчётом до освобождения.
    // У президента вместо обычной работы — "Дела президентские".
    let navItems = BASE_NAV_ITEMS;
    if (isPresident) {
        navItems = navItems.map((item) => (item.id === "work" ? PRESIDENT_NAV_ITEM : item));
    } else if (isPrisoner) {
        navItems = navItems.map((item) => (item.id === "work" ? PRISON_NAV_ITEM : item));
    } else if (isCriminal) {
        navItems = navItems.map((item) => (item.id === "work" ? CRIME_NAV_ITEM : item));
    }

    // Права уже получены (экзамен сдан и права куплены) — вкладка больше не
    // нужна, убираем совсем, а не оставляем висеть неактуальной.
    if (hasLicense) {
        navItems = navItems.filter((item) => item.id !== "license");
    }

    appRoot.innerHTML = `
        <div id="screen-content" class="screen-content"></div>
        <nav class="bottom-nav" id="bottom-nav"></nav>
    `;

    const content = appRoot.querySelector("#screen-content");
    const nav = appRoot.querySelector("#bottom-nav");

    navItems.forEach((item) => {
        const btn = document.createElement("button");
        btn.className = "nav-btn";
        btn.id = `nav-${item.id}`;
        btn.innerHTML = `<span class="nav-icon">${item.icon}</span><span class="nav-label">${item.label}</span>${item.id === "notifications" ? '<span class="nav-badge" id="notif-badge" style="display:none">0</span>' : ""}${item.id === "army" ? '<span class="nav-badge" id="army-badge" style="display:none">!</span>' : ""}${item.id === "work" ? '<span class="nav-badge" id="work-badge" style="display:none">0</span>' : ""}`;
        btn.onclick = () => switchTo(item.id, content, nav, navItems);
        nav.appendChild(btn);
    });

    switchTo("profile", content, nav, navItems);
    pollUnreadNotifications(nav);
    setInterval(() => pollUnreadNotifications(nav), 20000);

    pollRiotStatus(nav, isArmy);
    setInterval(() => pollRiotStatus(nav, isArmy), 15000);

    pollPendingDuty(nav);
    setInterval(() => pollPendingDuty(nav), 20000);
}

async function pollPendingDuty(nav) {
    const badge = nav.querySelector("#work-badge");
    if (!badge) return;
    try {
        const pending = await apiFetch("/api/duty/pending");
        if (pending.length > 0) {
            badge.textContent = `+${pending.length}`;
            badge.style.display = "inline-block";
        } else {
            badge.style.display = "none";
        }
    } catch (e) {
        // не критично — просто не покажем значок в этот раз
    }
}

async function pollRiotStatus(nav, isArmy) {
    try {
        const status = await apiFetch("/api/active_riot_status");
        document.body.classList.toggle("riot-theme", !!status.active);

        if (isArmy) {
            const badge = nav.querySelector("#army-badge");
            if (badge) {
                if (status.active) {
                    const myStatus = await apiFetch("/api/army/riot_status");
                    badge.style.display = myStatus.already_acted ? "none" : "flex";
                } else {
                    badge.style.display = "none";
                }
            }
        }
    } catch (e) {
        // Не критично — попробуем на следующем опросе.
    }
}

async function pollUnreadNotifications(nav) {
    try {
        const result = await apiFetch("/api/notifications/unread_count");
        const badge = nav.querySelector("#notif-badge");
        if (!badge) return;
        if (result.count > 0) {
            badge.textContent = result.count > 9 ? "9+" : String(result.count);
            badge.style.display = "flex";
        } else {
            badge.style.display = "none";
        }
    } catch (e) {
        // Не критично — просто не покажем бейдж в этот раз, попробуем на следующем опросе.
    }
}

async function switchTo(screenId, content, nav, navItems) {
    leaveChatOnNavigateAway(); // безопасно вызывать всегда — если чат не открыт, просто ничего не делает
    nav.querySelectorAll(".nav-btn").forEach((btn) => btn.classList.remove("active"));
    nav.querySelector(`#nav-${screenId}`).classList.add("active");

    const item = navItems.find((i) => i.id === screenId);
    await item.render(content);

    if (screenId === "notifications") {
        const badge = nav.querySelector("#notif-badge");
        if (badge) badge.style.display = "none";
    }
}
