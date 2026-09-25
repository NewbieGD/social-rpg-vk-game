import { apiFetch } from "../api.js";
import { screenHeader } from "../screenHeader.js";
import { burstConfetti } from "../fx.js";
import { showGamePopupWithContent, showGameStylePopup } from "../gamePopup.js";
import { PROFESSION_INFO } from "../professionInfo.js";

const REMOTE_PROFESSIONS = []; // раньше IT и Юриспруденция — обе профессии убраны из игры

export async function renderWorkScreen(root) {
    root.innerHTML = `<div class="loading">Загружаем…</div>`;

    let profile;
    try {
        profile = await apiFetch("/api/profile");
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    const isStudent = profile.stage === "student";
    const bannerText = isStudent ? "🎓 УЧЕБНОЕ МЕСТО" : "💼 РАБОЧЕЕ МЕСТО";
    const titleText = isStudent ? "Учёба" : "Работа";

    // Кадр улицы по профессии: полиция — участок, такси/курьер — дорога со
    // скутером, студент — дома с окнами. Остальные — общая улица.
    const workScene = isStudent ? "school"
        : profile.profession === "police" ? "police"
        : (profile.profession === "taxi" || profile.profession === "courier") ? "commute"
        : "street";
    const header = screenHeader({
        scene: workScene,
        title: titleText,
        sub: profile.profession_name || "",
        fallbackTitle: titleText,
    });
    root.innerHTML = `${header.includes("street-hero") ? "" : `<div class="work-banner">${bannerText}</div>`}${header}<div id="work-body"></div>`;
    const body = root.querySelector("#work-body");

    if (profile.stage === "criminal") {
        body.innerHTML = `<div class="card"><div class="subtitle">У преступников нет обычной работы — доход с ограблений (раздел 🚨 Криминал).</div></div>`;
        return;
    }

    if (profile.stage === "worker" && Math.floor(Number(profile.authority)) >= 10) {
        const switchCard = document.createElement("div");
        switchCard.className = "card";
        const switchCooldown = profile.profession_switch_cooldown_seconds;
        if (switchCooldown) {
            switchCard.innerHTML = `<div class="subtitle">🎓 Смена профессии</div><div class="profile-dim">⏳ Следующая попытка через ${formatMinutes(switchCooldown)}.</div>`;
        } else {
            switchCard.innerHTML = `<div class="subtitle">🎓 Смена профессии</div><div class="profile-dim" style="margin-bottom:8px">Ранг максимальный — можно попробовать переобучиться на дефицитную профессию.</div><div id="switch-options"></div>`;
        }
        body.appendChild(switchCard);
        if (!switchCooldown) loadSwitchOptions(switchCard);
    }

    // Удалённые профессии (IT/Юриспруденция) — отдельная логика, её пока не
    // трогаем (договорились сначала разобраться с очными профессиями).
    if (REMOTE_PROFESSIONS.includes(profile.profession)) {
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `<div class="subtitle">Удалённая профессия — нужен Ноутбук (купи в 🛍 Магазине, если ещё нет).</div>`;
        const resultEl = document.createElement("div");
        resultEl.id = "work-result";
        const btn = document.createElement("button");
        btn.className = "btn";
        btn.textContent = "💻 Работать сегодня";
        btn.onclick = () => doRemoteWork(root, resultEl);
        card.appendChild(btn);
        card.appendChild(resultEl);
        body.appendChild(card);

        if (profile.army_contract_active) {
            appendArmyNote(body);
        } else {
            await appendPendingRequestsCard(root, body);
        }
        return;
    }

    let commuteStatus;
    try {
        commuteStatus = await apiFetch("/api/work/commute_status");
    } catch (e) {
        commuteStatus = { commuting: false };
    }

    const commutedToday = profile.commute_day_is_today === true;
    const verb = isStudent ? "учишься" : "работаешь";
    const verbInfinitive = isStudent ? "учиться" : "на работу";

    const statusCard = document.createElement("div");
    statusCard.className = "card";
    body.appendChild(statusCard);

    if (commuteStatus.commuting) {
        statusCard.innerHTML = `
            <div class="subtitle" style="color:#ffb454">🚗 Едешь ${isStudent ? "на учёбу" : "на работу"}…</div>
            <div class="profile-dim">${commuteStatus.driver_assigned ? "Водитель назначен, ждём, пока согласится принять заказ." : "Ищем свободного таксиста…"}</div>
            <div class="profile-dim">Если никто не откликнется — дойдёшь пешком через ${formatMinutes(commuteStatus.seconds_left)}, тогда явка засчитается бесплатно.</div>
        `;
    } else if (!commutedToday) {
        statusCard.innerHTML = `<div class="subtitle" style="color:#ffb454">❌ Ты пока не зарабатываешь — отправляйся ${verbInfinitive}!</div>`;
        const goBtn = document.createElement("button");
        goBtn.className = "btn";
        goBtn.textContent = isStudent ? "🎓 Поехать учиться" : "🚕 Поехать на работу";
        goBtn.onclick = () => goToWork(root, statusCard, isStudent);
        statusCard.appendChild(goBtn);
        const resultEl = document.createElement("div");
        resultEl.id = "work-result";
        statusCard.appendChild(resultEl);
    } else {
        statusCard.innerHTML = `<div class="subtitle" style="color:#7ee787">✅ Ты ${verb} сегодня — ${Number(profile.net_rate_per_hour).toFixed(1)}₭/час</div>`;
    }

    if (isStudent) {
        await appendExamCard(root, body, profile);
    } else {
        if (profile.profession === "zavod") {
            appendZavodCard(root, body, commutedToday);
        } else if (profile.profession !== "taxi" && profile.profession !== "courier") {
            appendCertifyCard(root, body, profile);
        }
    }

    if (profile.army_contract_active) {
        appendArmyNote(body);
    } else if (profile.profession !== "zavod") {
        await appendPendingRequestsCard(root, body);
    }
}

function appendArmyNote(body) {
    const armyNote = document.createElement("div");
    armyNote.className = "card";
    armyNote.innerHTML = `<div class="subtitle">🎖 Ты сейчас на военной службе по контракту — заявки по твоей прежней профессии тебе больше не приходят. Подробности — во вкладке Армия.</div>`;
    body.appendChild(armyNote);
}

function appendZavodCard(root, body, commutedToday) {
    const card = document.createElement("div");
    card.className = "card";
    if (commutedToday) {
        card.innerHTML = `
            <div class="subtitle">🏭 Завод</div>
            <div class="zavod-tools-row">
                <button class="zavod-tool-btn" id="zavod-wrench-btn" title="Произвести товар">
                    <span class="zavod-tool-icon">🔧</span>
                    <span class="zavod-tool-label">Произвести</span>
                </button>
                <button class="zavod-tool-btn" id="zavod-box-btn" title="Голосование за товар дня">
                    <span class="zavod-tool-icon">📦</span>
                    <span class="zavod-tool-label">Голосование</span>
                </button>
            </div>
        `;
        card.querySelector("#zavod-wrench-btn").onclick = () => showProduceProductPopup();
        card.querySelector("#zavod-box-btn").onclick = () => showFactoryVotePopup();
    } else {
        card.innerHTML = `<div class="subtitle profile-dim">Сначала доедь на завод (кнопка выше) — тогда откроются инструменты завода.</div>`;
    }
    body.appendChild(card);
}

async function appendExamCard(root, body, profile) {
    const hoursTotal = profile.progress && profile.progress.kind === "graduation" ? profile.progress.hours_total : null;
    const hoursDone = profile.hours_worked || 0;
    if (hoursTotal === null || hoursDone < hoursTotal) return;

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<div class="subtitle">📝 Ты отучился(лась) достаточно — можно сдавать выпускной экзамен! Заявка уйдёт случайному свободному учителю (нужно, чтобы он тоже был на работе).</div>`;
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "📝 Сдать экзамен";
    const resultEl = document.createElement("div");
    btn.onclick = () => requestExam(root, card, btn, resultEl);
    card.appendChild(btn);
    card.appendChild(resultEl);
    body.appendChild(card);
}

async function requestExam(root, card, btn, resultEl) {
    btn.disabled = true;
    resultEl.innerHTML = `<div class="loading">Отправляем заявку учителю…</div>`;
    try {
        await apiFetch("/api/duty/request_graduation_exam", { method: "POST" });
        resultEl.innerHTML = `<div class="profile-row" style="color:#7ee787">✅ Заявка ушла учителю — жди результата (уведомление придёт).</div>`;
    } catch (e) {
        resultEl.innerHTML = `<div class="error">${e.message}</div>`;
        btn.disabled = false;
    }
}

const TYPE_LABELS = {
    police: "👮 Полиция", doctor: "🚑 Врач", firefighter: "🚒 Пожарный", teacher: "📚 Пересдача",
    courier: "📦 Курьер", taxi: "🚕 Такси", repair: "🏗 Ремонт дома", graduation_exam: "📝 Выпускной экзамен",
    catch_thief_chat: "👮 Вор в чате", rank_confirm: "🎖 Подтверждение роста Ранга",
    prescription: "💊 Рецепт на таблетки", rescue: "🚨 Спасение", home_repair: "🔧 Бытовая поломка",
    build_house: "🏠 Постройка Квартиры", certify: "🎓 Аттестация", profession_switch: "🎓 Смена профессии",
    duty_shift: "📋 Дежурство (назначено системой)", catastrophe_response: "🔥 Сдерживание катастрофы (назначено системой)",
    gov_repair: "🏛 Ремонт гос. объекта (назначено системой)", extra_lesson: "📖 Доп. урок (назначено системой)",
};

// Эти типы назначаются СИСТЕМОЙ, а не другим игроком — у них нет настоящего
// заявителя, поэтому "от ID 0" рядом с ними только сбивает с толку.
const SYSTEM_ASSIGNED_TYPES = new Set(["duty_shift", "catastrophe_response", "gov_repair", "extra_lesson"]);

const RESULT_LABELS = {
    recovered: "Вещь/деньги возвращены", caught: "Вор пойман", cured: "Вылечен(а)",
    saved: "Дом спасён", passed: "Экзамен сдан", delivered: "Доставлено", fixed: "Починено",
    won: "Выиграно", repaired: "Дом восстановлен", helped: "Помощь оказана",
};

async function appendPendingRequestsCard(root, body) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
        <div class="subtitle">📋 Заявки, которые ждут тебя как специалиста</div>
        <div id="pending-list"><div class="loading">Загружаем…</div></div>
    `;
    body.appendChild(card);

    const listEl = card.querySelector("#pending-list");
    let pending;
    try {
        pending = await apiFetch("/api/duty/pending");
    } catch (e) {
        listEl.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    if (pending.length === 0) {
        listEl.innerHTML = `<div class="profile-dim">Пока ничего не ждёт.</div>`;
        return;
    }

    card.classList.add("work-card-urgent");
    listEl.innerHTML = "";
    pending.forEach((req) => {
        const row = document.createElement("div");
        row.className = "shop-item";

        const nameEl = document.createElement("div");
        nameEl.className = "shop-item-name";
        const label = TYPE_LABELS[req.type] || req.type;
        const sourceText = SYSTEM_ASSIGNED_TYPES.has(req.type) ? "" : ` от ID ${req.requester_vk_id}`;
        nameEl.innerHTML = `<span class="work-new-badge">НОВОЕ</span> ${label}${sourceText}`;
        row.appendChild(nameEl);

        const btn = document.createElement("button");
        btn.className = "btn";
        btn.textContent = "✅ Принять и разобрать";
        row.appendChild(btn);

        const rowResult = document.createElement("div");
        row.appendChild(rowResult);

        btn.onclick = () => acceptRequest(req.id, req.type, btn, rowResult, row);

        listEl.appendChild(row);
    });
}

async function acceptRequest(requestId, requestType, btn, rowResult, row) {
    btn.disabled = true;
    btn.textContent = "Разбираем…";
    try {
        const result = await apiFetch(`/api/duty/${requestId}/accept`, { method: "POST" });
        rowResult.innerHTML = `<div class="profile-row" style="color:#7ee787">${formatOutcome(result)}</div>`;
        if (requestType === "graduation_exam" && result.passed) {
            burstConfetti(row, 32);
        }
    } catch (e) {
        rowResult.innerHTML = `<div class="error">${e.message}</div>`;
        btn.disabled = false;
        btn.textContent = "✅ Принять и разобрать";
    }
}

function formatOutcome(result) {
    const parts = [];

    if ("recovered" in result && "caught" in result) {
        parts.push(result.recovered ? "✅ Вещь/деньги возвращены" : "❌ Вернуть не удалось");
        if (result.caught) parts.push("🚨 Вор пойман");
    } else {
        for (const [key, label] of Object.entries(RESULT_LABELS)) {
            if (key in result) {
                parts.push(result[key] ? `✅ ${label}` : `❌ Не получилось (${label.toLowerCase()})`);
                break;
            }
        }
    }

    const fee = result.officer_fee !== undefined ? result.officer_fee : result.fee;
    if (fee !== undefined) {
        parts.push(fee >= 0 ? `💰 Заработано: ${fee.toFixed(0)}₭` : `💸 Штраф: ${Math.abs(fee).toFixed(0)}₭`);
    }

    return parts.join("<br>") || "✅ Разобрано";
}

function appendCertifyCard(root, body, profile) {
    const certCard = document.createElement("div");
    certCard.className = "card";
    certCard.innerHTML = `<div class="subtitle">🎓 Аттестация даёт +${(profile.certification_bonus_pct || 15)}% к доходу на сутки — раз в день, решает случайный Учитель по заявке.</div>`;
    const btn = document.createElement("button");
    btn.className = "btn";
    const resultEl = document.createElement("div");

    const cooldown = profile.certification_cooldown_seconds;
    if (cooldown) {
        btn.disabled = true;
        btn.textContent = `⏳ Следующая попытка через ${formatMinutes(cooldown)}`;
    } else {
        btn.textContent = "🎓 Пройти аттестацию";
        btn.onclick = async () => {
            btn.disabled = true;
            resultEl.innerHTML = `<div class="loading">Отправляем заявку учителю…</div>`;
            try {
                const result = await apiFetch("/api/certify", { method: "POST" });
                resultEl.innerHTML = `<div class="profile-row" style="color:#7ee787">✅ Заявка отправлена (${result.price.toFixed(0)}₭ списано) — жди уведомления об исходе.</div>`;
            } catch (e) {
                btn.disabled = false;
                resultEl.innerHTML = `<div class="error">${e.message}</div>`;
            }
        };
    }
    certCard.appendChild(btn);
    certCard.appendChild(resultEl);
    body.appendChild(certCard);
}

function addBtn(container, label, onClick) {
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = label;
    btn.onclick = onClick;
    container.appendChild(btn);
}

async function goToWork(root, statusCard, isStudent) {
    const resultEl = statusCard.querySelector("#work-result");
    resultEl.innerHTML = `<div class="loading">Выполняем…</div>`;
    try {
        const result = await apiFetch("/api/work/go_to_work", { method: "POST" });
        let text = "✅ Готово";
        if (result.via === "self_employed_no_commute") text = "✅ Готово, можно принимать заказы";
        else if (result.via === "car") text = `✅ Доехал(а) на своей машине, налог за день — ${result.fare.toFixed(0)}₭`;
        else if (result.driver_found) text = `✅ Такси уже едет, поездка обойдётся в ${result.fare.toFixed(0)}₭`;
        else text = `⏳ Заявка на такси отправлена (${result.fare.toFixed(0)}₭) — ищем свободного водителя, если никто не откликнется за час, дойдёшь пешком бесплатно.`;
        resultEl.innerHTML = `<div class="profile-row" style="color:#7ee787">${text}</div>`;
        setTimeout(() => renderWorkScreen(root), 1200);
    } catch (e) {
        resultEl.innerHTML = `<div class="error">${e.message}</div>`;
    }
}

async function doRemoteWork(root, resultEl) {
    resultEl.innerHTML = `<div class="loading">Выполняем…</div>`;
    try {
        await apiFetch("/api/work", { method: "POST" });
        resultEl.innerHTML = `<div class="profile-row" style="color:#7ee787">✅ Готово</div>`;
    } catch (e) {
        resultEl.innerHTML = `<div class="error">${e.message}</div>`;
    }
}

async function showProduceProductPopup() {
    const { content } = showGamePopupWithContent("🔧 Произвести товар", (c) => {
        c.innerHTML = `<div class="loading">Загружаем…</div>`;
    });

    let products, status;
    try {
        [products, status] = await Promise.all([
            apiFetch("/api/work/products"),
            apiFetch("/api/work/production_status"),
        ]);
    } catch (e) {
        content.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    let statusHtml;
    if (status.daily_limit_reached) {
        statusHtml = `<div class="profile-row" style="color:#ffb454">📦 Дневной лимит производства исчерпан (8 из 8). Возвращайся завтра.</div>`;
    } else if (status.last_product) {
        const dailyText = `<div class="profile-dim">Сегодня произведено: ${status.produced_today}/8</div>`;
        statusHtml = (status.ready_now
            ? `<div class="profile-row" style="color:#7ee787">✅ Готово к новому производству (последним был: ${escapeHtmlWork(status.last_product)})</div>`
            : `<div class="profile-dim">Недавно создано: ${escapeHtmlWork(status.last_product)}. Следующее производство доступно через ${formatMinutes(status.seconds_left)}.</div>`
        ) + dailyText;
    } else {
        statusHtml = `<div class="profile-dim">Ты ещё ничего не производил(а) — выбери товар ниже. Максимум 8 раз в сутки, не чаще раза в 2 часа.</div>`;
    }

    const canProduceNow = status.ready_now && !status.daily_limit_reached;
    content.innerHTML = `${statusHtml}<div class="subtitle" style="margin-top:10px">Нажми на товар — он сразу уйдёт на склад магазина (без курьера):</div><div id="product-list"></div>`;

    const list = content.querySelector("#product-list");
    products.forEach((p) => {
        const btn = document.createElement("button");
        btn.className = "gov-vote-btn";
        btn.textContent = p.name;
        if (!canProduceNow) btn.disabled = true;
        btn.onclick = async () => {
            btn.disabled = true;
            try {
                const result = await apiFetch("/api/work/choose_product", { method: "POST", body: { code: p.code } });
                showGameStylePopup(
                    "✅ Произведено!",
                    `${escapeHtmlWork(result.product)} (+${result.units} шт на склад магазина) — начислено +${result.pay.toFixed(0)}₭${result.gained_rating ? " и +1 к рейтингу!" : ""}.<br>Сегодня произведено: ${result.produced_today}/${result.daily_limit}. Следующее производство — через ${formatMinutes(result.next_available_in_seconds)}.`,
                );
            } catch (e) {
                btn.disabled = false;
                showGameStylePopup("❌ Не получилось", e.message);
            }
        };
        list.appendChild(btn);
    });
}

async function showFactoryVotePopup() {
    let products;
    try {
        products = await apiFetch("/api/work/products");
    } catch (e) {
        showGameStylePopup("❌ Не получилось", e.message);
        return;
    }
    const { content } = showGamePopupWithContent("📦 Голосование за товар дня", (c) => {
        c.innerHTML = `<div class="loading">Загружаем…</div>`;
    });
    await renderFactoryVoting(content, products);
}

function formatMinutes(seconds) {
    const mins = Math.ceil(seconds / 60);
    if (mins >= 60) return `${Math.floor(mins / 60)} ч ${mins % 60} мин`;
    return `${mins} мин`;
}

function escapeHtmlWork(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

async function renderFactoryVoting(content, products) {
    content.innerHTML = `
        <div class="profile-dim" style="margin-bottom:8px">Победитель получает бонус к складу и сразу поступает в магазин. Голос можно отдать только один раз за голосование — сменить нельзя. Если голосуешь один, твой голос сразу и есть 100%.</div>
        <div id="vote-timer" class="profile-dim"></div>
        <div id="vote-standings" class="profile-dim"></div>
        <div id="vote-buttons"></div>
    `;

    try {
        const votes = await apiFetch("/api/work/factory_votes");
        content.querySelector("#vote-timer").textContent = `⏳ До объявления результатов: ${formatMinutes(votes.seconds_until_results)}`;
        const standingsEl = content.querySelector("#vote-standings");
        if (votes.standings.length === 0) {
            standingsEl.textContent = "Сегодня ещё никто не голосовал.";
        } else {
            standingsEl.innerHTML = votes.standings
                .map((s) => `${s.name}: ${s.votes} голос(ов) — ${s.pct}%`)
                .join("<br>");
        }
    } catch (e) {
        content.querySelector("#vote-standings").innerHTML = `<span class="error">${e.message}</span>`;
    }

    const btnContainer = content.querySelector("#vote-buttons");
    products.forEach((p) => {
        const btn = document.createElement("button");
        btn.className = "gov-vote-btn";
        btn.textContent = `Голосовать: ${p.name}`;
        btn.onclick = async () => {
            btn.disabled = true;
            try {
                await apiFetch("/api/work/factory_vote", { method: "POST", body: { code: p.code } });
                showGameStylePopup("✅ Голос учтён!", `Ты проголосовал(а) за «${escapeHtmlWork(p.name)}».`);
                await renderFactoryVoting(content, products);
            } catch (e) {
                btn.disabled = false;
                showGameStylePopup("❌ Не получилось", e.message);
            }
        };
        btnContainer.appendChild(btn);
    });
}

async function loadSwitchOptions(card) {
    const container = card.querySelector("#switch-options");
    container.innerHTML = `<div class="loading">Загружаем список…</div>`;
    let data;
    try {
        data = await apiFetch("/api/work/switch_profession/options");
    } catch (e) {
        container.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }
    if (!data.options.length) {
        container.innerHTML = `<div class="profile-dim">Сейчас нет дефицитных профессий для смены.</div>`;
        return;
    }
    container.innerHTML = "";
    data.options.forEach((opt) => {
        const btn = document.createElement("button");
        btn.className = "btn btn-secondary";
        btn.style.marginBottom = "6px";
        btn.textContent = `${opt.name} (обучение ${opt.training_price.toFixed(0)}₭)`;
        btn.onclick = () => confirmSwitchProfession(card, opt);
        container.appendChild(btn);
    });
}

function confirmSwitchProfession(card, opt) {
    const info = PROFESSION_INFO[opt.code];
    showGamePopupWithContent(`🎓 Смена на «${opt.name}»`, (content) => {
        content.innerHTML = `
            ${info ? `<div class="profile-dim" style="margin-bottom:6px">${escapeHtmlWork(info.summary)}</div><div style="margin-bottom:10px">${info.details.map((d) => `<div class="profile-dim" style="font-size:13px">• ${escapeHtmlWork(d)}</div>`).join("")}</div>` : ""}
            <div class="profile-dim" style="margin-bottom:10px">Стоимость обучения: ${opt.training_price.toFixed(0)}₭. Деньги списываются сразу — заявка уходит случайному учителю. Если он справится, Ранг обнулится и начнёшь работать по новой профессии; если нет — деньги не возвращаются, повтор через час.</div>
            <button class="btn" id="switch-confirm-btn">Подтвердить</button>
        `;
        content.querySelector("#switch-confirm-btn").onclick = async () => {
            const btn = content.querySelector("#switch-confirm-btn");
            btn.disabled = true;
            try {
                await apiFetch("/api/work/switch_profession", { method: "POST", body: { profession: opt.code } });
                showGameStylePopup("🎓 Заявка отправлена!", "Учитель уже занимается твоим обучением — жди уведомления об исходе.");
            } catch (e) {
                showGameStylePopup("❌ Не получилось", e.message);
            }
        };
    });
}
