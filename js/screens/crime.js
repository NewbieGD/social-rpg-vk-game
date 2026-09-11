import { apiFetch } from "../api.js";
import { playFailSound, playCoinSound, shakeElement } from "../fx.js";

export async function renderCrimeScreen(root) {
    root.innerHTML = `<div class="loading">Загружаем…</div>`;

    let profile;
    try {
        profile = await apiFetch("/api/profile");
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    if (profile.stage === "prison") {
        root.innerHTML = `
            <div class="title">🚨 Криминал</div>
            <div class="card"><div class="subtitle">⛓ Ты в тюрьме — сначала нужно освободиться.</div></div>
        `;
        return;
    }

    if (profile.stage !== "criminal") {
        root.innerHTML = `
            <div class="title">🚨 Криминал</div>
            <div class="card"><div class="subtitle">Этот раздел доступен только преступникам.</div></div>
        `;
        return;
    }

    root.innerHTML = `
        <div class="title">🚨 Криминал</div>
        <div class="card">
            <div class="subtitle">
                🔫 Ограбление — крупная добыча (15–40% баланса жертвы), но риск растёт с каждой попыткой за день.<br><br>
                🕵️ Карманная кража — мелкая добыча (2–8%, максимум 30₭), риск поимки всего 5% и не растёт, можно делать до 5 раз в день.
            </div>
            <button class="btn" id="rob-btn">🔫 Ограбить</button>
            <button class="btn btn-secondary" id="pickpocket-btn">🕵️ Карманная кража</button>
            <div id="crime-result"></div>
        </div>
    `;

    root.querySelector("#rob-btn").onclick = () => doCrime(root, "/api/crime/rob", "rob");
    root.querySelector("#pickpocket-btn").onclick = () => doCrime(root, "/api/crime/pickpocket", "pickpocket");
}

async function doCrime(root, path, kind) {
    const resultEl = root.querySelector("#crime-result");
    resultEl.innerHTML = `<div class="loading">…</div>`;

    let result;
    try {
        result = await apiFetch(path, { method: "POST" });
    } catch (e) {
        resultEl.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    resultEl.innerHTML = formatResult(result, kind);

    if (result.status === "caught") {
        playFailSound();
        shakeElement(resultEl);
    } else if (result.status === "success") {
        playCoinSound();
    }
}

function formatResult(result, kind) {
    if (result.status === "blocked") {
        return `<div class="profile-row" style="color:#ffb454">🌶 Жертва отбилась перцовым баллончиком — попытка сорвалась.</div>`;
    }

    if (result.status === "caught") {
        const pctText = result.confiscated_pct ? `, конфисковано ${result.confiscated_pct.toFixed(0)}% баланса` : "";
        return `<div class="error">🚨 Поймали! В тюрьме ${result.prison_hours} ч.${pctText}</div>`;
    }

    if (result.status === "success" && kind === "pickpocket") {
        return `<div class="profile-row" style="color:#7ee787">🕵️ Незаметно стащил(а) ${result.amount.toFixed(2)}₭. Осталось попыток сегодня: ${result.attempts_left}.</div>`;
    }

    if (result.status === "success" && result.loot_type === "item") {
        return `<div class="profile-row" style="color:#7ee787">🎁 Украдена вещь: ${escapeHtml(result.item_name)}!</div>`;
    }

    if (result.status === "success" && result.loot_type === "money") {
        const immuneText = result.immune_used ? " (была неприкосновенность — риска не было)" : "";
        return `<div class="profile-row" style="color:#7ee787">💰 Добыча: ${result.robber_share.toFixed(2)}₭${immuneText}</div>`;
    }

    return `<div class="profile-dim">Готово.</div>`;
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
