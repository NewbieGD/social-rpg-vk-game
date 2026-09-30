// «Воры и Босс мафии»: трон Босса (с аватаркой и рамкой, либо пустой),
// портреты павших Боссов, сводка по ворам, голосования воров, условия
// кандидатства и панель управления для Босса (или его правой руки).
import { apiFetch } from "../api.js";
import { screenHeader } from "../screenHeader.js";
import { showGamePopupWithContent, showGameStylePopup } from "../gamePopup.js";
import { avatarHtml } from "../cosmeticFrames.js";
import { infoButton, bindInfoButtons } from "../infoPopups.js";
import { animateCounter, burstConfetti, playSuccessSound } from "../fx.js";
import { THIEVES_ASSETS } from "../thievesAssets.js";

export async function renderThievesScreen(root) {
    root.innerHTML = `<div class="loading">Загружаем логово…</div>`;
    let ov;
    try {
        ov = await apiFetch("/api/thieves/overview");
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }
    root.innerHTML = `
        ${screenHeader({ scene: "crime", title: "Воры и Босс мафии", sub: "Воровское логово", fallbackTitle: "👑 Воры и Босс мафии", image: THIEVES_ASSETS.background || "assets/backgrounds/thief-den.jpg" })}
        ${throneHtml(ov)}
        ${statsHtml(ov)}
        <div id="thief-votes">${votesHtml(ov)}</div>
        <div class="card traitors-entry"><div class="subtitle">🐍 Предатели</div><div class="profile-dim">Бывшие Боссы, перешедшие на сторону власти.</div><button class="btn btn-secondary" id="traitors-btn">Открыть список предателей</button></div>
        ${candidacyHtml(ov)}
        <div id="boss-panel"></div>`;
    root.querySelector("#traitors-btn").onclick = () => showTraitors();
    bindInfoButtons(root);
    root.querySelectorAll("[data-count]").forEach((el) => animateCounter(el, 0, Number(el.dataset.count), 900, (v) => el.dataset.money ? `${v.toFixed(2)} ₭` : Math.round(v).toString()));
    bindVotes(root);
    bindCandidacy(root, ov);
    if (ov.is_boss || ov.is_right_hand) loadBossPanel(root);
}

