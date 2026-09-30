import { apiFetch } from "../api.js";
import { screenHeader } from "../screenHeader.js";
import { renderOtherProfile } from "./profile.js";
import { showGamePopupWithContent } from "../gamePopup.js";

export async function renderRecruitmentScreen(root) {
    root.innerHTML = `${screenHeader({ scene: "blackmarket", title: "Вербовка", sub: "Найди новых воров", fallbackTitle: "👥 Вербовка" })}<div class="loading">Загружаем список…</div>`;

    let data;
    try {
        data = await apiFetch("/api/recruitment/candidates");
    } catch (e) {
        root.innerHTML = `${screenHeader({ scene: "blackmarket", title: "Вербовка", sub: "Найди новых воров", fallbackTitle: "👥 Вербовка" })}<div class="error">${e.message}</div>`;
        return;
    }

    const initials = (c) => (c.username || String(c.vk_id)).replace("@", "").slice(0, 2).toUpperCase();
    const rows = data.candidates.map((c, i) => `
        <div class="dossier-card ${c.traitor ? "dossier-traitor" : ""}" style="animation-delay:${i * 35}ms">
            <div class="dossier-photo">${c.traitor ? "🐍" : escapeHtml(initials(c))}</div>
            <div class="dossier-info">
                <span class="crime-candidate-name dossier-name" data-vkid="${c.vk_id}">${escapeHtml(c.username ? "@" + c.username : "ID " + c.vk_id)}</span>
                <span class="dossier-prof">${c.traitor ? "ПРЕДАТЕЛЬ — " : ""}${c.profession_name ? escapeHtml(c.profession_name) : "профессия скрыта"}</span>
            </div>
            <button class="btn btn-secondary crime-candidate-choose" data-vkid="${c.vk_id}">Выбрать</button>
        </div>
    `).join("");

    const mark = data.black_mark;
    const markBanner = !mark ? "" : mark.found
        ? `<div class="card mark-banner mark-found"><div class="subtitle">🐍 Предатель найден!</div><div class="profile-dim">Экс-Босс <b>${escapeHtml(mark.found.name)}</b> прятался среди граждан — теперь он ${escapeHtml(mark.found.profession)}. Все воры получили весть, началась охота.</div></div>`
        : `<div class="card mark-banner"><div class="subtitle">🖤 Чёрная метка</div><div class="profile-dim">${mark.checked_now ? "Этот список проверен — предателя в нём нет." : "Этот список уже проверялся."} Осталось зарядов: <b>${mark.charges_left}</b>. Новый список — после следующей вербовки.</div></div>`;

    root.innerHTML = `
        ${screenHeader({ scene: "blackmarket", title: "Вербовка", sub: "Найди новых воров", fallbackTitle: "👥 Вербовка" })}
        ${markBanner}
        <div class="card dossier-card-wrap">
            <div class="subtitle">📁 Досье на 20 честных граждан</div>
            <div class="profile-dim">Список обновляется раз в сутки и после каждой вербовки.${data.has_detailed_list ? " Нажми на имя — откроется профиль." : " Купи «Список вербовки» на чёрном рынке, чтобы видеть профессии и открывать профили."}</div>
            <div id="candidate-list" class="dossier-grid">${rows}</div>
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
