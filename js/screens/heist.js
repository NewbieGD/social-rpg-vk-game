import { apiFetch } from "../api.js";
import { playSuccessSound, playFailSound, burstConfetti } from "../fx.js";

const TARGET_LIFETIME_MS = 1200;
const SUBMIT_INTERVAL_MS = 5000;
const SPAWN_INTERVAL_MS = 900;

export async function renderHeistScreen(root) {
    root.innerHTML = `<div class="title">💰 Ограбление по крупному</div><div class="loading">Загружаем…</div>`;

    let status;
    try {
        status = await apiFetch("/api/heist/status");
    } catch (e) {
        root.innerHTML = `<div class="title">💰 Ограбление по крупному</div><div class="error">${e.message}</div>`;
        return;
    }

    if (!status.active) {
        root.innerHTML = `<div class="title">💰 Ограбление по крупному</div><div class="card"><div class="subtitle">Сейчас событие не идёт.</div></div>`;
        return;
    }

    const isThief = status.side === "thief";
    const isPolice = status.side === "police";
    const title = isThief ? "💰 Ограбление по крупному" : isPolice ? "🛡 Защита банка страны" : "💰 Ограбление по крупному";

    if (status.phase === "prep") {
        const msLeft = new Date(status.minigame_starts_at).getTime() - Date.now();
        root.innerHTML = `
            <div class="title">${title}</div>
            <div class="card">
                <div class="subtitle">${isThief ? "🕶 Зовите своих воров — готовьтесь к дерзкому налёту!" : isPolice ? "🚨 Воры готовят налёт на банк — соберите силы, чтобы его отбить!" : "Событие скоро начнётся."}</div>
                <div class="heist-prep-clock" id="prep-clock">${Math.max(0, Math.ceil(msLeft / 1000))}с</div>
            </div>
        `;
        const clockEl = root.querySelector("#prep-clock");
        const interval = setInterval(() => {
            if (!clockEl.isConnected) { clearInterval(interval); return; }
            const left = new Date(status.minigame_starts_at).getTime() - Date.now();
            if (left <= 0) {
                clearInterval(interval);
                renderHeistScreen(root);
                return;
            }
            clockEl.textContent = `${Math.ceil(left / 1000)}с`;
        }, 500);
        return;
    }

    if (status.phase === "resolved" || status.phase === "ending") {
        const thiefWon = status.thief_score > status.police_score;
        root.innerHTML = `
            <div class="title">${title}</div>
            <div class="card">
                <div class="subtitle">🏁 Событие завершено!</div>
                <div class="heist-vs-bar">
                    <div class="heist-vs-side" style="${thiefWon ? "border:1px solid #ffd166" : ""}">💰 Воры<br><b style="font-size:22px">${status.thief_score}</b></div>
                    <div style="font-weight:700">VS</div>
                    <div class="heist-vs-side" style="${!thiefWon ? "border:1px solid #7ec8ff" : ""}">🛡 Полиция<br><b style="font-size:22px">${status.police_score}</b></div>
                </div>
            </div>
        `;
        return;
    }

    if (!isThief && !isPolice) {
        root.innerHTML = `<div class="title">${title}</div><div class="card"><div class="subtitle">Это событие доступно только ворам и полиции.</div></div>`;
        return;
    }

    startMinigame(root, status, isThief);
}

function startMinigame(root, status, isThief) {
    const title = isThief ? "💰 Ограбление по крупному" : "🛡 Защита банка страны";
    const emoji = isThief ? "💵" : "✋";
    const fieldClass = isThief ? "heist-field-thief" : "heist-field-police";
    const instructions = isThief
        ? "Хватай доллары из сейфов, пока они не исчезли!"
        : "Бей по рукам воров, пытающихся схватить деньги!";

    root.innerHTML = `
        <div class="title">${title}</div>
        <div class="card">
            <div class="subtitle">${instructions}</div>
            <div class="heist-hud-bar">
                <span id="heist-score">⭐ Твои очки: 0</span>
                <span class="heist-timer-ring" id="heist-clock"></span>
            </div>
            <div class="heist-field ${fieldClass}" id="heist-field"></div>
        </div>
    `;

    let myScore = 0;
    let pendingScore = 0;
    let ended = false;
    const field = root.querySelector("#heist-field");
    const scoreEl = root.querySelector("#heist-score");
    const clockEl = root.querySelector("#heist-clock");

    function spawnTarget() {
        if (ended) return;
        const target = document.createElement("div");
        target.className = "heist-target";
        target.textContent = emoji;
        const leftPct = Math.random() * 80;
        const topPct = Math.random() * 70;
        target.style.left = `${leftPct}%`;
        target.style.top = `${topPct}%`;
        target.onclick = () => {
            if (ended) return;
            myScore += 1;
            pendingScore += 1;
            scoreEl.textContent = `⭐ Твои очки: ${myScore}`;
            playSuccessSound();

            const floatScore = document.createElement("div");
            floatScore.className = "heist-float-score";
            floatScore.textContent = "+1";
            floatScore.style.left = `${leftPct}%`;
            floatScore.style.top = `${topPct}%`;
            field.appendChild(floatScore);
            setTimeout(() => { if (floatScore.isConnected) floatScore.remove(); }, 700);

            target.remove();
        };
        field.appendChild(target);
        setTimeout(() => {
            if (target.isConnected) target.remove();
        }, TARGET_LIFETIME_MS);
    }

    const spawnTimer = setInterval(spawnTarget, SPAWN_INTERVAL_MS);

    async function submitPending() {
        if (pendingScore === 0) return;
        const toSubmit = pendingScore;
        pendingScore = 0;
        try {
            await apiFetch("/api/heist/submit_points", { method: "POST", body: { points: toSubmit } });
        } catch (e) {
            // не критично — просто попробуем на следующем цикле
        }
    }

    const submitTimer = setInterval(submitPending, SUBMIT_INTERVAL_MS);

    function tickClock() {
        const left = new Date(status.minigame_ends_at).getTime() - Date.now();
        if (left <= 0) {
            endMinigame();
            return;
        }
        clockEl.textContent = `⏳ ${Math.ceil(left / 1000)}с`;
    }
    const clockTimer = setInterval(tickClock, 500);
    tickClock();

    async function endMinigame() {
        if (ended) return;
        ended = true;
        clearInterval(spawnTimer);
        clearInterval(clockTimer);
        clearInterval(submitTimer);
        await submitPending();
        field.innerHTML = "";
        burstConfetti(root.querySelector(".card"), 16);
        root.querySelector(".card").insertAdjacentHTML("beforeend", `<div class="profile-row" style="color:#7ee787;font-size:17px;margin-top:8px">✅ Готово! Твой итог: <b>${myScore}</b> очков. Общий результат подводится централизованно.</div>`);
    }
}