// ---------- Трон ----------
function throneHtml(ov) {
    const martyrs = (ov.martyrs || []).map((m) => `
        <div class="throne-martyr" title="${escapeAttr(m.name || "")}">
            <div class="throne-martyr-frame">${m.photo_url ? `<img src="${m.photo_url}" alt="">` : "🕯"}</div>
            <div class="throne-martyr-name">${escapeHtml(m.name || "")}</div>
            <div class="throne-martyr-num">${m.boss_number ? `${m.boss_number}-й Босс` : ""}</div>
        </div>`).join("");
    const b = ov.boss;
    const seated = b ? `
        <div class="throne-boss">
            <div class="throne-crown">👑</div>
            ${b.vk_id ? avatarHtml(b.photo_url, b.active_frame, false) : `<div class="throne-unknown">?</div>`}
        </div>` : "";
    const throneArt = THIEVES_ASSETS.throne
        ? `<img src="${THIEVES_ASSETS.throne}" alt="" class="throne-img">`
        : `<svg viewBox="0 0 200 230" class="throne-svg" aria-hidden="true">
            <path d="M40 200 L40 60 Q40 20 100 14 Q160 20 160 60 L160 200 Z" fill="#7a1f2a" stroke="#d4af37" stroke-width="6"/>
            <path d="M58 190 L58 70 Q58 40 100 34 Q142 40 142 70 L142 190 Z" fill="#9a2a36"/>
            <rect x="24" y="140" width="152" height="26" rx="6" fill="#b8912a"/>
            <rect x="30" y="160" width="140" height="18" rx="4" fill="#7a1f2a"/>
            <rect x="18" y="112" width="26" height="60" rx="6" fill="#b8912a"/>
            <rect x="156" y="112" width="26" height="60" rx="6" fill="#b8912a"/>
            <rect x="44" y="178" width="14" height="44" fill="#8a6a1a"/>
            <rect x="142" y="178" width="14" height="44" fill="#8a6a1a"/>
            <circle cx="100" cy="102" r="3" fill="#d4af37"/><circle cx="80" cy="130" r="2.5" fill="#d4af37"/><circle cx="120" cy="130" r="2.5" fill="#d4af37"/>
        </svg>`;
    const diamond = THIEVES_ASSETS.diamond
        ? `<img src="${THIEVES_ASSETS.diamond}" alt="" class="throne-diamond-img">`
        : `<svg viewBox="0 0 60 50" class="throne-diamond" aria-hidden="true">
            <polygon points="12,4 48,4 58,18 30,48 2,18" fill="#8fe3ff"/>
            <polygon points="12,4 30,4 22,18 2,18" fill="#c9f3ff"/>
            <polygon points="30,4 48,4 58,18 38,18" fill="#5ec8f0"/>
            <polygon points="2,18 22,18 30,48" fill="#6fd4f7"/>
            <polygon points="38,18 58,18 30,48" fill="#3ea9d8"/>
            <polygon points="22,18 38,18 30,48" fill="#a6ebff"/>
        </svg>`;
    return `
        <div class="card throne-card">
            ${martyrs ? `<div class="throne-martyrs"><div class="throne-martyrs-title">Павшие Боссы — не сдали своих</div>${martyrs}</div>` : ""}
            <div class="throne-stage ${b ? "throne-taken" : "throne-empty"}">
                <div class="throne-spot"></div>
                <div class="throne-diamond-wrap">${diamond}<span class="throne-glint"></span><span class="throne-glint throne-glint-2"></span></div>
                <div class="throne-seat">${throneArt}${seated}</div>
            </div>
            <div class="throne-caption">
                ${b ? `<div class="throne-name">${escapeHtml(b.name)} ${infoButton("boss_mafia")}</div>
                       <div class="profile-dim">${b.number ? `${b.number}-й Босс Мафии` : "Босс Мафии"}${b.in_prison ? " · сейчас в тюрьме" : ""}</div>`
                    : `<div class="throne-name">Трон пуст ${infoButton("boss_mafia")}</div><div class="profile-dim">Воры ещё не выбрали Босса.</div>`}
                ${ov.boss_trust !== null && ov.boss_trust !== undefined ? `
                    <div class="throne-trust"><span>Доверие воров</span><b>${Math.round(ov.boss_trust)}/100</b></div>
                    <div class="progress-bar"><div class="progress-bar-fill trust-fill ${ov.boss_trust < 50 ? "trust-low" : ""}" style="width:${ov.boss_trust}%"></div></div>` : ""}
                ${ov.boss_catch_count !== null && ov.boss_catch_count !== undefined && b ? `<div class="profile-dim throne-catches">🚔 Полиция ловила и отпускала: <b>${Math.min(ov.boss_catch_count, 5)}/5</b>${ov.boss_exposed ? " — Босс опознан, его видят все" : ov.boss_catch_count >= 4 ? " — ещё раз, и его узнают все" : ""}</div>` : ""}
                ${ov.raid_night_until ? `<div class="raid-night-badge">🌙 Идёт Ночь налётов — жертвы узнают воров на 10% реже</div>` : ""}
            </div>
        </div>`;
}

// ---------- Сводка ----------
function statsHtml(ov) {
    const tile = (icon, label, value, money = false) =>
        `<div class="thief-stat"><div class="thief-stat-icon">${icon}</div><div class="thief-stat-value" data-count="${value}" ${money ? "data-money=1" : ""}>0</div><div class="thief-stat-label">${label}</div></div>`;
    return `
        <div class="card">
            <div class="subtitle">Положение дел воров</div>
            <div class="thief-stats">
                ${tile("🕶", "воров на свободе", ov.thieves)}
                ${tile("🔒", "сидят в тюрьме", ov.in_prison)}
                ${tile("⚰️", "ликвидировано", ov.liquidated)}
                ${tile("🤝", "переманено из граждан", ov.recruited)}
                ${tile("🏛", "воров во власти", ov.in_power)}
                ${tile("🏦", "банк воров", ov.bank, true)}
            </div>
        </div>`;
}

