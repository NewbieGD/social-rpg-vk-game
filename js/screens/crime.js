import { apiFetch } from "../api.js";
import { runPocketsGame, runSafeGame } from "./thiefGames.js";
import { infoButton, bindInfoButtons } from "../infoPopups.js";
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
            ${screenHeader({ scene: "crime", title: "Криминал", sub: "Воровское логово", fallbackTitle: "🚨 Криминал", image: "assets/backgrounds/thief-den.jpg" })}
            <div class="card"><div class="subtitle">⛓ Ты в тюрьме — сначала нужно освободиться.</div></div>
        `;
        return;
    }

    if (profile.stage !== "criminal") {
        root.innerHTML = `
            ${screenHeader({ scene: "crime", title: "Криминал", sub: "Воровское логово", fallbackTitle: "🚨 Криминал", image: "assets/backgrounds/thief-den.jpg" })}
            <div class="card"><div class="subtitle">Этот раздел доступен только преступникам.</div></div>
        `;
        return;
    }

    root.innerHTML = `
        ${screenHeader({ scene: "crime", title: "Криминал", sub: "Воровское логово", fallbackTitle: "🚨 Криминал", image: "assets/backgrounds/thief-den.jpg" })}
        <div class="card">
            <div class="subtitle">
                🕵️ <b>Карманная кража</b> ${infoButton("pickpocket")} — до 5 раз в день, без перерывов. За раз — от 1 до 30₭. После кражи — мини-игра «Карманы»: в трёх карманах из девяти кошельки, открой три — за каждый найденный бонус сверху (1 — +5₭, 2 — +10₭, все 3 — +20₭). С шансом 5% тебя замечают, и кража срывается (0₭, без наказания).<br><br>
                🔫 <b>Ограбление</b> ${infoButton("safecrack")} — до 3 раз в день, реальная жертва. Добыча 15–20% её баланса (не больше 120₭), с шансом 50% ещё и вещь. В комнате жертвы — сейф с тремя замками: вскрыл 1 — шанс, что жертва тебя узнает, ниже на 1%, 2 — на 2%, все 3 — на 5%. Чем больше грабишь за день, тем выше этот шанс (35% → 45% → 55%): узнавшая жертва может заявить в полицию, а полиция ловит с шансом 30% (стажёр) или 40% (работающий). После ограбления можно спрятать часть добычи в тайник или банк воров.</div>
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

    bindInfoButtons(root);
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
        if (kind === "rob") {
            // шаг 1 — комната жертвы и сейф, шаг 2 — итог с учётом вскрытых замков
            const room = await apiFetch("/api/crime/rob/start", { method: "POST" });
            resultEl.innerHTML = "";
            const locks = await runSafeGame(room);
            result = await apiFetch("/api/crime/rob/finish", { method: "POST", body: { token: room.token, locks_opened: locks } });
        } else {
            result = await apiFetch(path, { method: "POST" });
            if (result.status === "success" && result.game) {
                resultEl.innerHTML = "";
                result.pocket = await runPocketsGame(result);
            }
        }
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
        if (kind === "rob" && result.status === "success" && result.robbery_id) {
            const stashAmount = (result.loot * 0.30).toFixed(2);
            const bankAmount = (result.loot * 0.10).toFixed(2);
            content.insertAdjacentHTML("beforeend", `
                <div class="protect-choice">
                    <div class="profile-dim">Что сделать с добычей? Решить можно в течение часа.${result.identity_known ? " Спрятанное и внесённое в банк жертве не вернут, даже если тебя поймают." : ""}</div>
                    <button class="btn btn-secondary" id="stash-protect-btn" ${result.has_stash ? "" : "disabled"}>🗝 В тайник: ${stashAmount} ₭ (30%)</button>
                    ${result.has_stash ? "" : `<div class="profile-dim protect-hint">Нужен предмет «Тайник» — купи на чёрном рынке.</div>`}
                    <button class="btn btn-secondary" id="bank-protect-btn">🏦 В банк воров: ${bankAmount} ₭ (10%)</button>
                    ${result.traitor_hunt_active ? `<button class="btn btn-secondary" id="hunt-protect-btn">🎯 На охоту за предателем: ${bankAmount} ₭ (10%)</button>` : ""}
                    <button class="btn btn-secondary" id="skip-protect-btn">Пропустить — оставить всё на балансе</button>
                    <div id="protect-result"></div>
                </div>
            `);
            content.querySelector("#stash-protect-btn").onclick = () => doProtect(content, "/api/stash/stash_case", result.robbery_id, "stash-protect-btn");
            content.querySelector("#bank-protect-btn").onclick = () => doProtect(content, "/api/stash/bank_case", result.robbery_id, "bank-protect-btn");
            const huntBtn = content.querySelector("#hunt-protect-btn");
            if (huntBtn) huntBtn.onclick = () => doProtect(content, "/api/stash/hunt_case", result.robbery_id, "hunt-protect-btn");
            content.querySelector("#skip-protect-btn").onclick = () => {
                const overlay = content.closest(".profile-overlay");
                if (overlay) overlay.remove();
            };
        }
    });

    if (result.status === "failed") {
        playFailSound();
    } else if (result.status === "success") {
        playCoinSound();
    }
}

