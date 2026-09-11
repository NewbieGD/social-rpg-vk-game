import { apiFetch } from "../api.js";

export async function renderPresidentDealsScreen(root) {
    root.innerHTML = `
        <div class="title">🎖 Дела президентские</div>
        <div class="card">
            <div class="subtitle">📊 Панель Президента</div>
            <div id="dashboard-stats" class="profile-dim">Загружаем…</div>
            <div id="picker-area"></div>
            <button class="option-btn" id="p-tax">💰 Установить налог</button>
            <button class="option-btn" id="p-boost">📈 Надбавка профессии</button>
            <button class="option-btn" id="p-force">👷 Принудительное назначение</button>
            <button class="option-btn" id="p-appoint">🎖 Назначить министра</button>
            <button class="option-btn" id="p-dismiss">🚫 Снять министра</button>
            <button class="option-btn" id="p-treasury">💸 Раздать Госбюджет</button>
            <button class="option-btn" id="p-rename">✏️ Сменить название страны (голосование)</button>
            <button class="option-btn" id="p-flag">🚩 Предложить флаг страны (голосование)</button>
            <button class="option-btn" id="p-hunt">🎯 Начать охоту на Вора</button>
            <button class="option-btn" id="p-restock">📦 Пополнить склад (страховки/подписка/лицензия/кандидат/спортзал)</button>
            <button class="option-btn" id="p-remove">🔫 Убрать Вора (после охоты)</button>
            <button class="option-btn" id="p-army-rate">🎖 Изменить ставку армии</button>
            <button class="option-btn" id="p-army-disband">💣 Расформировать армию</button>
            <div id="president-result"></div>
        </div>
        <div class="card">
            <div class="subtitle">🏦 Золотовалютный резерв страны</div>
            <div id="reserve-info" class="profile-dim">Загружаем ЗРС…</div>
            <button class="option-btn" id="p-reserve-withdraw">💰 Вывести ЗРС себе на баланс</button>
            <button class="option-btn" id="p-reserve-ministers">💰 Распределить ЗРС между министрами</button>
            <button class="option-btn" id="p-reserve-cosmetics">🎁 Сделать косметику дешевле (из ЗРС)</button>
            <button class="option-btn" id="p-reserve-convert">💱 Конвертировать ЗРС в Госбюджет</button>
        </div>
        <div id="pending-petitions"></div>
    `;

    try {
        const dash = await apiFetch("/api/president/dashboard");
        root.querySelector("#dashboard-stats").innerHTML = `
            Активных: ${dash.total_active} · Больных: ${dash.sick_count} · Ограблено сегодня: ${dash.robbed_today}<br>
            Полиция: ${dash.police_count} (цель ${dash.police_target.toFixed(1)}) ·
            Врачи: ${dash.doctor_count} (цель ${dash.doctor_target.toFixed(1)}) ·
            МЧС: ${dash.mchs_count} (цель ${dash.mchs_target.toFixed(1)})<br>
            ${dash.disasters_ready ? "⚠️ Катаклизмы возможны" : "✅ Катаклизмы пока заблокированы (мало нужных профессий)"}
        `;
    } catch (e) {
        root.querySelector("#dashboard-stats").innerHTML = `<span class="error">${e.message}</span>`;
    }

    await loadPendingPetitions(root);
    await loadReserveInfo(root);

    let options;
    try {
        options = await apiFetch("/api/president/options");
    } catch (e) {
        options = { professions: [], force_assign_professions: [], minister_posts: [], restockable_items: [], flag_colors: [] };
    }
    const pickerArea = root.querySelector("#picker-area");

    root.querySelector("#p-tax").onclick = () => {
        const pct = promptNumber("Новая ставка налога в % (5-30):");
        if (pct !== null) runAction(root, "/api/president/set_tax", { percent: pct });
    };
    root.querySelector("#p-boost").onclick = () => {
        showPicker(pickerArea, "Какой профессии поднять ставку?", options.professions, (profession) => {
            const pct = promptNumber("На сколько % поднять (стоимость 5000₭ за 1%)?");
            if (pct !== null) runAction(root, "/api/president/boost_profession", { profession, percent: pct });
        });
    };
    root.querySelector("#p-force").onclick = () => {
        showPicker(pickerArea, "В какую профессию принудительно перевести?", options.force_assign_professions, (profession) => {
            runAction(root, "/api/president/force_assign", { profession });
        });
    };
    root.querySelector("#p-appoint").onclick = () => {
        showPicker(pickerArea, "На какой пост назначить?", options.minister_posts, (post) => {
            const targetId = promptNumber("VK ID кандидата (Авторитет 5+ в нужной профессии):");
            if (targetId !== null) runAction(root, "/api/president/appoint_minister", { post, target_vk_id: targetId });
        });
    };
    root.querySelector("#p-dismiss").onclick = () => {
        showPicker(pickerArea, "Какой пост освободить?", options.minister_posts, (post) => {
            runAction(root, "/api/president/dismiss_minister", { post });
        });
    };
    root.querySelector("#p-treasury").onclick = () => runAction(root, "/api/president/distribute_treasury", {});
    root.querySelector("#p-rename").onclick = () => {
        const name = prompt("Предложить новое название страны (запустит всенародное голосование на 1 час):");
        if (name) runRenameVote(root, name);
    };
    root.querySelector("#p-flag").onclick = () => {
        showMultiPicker(pickerArea, "Выбери от 1 до 5 цветов флага:", options.flag_colors, (colors) => {
            if (colors.length > 0) runFlagVote(root, colors);
        });
    };
    root.querySelector("#p-hunt").onclick = () => runAction(root, "/api/president/hunt_vor", {});
    root.querySelector("#p-restock").onclick = () => {
        showPicker(pickerArea, "Какой товар пополнить?", options.restockable_items, (code) => {
            runAction(root, "/api/president/restock_item", { code });
        });
    };
    root.querySelector("#p-remove").onclick = () => runAction(root, "/api/president/remove_vor", {});
    root.querySelector("#p-army-rate").onclick = () => {
        const rate = promptNumber("Новая ставка армии (₭/час):");
        if (rate !== null) runAction(root, "/api/president/set_army_rate", { rate });
    };
    root.querySelector("#p-army-disband").onclick = () => {
        if (confirm("Расформировать армию? Все действующие контракты будут расторгнуты досрочно немедленно.")) {
            runAction(root, "/api/president/disband_army", {});
        }
    };

    root.querySelector("#p-reserve-withdraw").onclick = () => {
        const amount = promptNumber("Сколько голосов вывести из ЗРС себе на баланс (нужно голосование граждан 66%+)?");
        if (amount !== null) runAction(root, "/api/president/reserve/withdraw", { amount });
    };
    root.querySelector("#p-reserve-ministers").onclick = () => {
        showPicker(pickerArea, "Какому министру выделить голоса из ЗРС?", options.minister_posts, (post) => {
            const amount = promptNumber("Сколько голосов выделить?");
            if (amount !== null) runAction(root, "/api/president/reserve/distribute_ministers", { allocations: { [post]: amount } });
        });
    };
    root.querySelector("#p-reserve-cosmetics").onclick = () => {
        runAction(root, "/api/president/reserve/cheaper_cosmetics", {});
    };
    root.querySelector("#p-reserve-convert").onclick = () => {
        runAction(root, "/api/president/reserve/convert_to_treasury", {});
    };
}