// ---------- Голосования ----------
function votesHtml(ov) {
    if (!ov.votes.length) return "";
    return ov.votes.map((v) => {
        const mins = Math.max(0, Math.ceil((new Date(v.closes_at) - Date.now()) / 60000));
        if (v.kind === "depose") return deposeHtml(v, mins, ov);
        const title = v.kind === "bank_withdraw" ? `Босс хочет забрать себе весь банк воров (${v.amount.toFixed(2)} ₭)` : "Голосование воров";
        const body = !v.can_vote
            ? `<div class="profile-dim">⏳ По этому вопросу голосуют воры — как они голосуют, тебе не видно. Осталось ~${mins} мин.</div>`
            : v.my_choice
                ? `<div class="profile-row">Твой голос: <b>${v.my_choice === "yes" ? "За" : "Против"}</b>. Осталось ~${mins} мин.</div>`
                : `<div class="vote-buttons"><button class="btn" data-vote="${v.id}" data-choice="yes">За</button><button class="btn btn-secondary" data-vote="${v.id}" data-choice="no">Против</button></div>
                   <div class="profile-dim">Осталось ~${mins} мин. Если воры откажут — доверие к Боссу −10.</div>`;
        return `<div class="card thief-vote-card"><div class="subtitle">🗳 ${title}</div>${body}<div class="profile-dim vote-note">${escapeHtml(ov.voters_note)}</div></div>`;
    }).join("");
}

const DEPOSE_ICONS = { liquidate: "⚰️", remove: "👑", warn: "⚠️" };
const DEPOSE_LABELS = { liquidate: "Ликвидировать", remove: "Снять с трона", warn: "Предупредить" };

function deposeHtml(v, mins, ov) {
    if (!v.can_vote) {
        return `<div class="card depose-card">
            <div class="subtitle">⚠️ Против тебя идёт голосование</div>
            <div class="profile-dim">Доверие воров упало ниже 50. Воры решают: ликвидировать тебя, снять с трона${v.options.some((o) => o.key === "warn") ? " или вынести предупреждение" : ""}. Как они голосуют, тебе не видно.</div>
            <div class="profile-row depose-timer">⏳ Осталось ~${mins} мин — позови воров в воровской чат, объяснись, договорись.</div>
        </div>`;
    }
    const choices = v.options.map((o) => `
        <button class="depose-option ${v.my_choice === o.key ? "depose-option-mine" : ""}" ${v.my_choice ? "disabled" : ""} data-vote="${v.id}" data-choice="${o.key}">
            <span class="depose-option-title">${DEPOSE_ICONS[o.key]} ${DEPOSE_LABELS[o.key]}</span>
            <span class="depose-option-text">${escapeHtml(o.text)}</span>
        </button>`).join("");
    return `<div class="card depose-card">
        <div class="subtitle">⚠️ Судьба Босса Мафии</div>
        <div class="profile-dim">Доверие к Боссу упало ниже 50. Выбери, что с ним сделать. Голос один, переголосовать нельзя. Ничья или тишина — ${v.options.some((o) => o.key === "warn") ? "предупреждение" : "снятие с трона"}.</div>
        <div class="depose-options">${choices}</div>
        <div class="profile-dim">${v.my_choice ? `Твой голос: <b>${DEPOSE_LABELS[v.my_choice]}</b>. ` : ""}Осталось ~${mins} мин.</div>
        <div class="profile-dim vote-note">${escapeHtml(ov.voters_note)}</div>
    </div>`;
}

function bindVotes(root) {
    root.querySelectorAll("[data-vote]").forEach((btn) => {
        btn.onclick = async () => {
            try {
                await apiFetch(`/api/thieves/votes/${btn.dataset.vote}`, { method: "POST", body: { choice: btn.dataset.choice } });
                playSuccessSound();
                renderThievesScreen(root);
            } catch (e) {
                showGameStylePopup("Не получилось", escapeHtml(e.message));
            }
        };
    });
}

