import { apiFetch } from "../api.js";

export async function renderPrisonScreen(root) {
    root.innerHTML = `<div class="loading">Загружаем…</div>`;

    let profile;
    try {
        profile = await apiFetch("/api/profile");
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    if (!profile.prison_until) {
        root.innerHTML = `<div class="title">🔒 Тюрьма</div><div class="card"><div class="subtitle">Ты не в заключении.</div></div>`;
        return;
    }

    const releaseDate = new Date(profile.prison_until);
    const secondsLeft = Math.max(0, Math.round((releaseDate - new Date()) / 1000));

    root.innerHTML = `
        <div class="title">🔒 Тюрьма</div>
        <div class="card">
            <div class="subtitle">Тебя поймали — сейчас ты отбываешь срок.</div>
            <div class="profile-row">⏳ Освобождение через: ${formatDuration(secondsLeft)}</div>
            <div class="profile-dim">Пока сидишь — недоступны работа, криминал и чаты. После освобождения вернёшься к своим прежним делам автоматически.</div>
        </div>
    `;
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours} ч ${minutes} мин`;
}
