import { apiFetch } from "../api.js";
import { showGamePopupWithContent, showGameStylePopup } from "../gamePopup.js";
import { playSuccessSound, playFailSound, burstConfetti } from "../fx.js";

const REWARD_TEXT = { 0: "🥇 Награда: 3000₭", 1: "🥈 Награда: 2000₭", 2: "🥉 Награда: 1000₭" };

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
    root.querySelector("#event-help-btn").onclick = () => tryStartMinigame(root);
}

async function tryStartMinigame(root) {
    // Вкладка могла провисеть открытой давно (без обновления страницы) —
    // сверяем актуальный статус ПРЯМО ПЕРЕД стартом игры, а не полагаемся
    // на то, что было при последней прорисовке экрана.
    let fresh;
    try {
        fresh = await apiFetch("/api/national_event/status");
    } catch (e) {
        showGameStylePopup("❌ Не получилось", e.message);
        return;
    }
    if (!fresh.active || fresh.status !== "active") {
        showGameStylePopup("🎉 Уже не актуально", "Событие уже завершилось (кто-то добил последние очки раньше). Обновляем экран.");
        await renderNationalEventScreen(root);
        return;
    }
    startFireMinigame(root, fresh);
}

function renderShowcase(root, status) {
    root.innerHTML = `
        <div class="event-banner event-banner-victory">
            <div class="event-banner-title">🎉 Событие завершено!</div>
            <div class="event-banner-desc">Страна справилась общими усилиями. Эта вкладка исчезнет через ${Math.ceil((status.cooldown_seconds_left || 0) / 60)} мин.</div>
            <div class="subtitle" style="margin-top:12px">🏆 Топ-10 участников</div>
            <div id="event-leaderboard"></div>
        </div>
    `;
    const list = root.querySelector("#event-leaderboard");
    (status.leaderboard || []).forEach((p, i) => {
        const row = document.createElement("div");
        row.className = "event-leaderboard-row event-leaderboard-row-clickable";
        const name = p.username ? "@" + escapeHtmlEvent(p.username) : "ID " + p.vk_id;
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
        const reward = REWARD_TEXT[i] ? ` <span class="event-reward-tag">${REWARD_TEXT[i]}</span>` : "";
        row.innerHTML = `${medal} ${name} — ${p.points} очков${reward}`;
        row.onclick = () => showEventPlayerProfile(p.vk_id);
        list.appendChild(row);
    });
    if (!(status.leaderboard || []).length) {
        list.innerHTML = `<div class="profile-dim">Данных пока нет.</div>`;
    }
}

async function showEventPlayerProfile(vkId) {
    const { content } = showGamePopupWithContent(null, (c) => {
        c.innerHTML = `<div class="loading">Загружаем профиль…</div>`;
    });
    try {
        const p = await apiFetch(`/api/map/player/${vkId}`);
        content.innerHTML = `
            <div class="title">${p.username ? "@" + escapeHtmlEvent(p.username) : "ID " + p.vk_id}</div>
            <div class="profile-row">💼 ${escapeHtmlEvent(p.display_profession)}</div>
            <div class="profile-row">⭐ Рейтинг: ${p.rating.toFixed(2)}</div>
            <div class="profile-row">⚔️ Побед в дуэлях: ${p.duel_wins}</div>
        `;
    } catch (e) {
        content.innerHTML = `<div class="error">${e.message}</div>`;
    }
}

// ---------- мини-игра: тушим падающие огоньки ----------

const GAME_WIDTH = 320;
const GAME_HEIGHT = 420;
const EMBER_SIZE = 44;
const SPAWN_INTERVAL_MS = 700;
const FALL_DURATION_MS = 3200;
const EVENT_STATUS_CHECK_MS = 4000; // как часто проверяем, не завершил ли событие кто-то другой, пока мы играем

function startFireMinigame(root, status) {
    let score = 0;
    let gameOver = false;
    let spawnTimer = null;
    let statusCheckTimer = null;
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

    function stopTimers() {
        clearInterval(spawnTimer);
        clearInterval(statusCheckTimer);
        embers.forEach((e) => clearInterval(e._fallInterval));
    }

    function endGame(manualStop) {
        if (gameOver) return;
        gameOver = true;
        stopTimers();
        if (!manualStop) playFailSound();
        submitScore(root, score, overlay);
    }

    // Пока мы играем, кто-то ДРУГОЙ мог уже добить событие — проверяем
    // периодически и, если так, сразу останавливаем игру и засчитываем
    // то, что успели набрать (см. пункт про "разногласия" очков).
    statusCheckTimer = setInterval(async () => {
        if (gameOver) return;
        try {
            const fresh = await apiFetch("/api/national_event/status");
            if (!fresh.active || fresh.status !== "active") {
                gameOver = true;
                stopTimers();
                overlay.remove();
                showGameStylePopup("🎉 Событие уже завершено!", `Кто-то другой добил последние очки раньше. Твои ${score} очков в этот раз не потребовались — событие уже закрыто.`);
                await renderNationalEventScreen(root);
            }
        } catch (e) {
            // не критично — проверим на следующем цикле
        }
    }, EVENT_STATUS_CHECK_MS);

    spawnTimer = setInterval(spawnEmber, SPAWN_INTERVAL_MS);
    spawnEmber();

    overlay.querySelector(".profile-overlay-close").addEventListener("click", () => {
        if (!gameOver) endGame(true);
    });
}

async function submitScore(root, score, overlay) {
    if (score <= 0) {
        showGameStylePopup("😔 Не в этот раз", "Ни одного огонька не потушено — попробуй ещё раз.");
        return;
    }
    try {
        const result = await apiFetch("/api/national_event/help", { method: "POST", body: { points: score } });
        overlay.remove();
        const counted = result.counted_points;
        const wastedNote = counted < score
            ? ` (засчиталось ${counted} из ${score} — остальное уже не требовалось, шкала была почти заполнена)`
            : "";
        if (result.event_completed) {
            playSuccessSound();
            burstConfetti(document.body, 60);
            showGameStylePopup("🎉 Победа!", `Твой вклад стал решающим${wastedNote} — событие завершено! Спасибо за помощь стране.`);
        } else if (counted === 0) {
            showGameStylePopup("🎉 Уже не актуально", "Событие завершилось, пока ты играл(а) — твои очки в этот раз не потребовались.");
        } else {
            showGameStylePopup("✅ Зачтено!", `Потушено огоньков: ${score}${wastedNote}. Внесено в общую шкалу события (${result.progress}/${result.target}).`);
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