// ---------- Кандидатство ----------
function candidacyHtml(ov) {
    const r = ov.requirements;
    if (!r || !r.is_thief) return "";
    const line = (ok, text) => `<div class="req-line ${ok ? "req-ok" : "req-no"}"><span>${ok ? "✅" : "❌"}</span>${text}</div>`;
    return `
        <div class="card">
            <div class="subtitle">👑 Стать Боссом Мафии ${infoButton("boss_mafia")}</div>
            ${line(r.authority >= r.authority_needed, `Авторитет ${r.authority_needed}+ (у тебя ${Math.floor(r.authority)})`)}
            ${line(r.balance >= r.fee, `Взнос ${r.fee.toFixed(0)}₭ в банк воров (на балансе ${r.balance.toFixed(2)}₭)`)}
            ${line(r.throne_free, r.throne_free ? "Трон свободен" : "Трон занят — выборы только при вакансии")}
            ${r.throne_free ? `<div class="profile-dim">${r.election_open ? "🗳 Выборы идут — можно присоединиться (48 часов, голосуют только воры)." : "Выборов пока нет — первый подходящий кандидат их откроет."}</div>` : ""}
            <button class="btn" id="boss-candidate-btn" style="margin-top:10px">${r.already_candidate ? "Ты уже кандидат" : "Баллотироваться в Боссы мафии"}</button>
        </div>`;
}

function bindCandidacy(root, ov) {
    const btn = root.querySelector("#boss-candidate-btn");
    if (!btn) return;
    const r = ov.requirements;
    btn.onclick = () => {
        let reason = null;
        if (r.already_candidate) reason = "Ты уже зарегистрирован(а) в этих выборах — жди итогов.";
        else if (r.authority < r.authority_needed) reason = `Не хватает Авторитета: нужно ${r.authority_needed}, у тебя ${Math.floor(r.authority)}. Авторитет растёт за успешные ограбления (+1) и вербовку новых воров (+20).`;
        else if (!r.throne_free) reason = "Сейчас Босс Мафии уже избран. Выборы начнутся, только когда трон освободится.";
        else if (r.balance < r.fee) reason = `Нужен взнос ${r.fee.toFixed(0)}₭ — на балансе ${r.balance.toFixed(2)}₭.`;
        if (reason) { showGameStylePopup("Пока нельзя баллотироваться", reason); return; }
        showGamePopupWithContent("👑 Баллотироваться в Боссы", (content) => {
            content.innerHTML = `
                <div class="profile-dim">С баланса спишется взнос <b>${r.fee.toFixed(0)}₭</b> — он уйдёт в банк воров и не вернётся, даже если проиграешь. ${r.election_open ? "Ты присоединишься к идущим выборам." : "Ты откроешь выборы на 48 часов."}</div>
                <button class="btn" id="boss-candidate-go" style="margin-top:12px">Заплатить и баллотироваться</button>
                <div id="boss-candidate-res"></div>`;
            content.querySelector("#boss-candidate-go").onclick = async () => {
                const res = content.querySelector("#boss-candidate-res");
                try {
                    await apiFetch("/api/boss_mafia/register", { method: "POST" });
                    res.innerHTML = `<div class="profile-row" style="color:#7ee787">✅ Ты в списке кандидатов!</div>`;
                    burstConfetti(content, 24);
                    renderThievesScreen(root);
                } catch (e) {
                    res.innerHTML = `<div class="error">${escapeHtml(e.message)}</div>`;
                }
            };
        });
    };
}

