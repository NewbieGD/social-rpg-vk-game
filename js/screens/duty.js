import { apiFetch } from "../api.js";

const REQUEST_BUTTONS = [
    { label: "🚑 Вызвать скорую (болезнь)", path: "/api/duty/ambulance" },
    { label: "🚒 Вызвать пожарного (пожар)", path: "/api/duty/call_firefighter" },
    { label: "👮 Позвать полицию (ограбили)", path: "/api/duty/call_police" },
    { label: "📚 Пересдать экзамен (Завод/Такси/Курьер)", path: "/api/duty/request_reexam" },
    { label: "🖥 Починить IT-подписку", path: "/api/duty/request_it_fix" },
    { label: "⚖️ Нанять адвоката (200₭, из тюрьмы)", path: "/api/duty/request_defense" },
    { label: "🏗 Восстановить дом (после пожара)", path: "/api/duty/request_repair" },
];

export async function renderDutyScreen(root) {
    root.innerHTML = `
        <div class="duty-banner">🚨 ЭКСТРЕННАЯ ПОМОЩЬ</div>
        <div class="title">Помощь</div>
        <div class="card">
            <div class="subtitle">Нажми, если ситуация подходит — заявка уйдёт случайному свободному специалисту. Если не подходит, backend просто объяснит, почему нельзя.</div>
            <div id="request-buttons"></div>
            <div id="request-result"></div>
        </div>
    `;

    const btnContainer = root.querySelector("#request-buttons");
    REQUEST_BUTTONS.forEach((r) => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        btn.textContent = r.label;
        btn.onclick = () => sendRequest(root, r.path);
        btnContainer.appendChild(btn);
    });

    const prosecutionBtn = document.createElement("button");
    prosecutionBtn.className = "option-btn";
    prosecutionBtn.textContent = "⚖️ Обвинить вора в суде (он сейчас в тюрьме)";
    prosecutionBtn.onclick = () => sendProsecution(root);
    btnContainer.appendChild(prosecutionBtn);

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

async function sendProsecution(root) {
    const idText = prompt("VK ID вора, который сейчас в тюрьме:");
    if (!idText) return;
    const thiefVkId = Number(idText);
    if (!Number.isFinite(thiefVkId)) return;

    const resultEl = root.querySelector("#request-result");
    resultEl.innerHTML = `<div class="loading">Отправляем заявку…</div>`;
    try {
        const result = await apiFetch("/api/duty/request_prosecution", { method: "POST", body: { thief_vk_id: thiefVkId } });
        resultEl.innerHTML = `<div class="profile-row" style="color:#7ee787">✅ Заявка отправлена юристу (ID ${result.professional_vk_id}), жди ответа.</div>`;
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