async function doProtect(content, path, robberyId, btnId) {
    const resultEl = content.querySelector("#protect-result");
    resultEl.innerHTML = `<div class="loading">…</div>`;
    try {
        await apiFetch(path, { method: "POST", body: { robbery_id: robberyId } });
        resultEl.innerHTML = `<div class="profile-row" style="color:#7ee787">✅ ${btnId === "stash-protect-btn" ? "Спрятано в тайник" : btnId === "hunt-protect-btn" ? "Внесено на охоту за предателем" : "Внесено в банк воров"}!</div>`;
        // часть добычи уже перемещена — «оставить всё на балансе» больше не правда
        const skip = content.querySelector("#skip-protect-btn");
        if (skip) skip.textContent = "Готово";
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
        const pk = result.pocket;
        const bonusLine = pk && pk.bonus
            ? `<div class="profile-row" style="color:#f2c46a">👛 Кошельков найдено: <b>${pk.found_count}</b> → бонус <b>+${pk.bonus}₭</b></div><div class="profile-row">Итого: <b>${pk.total.toFixed(2)}₭</b></div>`
            : `<div class="profile-dim">Кошельки не найдены — бонуса нет.</div>`;
        return `<div class="profile-row" style="color:#7ee787;font-size:18px">🕵️ Незаметно стащил(а) <b>${result.amount.toFixed(2)}₭</b></div>${pk ? bonusLine : ""}${result.hunt_share ? `<div class="profile-dim">🎯 ${result.hunt_share.toFixed(2)}₭ (20%) ушло на охоту за предателем.</div>` : ""}<div class="profile-dim" style="margin-top:6px">Осталось попыток сегодня: ${result.attempts_left}.</div>`;
    }

    // rob
    const victimName = escapeHtml(result.victim_username ? "@" + result.victim_username : "ID " + result.victim_vk_id);
    const itemText = result.stolen_item_name ? `<div class="profile-row" style="color:#7ee787">🎁 + вещь: <b>${escapeHtml(result.stolen_item_name)}</b></div>` : "";
    const identityText = result.identity_known
        ? `<div class="profile-row" style="color:#ff9eb5;margin-top:6px">⚠️ Жертва узнала тебя — может подать заявление в полицию.</div>`
        : `<div class="profile-dim" style="margin-top:6px">Личность осталась в тайне.</div>`;
    const vorText = result.vor_cut > 0 ? `<div class="profile-dim">${result.vor_cut.toFixed(2)}₭ ушло Боссу Мафии.</div>` : "";
    const woundText = result.victim_wounded ? `<div class="profile-dim">Жертва (${victimName}) ещё и ранена.</div>` : "";
    const locksText = typeof result.locks_opened === "number"
        ? `<div class="profile-dim">🔓 Вскрыто замков: ${result.locks_opened} из 3${result.reveal_reduction_pct ? ` — шанс, что тебя узнают, был ниже на ${result.reveal_reduction_pct}%` : ""}.</div>`
        : "";
    return `<div class="profile-row" style="color:#7ee787;font-size:18px">💰 Ты ограбил(а) ${victimName} на <b>${result.loot.toFixed(2)}₭</b></div>${itemText}${vorText}${woundText}${locksText}${identityText}`;
}

async function loadBossMafiaCard(root, profile) {
    const card = root.querySelector("#boss-mafia-card");
    let ov;
    try {
        ov = await apiFetch("/api/thieves/overview");
    } catch (e) {
        card.innerHTML = "";
        return;
    }
    const b = ov.boss;
    card.classList.add("thieves-entry");
    card.innerHTML = `
        <div class="thieves-entry-throne">${b ? "👑" : "🪑"}</div>
        <div class="thieves-entry-text">
            <div class="subtitle">${b ? `Босс Мафии: ${escapeHtml(b.name)}` : "Трон Босса Мафии пуст"}</div>
            <div class="profile-dim">Воров: ${ov.thieves} · в тюрьме: ${ov.in_prison} · банк: ${ov.bank.toFixed(0)}₭${ov.votes.length ? " · 🗳 идёт голосование!" : ""}</div>
        </div>
        <button class="btn" id="thieves-open-btn">👑 Воры и Босс мафии</button>`;
    card.querySelector("#thieves-open-btn").onclick = async () => {
        const { renderThievesScreen } = await import("./thieves.js");
        showFullScreenFrom(root, renderThievesScreen);
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
        <div class="gov-section-title">💰 До «Ограбления по крупному» ${infoButton("heist")}</div>
        <div class="profile-dim" style="margin-bottom:6px">${scale.progress} / ${scale.threshold} успешных ограблений всех воров страны. Когда шкала заполнится — начнётся налёт на банк страны. Если полиция наберёт больше очков, один случайный вор-участник (кроме Босса) попадёт в тюрьму.</div>
        <div class="progress-bar pb-red"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
    `;
    bindInfoButtons(card);
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