// ---------- Панель Босса ----------
async function loadBossPanel(root) {
    const box = root.querySelector("#boss-panel");
    let p;
    try {
        p = await apiFetch("/api/thieves/boss/panel");
    } catch (e) {
        box.innerHTML = "";
        return;
    }
    const cd = (sec) => sec ? `⏳ через ${Math.floor(sec / 3600)} ч ${Math.ceil((sec % 3600) / 60)} мин` : "";
    const opts = (list) => list.map((t) => `<option value="${t.vk_id}">${escapeHtml(t.name)}</option>`).join("");
    box.innerHTML = `
        <div class="card boss-panel">
            <div class="subtitle">🎩 Управление ворами</div>
            <div class="boss-row"><span>Банк воров</span><b>${p.bank.toFixed(2)} ₭</b></div>

            <div class="boss-block">
                <div class="boss-block-title">📜 Записка всем ворам</div>
                <div class="profile-dim">Раз в час, до ${p.note_max_len} символов, без ссылок и мата. Каждый вор увидит её один раз.</div>
                <div class="boss-inline"><input class="text-input" id="bp-note" maxlength="${p.note_max_len}" placeholder="Всем в воровской чат"><span class="note-counter" id="bp-note-count">0/${p.note_max_len}</span></div>
                <button class="btn" data-act="note" ${p.note_cooldown ? "disabled" : ""}>Отправить записку ${cd(p.note_cooldown)}</button>
            </div>

            <div class="boss-block">
                <div class="boss-block-title">💰 Забрать банк себе</div>
                <div class="profile-dim">Воры час голосуют. Большинство «за» — весь банк на твой баланс. Откажут (или никто не проголосует) — доверие −10. Раз в сутки.</div>
                <button class="btn btn-secondary" data-act="withdraw" ${p.withdraw_cooldown || p.withdraw_vote_open || p.bank <= 0 ? "disabled" : ""}>${p.withdraw_vote_open ? "Голосование идёт…" : `Попросить банк ${cd(p.withdraw_cooldown)}`}</button>
            </div>

            <div class="boss-block">
                <div class="boss-block-title">🗝 Завезти «Выкуп из тюрьмы»</div>
                <div class="profile-dim">1 штука на чёрный рынок раз в сутки. Выручка (1500₭) — в банк воров.</div>
                <button class="btn btn-secondary" data-act="ransom" ${p.ransom_cooldown ? "disabled" : ""}>Завезти ${cd(p.ransom_cooldown)}</button>
            </div>

            <div class="boss-block">
                <div class="boss-block-title">🖤 Завезти «Чёрную метку»</div>
                <div class="profile-dim">1 штука раз в 3 дня (5000₭, выручка — в банк воров). С меткой и Списком вербовки воры находят предателей. Ненайденных предателей: <b>${p.traitors_unfound}</b>.</div>
                <button class="btn btn-secondary" data-act="mark" ${p.black_mark_cooldown ? "disabled" : ""}>Завезти ${cd(p.black_mark_cooldown)}</button>
            </div>

            <div class="boss-block">
                <div class="boss-block-title">🔓 Амнистия</div>
                <div class="profile-dim">Выкупить вора из тюрьмы за ${p.amnesty_cost.toFixed(0)}₭ из банка. Раз в сутки.</div>
                ${p.prisoners.length ? `<select class="text-input" id="bp-amnesty">${opts(p.prisoners)}</select>` : `<div class="profile-dim">Сейчас никто из воров не сидит.</div>`}
                <button class="btn btn-secondary" data-act="amnesty" ${p.amnesty_cooldown || !p.prisoners.length ? "disabled" : ""}>Выкупить ${cd(p.amnesty_cooldown)}</button>
            </div>

            <div class="boss-block">
                <div class="boss-block-title">🎁 Премия из банка</div>
                ${p.thieves.length ? `<select class="text-input" id="bp-bonus-to">${opts(p.thieves)}</select>
                <input class="text-input" id="bp-bonus-amount" type="number" min="1" placeholder="Сумма в ₭">` : `<div class="profile-dim">Других воров пока нет.</div>`}
                <button class="btn btn-secondary" data-act="bonus" ${p.thieves.length ? "" : "disabled"}>Выдать премию</button>
            </div>

            <div class="boss-block">
                <div class="boss-block-title">🌙 Ночь налётов</div>
                <div class="profile-dim">Целый час жертвы узнают воров на 10% реже. Раз в сутки.</div>
                <button class="btn btn-secondary" data-act="raid" ${p.raid_cooldown ? "disabled" : ""}>${p.raid_active_until ? "Ночь налётов идёт" : `Объявить ${cd(p.raid_cooldown)}`}</button>
            </div>

            <div class="boss-block">
                <div class="boss-block-title">🤝 Правая рука</div>
                <div class="profile-dim">Управляет ворами, пока ты в тюрьме. Сейчас: <b>${p.right_hand ? escapeHtml(p.right_hand.name) : "не назначена"}</b>.</div>
                ${p.thieves.length ? `<select class="text-input" id="bp-hand">${opts(p.thieves)}</select>` : ""}
                <button class="btn btn-secondary" data-act="hand" ${p.thieves.length ? "" : "disabled"}>Назначить</button>
            </div>

            <div class="boss-block">
                <div class="boss-block-title">🏛 Разрешить вору баллотироваться в депутаты</div>
                <div class="profile-dim">Разрешение одноразовое — на одни выборы.</div>
                ${p.thieves.length ? `<select class="text-input" id="bp-permit">${opts(p.thieves)}</select>` : ""}
                <button class="btn btn-secondary" data-act="permit" ${p.thieves.length ? "" : "disabled"}>Разрешить</button>
            </div>
            <div id="bp-result"></div>
        </div>`;

    const note = box.querySelector("#bp-note");
    if (note) note.oninput = () => { box.querySelector("#bp-note-count").textContent = `${note.value.length}/${p.note_max_len}`; };
    const val = (id) => box.querySelector(id) && box.querySelector(id).value;
    const actions = {
        note: () => apiFetch("/api/thieves/boss/note", { method: "POST", body: { text: val("#bp-note") } }).then(() => "📜 Записка разослана всем ворам"),
        ransom: () => apiFetch("/api/thieves/boss/restock_ransom", { method: "POST" }).then(() => "🗝 «Выкуп из тюрьмы» завезён на чёрный рынок"),
        mark: () => apiFetch("/api/thieves/boss/restock_black_mark", { method: "POST" }).then(() => "🖤 «Чёрная метка» завезена — воры получили весть"),
        amnesty: () => apiFetch("/api/thieves/boss/amnesty", { method: "POST", body: { target_vk_id: Number(val("#bp-amnesty")) } }).then(() => "🔓 Вор на свободе"),
        bonus: () => apiFetch("/api/thieves/boss/bonus", { method: "POST", body: { target_vk_id: Number(val("#bp-bonus-to")), amount: Number(val("#bp-bonus-amount")) } }).then(() => "🎁 Премия выдана"),
        raid: () => apiFetch("/api/thieves/boss/raid_night", { method: "POST" }).then(() => "🌙 Ночь налётов объявлена"),
        hand: () => apiFetch("/api/thieves/boss/right_hand", { method: "POST", body: { target_vk_id: Number(val("#bp-hand")) } }).then(() => "🤝 Правая рука назначена"),
        permit: () => apiFetch("/api/boss_mafia/grant_election_permission", { method: "POST", body: { target_vk_id: Number(val("#bp-permit")) } }).then(() => "🏛 Разрешение выдано"),
    };
    box.querySelectorAll("[data-act]").forEach((btn) => {
        btn.onclick = async () => {
            const act = btn.dataset.act;
            if (act === "withdraw") return confirmWithdraw(root, p);
            try {
                const msg = await actions[act]();
                playSuccessSound();
                showGameStylePopup("Готово", msg);
                renderThievesScreen(root);
            } catch (e) {
                showGameStylePopup("Не получилось", escapeHtml(e.message));
            }
        };
    });
}

