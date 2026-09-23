import { apiFetch } from "../api.js";
import { playSuccessSound, playFailSound } from "../fx.js";

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
                <div class="subtitle">${isThief ? "Зовите своих воров — готовьтесь!" : isPolice ? "Воры готовят налёт на банк — готовьтесь его отбить!" : "Событие скоро начнётся."}</div>
                <div class="profile-row" id="prep-clock">До начала: ${Math.max(0, Math.ceil(msLeft / 1000))}с</div>
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
            clockEl.textContent = `До начала: ${Math.ceil(left / 1000)}с`;
        }, 500);
        return;
    }

    if (status.phase === "resolved" || status.phase === "ending") {
        root.innerHTML = `
            <div class="title">${title}</div>
            <div class="card">
                <div class="subtitle">Событие завершено.</div>
                <div class="profile-row">💰 Очки воров: ${status.thief_score}</div>
                <div class="profile-row">🛡 Очки полиции: ${status.police_score}</div>
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
    const instructions = isThief
        ? "Хватай доллары из сейфов, пока они не исчезли!"
        : "Бей по рукам воров, пытающихся схватить деньги!";

    root.innerHTML = `
        <div class="title">${title}</div>
        <div class="card">
            <div class="subtitle">${instructions}</div>
            <div class="bureaucrat-hud">
                <span id="heist-score">Твои очки: 0</span>
                <span id="heist-clock"></span>
            </div>
            <div class="heist-field" id="heist-field"></div>
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
        target.style.left = `${Math.random() * 80}%`;
        target.style.top = `${Math.random() * 70}%`;
        target.onclick = () => {
            if (ended) return;
            myScore += 1;
            pendingScore += 1;
            scoreEl.textContent = `Твои очки: ${myScore}`;
            playSuccessSound();
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
        clockEl.textContent = `${Math.ceil(left / 1000)}с`;
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
        root.querySelector(".card").insertAdjacentHTML("beforeend", `<div class="profile-row" style="color:#7ee787">✅ Готово! Итоговый результат подводится централизованно.</div>`);
    }
}
