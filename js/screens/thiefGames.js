// Мини-игры вора.
// «Карманы»: 9 карманов, в трёх — кошельки (где — знает только сервер,
// каждый раз новые места), 3 попытки. Бонус +5/+10/+20₭ сверху к добыче.
// «Взлом сейфа»: в комнате жертвы сейф с тремя замками — стрелка крутится
// всё быстрее, сектор всё уже, нажать нужно, когда стрелка в секторе.
// Каждый вскрытый замок снижает шанс, что жертва узнает вора.
import { apiFetch } from "../api.js";
import { playSuccessSound, playFailSound, playCoinSound, burstConfetti, shakeElement } from "../fx.js";
import { THIEF_GAME_ASSETS } from "../thiefGameAssets.js";

// ---------- Карманы ----------
export function runPocketsGame(result) {
    return new Promise((resolve) => {
        const g = result.game;
        const overlay = document.createElement("div");
        overlay.className = "tg-overlay";
        overlay.innerHTML = `
            <div class="tg-box tg-pockets-box"${THIEF_GAME_ASSETS.pocketsBackground ? ` style="background-image:url('${THIEF_GAME_ASSETS.pocketsBackground}')"` : ""}>
                <div class="tg-title">🕵️ Карманы</div>
                <div class="tg-sub">Добыча <b>${result.amount.toFixed(2)} ₭</b> уже у тебя. В трёх карманах из девяти — кошельки. Открой три кармана:</div>
                <div class="tg-rules">1 кошелёк — <b>+${g.bonus[1]}₭</b> · 2 — <b>+${g.bonus[2]}₭</b> · все 3 — <b>+${g.bonus[3]}₭</b></div>
                <div class="tg-tries" id="tg-tries">${"<span class='tg-try'></span>".repeat(g.tries)}</div>
                <div class="tg-pockets" id="tg-pockets">
                    ${Array.from({ length: g.cells }, (_, i) => `
                        <button class="tg-pocket" data-cell="${i}" aria-label="Карман ${i + 1}">
                            <span class="tg-pocket-inside"></span>
                            <span class="tg-pocket-flap">${THIEF_GAME_ASSETS.pocket ? `<img src="${THIEF_GAME_ASSETS.pocket}" alt="">` : ""}</span>
                        </button>`).join("")}
                </div>
                <div class="tg-status" id="tg-status">Выбирай карман…</div>
                <button class="btn tg-done" id="tg-done" hidden>Забрать</button>
            </div>`;
        document.body.appendChild(overlay);

        const status = overlay.querySelector("#tg-status");
        const tries = overlay.querySelectorAll(".tg-try");
        let used = 0;
        let busy = false;
        let summary = null;

        const walletHtml = () => THIEF_GAME_ASSETS.wallet
            ? `<img src="${THIEF_GAME_ASSETS.wallet}" alt="" class="tg-wallet-img">`
            : `<svg viewBox="0 0 40 30" class="tg-wallet" aria-hidden="true">
                   <rect x="2" y="5" width="36" height="22" rx="4" fill="#8a5a2a"/>
                   <rect x="2" y="5" width="36" height="8" rx="4" fill="#a8703a"/>
                   <rect x="26" y="13" width="12" height="8" rx="2" fill="#6e4520"/>
                   <circle cx="31" cy="17" r="2" fill="#f2c46a"/>
                   <rect x="6" y="1" width="18" height="6" rx="1" fill="#7ee787"/>
               </svg>`;

        function reveal(btn, found, final = false) {
            btn.classList.add("tg-pocket-open", found ? "tg-pocket-win" : "tg-pocket-empty");
            if (final) btn.classList.add("tg-pocket-missed");
            btn.querySelector(".tg-pocket-inside").innerHTML = found ? walletHtml() : `<span class="tg-dust">💨</span>`;
            btn.disabled = true;
        }

        overlay.querySelectorAll(".tg-pocket").forEach((btn) => {
            btn.onclick = async () => {
                if (busy || summary) return;
                busy = true;
                let r;
                try {
                    r = await apiFetch("/api/crime/pickpocket/open", { method: "POST", body: { token: g.token, cell: Number(btn.dataset.cell) } });
                } catch (e) {
                    status.textContent = e.message;
                    busy = false;
                    return;
                }
                tries[used].classList.add("tg-try-used");
                used++;
                reveal(btn, r.found);
                if (r.found) {
                    playCoinSound();
                    burstConfetti(btn, 10);
                    status.innerHTML = `👛 Кошелёк! Найдено: <b>${r.found_count}</b>`;
                } else {
                    playFailSound();
                    status.textContent = "Пусто…";
                }
                if (r.done) {
                    summary = r;
                    // показываем, где были остальные кошельки
                    r.wallets.forEach((c) => {
                        const b = overlay.querySelector(`.tg-pocket[data-cell="${c}"]`);
                        if (b && !b.classList.contains("tg-pocket-open")) reveal(b, true, true);
                    });
                    overlay.querySelectorAll(".tg-pocket:not(.tg-pocket-open)").forEach((b) => { b.disabled = true; });
                    status.innerHTML = r.bonus
                        ? `Найдено кошельков: <b>${r.found_count}</b> → бонус <b>+${r.bonus}₭</b>`
                        : "Кошельки не найдены — остаётся базовая добыча.";
                    if (r.bonus) { playSuccessSound(); burstConfetti(overlay.querySelector(".tg-box"), 28); }
                    overlay.querySelector("#tg-done").hidden = false;
                }
                busy = false;
            };
        });
        overlay.querySelector("#tg-done").onclick = () => {
            overlay.remove();
            resolve(summary);
        };
    });
}

