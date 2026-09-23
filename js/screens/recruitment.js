import { apiFetch } from "../api.js";
import { renderOtherProfile } from "./profile.js";
import { showGamePopupWithContent } from "../gamePopup.js";

export async function renderRecruitmentScreen(root) {
    root.innerHTML = `<div class="title">👥 Вербовка</div><div class="loading">Загружаем список…</div>`;

    let data;
    try {
        data = await apiFetch("/api/recruitment/candidates");
    } catch (e) {
        root.innerHTML = `<div class="title">👥 Вербовка</div><div class="error">${e.message}</div>`;
        return;
    }

    const rows = data.candidates.map((c) => `
        <div class="crime-candidate-row">
            <span class="crime-candidate-name" data-vkid="${c.vk_id}">${escapeHtml(c.username ? "@" + c.username : "ID " + c.vk_id)}${c.profession_name ? ` — ${escapeHtml(c.profession_name)}` : ""}</span>
            <button class="btn btn-secondary crime-candidate-choose" data-vkid="${c.vk_id}">Выбрать жителя</button>
        </div>
    `).join("");

    root.innerHTML = `
        <div class="title">👥 Вербовка</div>
        <div class="card">
            <div class="subtitle">Список из 20 случайных честных граждан — обновляется раз в сутки.${data.has_detailed_list ? "" : " Купи «Список вербовки» на чёрном рынке, чтобы видеть профессии и переходить в профиль."}</div>
            <div id="candidate-list">${rows}</div>
        </div>
    `;

    if (data.has_detailed_list) {
        root.querySelectorAll(".crime-candidate-name").forEach((el) => {
            el.style.cursor = "pointer";
            el.style.color = "#8fd3ff";
            el.onclick = () => renderOtherProfile(document.getElementById("app"), Number(el.dataset.vkid));
        });
    }

    root.querySelectorAll(".crime-candidate-choose").forEach((btn) => {
        btn.onclick = () => confirmSendOffer(root, Number(btn.dataset.vkid));
    });
}

function confirmSendOffer(root, targetVkId) {
    showGamePopupWithContent("🕵️ Завербовать гражданина?", (content) => {
        content.innerHTML = `
            <div class="profile-dim" style="margin-bottom:12px">Вы действительно хотите попробовать завербовать данного гражданина? Записка расходуется в любом случае — и при согласии, и при отказе.</div>
            <button class="btn" id="confirm-yes">✅ Да, отправить записку</button>
            <div id="offer-send-result"></div>
        `;
        content.querySelector("#confirm-yes").onclick = async () => {
            const resultEl = content.querySelector("#offer-send-result");
            resultEl.innerHTML = `<div class="loading">Отправляем записку…</div>`;
            try {
                await apiFetch("/api/recruitment/send_offer", { method: "POST", body: { target_vk_id: targetVkId } });
                resultEl.innerHTML = `<div class="profile-row" style="color:#7ee787">✅ Записка отправлена!</div>`;
            } catch (e) {
                resultEl.innerHTML = `<div class="error">${e.message}</div>`;
            }
        };
    });
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
