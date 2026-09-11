import { apiFetch } from "../api.js";

export async function renderStateScreen(root) {
    root.innerHTML = `<div class="loading">Загружаем…</div>`;

    let state, profile, elections;
    try {
        [state, profile, elections] = await Promise.all([
            apiFetch("/api/state"),
            apiFetch("/api/profile"),
            apiFetch("/api/elections"),
        ]);
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    const isPresident = state.president && state.president.vk_id === profile.tg_id;
    const isVor = profile.is_vor;

    const parts = [];
    parts.push(renderCountryCard(state));
    parts.push(`
        <div class="card">
            <div class="subtitle">📊 Подробная статистика доступна с купленной Подпиской на статистику страны (магазин).</div>
            <button class="btn btn-secondary" id="stats-btn">📊 Посмотреть статистику</button>
            <div id="stats-result"></div>
        </div>
    `);
    parts.push(`<div id="elections-card"></div>`);
    parts.push(renderRoleActionsCard(profile));
    if (isVor) parts.push(renderVorCard());
    parts.push(`<div id="state-result"></div>`);

    root.innerHTML = `<div class="title">🏛 Государство</div>${parts.join("")}`;

    root.querySelector("#stats-btn").onclick = () => loadCountryStats(root);
    renderElections(root, elections);
    wireRoleActions(root, profile);
    loadPublicReserveInfo(root);
    if (isVor) {
        wireVorActions(root);
    }
}

function renderCountryCard(state) {
    const presidentText = state.president ? nameOf(state.president) : "не назначен";
    const ministers = Object.values(state.ministers)
        .map((m) => `${m.name}: ${m.vk_id ? nameOf(m) : "вакантно"}`)
        .join("<br>");

    const flagHtml = state.flag_colors && state.flag_colors.length
        ? `<div class="country-flag">${state.flag_colors.map((c) => `<div class="country-flag-stripe" style="background:${state.flag_color_hex[c] || "#888"}"></div>`).join("")}</div>`
        : `<div class="country-flag country-flag-blank"><div class="country-flag-stripe" style="background:#fff"></div></div>`;
    const flagNote = state.flag_colors && state.flag_colors.length ? "" : `<div class="profile-dim">⬜ У страны пока нет флага — президент может предложить цвета на голосование.</div>`;
    const nameNote = state.country_name_chosen ? "" : `<div class="profile-dim">📛 Название страны пока не выбрано официально (используется значение по умолчанию) — президент может предложить новое.</div>`;

    return `
        <div class="card">
            ${flagHtml}
            <div class="title" style="font-size:17px">${escapeHtml(state.country_name)}</div>
            ${nameNote}
            ${flagNote}
            <div class="profile-row">Президент: ${presidentText}</div>
            <div class="profile-row profile-dim">${ministers}</div>
            <div class="profile-row">Депутатов: ${state.deputies.length}</div>
            <div class="profile-row">Налог: ${(state.tax_rate * 100).toFixed(1)}%</div>
            <div class="profile-row">Госбюджет: ${Number(state.treasury).toFixed(2)}₭</div>
            <div class="profile-row profile-dim">Контроль власти (подкуплено чиновников): ${state.corruption_control}</div>
            <div class="profile-row profile-dim">🔪 Ликвидировано Воров в законе: ${state.vors_eliminated}</div>
            <div class="profile-row profile-dim">📈 Рейтинг президента (по итогам голосований/путчей/бунтов): ${state.president_rating.toFixed(1)}</div>
            <div class="profile-row profile-dim" id="reserve-info-public">🏦 Загружаем ЗРС…</div>
        </div>
    `;
}

function nameOf(entity) {
    return entity.username ? `@${entity.username}` : `ID ${entity.vk_id}`;
}

function renderElections(root, elections) {
    const card = root.querySelector("#elections-card");
    card.className = "card";
    if (elections.length === 0) {
        card.innerHTML = `<div class="subtitle">🗳 Сейчас нет активных голосований.</div>`;
        return;
    }

    card.innerHTML = `<div class="subtitle">🗳 Голосования</div><div id="election-list"></div>`;
    const list = root.querySelector("#election-list");

    elections.forEach((e) => {
        const wrap = document.createElement("div");
        wrap.className = "shop-item";
        wrap.innerHTML = `<div class="shop-item-name">${electionLabel(e.type)}</div><div class="profile-dim">⏳ До ${formatDeadline(e.closes_at)}</div>`;
        e.choices.forEach((choice) => {
            const row = document.createElement("div");
            row.className = "election-choice-row";

            const btn = document.createElement("button");
            btn.className = "option-btn";
            btn.textContent = `${choice.label || nameOf(choice)} — ${choice.votes} 🗳`;
            const value = choice.value || String(choice.vk_id);
            btn.onclick = () => castVote(root, e.id, value);
            row.appendChild(btn);

            if (choice.voters && choice.voters.length > 0) {
                const votersLine = document.createElement("div");
                votersLine.className = "profile-dim election-voters-line";
                votersLine.textContent = `Голосовали: ${choice.voters.join(", ")}`;
                row.appendChild(votersLine);
            }

            wrap.appendChild(row);
        });
        list.appendChild(wrap);
    });
}

function formatDeadline(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const ELECTION_LABELS = {
    vor: "👑 Выборы Вора в законе", deputy: "🏛 Выборы депутатов", president: "🎖 Выборы президента",
    president_runoff: "🎖 Второй тур выборов президента", impeachment: "⚖️ Импичмент",
    impeachment_auto: "⚖️ Автоматический импичмент (после провала бунта)", coup: "⚔️ Путч",
    hunt_vor: "🎯 Поддержать охоту на Вора", riot_vote: "🔥 Голосование за бунт",
    rename_country: "📛 Переименование страны", flag_vote: "🚩 Голосование за флаг страны",
};

function electionLabel(type) {
    return ELECTION_LABELS[type] || type;
}

async function castVote(root, electionId, choice) {
    const resultEl = root.querySelector("#state-result");
    resultEl.innerHTML = `<div class="loading">Голосуем…</div>`;
    try {
        await apiFetch(`/api/elections/${electionId}/vote`, { method: "POST", body: { choice } });
        resultEl.innerHTML = `<div class="profile-row" style="color:#7ee787">✅ Голос учтён</div>`;
    } catch (e) {
        resultEl.innerHTML = `<div class="error">${e.message}</div>`;
    }
}

function renderRoleActionsCard(profile) {
    if (profile.is_deputy) {
        return `<div class="card"><div class="subtitle">Ты депутат.</div><button class="btn" id="impeach-btn">⚖️ Подписать импичмент президенту</button></div>`;
    }
    if (profile.stage !== "criminal") {
        return `<div class="card"><div class="subtitle">Нужен Рейтинг 100 и предмет «Кандидат на выборы» (из магазина).</div><button class="btn" id="register-deputy-btn">🗳️ Выдвинуться в депутаты</button></div>`;
    }
    return "";
}

function wireRoleActions(root, profile) {
    const impeachBtn = root.querySelector("#impeach-btn");
    if (impeachBtn) {
        impeachBtn.onclick = () => runAction(root, "/api/impeach", {});
    }
    const registerBtn = root.querySelector("#register-deputy-btn");
    if (registerBtn) {
        registerBtn.onclick = () => runAction(root, "/api/deputy/register", {});
    }
}

async function loadPublicReserveInfo(root) {
    const el = root.querySelector("#reserve-info-public");
    if (!el) return;
    try {
        const info = await apiFetch("/api/reserve");
        el.textContent = `🏦 Золотовалютный резерв страны: ${info.golden_reserve.toFixed(1)} 🗳 голосов (копится с продаж Косметики, управляет только президент)`;
    } catch (e) {
        el.textContent = "";
    }
}

async function loadCountryStats(root) {
    const resultEl = root.querySelector("#stats-result");
    resultEl.innerHTML = `<div class="loading">Загружаем…</div>`;
    try {
        const s = await apiFetch("/api/stats");
        const growthText = s.population_growth === null ? "" : ` (${s.population_growth >= 0 ? "+" : ""}${s.population_growth} за сутки)`;
        resultEl.innerHTML = `
            <div class="stats-panel">
                <div class="stats-tile">
                    <div class="stats-tile-value">${s.population}</div>
                    <div class="stats-tile-label">👥 Население${growthText}</div>
                </div>
                <div class="stats-tile">
                    <div class="stats-tile-value">${Number(s.treasury).toFixed(0)}₭</div>
                    <div class="stats-tile-label">🏦 Госбюджет</div>
                </div>
                <div class="stats-tile">
                    <div class="stats-tile-value">${s.crime_pct}%</div>
                    <div class="stats-tile-label">🕶 Преступность</div>
                </div>
                <div class="stats-tile">
                    <div class="stats-tile-value">${s.illness_pct}%</div>
                    <div class="stats-tile-label">🦠 Заболеваемость</div>
                </div>
            </div>
            <div class="profile-row">🎖 Президент: ${s.president ? escapeHtml(s.president) : "не избран"}</div>
            <div class="profile-row">💰 Налог: ${(s.tax_rate * 100).toFixed(1)}%</div>
            <div class="profile-row">👑 Вор в законе: ${s.vor_present ? "есть" : "свободный трон"}</div>
            <div class="profile-row" style="color:#ffd873">🏆 Богатейший житель: ${s.richest_username ? escapeHtml(s.richest_username) : (s.richest_vk_id ? "ID " + s.richest_vk_id : "—")} (${Number(s.richest_balance).toFixed(0)}₭)</div>
            <div class="profile-row profile-dim">💵 Средний баланс по стране: ${Number(s.avg_balance).toFixed(0)}₭ · ⭐ Средний рейтинг: ${s.avg_rating}</div>
            <div class="profile-row profile-dim">👮 Полиция: ${s.police_count} · 🚒 МЧС: ${s.mchs_count} · 🚑 Врачи: ${s.doctor_count} · 📚 Преподаватели: ${s.teacher_count}</div>
            <div class="profile-row profile-dim">🏭 Завод: ${s.zavod_count} · 🏗 Строители: ${s.construction_count} · 📦 Такси/Курьеры: ${s.delivery_count} · 🎒 Студентов: ${s.student_count} · 🎖 Армия: ${s.army_count}</div>
        `;
    } catch (e) {
        resultEl.innerHTML = `<div class="error">${e.message}</div>`;
    }
}

async function runAction(root, path, body, method = "POST") {
    const resultEl = root.querySelector("#state-result");
    resultEl.innerHTML = `<div class="loading">Выполняем…</div>`;
    try {
        const result = await apiFetch(path, { method, body });
        resultEl.innerHTML = `<div class="profile-row" style="color:#7ee787">✅ Готово</div>`;
        return result;
    } catch (e) {
        resultEl.innerHTML = `<div class="error">${e.message}</div>`;
        return null;
    }
}

function renderVorCard() {
    return `
        <div class="card">
            <div class="subtitle">👑 Ты Вор в законе</div>
            <button class="option-btn" id="v-pardon">🛡 Помиловать бандита</button>
            <button class="option-btn" id="v-bribe">💰 Подкупить чиновника (1000₭)</button>
            <button class="btn" id="v-assassinate">💀 Покушение на Президента</button>
        </div>
    `;
}

function wireVorActions(root) {
    root.querySelector("#v-pardon").onclick = () => {
        const id = promptNumber("VK ID бандита:");
        if (id !== null) runAction(root, "/api/vor/pardon", { target_vk_id: id });
    };
    root.querySelector("#v-bribe").onclick = () => {
        const id = promptNumber("VK ID депутата/министра:");
        if (id !== null) runAction(root, "/api/vor/bribe", { target_vk_id: id });
    };
    root.querySelector("#v-assassinate").onclick = () => runAction(root, "/api/vor/assassinate_president", {});
}

function promptNumber(message) {
    const value = prompt(message);
    if (value === null || value.trim() === "") return null;
    const num = Number(value);
    return Number.isNaN(num) ? null : num;
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
