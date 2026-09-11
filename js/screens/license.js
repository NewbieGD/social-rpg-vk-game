import { apiFetch } from "../api.js";
import { burstConfetti, playSuccessSound, playFailSound, shakeElement } from "../fx.js";

export async function renderLicenseScreen(root) {
    root.innerHTML = `<div class="loading">Загружаем…</div>`;

    let status;
    try {
        status = await apiFetch("/api/license/status");
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    if (status.has_license) {
        root.innerHTML = `
            <div class="title">🪪 Права (ВУ)</div>
            <div class="card">
                <div class="profile-row" style="color:#7ee787">✅ У тебя есть права — можно покупать Машину в магазине.</div>
            </div>
        `;
        return;
    }

    if (status.exam_passed) {
        root.innerHTML = `
            <div class="title">🪪 Права (ВУ)</div>
            <div class="card">
                <div class="profile-row" style="color:#7ee787">✅ Экзамен сдан на отлично!</div>
                <div class="subtitle">Осталось купить сами права в 🛍 Магазине.</div>
            </div>
        `;
        return;
    }

    if (!status.can_retry) {
        root.innerHTML = `
            <div class="title">🪪 Права (ВУ)</div>
            <div class="card">
                <div class="profile-row">❌ Экзамен не сдан.</div>
                <div class="subtitle">Пересдача будет доступна через ${formatDuration(status.seconds_left)}.</div>
            </div>
        `;
        return;
    }

    root.innerHTML = `
        <div class="title">🪪 Права (ВУ)</div>
        <div class="card">
            <div class="subtitle">5 вопросов по ПДД РФ. Чтобы сдать — нужно ответить правильно на все 5. Если хоть один неверный — пересдача через сутки.</div>
            <button class="btn" id="start-btn">🚗 Начать экзамен</button>
        </div>
    `;
    root.querySelector("#start-btn").onclick = () => loadQuestion(root);
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours} ч ${minutes} мин`;
}

async function loadQuestion(root) {
    root.innerHTML = `<div class="loading">Загружаем вопрос…</div>`;
    let q;
    try {
        q = await apiFetch("/api/license/question");
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    if (q.finished) {
        root.innerHTML = `<div class="card">Экзамен уже завершён. Обнови страницу.</div>`;
        return;
    }

    root.innerHTML = `
        <div class="card">
            <div class="subtitle">Вопрос ${q.index + 1} из ${q.total}</div>
            <div class="question-text">${escapeHtml(q.text)}</div>
            <div id="options"></div>
        </div>
    `;
    const optionsEl = root.querySelector("#options");
    q.options.forEach((opt) => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        btn.textContent = opt.text;
        btn.onclick = () => submitAnswer(root, q.index, opt.index);
        optionsEl.appendChild(btn);
    });
}

async function submitAnswer(root, questionIndex, optionIndex) {
    root.innerHTML = `<div class="loading">Проверяем…</div>`;
    let result;
    try {
        result = await apiFetch("/api/license/answer", {
            method: "POST",
            body: { question_index: questionIndex, option_index: optionIndex },
        });
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    if (!result.finished) {
        await loadQuestion(root);
        return;
    }

    if (result.passed) {
        root.innerHTML = `
            <div class="card">
                <div class="result-outcome">✅ Экзамен сдан на отлично! (${result.correct_count}/${result.total})</div>
                <div class="subtitle">В 🛍 Магазине появились Права (ВУ) — можно купить.</div>
                <button class="btn" onclick="location.reload()">Продолжить</button>
            </div>
        `;
        const card = root.querySelector(".card");
        playSuccessSound();
        burstConfetti(card);
    } else {
        root.innerHTML = `
            <div class="card">
                <div class="result-outcome">❌ Экзамен не сдан (${result.correct_count}/${result.total}, нужно 5 из 5)</div>
                <div class="subtitle">Пересдача — через 24 часа.</div>
                <button class="btn" onclick="location.reload()">Понятно</button>
            </div>
        `;
        const card = root.querySelector(".card");
        playFailSound();
        shakeElement(card);
    }
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
