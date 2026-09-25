import { apiFetch } from "../api.js";
import { screenHeader } from "../screenHeader.js";
import { playFailSound, playCoinSound, burstConfetti } from "../fx.js";
import { renderRecruitmentScreen } from "./recruitment.js";
import { renderHeistScreen } from "./heist.js";
import { renderStashScreen } from "./stash.js";
import { renderThiefBankScreen } from "./thiefBank.js";
import { showGamePopupWithContent } from "../gamePopup.js";

export async function renderCrimeScreen(root) {
    root.innerHTML = `<div class="loading">Загружаем…</div>`;

    let profile;
    try {
        profile = await apiFetch("/api/profile");
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    if (profile.stage === "prison") {
        root.innerHTML = `
            ${screenHeader({ scene: "crime", title: "Криминал", sub: "Тёмная сторона города", fallbackTitle: "🚨 Криминал" })}
            <div class="card"><div class="subtitle">⛓ Ты в тюрьме — сначала нужно освободиться.</div></div>
        `;
        return;
    }

    if (profile.stage !== "criminal") {
        root.innerHTML = `
            ${screenHeader({ scene: "crime", title: "Криминал", sub: "Тёмная сторона города", fallbackTitle: "🚨 Криминал" })}
            <div class="card"><div class="subtitle">Этот раздел доступен только преступникам.</div></div>
        `;
        return;
    }

    root.innerHTML = `
        ${screenHeader({ scene: "crime", title: "Криминал", sub: "Тёмная сторона города", fallbackTitle: "🚨 Криминал" })}
        <div class="card">
            <div class="profile-row">🔫 Авторитет: ${Number(profile.authority).toFixed(2)}/100</div>
        </div>
        <div class="card">
            <div class="subtitle">
                🕵️ Карманная кража — без жертвы, до 5 раз в день без кулдауна, 1-30₭ за раз, 5% простой шанс неудачи.<br><br>
                🔫 Ограбление — реальная жертва, до 3 раз в день, добыча 15-20% баланса (не больше 120₭), шанс украсть вещь 50%. Чем больше грабишь за день — тем выше шанс, что жертва узнает тебя и сможет заявить в полицию.
            </div>
            <button class="btn btn-secondary" id="pickpocket-btn">🕵️ Карманная кража</button>
            <button class="btn" id="rob-btn">🔫 Ограбить</button>
            <div id="crime-result"></div>
        </div>
        <div class="card">
            <div class="subtitle">👥 Вербовка новых воров</div>
            <button class="btn btn-secondary" id="recruitment-btn">Открыть список кандидатов</button>
        </div>
        <div class="card">
            <button class="btn btn-secondary" id="stash-btn">🗝 Мой тайник</button>
            <button class="btn btn-secondary" id="thief-bank-btn" style="margin-top:6px">🏦 Банк воров</button>
        </div>
        <div class="card" id="boss-mafia-card"><div class="loading">Загружаем…</div></div>
        <div class="card" id="heist-link-card"></div>
    `;

    root.querySelector("#rob-btn").onclick = () => doCrime(root, "/api/crime/rob", "rob");
    root.querySelector("#pickpocket-btn").onclick = () => doCrime(root, "/api/crime/pickpocket", "pickpocket");
    root.querySelector("#recruitment-btn").onclick = () => showFullScreenFrom(root, renderRecruitmentScreen);
    root.querySelector("#stash-btn").onclick = () => showFullScreenFrom(root, renderStashScreen);
    root.querySelector("#thief-bank-btn").onclick = () => showFullScreenFrom(root, renderThiefBankScreen);

    await loadBossMafiaCard(root, profile);
    await loadHeistLinkCard(root);
}

async function doCrime(root, path, kind) {
    const resultEl = root.querySelector("#crime-result");
    resultEl.innerHTML = `<div class="loading">…</div>`;

    let result;
    try {
        result = await apiFetch(path, { method: "POST" });
    } catch (e) {
        resultEl.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }
    resultEl.innerHTML = "";

    showGamePopupWithContent(kind === "pickpocket" ? "🕵️ Карманная кража" : "🔫 Ограбление", (content) => {
        content.innerHTML = formatResult(result, kind);
        if (result.status === "success") {
            burstConfetti(content, 20);
        }
        if (kind === "rob" && result.status === "success" && result.identity_known) {
            content.insertAdjacentHTML("beforeend", `
                <div class="profile-dim" style="margin-top:10px">Жертва тебя узнала — в течение часа можешь защитить часть добычи от возврата, если поймают:</div>
                <button class="btn btn-secondary" id="stash-protect-btn" style="margin-top:6px">🗝 В тайник (30%)</button>
                <button class="btn btn-secondary" id="bank-protect-btn" style="margin-top:6px">🏦 В банк воров (10%)</button>
                <div id="protect-result"></div>
            `);
            content.querySelector("#stash-protect-btn").onclick = () => doProtect(content, "/api/stash/stash_case", result.victim_vk_id, "stash-protect-btn");
            content.querySelector("#bank-protect-btn").onclick = () => doProtect(content, "/api/stash/bank_case", result.victim_vk_id, "bank-protect-btn");
        }
    });

    if (result.status === "failed") {
        playFailSound();
    } else if (result.status === "success") {
        playCoinSound();
    }
}

async function doProtect(content, path, victimVkId, btnId) {
    const resultEl = content.querySelector("#protect-result");
    resultEl.innerHTML = `<div class="loading">…</div>`;
    try {
        await apiFetch(path, { method: "POST", body: { victim_vk_id: victimVkId } });
        resultEl.innerHTML = `<div class="profile-row" style="color:#7ee787">✅ Защищено!</div>`;
        const btn = content.querySelector(`#${btnId}`);
        if (btn) btn.disabled = true;
    } catch (e) {
        resultEl.innerHTML = `<div class="error">${e.message}</div>`;
    }
}

function formatResult(result, kind) {
    if (kind === "pickpocket") {
        if (result.status === "failed") {
            return `<div class="profile-row" style="color:#ffb454">😬 Не получилось — попробуй ещё раз. Осталось попыток: ${result.attempts_left}.</div>`;
        }
        return `<div class="profile-row" style="color:#7ee787;font-size:18px">🕵️ Незаметно стащил(а) <b>${result.amount.toFixed(2)}₭</b>!</div><div class="profile-dim" style="margin-top:6px">Осталось попыток сегодня: ${result.attempts_left}.</div>`;
    }

    // rob
    const victimName = escapeHtml(result.victim_username ? "@" + result.victim_username : "ID " + result.victim_vk_id);
    const itemText = result.stolen_item_name ? `<div class="profile-row" style="color:#7ee787">🎁 + вещь: <b>${escapeHtml(result.stolen_item_name)}</b></div>` : "";
    const identityText = result.identity_known
        ? `<div class="profile-row" style="color:#ff9eb5;margin-top:6px">⚠️ Жертва узнала тебя — может подать заявление в полицию.</div>`
        : `<div class="profile-dim" style="margin-top:6px">Личность осталась в тайне.</div>`;
    const vorText = result.vor_cut > 0 ? `<div class="profile-dim">${result.vor_cut.toFixed(2)}₭ ушло Боссу Мафии.</div>` : "";
    const woundText = result.victim_wounded ? `<div class="profile-dim">Жертва (${victimName}) ещё и ранена.</div>` : "";
    return `<div class="profile-row" style="color:#7ee787;font-size:18px">💰 Ты ограбил(а) ${victimName} на <b>${result.loot.toFixed(2)}₭</b></div>${itemText}${vorText}${woundText}${identityText}`;
}

async function loadBossMafiaCard(root, profile) {
    const card = root.querySelector("#boss-mafia-card");
    let state;
    try {
        state = await apiFetch("/api/state");
    } catch (e) {
        card.innerHTML = "";
        return;
    }

    if (state.boss_mafia) {
        card.innerHTML = `
            <div class="subtitle">👑 Сейчас Босс Мафии: ${state.boss_mafia.vk_id === profile.tg_id ? "это ты!" : escapeHtml(state.boss_mafia.username ? "@" + state.boss_mafia.username : "ID " + state.boss_mafia.vk_id)}</div>
            ${state.boss_mafia.vk_id === profile.tg_id ? `<button class="btn btn-secondary" id="grant-permission-btn" style="margin-top:6px">Разрешить кому-то баллотироваться в депутаты</button>` : ""}
        `;
        const grantBtn = card.querySelector("#grant-permission-btn");
        if (grantBtn) grantBtn.onclick = () => showGrantPermissionPrompt();
        return;
    }

    card.innerHTML = `
        <div class="subtitle">👑 Сейчас вакансия Босса Мафии${state.boss_mafia_election_pending ? " — идут выборы, присоединяйся!" : ""}</div>
        <div class="profile-dim" style="margin-bottom:8px">Нужен Авторитет 100+, чтобы баллотироваться.</div>
        <button class="btn" id="boss-register-btn" ${profile.authority < 100 ? "disabled" : ""}>${state.boss_mafia_election_pending ? "Присоединиться к выборам" : "Баллотироваться в Боссы Мафии"}</button>
        <div id="boss-register-result"></div>
    `;
    const btn = card.querySelector("#boss-register-btn");
    btn.onclick = async () => {
        const resultEl = card.querySelector("#boss-register-result");
        resultEl.innerHTML = `<div class="loading">…</div>`;
        try {
            const r = await apiFetch("/api/boss_mafia/register", { method: "POST" });
            resultEl.innerHTML = `<div class="profile-row" style="color:#7ee787">✅ ${r.status === "started" ? "Выборы начались!" : "Ты присоединился(ась) к выборам!"}</div>`;
        } catch (e) {
            resultEl.innerHTML = `<div class="error">${e.message}</div>`;
        }
    };
}

function showGrantPermissionPrompt() {
    showGamePopupWithContent("👑 Разрешить баллотироваться", (content) => {
        content.innerHTML = `
            <div class="profile-dim" style="margin-bottom:10px">VK ID вора, которому разрешить баллотироваться в депутаты в этом цикле выборов:</div>
            <input type="number" id="grant-target-input" class="text-input" placeholder="VK ID">
            <button class="btn" id="grant-confirm-btn" style="margin-top:10px">Выдать разрешение</button>
            <div id="grant-permission-popup-result"></div>
        `;
        content.querySelector("#grant-confirm-btn").onclick = async () => {
            const targetId = Number(content.querySelector("#grant-target-input").value);
            const resultEl = content.querySelector("#grant-permission-popup-result");
            if (!targetId) {
                resultEl.innerHTML = `<div class="error">Введи корректный VK ID</div>`;
                return;
            }
            resultEl.innerHTML = `<div class="loading">…</div>`;
            try {
                await apiFetch("/api/boss_mafia/grant_election_permission", { method: "POST", body: { target_vk_id: targetId } });
                resultEl.innerHTML = `<div class="profile-row" style="color:#7ee787">✅ Разрешение выдано!</div>`;
            } catch (e) {
                resultEl.innerHTML = `<div class="error">${e.message}</div>`;
            }
        };
    });
}

async function loadHeistLinkCard(root) {
    const card = root.querySelector("#heist-link-card");
    let status;
    try {
        status = await apiFetch("/api/heist/status");
    } catch (e) {
        card.innerHTML = "";
        return;
    }
    if (!status.active) {
        await loadHeistScaleBar(card);
        return;
    }
    card.innerHTML = `
        <div class="subtitle">💰 Идёт «Ограбление по крупному»!</div>
        <button class="btn" id="heist-open-btn">Перейти к событию</button>
    `;
    card.querySelector("#heist-open-btn").onclick = () => showFullScreenFrom(root, renderHeistScreen);
}

async function loadHeistScaleBar(card) {
    let scale;
    try {
        scale = await apiFetch("/api/heist/scale_status");
    } catch (e) {
        card.innerHTML = "";
        return;
    }
    const pct = Math.min(100, Math.round((scale.progress / scale.threshold) * 100));
    card.innerHTML = `
        <div class="gov-section-title">💰 До «Ограбления по крупному»</div>
        <div class="profile-dim" style="margin-bottom:6px">${scale.progress} / ${scale.threshold} успешных ограблений всех воров страны</div>
        <div class="progress-bar"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
    `;
}

async function showFullScreenFrom(root, renderFn) {
    root.innerHTML = "";
    const backBtn = document.createElement("button");
    backBtn.className = "btn btn-secondary";
    backBtn.textContent = "🔙 Назад в Криминал";
    backBtn.onclick = () => renderCrimeScreen(root);
    root.appendChild(backBtn);
    const content = document.createElement("div");
    root.appendChild(content);
    await renderFn(content);
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
