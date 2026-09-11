import { apiFetch } from "../api.js";
import { DEV_MODE } from "../config.js";
import { getVkUserInfo } from "../vk.js";
import { animateCounter } from "../fx.js";
import { renderInventoryScreen } from "./inventory.js";
import { renderDutyScreen } from "./duty.js";
import { renderDuelsScreen } from "./duels.js";
import { renderCosmeticsScreen } from "./cosmetics.js";

const COSMETIC_NAMES = {
    golden_name: "Золотое имя", gradient_name: "Градиентное имя", vip_badge: "Значок VIP",
    profile_frame_neon: "Неоновая рамка", crown_badge: "Корона", mansion: "Особняк",
};

const STAGE_NAMES = {
    school: "🏫 Школьник (экзамен)",
    choosing: "🤔 Выбор профессии",
    choosing_free: "🤔 Свободный выбор профессии",
    criminal_offer: "🎲 Развилка после экзамена",
    pdd_test: "🚗 Сдаёт ПДД",
    student: "🎒 Студент",
    worker: "💼 Работник",
    criminal: "🕶 Преступник",
    prison: "⛓ В тюрьме",
};

export async function renderProfileScreen(root) {
    root.innerHTML = `<div class="loading">Загружаем профиль…</div>`;

    let user;
    try {
        user = await apiFetch("/api/profile");
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    const mainLines = [];
    const cosmetics = user.cosmetics || [];
    const isPresident = !!user.is_president;

    if (isPresident) {
        mainLines.push(`<div class="president-top-banner">🎖 ПРЕЗИДЕНТ СТРАНЫ</div>`);
    }
    if (user.times_president > 1) {
        mainLines.push(`<div class="profile-row profile-dim">${"⭐".repeat(user.times_president)} Был(а) президентом ${user.times_president} раз(а)</div>`);
    }

    const nameClass = isPresident
        ? "president-name-fire"
        : cosmetics.includes("gradient_name") ? "cosmetic-gradient-name" : cosmetics.includes("golden_name") ? "cosmetic-golden-name" : "";
    const nameBadges = [
        cosmetics.includes("crown_badge") ? "👑" : "",
        cosmetics.includes("vip_badge") ? "💎 VIP" : "",
    ].filter(Boolean).join(" ");
    const displayName = user.username ? "@" + escapeHtml(user.username) : "ID " + user.tg_id;
    mainLines.push(`<div class="profile-row"><span class="${nameClass}">${displayName}</span>${nameBadges ? " " + nameBadges : ""}</div>`);
    mainLines.push(`<div class="profile-row profile-dim" id="vk-fullname-slot"></div>`);
    mainLines.push(`<div class="profile-row profile-dim">${user.has_incognito ? "🕵️ Инкогнито активно — никто не перейдёт в твой настоящий ВК." : "👁 Сейчас любой может перейти в твой настоящий профиль ВКонтакте. Не хочешь этого — купи «Инкогнито» в Магазине."}</div>`);
    mainLines.push(`<div class="subtitle">${STAGE_NAMES[user.stage] || user.stage}</div>`);

    if (user.profession_name) {
        mainLines.push(`<div class="profile-row">💼 ${isPresident ? "Ранее работал(а): " : ""}${escapeHtml(user.profession_name)}</div>`);
    }
    if (user.forced_from_profession_name) {
        mainLines.push(`<div class="profile-row profile-dim">⚠️ Президент принудительно сменил профессию — раньше был(а): ${escapeHtml(user.forced_from_profession_name)}</div>`);
    }

    mainLines.push(`<div class="profile-row profile-balance" id="balance-value">💰 0.00 ₭</div>`);

    if (user.net_rate_per_hour > 0) {
        mainLines.push(`<div class="profile-row">📈 Сейчас зарабатываешь: ${user.net_rate_per_hour.toFixed(2)} ₭/час</div>`);
    } else if (user.zero_rate_reason) {
        mainLines.push(`<div class="profile-row profile-dim">📉 Доход сейчас: 0 ₭/час (${escapeHtml(user.zero_rate_reason)})</div>`);
    }

    if (user.progress && user.progress.kind === "graduation") {
        const p = user.progress;
        mainLines.push(`
            <div class="profile-row">🎓 До выпуска: осталось ~${p.hours_left} ч.</div>
            <div class="progress-bar"><div class="progress-bar-fill" style="width:${Math.min(100, (p.hours_done / p.hours_total) * 100)}%"></div></div>
        `);
    }

    if (user.stage === "worker" && user.profession !== "zavod" && !isPresident) {
        const authorityLevel = Math.min(Math.floor(Number(user.authority)), 10);
        const authorityBonus = Math.max(0, authorityLevel - 1);
        mainLines.push(`<div class="profile-row">🥋 Авторитет: ${authorityLevel}/10${authorityBonus > 0 ? ` (+${authorityBonus}% к шансу успеха на заявках)` : ""}</div>`);
        if (authorityLevel < 10) {
        const done = user.duty_successes_current_profession || 0;
        const total = user.authority_threshold || 4;
        mainLines.push(`
            <div class="profile-row profile-dim">До след. уровня Авторитета: ${done}/${total} успешных заявок</div>
            <div class="progress-bar"><div class="progress-bar-fill" style="width:${Math.min(100, (done / total) * 100)}%"></div></div>
        `);
        }
    }
    mainLines.push(`<div class="profile-row">⭐ ${isPresident ? "Рейтинг доверия граждан" : "Рейтинг"}: ${Number(user.rating).toFixed(2)}/100</div>`);
    mainLines.push(`<div class="profile-row">⚔️ Дуэли: ${user.duel_wins || 0} побед / ${user.duel_losses || 0} поражений</div>`);
    mainLines.push(`<div class="profile-row">🏛 Налог в стране: ${(user.tax_rate * 100).toFixed(1)}%</div>`);

    const badges = [];
    if (user.is_president) badges.push(`🎖 Президент`);
    if (user.is_peoples_rep) badges.push(`📜 Представитель народа`);
    if (user.founder_number) badges.push(`🏆 Основатель города №${user.founder_number}`);
    if (user.is_deputy && !isPresident) badges.push(`🏛 Депутат`);
    if (user.is_minister) badges.push(`🎩 ${user.minister_post_name}`);
    if (user.is_vor) badges.push(`👑 Вор в законе`);
    if (badges.length) {
        mainLines.push(`<div class="profile-badges">${badges.map((b) => `<div>${b}</div>`).join("")}</div>`);
    }

    if (cosmetics.length) {
        const cosmeticNames = cosmetics.map((c) => COSMETIC_NAMES[c] || c).join(", ");
        mainLines.push(`<div class="profile-row profile-dim">✨ Косметика: ${escapeHtml(cosmeticNames)}</div>`);
    }

    if (!isPresident) {
        const reserveEligible = Number(user.rating) >= 10 && user.has_veto;
        mainLines.push(`<div class="profile-row profile-dim">🗳 Голос по Золотовалютному резерву: ${reserveEligible ? "✅ доступен" : `❌ нужны Рейтинг 10+ и «Вето» (сейчас: рейтинг ${Number(user.rating).toFixed(0)}, «Вето» ${user.has_veto ? "есть" : "нет"})`}</div>`);
    }

    mainLines.push(`<div class="profile-row profile-dim">🎒 Предметов в инвентаре: ${user.inventory_count}</div>`);
    mainLines.push(`<div class="profile-row profile-dim">👥 Друзей приглашено: ${user.friend_count}</div>`);
    if (user.invited_by) {
        const inviterName = user.invited_by.username ? "@" + escapeHtml(user.invited_by.username) : "ID " + user.invited_by.vk_id;
        mainLines.push(`<div class="profile-row profile-dim">🔗 Тебя пригласил(а): ${inviterName}</div>`);
    }

    const hasNeonFrame = cosmetics.includes("profile_frame_neon");
    const avatarFrameClass = isPresident ? " profile-avatar-president" : hasNeonFrame ? " profile-avatar-neon" : "";

    const buffIcons = (user.buffs || []).map((b, i) =>
        `<button class="buff-icon-btn ${b.positive ? "buff-icon-positive" : "buff-icon-negative"}" id="buff-icon-${i}" style="background-image:url('assets/icons/${b.code}.png')">${b.icon}</button>`
    ).join("");

    root.innerHTML = `
        <div class="card${isPresident ? " profile-card-president" : ""}">
            <div class="title">🎮 Твой профиль</div>
            <div class="profile-layout-v2">
                <div class="profile-left-col">
                    <div class="profile-avatar-col" id="profile-avatar-col"><div class="profile-avatar profile-avatar-placeholder${avatarFrameClass}">👤</div></div>
                    <div class="profile-main-col">${mainLines.join("")}</div>
                </div>
                <div class="profile-right-col" id="profile-right-col"></div>
            </div>
            <div class="profile-buff-row">
                <div class="profile-dim" style="margin-bottom:4px">🧪 Активные баффы/дебаффы${buffIcons ? "" : ": сейчас ничего не действует"}</div>
                <div class="profile-buff-icons">${buffIcons}</div>
            </div>
        </div>
    `;

    (user.buffs || []).forEach((b, i) => {
        const btn = root.querySelector(`#buff-icon-${i}`);
        btn.onclick = () => showBuffPopup(b);
    });

    const balanceEl = root.querySelector("#balance-value");
    if (balanceEl) {
        animateCounter(balanceEl, 0, Number(user.balance), 700, (v) => `💰 ${v.toFixed(2)} ₭`);
    }

    // Фото из VK подгружаем отдельно, не блокируя показ самого профиля —
    // раньше это делалось внутри Promise.all вместе с /api/profile, и если VK
    // Bridge зависал (случается вне настоящего приложения VK), весь экран
    // виснул на "Загружаем...". Теперь профиль показывается сразу с заглушкой,
    // а фото просто подставляется следом, если и когда придёт.
    getVkUserInfo().then((info) => {
        if (!info) return;
        if (info.photoUrl) {
            const col = root.querySelector("#profile-avatar-col");
            if (col) col.innerHTML = `<img src="${info.photoUrl}" class="profile-avatar${avatarFrameClass}" alt="Фото профиля">`;
        }
        if (info.fullName) {
            const slot = root.querySelector("#vk-fullname-slot");
            if (slot) slot.textContent = `👤 ${info.fullName}`;
        }
        // Запоминаем на backend — это единственный способ потом показать твоё
        // настоящее имя/фото ДРУГИМ игрокам (сервисного ключа ВК на чужие
        // профили у нас нет, а вот через самого себя — можно).
        const firstNameOnly = info.fullName ? info.fullName.split(" ")[0] : null;
        apiFetch("/api/profile/cache_vk_info", { method: "POST", body: { photo_url: info.photoUrl, first_name: firstNameOnly } }).catch(() => {});
    });

    const navCard = root.querySelector("#profile-right-col");

    addProfileNavBtn(navCard, "nav-inventory.png", "🎒", "Инвентарь", () => showOverlayScreen(renderInventoryScreen));
    addProfileNavBtn(navCard, "nav-duty.png", "🚑", "Помощь", () => showOverlayScreen(renderDutyScreen));
    addProfileNavBtn(navCard, "nav-duels.png", "⚔️", "Дуэли", () => showFullScreenFrom(root, renderDuelsScreen, renderProfileScreen));
    addProfileNavBtn(navCard, "nav-cosmetics.png", "✨", "Косметика", () => showOverlayScreen(renderCosmeticsScreen));
    addProfileNavBtn(navCard, "nav-visitors.png", "👀", "Посетители", () => showOverlayScreen((el) => renderVisitorsOverlay(el)));
    addProfileNavBtn(navCard, "nav-invite.png", "🔗", "Пригласить друга", () => showInviteLink(null, user.tg_id));
    addProfileNavBtn(navCard, "nav-friends.png", "👥", `Друзья (${user.friend_count})`, () => showOverlayScreen((el) => renderFriendsOverlay(el)));

    const chestBtn = addProfileNavBtn(navCard, "nav-chest.png", "🎁", "Сундук", () => openChestFromNav(chestBtn));
    if (user.has_oko) {
        addProfileNavBtn(navCard, "nav-oko.png", "👁", "ОКО: статистика", () => showOkoPopup());
    }

    if (DEV_MODE) {
        const testCard = document.createElement("div");
        testCard.className = "card";
        testCard.innerHTML = `<div class="profile-dim" style="margin-bottom:10px">🧪 Кнопки для теста — уберите DEV_MODE перед тем, как показывать игру кому-то ещё.</div>`;
        const moneyBtn = document.createElement("button");
        moneyBtn.className = "btn";
        moneyBtn.textContent = "🎁 +1000₭ (тест)";
        moneyBtn.onclick = () => giveTestMoney(root, moneyBtn);
        testCard.appendChild(moneyBtn);
        const ratingBtn = document.createElement("button");
        ratingBtn.className = "btn";
        ratingBtn.textContent = "⭐ +100 к рейтингу (тест)";
        ratingBtn.onclick = () => giveTestRating(root, ratingBtn);
        testCard.appendChild(ratingBtn);
        const electionsBtn = document.createElement("button");
        electionsBtn.className = "btn";
        electionsBtn.textContent = "🗳 Завершить все голосования сейчас (тест)";
        electionsBtn.onclick = () => resolveAllElectionsNow(root, electionsBtn);
        testCard.appendChild(electionsBtn);

        const switchProfBtn = document.createElement("button");
        switchProfBtn.className = "btn";
        switchProfBtn.textContent = "🧑‍💼 Переключить профессию (тест)";
        const profPickerArea = document.createElement("div");
        switchProfBtn.onclick = () => showProfessionPicker(root, profPickerArea);
        testCard.appendChild(switchProfBtn);
        testCard.appendChild(profPickerArea);

        const timersBtn = document.createElement("button");
        timersBtn.className = "btn";
        timersBtn.textContent = "⏩ Завершить все таймеры сейчас (тест)";
        const timersResult = document.createElement("div");
        timersBtn.onclick = () => completeAllTimers(timersBtn, timersResult);
        testCard.appendChild(timersBtn);
        testCard.appendChild(timersResult);

        root.appendChild(testCard);
    }

    if (user.new_buffs && user.new_buffs.length) {
        showNewBuffsPopupQueue(user.new_buffs);
    }
}

async function openChestFromNav(btn) {
    let status;
    try {
        status = await apiFetch("/api/chest/status");
    } catch (e) {
        alert(e.message);
        return;
    }
    if (!status.available) {
        alert("Сундук уже открыт сегодня — приходи завтра.");
        return;
    }
    btn.disabled = true;
    try {
        const result = await apiFetch("/api/chest/open", { method: "POST" });
        showChestOverlay(result.amount);
    } catch (e) {
        alert(e.message);
    } finally {
        btn.disabled = false;
    }
}

async function renderVisitorsOverlay(root) {
    let data;
    try {
        data = await apiFetch("/api/profile/visitors");
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    root.innerHTML = `<div class="subtitle">👀 Последние посетители профиля</div>`;
    if (!data.visitors.length) {
        root.innerHTML += `<div class="profile-dim">Пока никто не заходил — как только кто-то посетит твой профиль, он появится здесь.</div>`;
        return;
    }
    data.visitors.forEach((v) => {
        const row = document.createElement("div");
        row.className = "shop-item";
        const name = v.username ? "@" + escapeHtml(v.username) : "ID " + v.vk_id;
        const time = new Date(v.visited_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
        row.innerHTML = `<div class="shop-item-name">${name}</div><div class="profile-dim">${time}</div>`;
        row.onclick = () => showFullScreenFrom(document.getElementById("app"), (el) => renderOtherProfile(el, v.vk_id), renderProfileScreen);
        root.appendChild(row);
    });
}

async function renderFriendsOverlay(root) {
    let friends;
    try {
        friends = await apiFetch("/api/profile/friends");
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }
    root.innerHTML = `<div class="subtitle">👥 Друзья</div>`;
    if (!friends.length) {
        root.innerHTML += `<div class="profile-dim">Пока никого не пригласил(а).</div>`;
        return;
    }
    friends.forEach((f) => {
        const card = document.createElement("div");
        card.className = "shop-item";
        card.innerHTML = `<div class="shop-item-name">${f.username ? "@" + escapeHtml(f.username) : "ID " + f.vk_id}</div>`;
        card.onclick = () => window.open(f.vk_profile_url, "_blank");
        root.appendChild(card);
    });
}

function showNewBuffsPopupQueue(buffs) {
    const [first, ...rest] = buffs;
    const overlay = document.createElement("div");
    overlay.className = "chest-overlay";
    overlay.innerHTML = `
        <div class="chest-overlay-box">
            <div class="chest-overlay-icon">${first.icon}</div>
            <div class="profile-dim" style="margin-bottom:4px">${first.positive ? "✨ Новый баф!" : "⚠️ Новый дебаф!"}</div>
            <div class="chest-overlay-title" style="color:${first.positive ? "#7ee787" : "#ff9eb5"};font-size:16px;font-weight:700">${escapeHtml(first.title)}</div>
            <div class="profile-dim" style="margin:8px 0 16px">${escapeHtml(first.description)}</div>
            <button class="btn" id="new-buff-close-btn">Понятно</button>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector("#new-buff-close-btn").onclick = () => {
        overlay.remove();
        if (rest.length) showNewBuffsPopupQueue(rest);
    };
}


async function showOkoPopup() {
    const overlay = document.createElement("div");
    overlay.className = "profile-overlay";
    const box = document.createElement("div");
    box.className = "profile-overlay-box";
    const closeBtn = document.createElement("button");
    closeBtn.className = "btn btn-secondary profile-overlay-close";
    closeBtn.textContent = "✕ Закрыть";
    closeBtn.onclick = () => overlay.remove();
    box.appendChild(closeBtn);
    const content = document.createElement("div");
    content.innerHTML = `<div class="loading">Загружаем…</div>`;
    box.appendChild(content);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    try {
        const data = await apiFetch("/api/profile/vk_visitors");
        content.innerHTML = `<div class="subtitle">👁 Всего переходов в твой ВК: ${data.total_clicks}</div>`;
        if (!data.clickers.length) {
            content.innerHTML += `<div class="profile-dim">Пока никто не переходил.</div>`;
            return;
        }
        content.innerHTML += `<div class="profile-dim" style="margin-bottom:8px">Последние 5:</div>`;
        data.clickers.forEach((c) => {
            const row = document.createElement("div");
            row.className = "shop-item";
            const name = c.vk_first_name || (c.username ? "@" + escapeHtml(c.username) : "ID " + c.vk_id);
            const time = new Date(c.clicked_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
            row.innerHTML = `<div class="shop-item-name">${c.vk_photo_url ? `<img src="${c.vk_photo_url}" class="oko-clicker-photo" alt="">` : ""}${escapeHtml(name)}</div><div class="profile-dim">${time}</div>`;
            row.onclick = () => { overlay.remove(); showFullScreenFrom(document.getElementById("app"), (el) => renderOtherProfile(el, c.vk_id), renderProfileScreen); };
            content.appendChild(row);
        });
    } catch (e) {
        content.innerHTML = `<div class="error">${e.message}</div>`;
    }
}

export async function renderOtherProfile(root, targetVkId) {
    root.innerHTML = `<div class="loading">Загружаем профиль…</div>`;
    let p;
    try {
        p = await apiFetch(`/api/profile/${targetVkId}`);
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    const badges = [];
    if (p.is_president) badges.push("🎖 Президент");
    if (p.is_peoples_rep) badges.push("📜 Представитель народа");
    if (p.founder_number) badges.push(`🏆 Основатель города №${p.founder_number}`);
    if (p.is_deputy) badges.push("🏛 Депутат");
    if (p.is_minister) badges.push(`🎩 ${p.minister_post_name}`);
    if (p.is_vor) badges.push("👑 Вор в законе");

    const photoHtml = p.vk_photo_url ? `<img src="${p.vk_photo_url}" class="oko-clicker-photo" style="width:64px;height:64px;margin-bottom:8px" alt="">` : "";
    const displayName = p.vk_first_name || (p.username ? "@" + escapeHtml(p.username) : "ID " + p.vk_id);

    root.innerHTML = `
        <div class="card${p.is_president ? " profile-card-president" : ""}">
            ${photoHtml}
            <div class="title">👤 ${escapeHtml(displayName)}</div>
            <div class="profile-row">💼 ${escapeHtml(p.profession_name || "—")}</div>
            <div class="profile-row">⭐ Рейтинг: ${p.rating.toFixed(2)}/100</div>
            <div class="profile-row">⚔️ Дуэли: ${p.duel_wins} побед / ${p.duel_losses} поражений</div>
            ${badges.length ? `<div class="profile-badges">${badges.map((b) => `<div>${b}</div>`).join("")}</div>` : ""}
            <div id="vk-link-slot"></div>
        </div>
    `;

    const vkSlot = root.querySelector("#vk-link-slot");
    if (p.has_incognito) {
        vkSlot.innerHTML = `<div class="profile-dim" style="margin-top:10px">🕵️ Этот игрок скрыл переход в свой настоящий ВК (Инкогнито).</div>`;
    } else {
        const vkBtn = document.createElement("button");
        vkBtn.className = "btn btn-secondary";
        vkBtn.style.cssText = "display:block;width:100%;margin-top:10px";
        vkBtn.textContent = "Открыть страницу ВКонтакте";
        vkBtn.onclick = () => {
            apiFetch(`/api/profile/${targetVkId}/track_vk_click`, { method: "POST" }).catch(() => {});
            window.open(p.vk_profile_url, "_blank");
        };
        vkSlot.appendChild(vkBtn);
    }
}


function showChestOverlay(amount) {
    const overlay = document.createElement("div");
    overlay.className = "chest-overlay";
    overlay.innerHTML = `
        <div class="chest-overlay-box">
            <div class="chest-overlay-icon">🎁</div>
            <div class="chest-overlay-title">В сундуке было:</div>
            <div class="chest-overlay-amount">+${amount.toFixed(2)}₭</div>
            <button class="btn" id="chest-claim-btn">Забрать</button>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector("#chest-claim-btn").onclick = () => {
        overlay.remove();
        const card = document.querySelector(".chest-card");
        if (card) card.remove();
    };
}

async function completeAllTimers(btn, resultEl) {
    btn.disabled = true;
    resultEl.innerHTML = `<div class="loading">Форсируем все таймеры…</div>`;
    try {
        const r = await apiFetch("/api/dev/complete_all_timers", { method: "POST" });
        resultEl.innerHTML = `
            <div class="profile-row" style="color:#7ee787">✅ Готово!</div>
            <div class="profile-dim">Голосований разрешено: ${r.elections_resolved} · Доставок курьером: ${r.couriers_delivered} · Освобождено из тюрьмы: ${r.prisoners_released} · Вылечено: ${r.sickness_cured}</div>
            <div class="profile-dim">Плюс: дуэли, активная Модернизация, активный Бунт, сегодняшнее голосование за Представителя народа — если были.</div>
        `;
    } catch (e) {
        resultEl.innerHTML = `<div class="error">${e.message}</div>`;
    } finally {
        btn.disabled = false;
    }
}

async function showProfessionPicker(root, container) {
    container.innerHTML = `<div class="loading">Загружаем список…</div>`;
    let data;
    try {
        data = await apiFetch("/api/dev/professions");
    } catch (e) {
        container.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    container.innerHTML = `<div class="subtitle" style="margin-top:8px">Выбери профессию — станешь ей полноценно (нужные предметы выдадутся сразу):</div>`;
    data.professions.forEach((p) => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        btn.textContent = p.name;
        btn.onclick = () => switchProfession(root, p.code);
        container.appendChild(btn);
    });
}

async function switchProfession(root, code) {
    try {
        const result = await apiFetch("/api/dev/switch_profession", { method: "POST", body: { profession: code } });
        const grantedText = result.granted_items.length ? ` Выдано: ${result.granted_items.join(", ")}.` : "";
        alert(`Готово! Теперь ты: ${result.profession_name}.${grantedText}`);
        await renderProfileScreen(root);
    } catch (e) {
        alert(e.message);
    }
}

function showInviteLink(container, myVkId) {
    const link = `${window.location.origin}${window.location.pathname}?ref=${myVkId}`;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(link).catch(() => {});
    }

    const overlay = document.createElement("div");
    overlay.className = "chest-overlay";
    overlay.innerHTML = `
        <div class="chest-overlay-box">
            <div class="chest-overlay-icon">🔗</div>
            <div class="chest-overlay-title">Пригласить друга</div>
            <div class="profile-dim" style="margin:8px 0">За приглашение: +100₭ и +1 к рейтингу. Работает только один раз на аккаунт — за второго приглашённого начисление не зачтётся. Ссылка уже скопирована в буфер обмена:</div>
            <div class="profile-row" style="word-break:break-all;font-size:13px;margin-bottom:16px">${escapeHtml(link)}</div>
            <button class="btn" id="invite-close-btn">Закрыть</button>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector("#invite-close-btn").onclick = () => overlay.remove();
}

function showBuffPopup(buff) {
    const overlay = document.createElement("div");
    overlay.className = "chest-overlay";
    overlay.innerHTML = `
        <div class="chest-overlay-box">
            <div class="chest-overlay-icon">${buff.icon}</div>
            <div class="chest-overlay-title" style="color:${buff.positive ? "#7ee787" : "#ff9eb5"};font-size:16px;font-weight:700">${escapeHtml(buff.title)}</div>
            <div class="profile-dim" style="margin:8px 0 16px">${escapeHtml(buff.description)}</div>
            <button class="btn" id="buff-close-btn">Закрыть</button>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector("#buff-close-btn").onclick = () => overlay.remove();
}

function addProfileNavBtn(container, iconFile, emoji, label, onClick) {
    const btn = document.createElement("button");
    btn.className = "btn btn-secondary profile-nav-btn";
    btn.innerHTML = `
        <img src="assets/ui/${iconFile}" class="profile-nav-icon" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';">
        <span class="profile-nav-emoji-fallback" style="display:none">${emoji}</span>
        <span>${escapeHtml(label)}</span>
    `;
    btn.onclick = onClick;
    container.appendChild(btn);
    return btn;
}

async function showOverlayScreen(renderFn) {
    const overlay = document.createElement("div");
    overlay.className = "profile-overlay";
    const box = document.createElement("div");
    box.className = "profile-overlay-box";
    const closeBtn = document.createElement("button");
    closeBtn.className = "btn btn-secondary profile-overlay-close";
    closeBtn.textContent = "✕ Закрыть";
    closeBtn.onclick = () => overlay.remove();
    box.appendChild(closeBtn);
    const content = document.createElement("div");
    box.appendChild(content);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    await renderFn(content);
}

async function showFullScreenFrom(root, renderFn, backToFn) {
    root.innerHTML = "";
    const backBtn = document.createElement("button");
    backBtn.className = "btn btn-secondary";
    backBtn.textContent = "🔙 Назад в профиль";
    backBtn.onclick = () => backToFn(root);
    root.appendChild(backBtn);
    const content = document.createElement("div");
    root.appendChild(content);
    await renderFn(content);
}

async function giveTestMoney(root, btn) {
    btn.disabled = true;
    btn.textContent = "Начисляем…";
    try {
        await apiFetch("/api/dev/give_money", { method: "POST" });
        await renderProfileScreen(root);
    } catch (e) {
        alert(e.message);
        btn.disabled = false;
        btn.textContent = "🎁 +1000₭ (тест)";
    }
}

async function giveTestRating(root, btn) {
    btn.disabled = true;
    btn.textContent = "Начисляем…";
    try {
        await apiFetch("/api/dev/give_rating", { method: "POST" });
        await renderProfileScreen(root);
    } catch (e) {
        alert(e.message);
        btn.disabled = false;
        btn.textContent = "⭐ +100 к рейтингу (тест)";
    }
}

async function resolveAllElectionsNow(root, btn) {
    btn.disabled = true;
    btn.textContent = "Завершаем…";
    try {
        const result = await apiFetch("/api/dev/resolve_all_elections", { method: "POST" });
        alert(`Готово: завершено голосований — ${result.resolved_count}. Результаты применены (загляни в 🔔 Уведомления и 🏛 Государство).`);
        btn.disabled = false;
        btn.textContent = "🗳 Завершить все голосования сейчас (тест)";
    } catch (e) {
        alert(e.message);
        btn.disabled = false;
        btn.textContent = "🗳 Завершить все голосования сейчас (тест)";
    }
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
