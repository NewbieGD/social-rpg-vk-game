import { apiFetch } from "../api.js";
import { showGamePopupWithContent, showGameStylePopup } from "../gamePopup.js";
import { playSuccessSound, playFailSound, burstConfetti } from "../fx.js";

export async function renderNationalEventScreen(root) {
    root.innerHTML = `<div class="loading">Загружаем…</div>`;
    let status;
    try {
        status = await apiFetch("/api/national_event/status");
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    if (!status.active) {
        root.innerHTML = `<div class="title">Сейчас всё спокойно</div><div class="profile-dim">Событий государственного масштаба сейчас нет.</div>`;
        return;
    }

    if (status.status === "cooldown") {
        renderShowcase(root, status);
        return;
    }

    renderActiveEvent(root, status);
}

function renderActiveEvent(root, status) {
    const pct = Math.min(100, Math.round((status.progress / status.target) * 100));
    root.innerHTML = `
        <div class="event-banner">
            <div class="event-banner-title">${status.title}</div>
            <div class="event-banner-desc">${escapeHtmlEvent(status.description)}</div>
            <div class="event-progress-wrap">
                <div class="event-progress-bar"><div class="event-progress-fill" style="width:${pct}%"></div></div>
                <div class="event-progress-text">${status.progress} / ${status.target}</div>
            </div>
            <button class="btn event-help-btn" id="event-help-btn">${status.help_label}</button>
        </div>
    `;
    root.querySelector("#event-help-btn").onclick = () => startFireMinigame(root, status);
}

function renderShowcase(root, status) {
    const rows = (status.leaderboard || []).map((p, i) => {
        const name = p.username ? "@" + escapeHtmlEvent(p.username) : "ID " + p.vk_id;
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
        return `<div class="event-leaderboard-row">${medal} ${name} — ${p.points} очков</div>`;
    }).join("");

    const minutesLeft = Math.ceil((status.cooldown_seconds_left || 0) / 60);
    root.innerHTML = `
        <div class="event-banner event-banner-victory">
            <div class="event-banner-title">🎉 Событие завершено!</div>
            <div class="event-banner-desc">Страна справилась общими усилиями. Эта вкладка исчезнет через ${minutesLeft} мин.</div>
            <div class="subtitle" style="margin-top:12px">🏆 Топ-10 участников</div>
            ${rows || `<div class="profile-dim">Данных пока нет.</div>`}
        </div>
    `;
}

// ---------- мини-игра: тушим падающие огоньки ----------

const GAME_WIDTH = 320;
const GAME_HEIGHT = 420;
const EMBER_SIZE = 44;
const SPAWN_INTERVAL_MS = 700;
const FALL_DURATION_MS = 3200;

function startFireMinigame(root, status) {
    let score = 0;
    let gameOver = false;
    let spawnTimer = null;
    const embers = [];

    const { content, overlay } = showGamePopupWithContent("🧯 Туши огонь!", (c) => {
        c.innerHTML = `
            <div class="profile-dim" style="margin-bottom:6px">Нажимай на огоньки, пока они не долетели донизу. Пропустишь один — игра закончится, а набранные очки уйдут в общую шкалу события.</div>
            <div class="event-game-score">Очки: <span id="game-score">0</span></div>
            <div class="event-game-field" id="game-field"></div>
        `;
    });

    const field = content.querySelector("#game-field");
    const scoreEl = content.querySelector("#game-score");

    function spawnEmber() {
        if (gameOver) return;
        const ember = document.createElement("div");
        ember.className = "event-ember";
        const x = Math.random() * (GAME_WIDTH - EMBER_SIZE);
        ember.style.left = `${x}px`;
        ember.style.top = `${-EMBER_SIZE}px`;
        ember.textContent = "🔥";
        field.appendChild(ember);
        embers.push(ember);

        const startTime = Date.now();
        ember._fallInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / FALL_DURATION_MS;
            if (progress >= 1) {
                clearInterval(ember._fallInterval);
                if (!ember._extinguished) {
                    endGame(false);
                }
                return;
            }
            ember.style.top = `${-EMBER_SIZE + progress * (GAME_HEIGHT + EMBER_SIZE)}px`;
        }, 30);

        ember.onclick = () => {
            if (ember._extinguished || gameOver) return;
            ember._extinguished = true;
            clearInterval(ember._fallInterval);
            score += 1;
            scoreEl.textContent = String(score);
            ember.remove();
        };
    }

    function endGame(manualStop) {
        if (gameOver) return;
        gameOver = true;
        clearInterval(spawnTimer);
        embers.forEach((e) => clearInterval(e._fallInterval));
        if (!manualStop) playFailSound();

        submitScore(root, status, score, overlay);
    }

    spawnTimer = setInterval(spawnEmber, SPAWN_INTERVAL_MS);
    spawnEmber();

    overlay.querySelector(".profile-overlay-close").addEventListener("click", () => {
        if (!gameOver) endGame(true);
    });
}

async function submitScore(root, status, score, overlay) {
    if (score <= 0) {
        showGameStylePopup("😔 Не в этот раз", "Ни одного огонька не потушено — попробуй ещё раз.");
        return;
    }
    try {
        const result = await apiFetch("/api/national_event/help", { method: "POST", body: { points: score } });
        overlay.remove();
        if (result.event_completed) {
            playSuccessSound();
            burstConfetti(document.body, 60);
            showGameStylePopup("🎉 Победа!", `Твои ${score} очков стали решающими — событие завершено! Спасибо за помощь стране.`);
        } else {
            showGameStylePopup("✅ Зачтено!", `Потушено огоньков: ${score}. Внесено в общую шкалу события (${result.progress}/${result.target}).`);
        }
        await renderNationalEventScreen(root);
    } catch (e) {
        showGameStylePopup("❌ Не получилось", e.message);
    }
}

function escapeHtmlEvent(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
