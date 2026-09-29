// Общий мини-игровой движок "тапни цель, пока не исчезла" — та же механика,
// что в js/screens/heist.js, но вынесена отдельно и обобщена, чтобы её можно
// было надеть на любое действие (дежурные заявки, в будущем — что угодно ещё).
//
// ВАЖНО: этот мини-раунд НИЧЕГО не решает сам — итог заявки по-прежнему
// считает сервер (см. bot/duty_router.py), как и раньше. Раунд запускается
// ДО настоящего запроса к серверу и служит только тому, чтобы игрок реально
// что-то сделал руками, а не просто нажал одну кнопку. Если/когда захотите,
// чтобы результат раунда (hits/misses) реально влиял на шанс успеха —
// это отдельная правка на бэкенде (новый параметр в вызове accept), сюда
// её сознательно не добавляли, чтобы не трогать баланс игры втихую.

import { playSuccessSound } from "./fx.js";

const DEFAULT_TARGET_LIFETIME_MS = 900;
const DEFAULT_SPAWN_INTERVAL_MS = 550;
const DEFAULT_ROUND_MS = 3200;
const DEFAULT_TARGET_COUNT = 5;

/**
 * Показывает короткий раунд "тапни N целей" внутри переданного контейнера.
 * container — обычный div, который эта функция полностью заполнит и потом
 * очистит сама. Возвращает Promise<{hits, misses}>, который разрешается,
 * когда раунд закончился (по времени или по числу целей).
 *
 * opts:
 *   emoji        — что тапать (по умолчанию "🎯")
 *   label        — короткая подпись над полем ("Поймай нужные бумаги!")
 *   targetCount  — сколько целей всего должно появиться за раунд
 *   roundMs      — общая длительность раунда, если не набрал targetCount раньше
 *   fieldClass   — доп. CSS-класс на поле (для темы, необязательно)
 */
export function playReactionMinigame(container, opts = {}) {
    const emoji = opts.emoji || "🎯";
    const label = opts.label || "Тапни цели, пока не исчезли!";
    const targetCount = opts.targetCount || DEFAULT_TARGET_COUNT;
    const roundMs = opts.roundMs || DEFAULT_ROUND_MS;
    const spawnMs = opts.spawnIntervalMs || DEFAULT_SPAWN_INTERVAL_MS;
    const lifetimeMs = opts.targetLifetimeMs || DEFAULT_TARGET_LIFETIME_MS;
    const fieldClass = opts.fieldClass || "";

    return new Promise((resolve) => {
        container.innerHTML = `
            <div class="mini-rx-label">${label}</div>
            <div class="mini-rx-hud">
                <span id="mini-rx-hits">✅ 0/${targetCount}</span>
                <span id="mini-rx-timer" class="mini-rx-timer"></span>
            </div>
            <div class="mini-rx-field ${fieldClass}" id="mini-rx-field"></div>
        `;

        const field = container.querySelector("#mini-rx-field");
        const hitsEl = container.querySelector("#mini-rx-hits");
        const timerEl = container.querySelector("#mini-rx-timer");

        let hits = 0;
        let misses = 0;
        let spawned = 0;
        let ended = false;
        const startedAt = Date.now();

        function finish() {
            if (ended) return;
            ended = true;
            clearInterval(spawnTimer);
            clearInterval(clockTimer);
            field.innerHTML = "";
            resolve({ hits, misses });
        }

        function spawnTarget() {
            if (ended || spawned >= targetCount) return;
            spawned += 1;
            const target = document.createElement("div");
            target.className = "mini-rx-target";
            target.textContent = emoji;
            target.style.left = `${Math.random() * 82}%`;
            target.style.top = `${Math.random() * 68}%`;
            let resolved = false;
            target.onclick = () => {
                if (ended || resolved) return;
                resolved = true;
                hits += 1;
                hitsEl.textContent = `✅ ${hits}/${targetCount}`;
                playSuccessSound();
                target.classList.add("mini-rx-target-hit");
                setTimeout(() => target.remove(), 140);
                if (hits + misses >= targetCount) finish();
            };
            field.appendChild(target);
            setTimeout(() => {
                if (!target.isConnected || resolved) return;
                resolved = true;
                misses += 1;
                target.remove();
                if (hits + misses >= targetCount) finish();
            }, lifetimeMs);
        }

        const spawnTimer = setInterval(spawnTarget, spawnMs);
        spawnTarget();

        function tickClock() {
            const left = roundMs - (Date.now() - startedAt);
            if (left <= 0) {
                finish();
                return;
            }
            timerEl.textContent = `⏳ ${(left / 1000).toFixed(1)}с`;
        }
        const clockTimer = setInterval(tickClock, 100);
        tickClock();
    });
}

// Готовые темы для типов дежурных заявок — используются в js/screens/work.js.
export const DUTY_MINIGAME_THEMES = {
    doctor: { emoji: "💊", label: "Быстро подай нужные лекарства!" },
    firefighter: { emoji: "💧", label: "Туши искры, пока не разгорелось!" },
    police: { emoji: "🚨", label: "Лови сигналы с места ограбления!" },
    teacher: { emoji: "📖", label: "Проверь ответы, пока не кончилось время!" },
    repair: { emoji: "🔧", label: "Закрути все гайки на объекте!" },
    rescue: { emoji: "🧯", label: "Успей до того, как станет хуже!" },
};
