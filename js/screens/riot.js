import { apiFetch } from "../api.js";

export async function renderRiotScreen(root) {
    root.innerHTML = `<div class="loading">Загружаем…</div>`;

    let activeStatus;
    try {
        activeStatus = await apiFetch("/api/active_riot_status");
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    if (activeStatus.active) {
        renderLiveRiot(root, activeStatus);
        return;
    }

    let status;
    try {
        status = await apiFetch("/api/riot_petition");
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    renderPetition(root, status);
}

function renderLiveRiot(root, s) {
    const startTime = new Date(s.started_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    const totalDuels = s.army_suppressing_wins + s.rioters_wins;

    root.innerHTML = `
        <div class="riot-active-banner">🔥 БУНТ ИДЁТ ПРЯМО СЕЙЧАС</div>
        <div class="title">Бунт</div>
        <div class="card">
            <div class="subtitle">📊 Текущая статистика</div>
            <div class="profile-row">🕐 Начался: ${startTime}</div>
            <div class="profile-row">🔥 Бастующих: ${s.rioters_count}</div>
            <div class="profile-row">🎖 Военных всего: ${s.army_total} · определились: ${s.army_acted}</div>
        </div>
        <div class="card">
            <div class="subtitle">⚔️ Счёт дуэлей</div>
            <div class="profile-row">🎖 Победы армии: ${s.army_suppressing_wins} · 🔥 Победы бунтующих: ${s.rioters_wins}</div>
            <div class="riot-progress-track">
                <div class="riot-progress-fill-army" style="width:${totalDuels > 0 ? (s.army_suppressing_wins / totalDuels) * 100 : 50}%"></div>
            </div>
            <div class="profile-dim">🕊 Военных, которые примкнули к бунтующим (не сражаются, ждут итог): ${s.army_joined_riot}</div>
        </div>
        <div class="card">
            <div class="subtitle">Пока идёт бунт — недоступны работа, магазин, рынок и вызов помощи. Как только все военные определятся (или пройдёт 12 часов), бунт разрешится сам, и страна вернётся к обычной жизни.</div>
        </div>
    `;
}

function renderPetition(root, status) {
    const needed = status.threshold_count;
    const progressPct = status.population > 0 ? Math.min(100, Math.round((status.yes_votes / needed) * 100)) : 0;

    root.innerHTML = `
        <div class="title">🔥 Бунт</div>
        <div class="card">
            <div class="subtitle">📜 Хроника действий президента</div>
            <div id="track-record"></div>
        </div>
        <div class="card">
            <div class="subtitle">Устроить бунт?</div>
            <div class="profile-dim">Это не голосование на время — как только «за» наберёт ${(status.threshold_fraction * 100).toFixed(0)}% от ВСЕГО населения страны, бунт начинается сразу, без ожидания. Голос можно менять в любой момент.</div>
            <div class="profile-row">🔥 За: ${status.yes_votes} · ✋ Против: ${status.no_votes} · Нужно для старта: ${needed} из ${status.population} чел.</div>
            <div class="riot-progress-track"><div class="riot-progress-fill" style="width:${progressPct}%"></div></div>
            <div class="profile-dim">Твой текущий голос: ${status.own_vote === "yes" ? "🔥 За бунт" : status.own_vote === "no" ? "✋ Против" : "ещё не голосовал(а)"}</div>
            <button class="btn" id="vote-yes">🔥 Да, устроить бунт</button>
            <button class="btn btn-secondary" id="vote-no">✋ Нет</button>
            <div id="vote-result"></div>
        </div>
        <div class="card">
            <div class="subtitle">⚠️ Последствия</div>
            <div class="profile-dim">${status.consequences.if_suppressed}</div>
            <div class="profile-dim" style="margin-top:6px">${status.consequences.if_riot_wins}</div>
        </div>
    `;

    const trackRecord = root.querySelector("#track-record");
    if (status.president_track_record.length === 0) {
        trackRecord.innerHTML = `<div class="profile-dim">Пока заметных событий не было.</div>`;
    } else {
        status.president_track_record.forEach((e) => {
            const row = document.createElement("div");
            row.className = "profile-dim";
            const time = new Date(e.created_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
            row.textContent = `${time} — ${e.text}`;
            trackRecord.appendChild(row);
        });
    }

    root.querySelector("#vote-yes").onclick = () => vote(root, "yes");
    root.querySelector("#vote-no").onclick = () => vote(root, "no");
}

async function vote(root, choice) {
    const resultEl = root.querySelector("#vote-result");
    resultEl.innerHTML = `<div class="loading">Голосуем…</div>`;
    try {
        const result = await apiFetch("/api/riot_petition/vote", { method: "POST", body: { choice } });
        if (result.status === "riot_triggered") {
            resultEl.innerHTML = `<div class="profile-row" style="color:#ff6b81">🔥 Бунт начался! ${result.rioters_count} бастующих вышли на улицы.</div>`;
            setTimeout(() => renderRiotScreen(root), 1500);
            return;
        }
        const updated = await apiFetch("/api/riot_petition");
        renderPetition(root, updated);
    } catch (e) {
        resultEl.innerHTML = `<div class="error">${e.message}</div>`;
    }
}
