// «Дело Босса мафии» — одна карточка для разных экранов: президент видит
// кнопки охоты и сделки, граждане — кто Босс (если опознан), полиция —
// розыск. Босс под стражей выбирает исход сделки на экране тюрьмы.
import { apiFetch } from "../api.js";
import { showGamePopupWithContent, showGameStylePopup } from "../gamePopup.js";
import { burstConfetti, playSuccessSound } from "../fx.js";

export async function loadBossStatus() {
    try {
        return await apiFetch("/api/boss_power/status");
    } catch (e) {
        return null;
    }
}

function catchesBar(s) {
    const dots = Array.from({ length: s.catches_to_expose }, (_, i) =>
        `<span class="boss-catch-dot ${i < s.catch_count ? "boss-catch-dot-on" : ""}"></span>`).join("");
    return `<div class="boss-catches"><span>Поймали и отпустили:</span>${dots}<b>${Math.min(s.catch_count, s.catches_to_expose)}/${s.catches_to_expose}</b></div>`;
}

// Карточка для Государства / Сводки полиции / панели президента
export function bossCaseHtml(s, role) {
    if (!s || !s.boss_exists) {
        return `<div class="card boss-case"><div class="subtitle">🕶 Босса мафии сейчас нет</div><div class="profile-dim">Трон воров пустует.</div></div>`;
    }
    const who = s.exposed && s.boss
        ? `<div class="boss-case-name">👑 ${escapeHtml(s.boss.name)}</div><div class="profile-dim">Опознан после ${s.catches_to_expose} поимок — виден всем, в чатах тоже.</div>`
        : `<div class="boss-case-name boss-case-unknown">👤 Личность не установлена</div><div class="profile-dim">Пока полиция не поймает его ${s.catches_to_expose} раз, никто, кроме воров, не знает, кто он.</div>`;
    let stage = "";
    if (s.custody) stage = `<div class="boss-case-stage boss-case-stage-hot">⛓ Под стражей до ${fmt(s.custody_until)}. ${s.deal_offered ? "Сделка предложена — Босс решает." : "Президент может предложить сделку."}</div>`;
    else if (s.hunt_active) stage = `<div class="boss-case-stage boss-case-stage-hot">🎯 Охота объявлена: следующая поимка полицией — заключение и сделка с президентом.</div>`;
    else if (s.hunt_cooldown_until) stage = `<div class="boss-case-stage">Охоту не поддержали — повтор после ${fmt(s.hunt_cooldown_until)}.</div>`;

    let action = "";
    if (role === "president") {
        if (s.custody && !s.deal_offered) action = `<button class="btn" data-boss-act="deal">📜 Предложить Боссу сделку</button>`;
        else if (s.exposed && !s.hunt_active && !s.custody && !s.hunt_cooldown_until) action = `<button class="btn" data-boss-act="hunt">🎯 Объявить охоту на Босса</button><div class="profile-dim">Голосуют депутаты и министры, решает большинство проголосовавших.</div>`;
        else if (!s.exposed) action = `<div class="profile-dim">Охоту можно объявить, когда Босс будет опознан.</div>`;
    }
    const citizenNote = role === "state"
        ? `<div class="profile-dim boss-case-note">🏛 Гражданам выгодно иметь президента: без него Босса мафии невозможно посадить — даже опознанного.${s.has_president ? "" : " <b>Сейчас президента нет.</b>"}</div>`
        : "";
    return `<div class="card boss-case ${s.custody || s.hunt_active ? "boss-case-hot" : ""}">
        <div class="subtitle">🕵️ Дело Босса мафии</div>
        ${who}
        ${catchesBar(s)}
        ${stage}
        ${action}
        ${citizenNote}
    </div>`;
}

export function bindBossCase(container, rerender) {
    container.querySelectorAll("[data-boss-act]").forEach((btn) => {
        btn.onclick = async () => {
            const act = btn.dataset.bossAct;
            try {
                if (act === "hunt") {
                    await apiFetch("/api/president/hunt_vor", { method: "POST" });
                    showGameStylePopup("🎯 Охота предложена", "Депутаты и министры голосуют в разделе Государство. Если большинство «за» — следующая поимка Босса полицией станет настоящим заключением.");
                } else {
                    await apiFetch("/api/boss_power/offer_deal", { method: "POST" });
                    showGameStylePopup("📜 Сделка предложена", "Босс выбирает: сдать двух воров, сложить полномочия или ликвидация. За исход ты получишь +10 или +20 к рейтингу.");
                }
                playSuccessSound();
                rerender();
            } catch (e) {
                showGameStylePopup("Не получилось", escapeHtml(e.message));
            }
        };
    });
}