function confirmWithdraw(root, p) {
    showGamePopupWithContent("💰 Забрать банк воров?", (content) => {
        content.innerHTML = `
            <div class="profile-dim">В банке <b>${p.bank.toFixed(2)} ₭</b>. Воры получат уведомление и час будут голосовать.</div>
            <ul class="prison-rules">
                <li>Большинство «за» — весь банк на твой баланс.</li>
                <li>Большинство «против», ничья или никто не проголосовал — банк остаётся, а доверие воров к тебе падает на 10.</li>
                <li>Как голосуют воры, тебе не видно. Можно позвать всех в воровской чат и договориться.</li>
                <li>Следующая попытка — не раньше чем через сутки.</li>
            </ul>
            <button class="btn" id="bp-withdraw-go">Начать голосование</button>
            <div id="bp-withdraw-res"></div>`;
        content.querySelector("#bp-withdraw-go").onclick = async () => {
            const res = content.querySelector("#bp-withdraw-res");
            try {
                await apiFetch("/api/thieves/boss/withdraw_bank", { method: "POST" });
                res.innerHTML = `<div class="profile-row" style="color:#7ee787">🗳 Голосование началось — у воров час.</div>`;
                renderThievesScreen(root);
            } catch (e) {
                res.innerHTML = `<div class="error">${escapeHtml(e.message)}</div>`;
            }
        };
    });
}

