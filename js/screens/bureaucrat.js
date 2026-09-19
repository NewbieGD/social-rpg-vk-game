import { apiFetch } from "../api.js";
import { playSuccessSound, playFailSound } from "../fx.js";

const ROUND_SECONDS = 30;
const DOC_TIME_LIMIT_MS = 2200;
const MAX_POINTS_PER_ROUND = 40;
const POINTS_PER_RATING = 100; // держим синхронно с government_rating.GAME_POINTS_PER_RATING на backend — только для текста правил

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
            <div class="subtitle">Раскидай документы по правильным лоткам, пока не кончилось время.</div>
            <div class="profile-dim bureaucrat-rules" style="margin:8px 0; line-height:1.5">
                <b>Правила:</b><br>
                • Один неверный лоток или не успел разобрать документ вовремя — раунд сразу заканчивается, а очки за этот раунд <b>сгорают полностью</b> (0 вклада).<br>
                • Только полностью безошибочный раунд (до истечения ${ROUND_SECONDS} сек) засчитывает очки.<br>
                • ${POINTS_PER_RATING} очков = <b>+1 балл</b> вклада в Рейтинг государства.<br>
                • Максимум за один безошибочный раунд — ${MAX_POINTS_PER_ROUND} очков (значит, для +1 балла нужно как минимум ${Math.ceil(POINTS_PER_RATING / MAX_POINTS_PER_ROUND)} успешных раунда подряд).<br>
                • Очки не дают денег или личного рейтинга тебе — только общий вклад страны.
            </div>
            <div id="bureaucrat-stats" class="profile-dim" style="margin-bottom:8px"></div>
            <button class="btn" id="bureaucrat-start-btn">▶️ Начать раунд (${ROUND_SECONDS} сек)</button>
            <div id="bureaucrat-game-area"></div>
            <div id="bureaucrat-result"></div>
        </div>
    `;
    root.querySelector("#bureaucrat-start-btn").onclick = () => startRound(root);
    await loadStats(root);
}

async function loadStats(root) {
    const statsEl = root.querySelector("#bureaucrat-stats");
    try {
        const stats = await apiFetch("/api/bureaucrat/my_stats");
        const lastText = stats.last_score !== null ? `Прошлый результат: ${stats.last_score}. ` : "";
        statsEl.textContent = `${lastText}Личный рекорд: ${stats.best_score}.`;
    } catch (e) {
        statsEl.textContent = "";
    }
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
            // Не успел разобрать вовремя — это ошибка, раунд заканчивается провалом,
            // очки за весь раунд сгорают (симметрично неверному лотку).
            endRound(false);
        }, DOC_TIME_LIMIT_MS);
    }

    function handleTrayClick(code) {
        if (ended || !currentDoc) return;
        if (code === currentDoc.code) {
            score = Math.min(MAX_POINTS_PER_ROUND, score + 1);
            playSuccessSound();
            gameArea.querySelector("#bureaucrat-score").textContent = `Очки: ${score}`;
            spawnDoc();
        } else {
            playFailSound();
            endRound(false);
        }
    }

    function tickClock() {
        timeLeftMs -= 100;
        const secondsLeft = Math.max(0, Math.ceil(timeLeftMs / 1000));
        const clockEl = gameArea.querySelector("#bureaucrat-clock");
        if (clockEl) clockEl.textContent = `${secondsLeft}с`;
        if (timeLeftMs <= 0) {
            endRound(true);
        }
    }

    async function endRound(success) {
        if (ended) return;
        ended = true;
        clearTimeout(docTimer);
        clearInterval(roundTimer);
        gameArea.innerHTML = "";
        // Ошибся или не успел — очки за раунд сгорают полностью, засчитывается 0,
        // только полностью безошибочный раунд до конца времени приносит очки.
        const finalScore = success ? score : 0;
        resultEl.innerHTML = `<div class="loading">Отправляем результат…</div>`;
        try {
            const result = await apiFetch("/api/bureaucrat/submit", { method: "POST", body: { points: finalScore } });
            let bodyText;
            if (!success) {
                bodyText = `<div class="profile-row" style="color:#ff9eb5">❌ Ошибка при раунде (набрано было ${score}, но очки не засчитаны) — попробуй ещё раз без единой ошибки!</div>`;
            } else {
                const gainedText = result.gained_rating_this_round > 0
                    ? ` +${result.gained_rating_this_round.toFixed(0)} к Рейтингу государства прямо сейчас!`
                    : ` Накоплено ${result.progress_points.toFixed(0)}/${result.points_needed_for_next} очков до следующего балла вклада.`;
                const bestText = result.best_score === finalScore && finalScore > 0 ? " Новый личный рекорд! 🏆" : "";
                bodyText = `
                    <div class="profile-row" style="color:#7ee787">✅ Раунд без единой ошибки — засчитано: ${finalScore}.${bestText}</div>
                    <div class="profile-dim" style="margin-top:4px">Спасибо, ваш вклад в развитие государства учтён.${gainedText} Продолжайте в том же духе — совместными усилиями мы поднимем Рейтинг страны!</div>
                `;
            }
            resultEl.innerHTML = bodyText;
        } catch (e) {
            resultEl.innerHTML = `<div class="error">${e.message}</div>`;
        }
        await loadStats(root);
        startBtn.disabled = false;
        startBtn.style.display = "";
        startBtn.textContent = `▶️ Сыграть ещё раз (${ROUND_SECONDS} сек)`;
    }

    roundTimer = setInterval(tickClock, 100);
    spawnDoc();
}
