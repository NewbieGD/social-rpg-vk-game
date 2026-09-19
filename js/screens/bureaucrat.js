import { apiFetch } from "../api.js";
import { playSuccessSound, playFailSound } from "../fx.js";

const ROUND_SECONDS = 30;
const DOC_TIME_LIMIT_MS = 2200;
const MAX_POINTS_PER_ROUND = 40;

const DOC_TYPES = [
    { code: "tax", label: "Налоговая", icon: "🧾", color: "#e0b23a" },
    { code: "health", label: "Минздрав", icon: "🩺", color: "#e05a5a" },
    { code: "social", label: "Соцзащита", icon: "🧓", color: "#4a90d9" },
    { code: "police", label: "Полиция", icon: "👮", color: "#5ac97a" },
];

export async function renderBureaucratScreen(root) {
    root.innerHTML = `
        <div class="title">🗂 Бюрократ</div>
        <div class="card">
            <div class="subtitle">Раскидай документы по правильным лоткам, пока не кончилось время. Очки не дают денег или рейтинга тебе лично — они идут в общий вклад страны в Рейтинг государства.</div>
            <button class="btn" id="bureaucrat-start-btn">▶️ Начать раунд (${ROUND_SECONDS} сек)</button>
            <div id="bureaucrat-game-area"></div>
            <div id="bureaucrat-result"></div>
        </div>
    `;
    root.querySelector("#bureaucrat-start-btn").onclick = () => startRound(root);
}

function startRound(root) {
    const startBtn = root.querySelector("#bureaucrat-start-btn");
    startBtn.disabled = true;
    startBtn.style.display = "none";

    const gameArea = root.querySelector("#bureaucrat-game-area");
    const resultEl = root.querySelector("#bureaucrat-result");
    resultEl.innerHTML = "";

    let score = 0;
    let timeLeftMs = ROUND_SECONDS * 1000;
    let docTimer = null;
    let roundTimer = null;
    let currentDoc = null;
    let ended = false;

    gameArea.innerHTML = `
        <div class="bureaucrat-hud">
            <span id="bureaucrat-score">Очки: 0</span>
            <span id="bureaucrat-clock">${ROUND_SECONDS}с</span>
        </div>
        <div class="bureaucrat-doc-slot" id="bureaucrat-doc-slot"></div>
        <div class="bureaucrat-trays" id="bureaucrat-trays"></div>
    `;

    const trayRow = gameArea.querySelector("#bureaucrat-trays");
    DOC_TYPES.forEach((type) => {
        const trayBtn = document.createElement("button");
        trayBtn.className = "bureaucrat-tray";
        trayBtn.style.borderColor = type.color;
        trayBtn.innerHTML = `<span style="font-size:22px">${type.icon}</span><br>${type.label}`;
        trayBtn.onclick = () => handleTrayClick(type.code);
        trayRow.appendChild(trayBtn);
    });

    function spawnDoc() {
        if (ended) return;
        currentDoc = DOC_TYPES[Math.floor(Math.random() * DOC_TYPES.length)];
        const slot = gameArea.querySelector("#bureaucrat-doc-slot");
        slot.innerHTML = `<div class="bureaucrat-doc" style="border-color:${currentDoc.color}"><span style="font-size:32px">${currentDoc.icon}</span><div>${currentDoc.label}</div></div>`;
        clearTimeout(docTimer);
        docTimer = setTimeout(() => {
            // не успел — просто следующий документ, без штрафа сверх пропуска
            spawnDoc();
        }, DOC_TIME_LIMIT_MS);
    }

    function handleTrayClick(code) {
        if (ended || !currentDoc) return;
        if (code === currentDoc.code) {
            score = Math.min(MAX_POINTS_PER_ROUND, score + 1);
            playSuccessSound();
        } else {
            playFailSound();
        }
        gameArea.querySelector("#bureaucrat-score").textContent = `Очки: ${score}`;
        spawnDoc();
    }

    function tickClock() {
        timeLeftMs -= 100;
        const secondsLeft = Math.max(0, Math.ceil(timeLeftMs / 1000));
        const clockEl = gameArea.querySelector("#bureaucrat-clock");
        if (clockEl) clockEl.textContent = `${secondsLeft}с`;
        if (timeLeftMs <= 0) {
            endRound();
        }
    }

    async function endRound() {
        if (ended) return;
        ended = true;
        clearTimeout(docTimer);
        clearInterval(roundTimer);
        gameArea.innerHTML = "";
        resultEl.innerHTML = `<div class="loading">Отправляем результат…</div>`;
        try {
            const result = await apiFetch("/api/bureaucrat/submit", { method: "POST", body: { points: score } });
            const gainedText = result.gained_rating_this_round > 0 ? ` Вклад в Рейтинг государства +${result.gained_rating_this_round.toFixed(0)}!` : "";
            resultEl.innerHTML = `<div class="profile-row" style="color:#7ee787">✅ Раунд окончен — правильно разобрано: ${score}.${gainedText}</div>`;
        } catch (e) {
            resultEl.innerHTML = `<div class="error">${e.message}</div>`;
        }
        startBtn.disabled = false;
        startBtn.style.display = "";
        startBtn.textContent = `▶️ Сыграть ещё раз (${ROUND_SECONDS} сек)`;
    }

    roundTimer = setInterval(tickClock, 100);
    spawnDoc();
}
