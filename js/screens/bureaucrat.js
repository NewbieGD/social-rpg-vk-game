// «Бюрократ»: разложи документы по лоткам. Механика прежняя (30 сек, 2,2 сек
// на документ, одна ошибка или опоздание — раунд сгорает, максимум 40 очков),
// новое — оформление: стол чиновника, живые бумаги, штампы, часы, отчёт.
import { apiFetch } from "../api.js";
import { screenHeader } from "../screenHeader.js";
import { playSuccessSound, playFailSound, burstConfetti } from "../fx.js";

const ROUND_SECONDS = 30;
const DOC_TIME_LIMIT_MS = 2200;
const MAX_POINTS_PER_ROUND = 40;
const POINTS_PER_RATING = 100; // синхронно с government_rating.GAME_POINTS_PER_RATING на backend — только для текста правил

const DOC_TYPES = [
    { code: "tax", label: "Налоговая", title: "ДЕКЛАРАЦИЯ", icon: "🧾", color: "#e0b23a" },
    { code: "health", label: "Минздрав", title: "МЕДСПРАВКА", icon: "🩺", color: "#e05a5a" },
    { code: "social", label: "Соцзащита", title: "ЗАЯВЛЕНИЕ", icon: "🧓", color: "#4a90d9" },
    { code: "police", label: "Полиция", title: "ПРОТОКОЛ", icon: "👮", color: "#5ac97a" },
];

export async function renderBureaucratScreen(root) {
    root.innerHTML = `
        ${screenHeader({ scene: "office", title: "Бюрократ", sub: "Разбери документы — помоги стране", fallbackTitle: "🗂 Бюрократ" })}
        <div class="bur-memo">
            <div class="bur-memo-head">СЛУЖЕБНАЯ ЗАПИСКА</div>
            <div class="bur-memo-text">Раскладывай документы по лоткам своих ведомств, пока не кончилось время. Цвет полосы на бумаге совпадает с цветом лотка.</div>
            <ul class="bur-memo-list">
                <li>Один неверный лоток или опоздание с документом — раунд сразу заканчивается, очки за него <b>сгорают</b>.</li>
                <li>Засчитывается только раунд без единой ошибки до конца ${ROUND_SECONDS} секунд.</li>
                <li>${POINTS_PER_RATING} очков = <b>+1 балл</b> к Рейтингу государства. За раунд — не больше ${MAX_POINTS_PER_ROUND}.</li>
                <li>Очки не дают денег или личного рейтинга — только общий вклад страны.</li>
            </ul>
            <div class="bur-memo-stats" id="bureaucrat-stats"></div>
            <div class="bur-memo-stamp">К ИСПОЛНЕНИЮ</div>
        </div>
        <button class="btn bur-start" id="bureaucrat-start-btn">📂 Начать смену (${ROUND_SECONDS} сек)</button>
        <div id="bureaucrat-game-area"></div>
        <div id="bureaucrat-result"></div>
    `;
    root.querySelector("#bureaucrat-start-btn").onclick = () => startRound(root);
    await loadStats(root);
}

async function loadStats(root) {
    const statsEl = root.querySelector("#bureaucrat-stats");
    try {
        const stats = await apiFetch("/api/bureaucrat/my_stats");
        statsEl.innerHTML = `${stats.last_score !== null ? `Прошлая смена: <b>${stats.last_score}</b> · ` : ""}Личный рекорд: <b>${stats.best_score}</b>`;
    } catch (e) {
        statsEl.textContent = "";
    }
}

function clockSvg() {
    const ticks = Array.from({ length: 12 }, (_, i) => `<line x1="0" y1="-25" x2="0" y2="${i % 3 ? -22 : -20}" stroke="#3a2a1a" stroke-width="${i % 3 ? 1.2 : 2}" transform="rotate(${i * 30})"/>`).join("");
    return `<svg viewBox="-32 -32 64 64" class="bur-clock" aria-hidden="true">
        <circle r="30" fill="#6e4a2a"/><circle r="27" fill="#f4ecd8"/>${ticks}
        <path id="bur-clock-sector" d="" fill="rgba(214,69,69,.18)"/>
        <line id="bur-clock-hand" x1="0" y1="4" x2="0" y2="-23" stroke="#b8323a" stroke-width="2" stroke-linecap="round"/>
        <circle r="2.6" fill="#3a2a1a"/></svg>`;
}

function docHtml(doc, n) {
    const lines = Array.from({ length: 4 }, (_, i) => `<span class="bur-line" style="width:${55 + ((n * 7 + i * 13) % 40)}%"></span>`).join("");
    return `<div class="bur-paper" style="--doc:${doc.color}">
        <div class="bur-paper-stripe"></div>
        <div class="bur-paper-head"><span class="bur-paper-icon">${doc.icon}</span><div><div class="bur-paper-title">${doc.title}</div><div class="bur-paper-dept">${doc.label} · № ${1000 + n * 37}</div></div></div>
        <div class="bur-paper-lines">${lines}</div>
        <div class="bur-paper-sign">подпись ________</div>
        <div class="bur-paper-corner"></div>
        <div class="bur-doc-timer"><div class="bur-doc-timer-fill"></div></div>
    </div>`;
}

