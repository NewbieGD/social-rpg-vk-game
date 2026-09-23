import { apiFetch } from "../api.js";
import { renderHeistScreen } from "./heist.js";

const REQUEST_BUTTONS = [
    { label: "🚑 Вызвать скорую (болезнь или рана)", path: "/api/duty/ambulance" },
    { label: "🚒 Вызвать пожарного (пожар)", path: "/api/duty/call_firefighter" },
    { label: "🚨 Вызвать МЧС (спасение)", path: "/api/duty/call_rescue" },
    { label: "👮 Позвать полицию (ограбили)", path: "/api/duty/call_police" },
    { label: "📚 Пересдать экзамен (Завод/Такси/Курьер)", path: "/api/duty/request_reexam" },
    { label: "💊 Запросить рецепт на Таблетки", path: "/api/duty/request_prescription", cooldownField: "prescription_cooldown_seconds" },
    { label: "🏗 Восстановить дом (после пожара)", path: "/api/duty/request_repair" },
    { label: "🔧 Вызвать строителя (бытовая поломка)", path: "/api/duty/call_home_repair" },
    { label: "🏠 Повторить попытку постройки Квартиры", path: "/api/duty/retry_house_build" },
];

function formatCooldown(seconds) {
    const mins = Math.ceil(seconds / 60);
    return mins >= 60 ? `${Math.floor(mins / 60)}ч ${mins % 60}м` : `${mins} мин.`;
}

export async function renderDutyScreen(root) {
    root.innerHTML = `
        <div class="duty-banner">🚨 ЭКСТРЕННАЯ ПОМОЩЬ</div>
        <div class="title">Помощь</div>
        <div class="card">
            <div class="subtitle">Нажми, если ситуация подходит — заявка уйдёт случайному свободному специалисту. Если не подходит, backend просто объяснит, почему нельзя.</div>
            <div id="request-buttons"></div>
            <div id="request-result"></div>
        </div>
        <div class="card" id="heist-police-link-card"></div>
    `;

    let profile = {};
    try {
        profile = await apiFetch("/api/profile");
    } catch (e) {
        // не критично — просто не покажем кулдауны в этот раз
    }

    if (profile.profession === "police" && profile.stage === "worker") {
        await loadHeistPoliceCard(root);
    }

    const btnContainer = root.querySelector("#request-buttons");
    REQUEST_BUTTONS.forEach((r) => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        const cooldown = r.cooldownField ? profile[r.cooldownField] : null;
        if (cooldown) {
            btn.textContent = `${r.label} — ⏳ через ${formatCooldown(cooldown)}`;
            btn.disabled = true;
        } else {
            btn.textContent = r.label;
            btn.onclick = () => sendRequest(root, r.path);
        }
        btnContainer.appendChild(btn);
    });

    const snitchBtn = document.createElement("button");
    snitchBtn.className = "option-btn";
    snitchBtn.textContent = "🕵️ Настучать на известного вора";
    snitchBtn.onclick = () => sendSnitch(root);
    btnContainer.appendChild(snitchBtn);
}

async function sendSnitch(root) {
    const idText = prompt("VK ID вора, на которого доносишь:");
    if (!idText) return;
    const targetVkId = Number(idText);
    if (!Number.isFinite(targetVkId)) return;

    const resultEl = root.querySelector("#request-result");
    resultEl.innerHTML = `<div class="loading">Отправляем донос…</div>`;
    try {
        await apiFetch("/api/crime/snitch", { method: "POST", body: { target_vk_id: targetVkId } });
        resultEl.innerHTML = `<div class="profile-row" style="color:#7ee787">🕵️ Донос принят. Шанс поимки этого вора при следующем ограблении повышен.</div>`;
    } catch (e) {
        resultEl.innerHTML = `<div class="error">${e.message}</div>`;
    }
}

async function sendRequest(root, path) {
    const resultEl = root.querySelector("#request-result");
    resultEl.innerHTML = `<div class="loading">Отправляем заявку…</div>`;
    try {
        const result = await apiFetch(path, { method: "POST" });
        resultEl.innerHTML = `<div class="profile-row" style="color:#7ee787">✅ Заявка отправлена специалисту (ID ${result.professional_vk_id}), жди ответа.</div>`;
    } catch (e) {
        resultEl.innerHTML = `<div class="error">${e.message}</div>`;
    }
}

async function loadHeistPoliceCard(root) {
    const card = root.querySelector("#heist-police-link-card");
    let status;
    try {
        status = await apiFetch("/api/heist/status");
    } catch (e) {
        card.innerHTML = "";
        return;
    }
    if (!status.active) {
        card.innerHTML = "";
        return;
    }
    card.innerHTML = `
        <div class="subtitle">🛡 Воры готовят «Ограбление по крупному» — банк страны нужно защитить!</div>
        <button class="btn" id="heist-police-open-btn">Перейти к защите банка</button>
    `;
    card.querySelector("#heist-police-open-btn").onclick = () => {
        root.innerHTML = "";
        const backBtn = document.createElement("button");
        backBtn.className = "btn btn-secondary";
        backBtn.textContent = "🔙 Назад в Помощь";
        backBtn.onclick = () => renderDutyScreen(root);
        root.appendChild(backBtn);
        const content = document.createElement("div");
        root.appendChild(content);
        renderHeistScreen(content);
    };
}