async function loadReserveInfo(root) {
    const el = root.querySelector("#reserve-info");
    try {
        const info = await apiFetch("/api/state/reserve");
        el.textContent = `🏦 В Золотовалютном резерве сейчас: ${info.golden_reserve.toFixed(1)} 🗳 голосов`;
    } catch (e) {
        el.textContent = "";
    }
}

async function loadPendingPetitions(root) {
    const container = root.querySelector("#pending-petitions");
    let petitions;
    try {
        petitions = await apiFetch("/api/president/pending_petitions");
    } catch (e) {
        container.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    if (petitions.length === 0) {
        container.innerHTML = "";
        return;
    }

    container.innerHTML = `<div class="subtitle" style="margin-top:10px">📜 Обращения от граждан, ждут ответа</div>`;
    petitions.forEach((p) => {
        const card = document.createElement("div");
        card.className = "shop-item";
        const repName = p.rep_username ? "@" + escapeHtml(p.rep_username) : "ID " + p.rep_vk_id;
        card.innerHTML = `<div class="shop-item-name">«${escapeHtml(p.text)}» — от ${repName}</div>`;

        const btnRow = document.createElement("div");
        btnRow.className = "duel-btn-row";
        const approveBtn = document.createElement("button");
        approveBtn.className = "btn";
        approveBtn.textContent = "✅ Выполнить (+рейтинг)";
        const declineBtn = document.createElement("button");
        declineBtn.className = "btn btn-secondary";
        declineBtn.textContent = "❌ Отклонить (−рейтинг)";
        const resultEl = document.createElement("div");

        approveBtn.onclick = () => respondPetition(root, p.id, true, resultEl);
        declineBtn.onclick = () => respondPetition(root, p.id, false, resultEl);
        btnRow.appendChild(approveBtn);
        btnRow.appendChild(declineBtn);
        card.appendChild(btnRow);
        card.appendChild(resultEl);
        container.appendChild(card);
    });
}

async function respondPetition(root, petitionId, approved, resultEl) {
    resultEl.innerHTML = `<div class="loading">Отвечаем…</div>`;
    try {
        await apiFetch(`/api/president/petition/${petitionId}/respond`, { method: "POST", body: { approved } });
        resultEl.innerHTML = `<div class="profile-row" style="color:${approved ? "#7ee787" : "#ff9eb5"}">${approved ? "✅ Выполнено" : "❌ Отклонено"}</div>`;
        await loadPendingPetitions(root);
    } catch (e) {
        resultEl.innerHTML = `<div class="error">${e.message}</div>`;
    }
}

async function runRenameVote(root, name) {
    const resultEl = root.querySelector("#president-result");
    resultEl.innerHTML = `<div class="loading">Запускаем голосование…</div>`;
    try {
        await apiFetch("/api/president/rename_country", { method: "POST", body: { name } });
        resultEl.innerHTML = `<div class="profile-row" style="color:#7ee787">🗳 Голосование за название «${escapeHtml(name)}» запущено на 1 час — все игроки получат уведомление.</div>`;
    } catch (e) {
        resultEl.innerHTML = `<div class="error">${e.message}</div>`;
    }
}

async function runFlagVote(root, colors) {
    const resultEl = root.querySelector("#president-result");
    resultEl.innerHTML = `<div class="loading">Запускаем голосование…</div>`;
    try {
        await apiFetch("/api/president/propose_flag", { method: "POST", body: { colors } });
        resultEl.innerHTML = `<div class="profile-row" style="color:#7ee787">🚩 Голосование за флаг (${colors.join(" + ")}) запущено на 1 час.</div>`;
    } catch (e) {
        resultEl.innerHTML = `<div class="error">${e.message}</div>`;
    }
}

async function runAction(root, path, body, method = "POST") {
    const resultEl = root.querySelector("#president-result");
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

function showPicker(container, title, optionList, onSelect) {
    container.innerHTML = `<div class="subtitle">${escapeHtml(title)}</div>`;
    optionList.forEach((opt) => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        btn.textContent = opt.name;
        btn.onclick = () => {
            container.innerHTML = "";
            onSelect(opt.code);
        };
        container.appendChild(btn);
    });
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn-secondary";
    cancelBtn.textContent = "Отмена";
    cancelBtn.onclick = () => { container.innerHTML = ""; };
    container.appendChild(cancelBtn);
}

function showMultiPicker(container, title, colorCodes, onConfirm) {
    const selected = new Set();
    container.innerHTML = `<div class="subtitle">${escapeHtml(title)}</div>`;
    colorCodes.forEach((color) => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        btn.textContent = color;
        btn.onclick = () => {
            if (selected.has(color)) {
                selected.delete(color);
                btn.classList.remove("active");
            } else if (selected.size < 5) {
                selected.add(color);
                btn.classList.add("active");
            }
        };
        container.appendChild(btn);
    });
    const confirmBtn = document.createElement("button");
    confirmBtn.className = "btn";
    confirmBtn.textContent = "Готово";
    confirmBtn.onclick = () => {
        container.innerHTML = "";
        onConfirm([...selected]);
    };
    container.appendChild(confirmBtn);
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