function startRound(root) {
    const startBtn = root.querySelector("#bureaucrat-start-btn");
    startBtn.disabled = true;
    startBtn.style.display = "none";
    const gameArea = root.querySelector("#bureaucrat-game-area");
    const resultEl = root.querySelector("#bureaucrat-result");
    resultEl.innerHTML = "";

    let score = 0;
    let streak = 0;
    let timeLeftMs = ROUND_SECONDS * 1000;
    let docTimer = null;
    let roundTimer = null;
    let currentDoc = null;
    let docN = 0;
    let ended = false;

    gameArea.innerHTML = `
        <div class="bur-desk">
            <div class="bur-lamp"><span class="bur-lamp-glow"></span></div>
            <div class="bur-tea"><span class="bur-steam"></span><span class="bur-steam bur-steam-2"></span></div>
            <div class="bur-phone">☎</div>
            <div class="bur-stack bur-stack-1"></div><div class="bur-stack bur-stack-2"></div>
            <div class="bur-hud">
                <div class="bur-score"><span>Принято</span><b id="bureaucrat-score">0</b></div>
                <div class="bur-streak" id="bur-streak"></div>
                ${clockSvg()}
            </div>
            <div class="bur-blotter"><div class="bur-doc-slot" id="bureaucrat-doc-slot"></div></div>
            <div class="bur-trays" id="bureaucrat-trays"></div>
        </div>`;

    const trayRow = gameArea.querySelector("#bureaucrat-trays");
    DOC_TYPES.forEach((type) => {
        const tray = document.createElement("button");
        tray.className = "bur-tray";
        tray.dataset.code = type.code;
        tray.style.setProperty("--doc", type.color);
        tray.innerHTML = `<span class="bur-tray-papers"></span><span class="bur-tray-plate"><span class="bur-tray-icon">${type.icon}</span>${type.label}</span>`;
        tray.onclick = () => handleTrayClick(type.code, tray);
        trayRow.appendChild(tray);
    });

    const hand = gameArea.querySelector("#bur-clock-hand");
    const sector = gameArea.querySelector("#bur-clock-sector");
    const clock = gameArea.querySelector(".bur-clock");

    function spawnDoc() {
        if (ended) return;
        currentDoc = DOC_TYPES[Math.floor(Math.random() * DOC_TYPES.length)];
        docN++;
        const slot = gameArea.querySelector("#bureaucrat-doc-slot");
        slot.innerHTML = docHtml(currentDoc, docN);
        const paper = slot.firstElementChild;
        paper.style.setProperty("--tilt", `${(Math.random() * 6 - 3).toFixed(1)}deg`);
        paper.querySelector(".bur-doc-timer-fill").style.animationDuration = `${DOC_TIME_LIMIT_MS}ms`;
        clearTimeout(docTimer);
        docTimer = setTimeout(() => {
            // не успел разобрать вовремя — ошибка, раунд сгорает (как и неверный лоток)
            stampPaper("ПРОСРОЧЕНО");
            playFailSound();
            endRound(false);
        }, DOC_TIME_LIMIT_MS);
    }

    function stampPaper(text, ok = false) {
        const paper = gameArea.querySelector(".bur-paper");
        if (!paper) return;
        paper.insertAdjacentHTML("beforeend", `<div class="bur-stamp ${ok ? "bur-stamp-ok" : "bur-stamp-bad"}">${text}</div>`);
        if (!ok) paper.classList.add("bur-paper-shake");
    }

    function flyToTray(tray) {
        const paper = gameArea.querySelector(".bur-paper");
        if (!paper) return;
        const from = paper.getBoundingClientRect(), to = tray.getBoundingClientRect();
        const ghost = paper.cloneNode(true);
        ghost.classList.add("bur-ghost");
        ghost.querySelector(".bur-doc-timer")?.remove();
        ghost.insertAdjacentHTML("beforeend", `<div class="bur-stamp bur-stamp-ok">ПРИНЯТО</div>`);
        Object.assign(ghost.style, { position: "fixed", left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, margin: 0, zIndex: 50 });
        document.body.appendChild(ghost);
        const dx = to.left + to.width / 2 - (from.left + from.width / 2);
        const dy = to.top + to.height / 2 - (from.top + from.height / 2);
        ghost.animate([
            { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1 },
            { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 60}px) scale(0.6) rotate(-8deg)`, opacity: 1, offset: 0.5 },
            { transform: `translate(${dx}px, ${dy}px) scale(0.18) rotate(-14deg)`, opacity: 0.2 },
        ], { duration: 380, easing: "cubic-bezier(.3,.7,.4,1)" }).onfinish = () => ghost.remove();
        tray.classList.remove("bur-tray-hit");
        void tray.offsetWidth;
        tray.classList.add("bur-tray-hit");
        tray.insertAdjacentHTML("beforeend", `<span class="bur-plus">+1</span>`);
        setTimeout(() => tray.querySelector(".bur-plus")?.remove(), 700);
    }

    function handleTrayClick(code, tray) {
        if (ended || !currentDoc) return;
        if (code === currentDoc.code) {
            score = Math.min(MAX_POINTS_PER_ROUND, score + 1);
            streak++;
            playSuccessSound();
            flyToTray(tray);
            const scoreEl = gameArea.querySelector("#bureaucrat-score");
            scoreEl.textContent = score;
            scoreEl.classList.remove("bur-bump");
            void scoreEl.offsetWidth;
            scoreEl.classList.add("bur-bump");
            const st = gameArea.querySelector("#bur-streak");
            if (streak >= 5 && streak % 5 === 0) {
                st.innerHTML = `<span class="bur-streak-pop">Серия ×${streak}!</span>`;
            } else if (streak >= 5) {
                st.textContent = `Серия ×${streak}`;
            }
            spawnDoc();
        } else {
            stampPaper("ОТКАЗ");
            tray.classList.add("bur-tray-wrong");
            playFailSound();
            endRound(false);
        }
    }

    function tickClock() {
        timeLeftMs -= 100;
        const frac = Math.max(0, timeLeftMs) / (ROUND_SECONDS * 1000);
        const ang = (1 - frac) * 360;
        hand.setAttribute("transform", `rotate(${ang.toFixed(1)})`);
        const a = (ang - 90) * Math.PI / 180;
        sector.setAttribute("d", ang > 0.5 ? `M0 0 L0 -26 A26 26 0 ${ang > 180 ? 1 : 0} 1 ${(26 * Math.cos(a)).toFixed(2)} ${(26 * Math.sin(a)).toFixed(2)} Z` : "");
        clock.classList.toggle("bur-clock-hurry", timeLeftMs <= 10000);
        if (timeLeftMs <= 0) endRound(true);
    }

    async function endRound(success) {
        if (ended) return;
        ended = true;
        clearTimeout(docTimer);
        clearInterval(roundTimer);
        const finalScore = success ? score : 0;
        // даём увидеть штамп и встряску, потом убираем стол
        await new Promise((r) => setTimeout(r, success ? 200 : 750));
        gameArea.innerHTML = "";
        resultEl.innerHTML = `<div class="loading">Отправляем отчёт…</div>`;
        try {
            const result = await apiFetch("/api/bureaucrat/submit", { method: "POST", body: { points: finalScore } });
            const best = success && result.best_score === finalScore && finalScore > 0;
            const gained = result.gained_rating_this_round > 0
                ? `<div class="bur-report-gain">+${result.gained_rating_this_round.toFixed(0)} к Рейтингу государства!</div>`
                : `<div class="profile-dim">До следующего балла вклада: ${result.progress_points.toFixed(0)} из ${result.points_needed_for_next}.</div>`;
            resultEl.innerHTML = `
                <div class="bur-report ${success ? "" : "bur-report-bad"}">
                    <div class="bur-report-head">ОТЧЁТ О РАБОТЕ</div>
                    <div class="bur-report-row"><span>Документов разобрано</span><b>${score}</b></div>
                    <div class="bur-report-row"><span>Засчитано</span><b>${finalScore}</b></div>
                    ${success
                        ? `${best ? `<div class="bur-report-best">🏆 Новый личный рекорд!</div>` : ""}${gained}
                           <div class="profile-dim">Спасибо за службу. Совместными усилиями мы поднимем Рейтинг страны!</div>`
                        : `<div class="profile-dim">В смене была ошибка — по регламенту очки не засчитаны. Попробуйте без единой ошибки!</div>`}
                    <div class="bur-report-stamp ${success ? "bur-stamp-ok" : "bur-stamp-bad"}">${success ? "ПРИНЯТО" : "ОТКАЗАНО"}</div>
                </div>`;
            if (success && finalScore > 0) burstConfetti(resultEl.querySelector(".bur-report"), best ? 36 : 18);
        } catch (e) {
            resultEl.innerHTML = `<div class="error">${e.message}</div>`;
        }
        await loadStats(root);
        startBtn.disabled = false;
        startBtn.style.display = "";
        startBtn.textContent = `📂 Новая смена (${ROUND_SECONDS} сек)`;
    }

    roundTimer = setInterval(tickClock, 100);
    spawnDoc();
}