// Экран сделки для Босса под стражей (в тюрьме)
export function custodyDealHtml(s) {
    if (!s.deal_offered) {
        return `<div class="card boss-case boss-case-hot">
            <div class="subtitle">⛓ Ты под стражей как Босс мафии</div>
            <div class="profile-dim">Подкуп, побег и выкуп не помогут — только сделка. Жди предложения президента до ${fmt(s.custody_until)}. Если его не будет — тебя отпустят, но поимок станет 4 из 5.</div>
            <div class="profile-dim">Пока ты сидишь, ворами управляет твоя правая рука.</div>
        </div>`;
    }
    const profs = s.professions.map((p) => `<option value="${p.code}">${escapeHtml(p.name)}</option>`).join("");
    return `<div class="card boss-case boss-case-hot">
        <div class="subtitle">📜 Президент предлагает сделку</div>
        <div class="profile-dim">Выбери свою судьбу до ${fmt(s.custody_until)}. Решение окончательное.</div>
        <div class="deal-options">
            <div class="deal-option">
                <div class="deal-option-title">🐀 Сдать ${s.give_up_count || 2} воров</div>
                <div class="deal-option-text">Случайные воры становятся гражданами дефицитных профессий (их деньги остаются, вещи чёрного рынка изымаются). Тебя отпускают, счётчик поимок обнуляется. Воры узнают — доверие к тебе −30.</div>
                <button class="btn btn-secondary" data-deal="give" ${s.can_give_up ? "" : "disabled"}>${s.can_give_up ? "Сдать воров" : "Сдавать некого"}</button>
            </div>
            <div class="deal-option">
                <div class="deal-option-title">🤝 Сложить полномочия</div>
                <div class="deal-option-text">Становишься гражданином выбранной профессии, вещи чёрного рынка изымаются. 60% банка воров уходит в казну. Для воров ты — предатель, и тебя начнут искать.</div>
                <select class="text-input" id="deal-prof">${profs}</select>
                <button class="btn btn-secondary" data-deal="resign">Сложить полномочия</button>
            </div>
            <div class="deal-option deal-option-dark">
                <div class="deal-option-title">⚰️ Ликвидация — не сдать своих</div>
                <div class="deal-option-text">Начинаешь игру заново (косметика остаётся), твои деньги уходят в казну. Твоё последнее слово услышат все, а портрет навсегда встанет у трона.</div>
                <input class="text-input" id="deal-word" maxlength="20" placeholder="Последнее слово (до 20 символов)">
                <button class="btn" data-deal="liquidate">Принять ликвидацию</button>
            </div>
        </div>
    </div>`;
}

export function bindCustodyDeal(container, rerender) {
    container.querySelectorAll("[data-deal]").forEach((btn) => {
        btn.onclick = () => {
            const choice = btn.dataset.deal;
            const body = { choice };
            if (choice === "resign") body.profession = container.querySelector("#deal-prof").value;
            if (choice === "liquidate") body.last_word = container.querySelector("#deal-word").value;
            const titles = { give: "Сдать воров?", resign: "Сложить полномочия?", liquidate: "Принять ликвидацию?" };
            showGamePopupWithContent(titles[choice], (content) => {
                content.innerHTML = `<div class="profile-dim">Это решение нельзя отменить.</div><button class="btn" id="deal-go" style="margin-top:12px">Да, решено</button><div id="deal-res"></div>`;
                content.querySelector("#deal-go").onclick = async () => {
                    try {
                        await apiFetch("/api/boss_power/choose", { method: "POST", body });
                        if (choice === "liquidate") burstConfetti(content, 16);
                        const overlay = content.closest(".profile-overlay");
                        if (overlay) overlay.remove();
                        rerender();
                    } catch (e) {
                        content.querySelector("#deal-res").innerHTML = `<div class="error">${escapeHtml(e.message)}</div>`;
                    }
                };
            });
        };
    });
}

function fmt(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str ?? "");
    return div.innerHTML;
}