// ---------- Взлом сейфа ----------
export function runSafeGame(room) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "tg-overlay";
        const bg = THIEF_GAME_ASSETS[room.room === "house" ? "houseRoom" : "dormRoom"];
        overlay.innerHTML = `
            <div class="tg-box tg-room tg-room-${room.room}"${bg ? ` style="background-image:url('${bg}')"` : ""}>
                ${bg ? "" : `<div class="tg-room-wall"></div><div class="tg-room-frame"></div><div class="tg-room-lamp"><span></span></div><div class="tg-room-rug"></div>`}
                <div class="tg-title">🔫 Комната ${escapeHtml(room.victim_name)}</div>
                <div class="tg-sub">Вскрой сейф: жми, когда стрелка в зелёном секторе. У каждого замка одна попытка.</div>
                <div class="tg-rules">1 замок — <b>−1%</b> · 2 — <b>−2%</b> · все 3 — <b>−5%</b> к шансу, что жертва тебя узнает</div>
                <div class="tg-locks" id="tg-locks">${room.locks.map(() => `<span class="tg-lock">🔒</span>`).join("")}</div>
                <div class="tg-safe">
                    ${THIEF_GAME_ASSETS.safe ? `<img src="${THIEF_GAME_ASSETS.safe}" alt="" class="tg-safe-img">` : `<div class="tg-safe-body"><span class="tg-safe-hinge"></span><span class="tg-safe-hinge tg-safe-hinge-2"></span></div>`}
                    <svg viewBox="-60 -60 120 120" class="tg-dial" id="tg-dial" aria-hidden="true">
                        <circle r="52" fill="#2a2d36" stroke="#9aa0ad" stroke-width="4"/>
                        ${Array.from({ length: 36 }, (_, i) => `<line x1="0" y1="-47" x2="0" y2="${i % 3 ? -43 : -39}" stroke="#6d7280" stroke-width="1.5" transform="rotate(${i * 10})"/>`).join("")}
                        <path id="tg-sector" fill="rgba(126,231,135,0.55)" d=""/>
                        <line id="tg-needle" x1="0" y1="6" x2="0" y2="-44" stroke="#ff5a5f" stroke-width="4" stroke-linecap="round"/>
                        <circle r="8" fill="#b8ae9b"/>
                    </svg>
                </div>
                <div class="tg-status" id="tg-status">Замок 1 из ${room.locks.length}</div>
                <button class="btn tg-crack" id="tg-crack">Взломать!</button>
            </div>`;
        document.body.appendChild(overlay);

        const needle = overlay.querySelector("#tg-needle");
        const sectorEl = overlay.querySelector("#tg-sector");
        const dial = overlay.querySelector("#tg-dial");
        const status = overlay.querySelector("#tg-status");
        const lockEls = overlay.querySelectorAll(".tg-lock");
        const crackBtn = overlay.querySelector("#tg-crack");

        let lockIdx = 0;
        let opened = 0;
        let angle = 0;
        let target = 0;
        let paused = false;
        let finished = false;
        let last = performance.now();

        function setSector() {
            const half = room.locks[lockIdx].sector / 2;
            target = 40 + Math.random() * 280;
            sectorEl.setAttribute("d", arcPath(target - half, target + half, 44));
        }
        setSector();

        function frame(now) {
            if (finished) return;
            const dt = (now - last) / 1000;
            last = now;
            if (!paused) {
                angle = (angle + room.locks[lockIdx].speed * 360 * dt) % 360;
                needle.setAttribute("transform", `rotate(${angle})`);
            }
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);

        function attempt() {
            if (paused || finished) return;
            paused = true;
            const half = room.locks[lockIdx].sector / 2;
            const diff = Math.abs(((angle - target + 540) % 360) - 180);
            const ok = diff <= half;
            lockEls[lockIdx].textContent = ok ? "🔓" : "❌";
            lockEls[lockIdx].classList.add(ok ? "tg-lock-open" : "tg-lock-fail");
            dial.classList.remove("tg-dial-ok", "tg-dial-fail");
            void dial.getBoundingClientRect();
            dial.classList.add(ok ? "tg-dial-ok" : "tg-dial-fail");
            if (ok) { opened++; playSuccessSound(); } else { playFailSound(); shakeElement(dial); }
            status.textContent = ok ? "Щёлк! Замок поддался." : "Сорвалось…";
            lockIdx++;
            setTimeout(() => {
                if (lockIdx >= room.locks.length) {
                    finished = true;
                    status.innerHTML = opened ? `Вскрыто замков: <b>${opened}</b> из ${room.locks.length}` : "Ни один замок не поддался — берёшь что лежит на виду.";
                    if (opened === room.locks.length) burstConfetti(overlay.querySelector(".tg-box"), 30);
                    crackBtn.textContent = "Забрать добычу";
                    crackBtn.onclick = () => { overlay.remove(); resolve(opened); };
                    return;
                }
                setSector();
                status.textContent = `Замок ${lockIdx + 1} из ${room.locks.length} — быстрее!`;
                paused = false;
            }, 750);
        }
        crackBtn.onclick = attempt;
        dial.addEventListener("pointerdown", attempt);
    });
}

function arcPath(fromDeg, toDeg, r) {
    const p = (deg) => {
        const a = (deg - 90) * Math.PI / 180;
        return `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
    };
    const large = toDeg - fromDeg > 180 ? 1 : 0;
    return `M 0 0 L ${p(fromDeg)} A ${r} ${r} 0 ${large} 1 ${p(toDeg)} Z`;
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str ?? "");
    return div.innerHTML;
}
