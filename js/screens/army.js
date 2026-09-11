import { apiFetch } from "../api.js";
import { burstConfetti, playSuccessSound } from "../fx.js";

export async function renderArmyScreen(root) {
    root.innerHTML = `<div class="loading">Загружаем…</div>`;

    let status;
    try {
        status = await apiFetch("/api/army/status");
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    if (status.active) {
        root.innerHTML = `
            <div class="title">🎖 Армия</div>
            <div class="card">
                <div class="profile-row" style="color:#7ee787">✅ Контракт действует</div>
                <div class="profile-row">💰 ${status.base_rate.toFixed(0)}₭/час</div>
                <div class="profile-row">⭐ +1 к рейтингу каждый день, пока контракт активен</div>
                <div class="profile-row">⚔️ +1 к рейтингу за успешное подавление бунта (неудача рейтинг не снижает)</div>
                <div class="profile-dim">До конца контракта: ${formatDuration(status.seconds_left)}</div>
                <div class="profile-dim">🏠 Квартира за верную службу: ${status.house_already_given ? "уже получена ранее" : "получишь, если дослужишь контракт до конца"}</div>
                <div class="profile-dim" style="margin-top:8px">⚠️ Расторгнуть контракт досрочно самому нельзя — только если свергнут президента, либо он сам расформирует армию.</div>
            </div>
            <div id="riot-army-card"></div>
        `;
        await appendRiotCard(root);
        return;
    }

    root.innerHTML = `
        <div class="title">🎖 Армия</div>
        <div class="card" id="army-card">
            <div class="subtitle">Контрактная служба — не профессия, отдельное соглашение на 30 дней.</div>
            <div class="profile-row">💰 ${status.base_rate.toFixed(0)}₭/час — фиксированная ставка (может менять президент)</div>
            <div class="profile-row">⭐ +1 к рейтингу каждый день, пока контракт активен</div>
            <div class="profile-row">⚔️ +1 к рейтингу за успешное подавление бунта 1-на-1 (неудача не наказывает)</div>
            <div class="profile-row">🎁 При подписании — по 1 шт. каждого обычного товара из магазина бесплатно и мгновенно (кроме Машины, Дома и Прав)</div>
            <div class="profile-row">🏠 ${status.house_already_given ? "Квартиру ты уже получал(а) раньше — во второй раз не дадут" : "Квартира в подарок насовсем — но только если дослужишь все 30 дней"}</div>
            <div class="profile-row" style="color:#ff9eb5">⚠️ Расторгнуть контракт самому нельзя — только через 30 дней, либо если свергнут президента / он сам распустит армию</div>
            <div id="sign-result"></div>
        </div>
    `;

    if (!status.can_sign) {
        root.querySelector("#army-card").innerHTML += `<div class="profile-dim" style="margin-top:8px">Подписать контракт можно только после выпуска (нужна стадия «Работник»).</div>`;
        return;
    }

    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "🖋 Подписать контракт";
    btn.onclick = () => signContract(root, btn);
    root.querySelector("#army-card").appendChild(btn);
}

async function appendRiotCard(root) {
    const container = root.querySelector("#riot-army-card");
    let riotStatus;
    try {
        riotStatus = await apiFetch("/api/army/riot_status");
    } catch (e) {
        return;
    }

    if (!riotStatus.active) return;

    const card = document.createElement("div");
    card.className = "card";

    if (riotStatus.already_acted) {
        const actionText = riotStatus.my_action === "suppress"
            ? (riotStatus.my_last_duel_won ? "⚔️ Ты подавлял(а) бунт и победил(а) в дуэли." : "⚔️ Ты подавлял(а) бунт, но проиграл(а) дуэль (рейтинг за это не снижается).")
            : "🕊 Ты решил(а) не сражаться и примкнул(а) к бунтующим.";
        card.innerHTML = `<div class="subtitle">🔥 В стране бунт</div><div class="profile-row">${actionText}</div><div class="profile-dim">Итог всего бунта станет известен, когда определятся все военные.</div>`;
        container.appendChild(card);
        return;
    }

    card.innerHTML = `
        <div class="subtitle">🔥 В стране бунт! Бастующих: ${riotStatus.rioters_count}</div>
        <div class="profile-dim">Подавить — случайная дуэль 1-на-1 против бунтующего. Примкнуть — не сражаешься, просто ждёшь итог вместе с бунтующими.</div>
    `;
    const suppressBtn = document.createElement("button");
    suppressBtn.className = "btn";
    suppressBtn.textContent = "⚔️ Подавить восстание";
    const joinBtn = document.createElement("button");
    joinBtn.className = "btn btn-secondary";
    joinBtn.textContent = "🕊 Примкнуть к бунту";
    const resultEl = document.createElement("div");

    suppressBtn.onclick = async () => {
        suppressBtn.disabled = true;
        joinBtn.disabled = true;
        try {
            const r = await apiFetch("/api/army/riot/suppress", { method: "POST" });
            resultEl.innerHTML = r.won
                ? `<div class="profile-row" style="color:#7ee787">⚔️ Победа! +1 к рейтингу.</div>`
                : `<div class="profile-row">⚔️ Проиграл(а) дуэль — но рейтинг за это не снижается.</div>`;
        } catch (e) {
            resultEl.innerHTML = `<div class="error">${e.message}</div>`;
            suppressBtn.disabled = false;
            joinBtn.disabled = false;
        }
    };
    joinBtn.onclick = async () => {
        suppressBtn.disabled = true;
        joinBtn.disabled = true;
        try {
            await apiFetch("/api/army/riot/join", { method: "POST" });
            resultEl.innerHTML = `<div class="profile-row">🕊 Ты примкнул(а) к бунтующим — просто ждёшь итог.</div>`;
        } catch (e) {
            resultEl.innerHTML = `<div class="error">${e.message}</div>`;
            suppressBtn.disabled = false;
            joinBtn.disabled = false;
        }
    };

    card.appendChild(suppressBtn);
    card.appendChild(joinBtn);
    card.appendChild(resultEl);
    container.appendChild(card);
}

function formatDuration(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days} дн ${hours} ч`;
}

async function signContract(root, btn) {
    btn.disabled = true;
    const resultEl = root.querySelector("#sign-result");
    resultEl.innerHTML = `<div class="loading">Подписываем…</div>`;
    try {
        const result = await apiFetch("/api/army/sign_contract", { method: "POST" });
        resultEl.innerHTML = `
            <div class="profile-row" style="color:#7ee787">✅ Контракт подписан!</div>
            <div class="profile-dim">Бесплатно выдано: ${result.granted_items.join(", ")}</div>
        `;
        try {
            playSuccessSound();
            burstConfetti(resultEl);
        } catch (fxError) {
            // Косметический эффект не должен маскировать уже показанный успех.
        }
        setTimeout(() => renderArmyScreen(root), 1500);
    } catch (e) {
        resultEl.innerHTML = `<div class="error">${e.message}</div>`;
        btn.disabled = false;
    }
}
