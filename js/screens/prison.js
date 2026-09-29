// Тюрьма: сцена камеры (решётка, койка, окно, палочки на стене по
// отсиженным часам), охранник за столом с часами обратного отсчёта,
// соседи по камерам. Охранник — подкуп, дверь — побег. Картинки — в
// js/prisonAssets.js.
import { apiFetch } from "../api.js";
import { screenHeader } from "../screenHeader.js";
import { showGamePopupWithContent, showGameStylePopup } from "../gamePopup.js";
import { avatarHtml } from "../cosmeticFrames.js";
import { infoButton, bindInfoButtons } from "../infoPopups.js";
import { PRISON_ASSETS } from "../prisonAssets.js";

let clockTimer = null;

export async function renderPrisonScreen(root) {
    if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
    root.innerHTML = `<div class="loading">Загружаем…</div>`;
    let st;
    try {
        st = await apiFetch("/api/prison/status");
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    const header = screenHeader({ scene: "police", title: "Тюрьма", sub: st.in_prison ? "Отбываешь срок" : "Под присмотром полиции", fallbackTitle: "🔒 Тюрьма" });
    root.innerHTML = `
        ${header}
        ${sceneHtml(st)}
        ${st.in_prison ? actionsHtml(st) : `<div class="card"><div class="subtitle">Ты не в заключении ${infoButton("prison")}</div><div class="profile-dim">Здесь сидят пойманные воры. У каждого есть шанс выйти раньше — подкупом или побегом.</div></div>`}
    `;
    bindInfoButtons(root);

    root.querySelectorAll("[data-neighbour]").forEach((el) => {
        el.onclick = async () => {
            const { renderOtherProfile } = await import("./profile.js");
            renderOtherProfile(document.getElementById("app"), Number(el.dataset.neighbour));
        };
    });
    if (!st.in_prison) return;

    const bribeBtn = root.querySelector("#bribe-btn");
    const escapeBtn = root.querySelector("#escape-btn");
    const openBribe = () => { if (!st.bribe_used) showBribePopup(root, st); };
    const openEscape = () => { if (!st.escape_used) showEscapeIntro(root, st); };
    if (bribeBtn) bribeBtn.onclick = openBribe;
    if (escapeBtn) escapeBtn.onclick = openEscape;
    const guard = root.querySelector(".prison-guard");
    const door = root.querySelector(".prison-door");
    if (guard) guard.onclick = openBribe;
    if (door) door.onclick = openEscape;

    // часы на стене — живой обратный отсчёт; раз в 20 секунд сверяемся с сервером
    const until = new Date(st.prison_until).getTime();
    const clockEl = root.querySelector("#prison-clock");
    let ticks = 0;
    clockTimer = setInterval(() => {
        if (!root.isConnected) { clearInterval(clockTimer); clockTimer = null; return; }
        const left = Math.max(0, Math.round((until - Date.now()) / 1000));
        if (clockEl) clockEl.textContent = formatClock(left);
        ticks++;
        if (left === 0 || ticks % 20 === 0) renderPrisonScreen(root);
    }, 1000);
}

// ---------- Сцена ----------
function sceneHtml(st) {
    const bg = PRISON_ASSETS.background ? ` style="background-image:url('${PRISON_ASSETS.background}')"` : "";
    const served = st.in_prison && st.prison_started_at
        ? Math.floor((Date.now() - new Date(st.prison_started_at).getTime()) / 3600000)
        : 0;
    const left = st.in_prison ? Math.max(0, Math.round((new Date(st.prison_until).getTime() - Date.now()) / 1000)) : 0;
    const img = (src, cls) => `<img src="${src}" alt="" class="${cls}">`;

    const neighbours = (st.neighbours || []).map((n) => `
        <button class="prison-neighbour" data-neighbour="${n.vk_id}" title="${escapeAttr(n.name)}">
            <span class="prison-neighbour-bars"></span>
            ${avatarHtml(n.photo_url, n.active_frame, false)}
            <span class="prison-neighbour-name">${escapeHtml(n.name)}</span>
        </button>`).join("");

    return `
        <div class="prison-scene"${bg}>
            ${PRISON_ASSETS.background ? "" : `
            <div class="prison-wall"></div>
            <div class="prison-window"><span></span></div>
            <div class="prison-tally" aria-label="Отсижено часов: ${served}">${tallyMarks(served)}</div>
            <div class="prison-sink"></div>`}
            <div class="prison-bunk">${PRISON_ASSETS.bunk ? img(PRISON_ASSETS.bunk, "prison-img") : `<span class="prison-bunk-frame"></span><span class="prison-bunk-mattress"></span><span class="prison-bunk-pillow"></span>`}</div>
            <div class="prison-bars"></div>
            <button class="prison-door" ${st.in_prison && !st.escape_used ? "" : "disabled"} aria-label="Побег">
                ${PRISON_ASSETS.door ? img(PRISON_ASSETS.door, "prison-img") : `<span class="prison-lock">🔒</span>`}
            </button>
            <div class="prison-post">
                <div class="prison-clock-face">
                    <div class="prison-clock-label">${st.in_prison ? "до свободы" : "камера свободна"}</div>
                    <div class="prison-clock" id="prison-clock">${st.in_prison ? formatClock(left) : "—"}</div>
                </div>
                <button class="prison-guard" ${st.in_prison && !st.bribe_used ? "" : "disabled"} aria-label="Охранник">
                    ${PRISON_ASSETS.guard ? img(PRISON_ASSETS.guard, "prison-img") : guardSvg()}
                </button>
            </div>
        </div>
        ${neighbours ? `<div class="prison-neighbours"><span class="cafe-counter-label">В соседних камерах:</span>${neighbours}</div>` : ""}`;
}

function guardSvg() {
    return `<svg viewBox="0 0 110 100" class="prison-guard-svg" aria-hidden="true">
        <circle cx="30" cy="16" r="10" fill="#ffd08a" opacity="0.25"/>
        <line x1="22" y1="56" x2="30" y2="20" stroke="#6d6a5a" stroke-width="3"/>
        <path d="M22 18 L38 18 L34 26 L26 26 Z" fill="#6d6a5a"/>
        <path d="M40 76 C40 50 48 42 60 42 C72 42 80 50 80 76 Z" fill="#2f3a55"/>
        <circle cx="60" cy="32" r="10" fill="#e8c4a0"/>
        <rect x="48" y="20" width="24" height="7" rx="2" fill="#1d2640"/>
        <rect x="52" y="17" width="16" height="5" rx="1" fill="#2f3a55"/>
        <rect x="56" y="52" width="8" height="8" rx="1" fill="#d4af37"/>
        <rect x="6" y="72" width="100" height="10" fill="#6e4a3a"/>
        <rect x="12" y="82" width="6" height="18" fill="#5a3a2a"/><rect x="92" y="82" width="6" height="18" fill="#5a3a2a"/>
        <rect x="84" y="62" width="10" height="10" rx="2" fill="#efe6d8"/>
        <circle cx="98" cy="40" r="5" fill="none" stroke="#b8ae9b" stroke-width="2"/>
        <line x1="98" y1="45" x2="96" y2="54" stroke="#b8ae9b" stroke-width="2"/><line x1="98" y1="45" x2="101" y2="53" stroke="#b8ae9b" stroke-width="2"/>
    </svg>`;
}

function tallyMarks(n) {
    const shown = Math.min(n, 30);
    let out = "";
    for (let g = 0; g < Math.ceil(shown / 5); g++) {
        const inGroup = Math.min(5, shown - g * 5);
        out += `<span class="tally-group">${"<i></i>".repeat(Math.min(4, inGroup))}${inGroup === 5 ? "<b></b>" : ""}</span>`;
    }
    return out;
}

// ---------- Действия ----------
function actionsHtml(st) {
    const b = st.bribe;
    const bribeState = !st.bribe_used ? ""
        : b && b.status === "pending" ? `⏳ Взятка ${b.amount.toFixed(2)} ₭ ждёт ответа полицейского (до часа). Деньги заморожены.`
        : b && b.status === "refused" ? "🚫 Полицейский отказался — +1 час к сроку, деньги вернулись."
        : b && b.status === "expired" ? "⌛ Никто не ответил — деньги вернулись. Попытка за этот срок использована."
        : "Попытка подкупа за этот срок использована.";
    return `
        <div class="card prison-actions">
            <div class="subtitle">Как выйти раньше ${infoButton("prison")}</div>
            <div class="prison-action">
                <button class="btn" id="bribe-btn" ${st.bribe_used ? "disabled" : ""}>💰 Подкупить полицейского</button>
                ${infoButton("bribe")}
            </div>
            ${bribeState ? `<div class="profile-dim">${bribeState}</div>` : `<div class="profile-dim">Согласится — выйдешь сразу. Откажет — +1 час, деньги вернутся.</div>`}
            <div class="prison-action">
                <button class="btn btn-secondary" id="escape-btn" ${st.escape_used ? "disabled" : ""}>🏃 Попытаться сбежать</button>
                ${infoButton("escape")}
            </div>
            <div class="profile-dim">${st.escape_used ? "Попытка побега за этот срок использована." : "Трудно. Успех — свобода, провал — +1 час."}</div>
        </div>`;
}

function showBribePopup(root, st) {
    showGamePopupWithContent("💰 Подкуп полицейского", (content) => {
        content.innerHTML = `
            <div class="profile-dim">Сколько предложишь? Сумма сразу заморозится на основном балансе (тайник не считается). У тебя сейчас: <b>${st.balance.toFixed(2)} ₭</b>.</div>
            <ul class="prison-rules">
                <li>Согласится — ты сразу на свободе.</li>
                <li>Откажет — деньги вернутся, но +1 час к сроку.</li>
                <li>Никто не ответит за час — деньги вернутся без штрафа.</li>
                <li>Попытка одна за срок.</li>
            </ul>
            <input type="number" min="1" step="1" class="text-input" id="bribe-amount" placeholder="Сумма в ₭">
            <button class="btn" id="bribe-send" style="margin-top:10px">Предложить взятку</button>
            <div id="bribe-result"></div>`;
        content.querySelector("#bribe-send").onclick = async () => {
            const amount = Number(content.querySelector("#bribe-amount").value);
            const res = content.querySelector("#bribe-result");
            if (!amount || amount <= 0) { res.innerHTML = `<div class="error">Впиши сумму больше нуля</div>`; return; }
            res.innerHTML = `<div class="loading">…</div>`;
            try {
                await apiFetch("/api/prison/bribe", { method: "POST", body: { amount } });
                res.innerHTML = `<div class="profile-row" style="color:#7ee787">✅ Предложение ушло случайному полицейскому. Ждём ответа.</div>`;
                content.querySelector("#bribe-send").disabled = true;
                renderPrisonScreen(root);
            } catch (e) {
                res.innerHTML = `<div class="error">${escapeHtml(e.message)}</div>`;
            }
        };
    });
}

// ---------- Побег: прокрасться мимо охранника ----------
function showEscapeIntro(root, st) {
    showGamePopupWithContent("🏃 Побег", (content) => {
        content.innerHTML = `
            <div class="profile-dim">Держи «Красться» — идёшь вперёд, отпустил — замер. Охранник то стоит спиной, то оборачивается. Вздрогнул — «!» — сразу замри. Иногда он только делает вид.</div>
            <ul class="prison-rules">
                <li>Двигался, когда он смотрит, — поймали.</li>
                <li>Не дошёл за ${st.escape_rules.time_limit} секунд — поймали.</li>
                <li>Успех — свобода. Провал — +1 час к сроку.</li>
                <li>Попытка одна за срок — начав, отменить нельзя.</li>
            </ul>
            <button class="btn" id="escape-go">Начать побег</button>`;
        content.querySelector("#escape-go").onclick = async () => {
            const overlay = content.closest(".profile-overlay");
            let game;
            try {
                game = await apiFetch("/api/prison/escape/start", { method: "POST" });
            } catch (e) {
                content.insertAdjacentHTML("beforeend", `<div class="error">${escapeHtml(e.message)}</div>`);
                return;
            }
            if (overlay) overlay.remove();
            runEscapeGame(root, game);
        };
    });
}

function runEscapeGame(root, game) {
    const overlay = document.createElement("div");
    overlay.className = "escape-overlay";
    overlay.innerHTML = `
        <div class="escape-box">
            <div class="escape-hud"><span>🏃 Побег</span><span id="escape-time">${game.time_limit}.0 с</span></div>
            <div class="escape-corridor">
                <div class="escape-light" id="escape-light"></div>
                <div class="escape-exit">EXIT</div>
                <div class="escape-guard" id="escape-guard">${PRISON_ASSETS.escapeGuard ? `<img src="${PRISON_ASSETS.escapeGuard}" alt="">` : "👮"}<span class="escape-alert" id="escape-alert">!</span></div>
                <div class="escape-runner" id="escape-runner">${PRISON_ASSETS.escapeRunner ? `<img src="${PRISON_ASSETS.escapeRunner}" alt="">` : "🧍"}</div>
                <div class="escape-track"><div class="escape-progress" id="escape-progress"></div></div>
            </div>
            <div class="escape-state" id="escape-state">Охранник стоит спиной…</div>
            <button class="btn escape-hold" id="escape-hold">Красться (держи)</button>
        </div>`;
    document.body.appendChild(overlay);

    const runner = overlay.querySelector("#escape-runner");
    const guardEl = overlay.querySelector("#escape-guard");
    const light = overlay.querySelector("#escape-light");
    const alertEl = overlay.querySelector("#escape-alert");
    const stateEl = overlay.querySelector("#escape-state");
    const timeEl = overlay.querySelector("#escape-time");
    const progressEl = overlay.querySelector("#escape-progress");
    const holdBtn = overlay.querySelector("#escape-hold");

    let pos = 0;
    let holding = false;
    let finished = false;
    const start = performance.now();
    // Охранник: спиной -> вздрогнул (!) -> либо смотрит, либо обманный манёвр
    let guard = "away";
    let guardUntil = start + rand(1200, 2600);

    const press = (v) => (e) => { e.preventDefault(); holding = v; };
    holdBtn.addEventListener("pointerdown", press(true));
    holdBtn.addEventListener("pointerup", press(false));
    holdBtn.addEventListener("pointerleave", press(false));
    holdBtn.addEventListener("pointercancel", press(false));
    const key = (v) => (e) => { if (e.code === "Space") { e.preventDefault(); holding = v; } };
    const kd = key(true), ku = key(false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);

    let last = start;
    function frame(now) {
        if (finished) return;
        const dt = (now - last) / 1000;
        last = now;

        if (now >= guardUntil) {
            if (guard === "away") { guard = "turning"; guardUntil = now + rand(300, 480); }
            else if (guard === "turning") {
                if (Math.random() < 0.3) { guard = "away"; guardUntil = now + rand(900, 2200); }
                else { guard = "looking"; guardUntil = now + rand(700, 1500); }
            } else { guard = "away"; guardUntil = now + rand(1100, 2600); }
        }
        guardEl.classList.toggle("escape-guard-look", guard === "looking");
        light.classList.toggle("escape-light-on", guard === "looking");
        alertEl.classList.toggle("escape-alert-on", guard === "turning");
        stateEl.textContent = guard === "looking" ? "СМОТРИТ! Замри!" : guard === "turning" ? "Вздрогнул…" : "Стоит спиной — иди!";
        stateEl.className = `escape-state escape-state-${guard}`;

        if (holding) {
            if (guard === "looking") return end(false, "Охранник тебя заметил!");
            pos = Math.min(game.distance, pos + game.speed * dt);
        }
        runner.style.left = `${4 + (pos / game.distance) * 76}%`;
        runner.classList.toggle("escape-runner-moving", holding);
        progressEl.style.width = `${(pos / game.distance) * 100}%`;

        const left = game.time_limit - (now - start) / 1000;
        timeEl.textContent = `${Math.max(0, left).toFixed(1)} с`;
        if (pos >= game.distance) return end(true, "Ты выскользнул(а) за дверь!");
        if (left <= 0) return end(false, "Время вышло — охрана подняла тревогу.");
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    async function end(success, text) {
        finished = true;
        window.removeEventListener("keydown", kd);
        window.removeEventListener("keyup", ku);
        let result = success ? "escaped" : "caught";
        try {
            const r = await apiFetch("/api/prison/escape/finish", { method: "POST", body: { token: game.token, success } });
            result = r.status;
        } catch (e) { /* итог всё равно покажем */ }
        overlay.remove();
        if (result === "escaped") showGameStylePopup("🎉 Свобода!", `${text} Ты сбежал(а) из тюрьмы.`);
        else showGameStylePopup("🚨 Поймали!", `${success ? "Охрана заметила подозрительно быстрый побег." : text} К сроку добавлен 1 час.`);
        renderPrisonScreen(root);
    }
}

function rand(a, b) { return a + Math.random() * (b - a); }

function formatClock(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str ?? "");
    return div.innerHTML;
}

function escapeAttr(str) {
    return String(str ?? "").replace(/"/g, "&quot;");
}