// ---------- Предатели ----------
export async function showTraitors() {
    showGamePopupWithContent("🐍 Предатели", async (content) => {
        content.innerHTML = `<div class="loading">…</div>`;
        let d;
        try {
            d = await apiFetch("/api/traitors/list");
        } catch (e) {
            content.innerHTML = `<div class="error">${escapeHtml(e.message)}</div>`;
            return;
        }
        if (!d.traitors.length) {
            content.innerHTML = `<div class="profile-dim">Предателей нет — ни один Босс пока не переходил на сторону власти.</div>`;
            return;
        }
        content.innerHTML = `<div class="traitor-list">${d.traitors.map((t) => {
            const head = `<div class="traitor-name">${escapeHtml(t.name)}${t.ex_boss_number ? ` · экс-${t.ex_boss_number}-й Босс` : ""}</div>`;
            if (!t.found) return `<div class="traitor-card">${head}<div class="profile-dim">🔍 Где он теперь и кем стал — неизвестно. Найти можно с «Чёрной меткой» и Списком вербовки.</div></div>`;
            if (t.on_trial) return `<div class="traitor-card traitor-hot">${head}<div class="profile-dim">Теперь — ${escapeHtml(t.profession)}. ⚖️ Плата собрана: граждане решают его судьбу.</div></div>`;
            const pct = Math.min(100, Math.round((t.fund / t.goal) * 100));
            return `<div class="traitor-card ${t.hunt_active ? "traitor-hot" : ""}">${head}
                <div class="profile-dim">Найден: теперь — ${escapeHtml(t.profession)}.</div>
                ${t.hunt_active
                    ? `<div class="traitor-bar-label"><span>🎯 Плата за ликвидацию</span><b>${t.fund.toFixed(0)} / ${t.goal.toFixed(0)} ₭</b></div>
                       <div class="progress-bar"><div class="progress-bar-fill traitor-bar" style="width:${pct}%"></div></div>
                       <div class="profile-dim">Пополняется 20% каждой карманной кражи и третьим пунктом после ограбления (10% добычи).</div>`
                    : `<div class="profile-dim">⏳ В очереди: охота начнётся, когда разберутся с первым.</div>`}
            </div>`;
        }).join("")}</div>`;
    });
}

// ---------- Записка от Босса (показывается один раз) ----------
export async function checkBossNote() {
    let data;
    try {
        data = await apiFetch("/api/thieves/notes/unread");
    } catch (e) {
        return;
    }
    if (!data.note) return;
    showGamePopupWithContent("📜 Записка от Босса", (content) => {
        content.innerHTML = `<div class="boss-note-paper"><div class="boss-note-text">${escapeHtml(data.note.text)}</div><div class="boss-note-sign">— Босс</div></div>`;
    });
    apiFetch("/api/thieves/notes/read", { method: "POST", body: { id: data.note.id } }).catch(() => {});
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str ?? "");
    return div.innerHTML;
}

function escapeAttr(str) {
    return String(str ?? "").replace(/"/g, "&quot;");
}
