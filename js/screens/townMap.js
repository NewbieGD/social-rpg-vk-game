import { apiFetch } from "../api.js";
import { startAutoRefresh } from "../autoRefresh.js";
import { getBuildingAsset, getCharacterAsset, renderAssetHtml } from "../mapAssets.js";
import { showGameStylePopup } from "../gamePopup.js";

// Здание -> какой существующий экран открывает. Импортируется динамически
// внутри функции, а не в шапке файла — часть экранов ссылается друг на
// друга циклически (например, профиль открывает Помощь и наоборот).
async function buildingHandlers() {
    const [
        work, state, shop, market, army, modernization,
        bureaucrat, chat, leaderboard, prison, duty, map,
    ] = await Promise.all([
        import("./work.js"),
        import("./state.js"),
        import("./shop.js"),
        import("./market.js"),
        import("./army.js"),
        import("./modernization.js"),
        import("./bureaucrat.js"),
        import("./chat.js"),
        import("./leaderboard.js"),
        import("./prison.js"),
        import("./duty.js"),
        import("./map.js"),
    ]);

    return {
        dorm: map.renderMapScreen,
        university: duty.renderDutyScreen,
        police: duty.renderDutyScreen,
        prison: prison.renderPrisonScreen,
        mchs: duty.renderDutyScreen,
        hospital: duty.renderDutyScreen,
        pharmacy: duty.renderDutyScreen,
        construction: duty.renderDutyScreen,
        zavod: work.renderWorkScreen,
        army: army.renderArmyScreen,
        government: state.renderStateScreen,
        private_sector: map.renderMapScreen,
        shop: shop.renderShopScreen,
        blackmarket: shop.renderBlackMarket,
        market: market.renderMarketScreen,
        chat: chat.renderChatsScreen,
        leaderboard: leaderboard.renderLeaderboardScreen,
        modernization: modernization.renderModernizationScreen,
        bureaucrat: bureaucrat.renderBureaucratScreen,
    };
}

const MAP_BUILDING_ORDER = [
    "government", "police", "hospital", "pharmacy", "mchs", "university",
    "construction", "zavod", "army", "dorm", "shop", "market",
    "modernization", "bureaucrat", "chat", "leaderboard", "prison",
];

export async function renderTownMapScreen(root) {
    root.innerHTML = `<div class="loading">Загружаем город…</div>`;

    let profile;
    try {
        profile = await apiFetch("/api/profile");
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    const isCriminal = profile.stage === "criminal";
    const buildings = isCriminal ? [...MAP_BUILDING_ORDER, "blackmarket"] : MAP_BUILDING_ORDER;
    const avatar = getCharacterAsset("player_avatar_idle");

    root.innerHTML = `
        <div class="town-map-topbar">
            <div class="town-map-profile-widget">
                <button class="town-map-icon-btn" id="town-map-profile-btn">${renderAssetHtml(avatar, "town-map-avatar-icon")}</button>
                <button class="town-map-icon-btn" id="town-map-notifications-btn">🔔</button>
            </div>
            <div class="town-map-effects" id="town-map-effects"></div>
        </div>
        <div class="town-map-grid" id="town-map-grid">
            ${buildings.map((code) => {
                const asset = getBuildingAsset(code);
                return `
                    <button class="town-map-building" data-code="${code}">
                        ${renderAssetHtml(asset, "town-map-building-icon")}
                        <span class="town-map-building-label">${asset.label}</span>
                    </button>
                `;
            }).join("")}
        </div>
        <div class="town-map-movements" id="town-map-movements"></div>
    `;

    const handlers = await buildingHandlers();

    root.querySelectorAll(".town-map-building").forEach((btn) => {
        btn.onclick = () => {
            const code = btn.dataset.code;
            if (code === "blackmarket") {
                openBuildingScreen(root, (content) => handlers.blackmarket(content, profile));
                return;
            }
            const handler = handlers[code];
            if (handler) openBuildingScreen(root, handler);
        };
    });

    root.querySelector("#town-map-profile-btn").onclick = async () => {
        const { renderProfileScreen } = await import("./profile.js");
        openBuildingScreen(root, renderProfileScreen);
    };
    root.querySelector("#town-map-notifications-btn").onclick = async () => {
        const { renderNotificationsScreen } = await import("./notifications.js");
        openBuildingScreen(root, renderNotificationsScreen);
    };

    await loadCountryEffects(root);
    await loadMovementsTicker(root);
}

function openBuildingScreen(root, renderFn) {
    root.innerHTML = "";
    const backBtn = document.createElement("button");
    backBtn.className = "btn btn-secondary";
    backBtn.textContent = "🔙 Вернуться на карту города";
    backBtn.onclick = () => renderTownMapScreen(root);
    root.appendChild(backBtn);
    const content = document.createElement("div");
    root.appendChild(content);
    renderFn(content);
}

async function loadCountryEffects(root) {
    const el = root.querySelector("#town-map-effects");
    if (!el) return;
    let data;
    try {
        data = await apiFetch("/api/country_effects");
    } catch (e) {
        return;
    }
    el.innerHTML = data.effects.map((eff, i) => `
        <button class="town-map-effect-icon ${eff.is_debuff ? "town-map-effect-debuff" : "town-map-effect-buff"}" data-idx="${i}">
            ${eff.is_debuff ? "🔺" : "🔻"}
        </button>
    `).join("");
    el.querySelectorAll(".town-map-effect-icon").forEach((btn, i) => {
        btn.onclick = () => showGameStylePopup(
            data.effects[i].is_debuff ? "🔺 Ухудшение" : "🔻 Улучшение",
            `${data.effects[i].reason} (${data.effects[i].item_name})`,
        );
    });
}

async function loadMovementsTicker(root) {
    const el = root.querySelector("#town-map-movements");
    if (!el) return;
    const refresh = async () => {
        let movements;
        try {
            movements = await apiFetch("/api/map/movements");
        } catch (e) {
            return;
        }
        el.innerHTML = movements.slice(0, 5).map((mv) => `
            <div class="town-map-movement-row">${mv.icon} ${escapeHtml(mv.message)}</div>
        `).join("") || `<div class="profile-dim">Пока никто не в пути.</div>`;
    };
    await refresh();
    startAutoRefresh(el, refresh, 8000);
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
