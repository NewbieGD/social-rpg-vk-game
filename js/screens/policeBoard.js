// «Сводка полиции» — отдельная вкладка для полицейских и стажёров:
// подготовка Крупного ограбления воров и предложения взяток из тюрьмы.
import { apiFetch } from "../api.js";
import { loadBossStatus, bossCaseHtml, bindBossCase, custodyDealHtml, bindCustodyDeal } from "./bossPower.js";
import { screenHeader } from "../screenHeader.js";
import { infoButton, bindInfoButtons } from "../infoPopups.js";
import { loadBribeOffers } from "./work.js";
import { renderHeistScreen } from "./heist.js";

export async function renderPoliceBoardScreen(root) {
    root.innerHTML = `
        ${screenHeader({ scene: "floodlights", title: "Сводка полиции", sub: "Оперативная обстановка в городе", fallbackTitle: "🚔 Сводка полиции" })}
        <div class="card police-alert" id="police-heist"><div class="loading">Загружаем сводку…</div></div>
        <div id="police-boss-case"></div>
        <div id="bribe-offers"></div>
        <div class="card"><div class="profile-dim">Предложения взяток от заключённых появляются здесь и в разделе Работа. Взятка — всегда риск служебной проверки.</div></div>`;
    await Promise.all([loadHeist(root), loadBribeOffers(root), loadBossStatus().then((bs) => {
        const box = root.querySelector("#police-boss-case");
        if (box) box.innerHTML = bossCaseHtml(bs, "police");
    })]);
}

async function loadHeist(root) {
    const card = root.querySelector("#police-heist");
    let status, scale;
    try {
        [status, scale] = await Promise.all([apiFetch("/api/heist/status"), apiFetch("/api/heist/scale_status")]);
    } catch (e) {
        card.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }
    if (status.active) {
        card.classList.add("police-alert-active");
        card.innerHTML = `
            <div class="police-siren">🚨</div>
            <div class="subtitle">Воры идут на банк страны! ${infoButton("heist")}</div>
            <div class="profile-dim">Собирайся на защиту — очки полиции против очков воров.</div>
            <button class="btn" id="police-heist-open">🛡 Защищать банк</button>`;
        card.querySelector("#police-heist-open").onclick = () => {
            root.innerHTML = "";
            const back = document.createElement("button");
            back.className = "btn btn-secondary";
            back.textContent = "🔙 Назад в Сводку";
            back.onclick = () => renderPoliceBoardScreen(root);
            root.appendChild(back);
            const content = document.createElement("div");
            root.appendChild(content);
            renderHeistScreen(content);
        };
    } else {
        const pct = Math.min(100, Math.round((scale.progress / scale.threshold) * 100));
        card.innerHTML = `
            <div class="subtitle">🕶 Воры готовят крупное ограбление ${infoButton("heist")}</div>
            <div class="profile-dim" style="margin-bottom:6px">${scale.progress} / ${scale.threshold} успешных ограблений всех воров страны. Когда шкала заполнится — начнётся налёт на банк, и полиции нужно будет его отбить.</div>
            <div class="progress-bar police-heist-bar"><div class="progress-bar-fill" style="width:${pct}%"></div></div>`;
    }
    bindInfoButtons(card);
}
