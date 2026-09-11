import { apiFetch } from "../api.js";

export async function renderModernizationScreen(root) {
    root.innerHTML = `<div class="loading">Загружаем…</div>`;

    let status, profile;
    try {
        [status, profile] = await Promise.all([
            apiFetch("/api/modernization/status"),
            apiFetch("/api/profile"),
        ]);
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    const isPresident = !!profile.is_president;

    root.innerHTML = `<div class="title">🏗 Модернизация государства</div><div id="mod-body"></div>`;
    const body = root.querySelector("#mod-body");

    if (status.active) {
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
            <div class="subtitle">🚧 Сейчас строится: ${escapeHtml(status.active.title)}</div>
            <div class="profile-row">⏳ Осталось: ${formatDuration(status.active.seconds_left)}</div>
        `;
        if (isPresident) {
            const accelBtn = document.createElement("button");
            accelBtn.className = "btn";
            accelBtn.textContent = "⚡ Ускорить (за счёт ЗРС)";
            const resultEl = document.createElement("div");
            accelBtn.onclick = () => proposeAccelerate(resultEl, accelBtn);
            card.appendChild(accelBtn);
            card.appendChild(resultEl);
        }
        body.appendChild(card);
    } else {
        body.innerHTML = `<div class="card"><div class="subtitle">Сейчас ничего не строится.</div></div>`;
    }

    const catalogCard = document.createElement("div");
    catalogCard.className = "card";
    catalogCard.innerHTML = `<div class="subtitle">📋 Доступные идеи развития</div>`;
    status.catalog.forEach((item) => {
        const row = document.createElement("div");
        row.className = "shop-item";
        row.innerHTML = `<div class="shop-item-name">${escapeHtml(item.title)}</div><div class="profile-dim">${escapeHtml(item.description)}</div>`;
        if (isPresident && !status.active) {
            const startBtn = document.createElement("button");
            startBtn.className = "btn btn-secondary";
            startBtn.textContent = "🏗 Начать модернизацию";
            const resultEl = document.createElement("div");
            startBtn.onclick = () => startModernization(item.code, item.title, resultEl, startBtn);
            row.appendChild(startBtn);
            row.appendChild(resultEl);
        }
        catalogCard.appendChild(row);
    });
    body.appendChild(catalogCard);
}

function formatDuration(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days} дн ${hours} ч`;
}

async function startModernization(code, title, resultEl, btn) {
    btn.disabled = true;
    resultEl.innerHTML = `<div class="loading">Запускаем…</div>`;
    try {
        await apiFetch("/api/president/modernization/start", { method: "POST", body: { code } });
        resultEl.innerHTML = `<div class="profile-row" style="color:#7ee787">✅ Модернизация «${escapeHtml(title)}» начата!</div>`;
    } catch (e) {
        resultEl.innerHTML = `<div class="error">${e.message}</div>`;
        btn.disabled = false;
    }
}

async function proposeAccelerate(resultEl, btn) {
    const hoursText = prompt("На сколько часов ускорить? (10 голосов из ЗРС = 1 час, потребуется одобрение граждан)");
    if (!hoursText) return;
    const hours = Number(hoursText);
    if (!Number.isFinite(hours) || hours <= 0) return;

    btn.disabled = true;
    resultEl.innerHTML = `<div class="loading">Отправляем на голосование…</div>`;
    try {
        const result = await apiFetch("/api/president/modernization/accelerate", { method: "POST", body: { hours } });
        resultEl.innerHTML = `<div class="profile-row" style="color:#7ee787">✅ Голосование запущено (потребуется ${result.cost.toFixed(0)} голосов из ЗРС, 24 часа на голосование).</div>`;
    } catch (e) {
        resultEl.innerHTML = `<div class="error">${e.message}</div>`;
        btn.disabled = false;
    }
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
