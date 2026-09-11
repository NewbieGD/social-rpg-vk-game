import { apiFetch } from "../api.js";
import { burstConfetti, playSuccessSound, playFailSound } from "../fx.js";
import { PROFESSION_INFO } from "../professionInfo.js";

const LETTERS = ["А", "Б", "В", "Г"];

export async function renderExamScreen(root) {
    root.innerHTML = `<div class="loading">Загружаем вопрос…</div>`;
    let question;
    try {
        question = await apiFetch("/api/exam/question");
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    if (question.finished) {
        root.innerHTML = `<div class="card">Экзамен уже завершён. Обнови страницу.</div>`;
        return;
    }

    renderQuestion(root, question);
}

function renderQuestion(root, question) {
    const dots = Array.from({ length: question.total }, (_, i) =>
        `<div class="exam-progress-dot ${i < question.index ? "exam-progress-dot-done" : ""}"></div>`
    ).join("");

    root.innerHTML = `
        <div class="exam-paper">
            <div class="exam-header">📝 Школьный экзамен — профориентация</div>
            <div class="exam-title-stamp">Билет ${question.index + 1} из ${question.total}</div>
            <div class="exam-progress-dots">${dots}</div>
            <div class="exam-question-text"><span class="exam-question-number">${question.index + 1}</span><span>${escapeHtml(question.text)}</span></div>
            <div id="options"></div>
        </div>
    `;

    const optionsEl = root.querySelector("#options");
    question.options.forEach((opt, i) => {
        const btn = document.createElement("button");
        btn.className = "exam-option-btn";
        btn.innerHTML = `<span class="exam-option-letter">${LETTERS[i] || i + 1}</span><span>${escapeHtml(opt.text)}</span>`;
        btn.onclick = () => submitAnswer(root, question.index, opt.index);
        optionsEl.appendChild(btn);
    });
}

async function submitAnswer(root, questionIndex, optionIndex) {
    root.innerHTML = `<div class="loading">Проверяем ответ…</div>`;
    let result;
    try {
        result = await apiFetch("/api/exam/answer", {
            method: "POST",
            body: { question_index: questionIndex, option_index: optionIndex },
        });
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    if (!result.finished) {
        await renderExamScreen(root);
        return;
    }

    await renderOutcome(root, result);
}

async function renderOutcome(root, result) {
    if (result.outcome === "student") {
        root.innerHTML = `
            <div class="exam-paper">
                <div class="exam-outcome-card">
                    <div class="exam-outcome-icon">🎓</div>
                    <div class="exam-outcome-score">Экзамен сдан: ${result.score}/100</div>
                    <div class="exam-outcome-text">Ты зачислен(а) на: <b>${escapeHtml(result.profession_name)}</b>. Статус: студент, идёт стипендия.</div>
                    <button class="btn" onclick="location.reload()">Продолжить</button>
                </div>
            </div>
        `;
        playSuccessSound();
        burstConfetti(root.querySelector(".exam-paper"), 36);
        return;
    }

    if (result.outcome === "choosing") {
        root.innerHTML = `
            <div class="exam-paper">
                <div class="exam-outcome-card">
                    <div class="exam-outcome-icon">🏆</div>
                    <div class="exam-outcome-score">Отличный результат: ${result.score}/100</div>
                    <div class="exam-outcome-text">Выбери профессию сам:</div>
                </div>
                <div id="candidates"></div>
            </div>
        `;
        playSuccessSound();
        burstConfetti(root.querySelector(".exam-paper"), 44);
        const el = root.querySelector("#candidates");
        result.candidates.forEach((c) => {
            const btn = document.createElement("button");
            btn.className = "exam-option-btn";
            btn.innerHTML = `<span>ℹ️ ${escapeHtml(c.name)}</span>`;
            btn.onclick = () => showProfessionInfoPopup(c.code, c.name, () => chooseProfession(root, c.code));
            el.appendChild(btn);
        });
        return;
    }

    if (result.outcome === "criminal_offer") {
        await renderCriminalOfferChoice(root, result.score);
        return;
    }

    if (result.outcome === "pdd_test") {
        root.innerHTML = `
            <div class="exam-paper">
                <div class="exam-outcome-card">
                    <div class="exam-outcome-icon">🚗</div>
                    <div class="exam-outcome-score">Экзамен окончен: ${result.score}/100</div>
                    <div class="exam-outcome-text">Результат ниже проходного — нужно сдать ПДД (шанс попасть в Такси/Курьер вместо Завода).</div>
                    <button class="btn" id="btn-pdd">Начать тест ПДД</button>
                </div>
            </div>
        `;
        root.querySelector("#btn-pdd").onclick = () => renderPddScreen(root);
        return;
    }
}

async function renderCriminalOfferChoice(root, score) {
    root.innerHTML = `<div class="loading">Смотрим, какие роли сейчас нужны стране…</div>`;
    let options;
    try {
        options = await apiFetch("/api/criminal_offer/options");
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    root.innerHTML = `
        <div class="exam-paper">
            <div class="exam-outcome-card">
                <div class="exam-outcome-icon">🎲</div>
                ${score !== undefined ? `<div class="exam-outcome-score">Экзамен окончен: ${score}/100</div>` : `<div class="exam-title-stamp">Развилка</div>`}
                <div class="exam-outcome-text">У тебя высокий показатель риска. Выбери путь:</div>
            </div>
            <div id="offer-buttons"></div>
        </div>
    `;
    const btnContainer = root.querySelector("#offer-buttons");
    if (options.show_zavod) {
        const b = document.createElement("button");
        b.className = "exam-option-btn"; b.id = "btn-zavod";
        b.innerHTML = `<span>🏭 Пойти на Завод (стабильно, сразу)</span>`;
        btnContainer.appendChild(b);
    }
    if (options.show_crime) {
        const b = document.createElement("button");
        b.className = "exam-option-btn"; b.id = "btn-crime";
        b.innerHTML = `<span>🕶 Встать на криминальную дорожку (рискованно)</span>`;
        btnContainer.appendChild(b);
    }
    if (options.show_taxi_courier) {
        const label = options.taxi_courier_needs_exam
            ? "🚕 Такси / Курьер (нужно сдать экзамен на права)"
            : "🚕 Такси / Курьер (сейчас особенно нужны — вход сразу, без экзамена!)";
        const b = document.createElement("button");
        b.className = "exam-option-btn"; b.id = "btn-taxi-courier";
        b.innerHTML = `<span>${label}</span>`;
        btnContainer.appendChild(b);
    }
    if (options.show_zavod) root.querySelector("#btn-zavod").onclick = () => showProfessionInfoPopup("zavod", "Завод", () => chooseCriminalOffer(root, "zavod"));
    if (options.show_crime) root.querySelector("#btn-crime").onclick = () => showProfessionInfoPopup("crime", "Криминальный путь", () => chooseCriminalOffer(root, "crime"));
    if (options.show_taxi_courier) root.querySelector("#btn-taxi-courier").onclick = () => showTaxiCourierInfoPopup(() => chooseCriminalOffer(root, "taxi_courier"));
}

function showTaxiCourierInfoPopup(onSelect) {
    const overlay = document.createElement("div");
    overlay.className = "profile-overlay";
    const box = document.createElement("div");
    box.className = "profile-overlay-box exam-info-box";
    const taxi = PROFESSION_INFO.taxi;
    const courier = PROFESSION_INFO.courier;
    box.innerHTML = `
        <div class="exam-info-icon">🚕📦</div>
        <div class="exam-info-title">Такси / Курьер</div>
        <div class="exam-info-summary">Куда именно попадёшь — зависит от баланса: тебя направят туда, кого сейчас в стране меньше.</div>
        <div class="exam-info-details">
            <div class="exam-info-point">🚕 <b>${escapeHtml(taxi.summary)}</b></div>
            ${taxi.details.map((d) => `<div class="exam-info-point">• ${escapeHtml(d)}</div>`).join("")}
            <div class="exam-info-point" style="margin-top:10px">📦 <b>${escapeHtml(courier.summary)}</b></div>
            ${courier.details.map((d) => `<div class="exam-info-point">• ${escapeHtml(d)}</div>`).join("")}
        </div>
        <div class="exam-info-btn-row">
            <button class="btn btn-secondary" id="exam-info-close">Закрыть</button>
            <button class="btn" id="exam-info-select">Выбрать</button>
        </div>
    `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    box.querySelector("#exam-info-close").onclick = () => overlay.remove();
    box.querySelector("#exam-info-select").onclick = () => {
        overlay.remove();
        onSelect();
    };
}

export async function renderPddScreen(root) {
    root.innerHTML = `<div class="loading">Загружаем вопрос ПДД…</div>`;
    let question;
    try {
        question = await apiFetch("/api/pdd/question");
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    if (question.finished) {
        root.innerHTML = `<div class="card">Тест ПДД уже завершён. Обнови страницу.</div>`;
        return;
    }

    renderPddQuestion(root, question);
}

function renderPddQuestion(root, question) {
    const dots = Array.from({ length: question.total }, (_, i) =>
        `<div class="exam-progress-dot ${i < question.index ? "exam-progress-dot-done" : ""}"></div>`
    ).join("");

    root.innerHTML = `
        <div class="exam-paper">
            <div class="exam-header">🚗 Экзамен на права — теория ПДД</div>
            <div class="exam-title-stamp">Билет ${question.index + 1} из ${question.total}</div>
            <div class="exam-progress-dots">${dots}</div>
            <div class="exam-question-text"><span class="exam-question-number">${question.index + 1}</span><span>${escapeHtml(question.text)}</span></div>
            <div id="pdd-options"></div>
        </div>
    `;

    const optionsEl = root.querySelector("#pdd-options");
    question.options.forEach((opt, i) => {
        const btn = document.createElement("button");
        btn.className = "exam-option-btn";
        btn.innerHTML = `<span class="exam-option-letter">${LETTERS[i] || i + 1}</span><span>${escapeHtml(opt.text)}</span>`;
        btn.onclick = () => submitPddAnswer(root, question.index, opt.index);
        optionsEl.appendChild(btn);
    });
}

async function submitPddAnswer(root, questionIndex, optionIndex) {
    root.innerHTML = `<div class="loading">Проверяем ответ…</div>`;
    let result;
    try {
        result = await apiFetch("/api/pdd/answer", {
            method: "POST",
            body: { question_index: questionIndex, option_index: optionIndex },
        });
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    if (!result.finished) {
        await renderPddScreen(root);
        return;
    }

    const profNames = { taxi: "Такси", courier: "Курьер", zavod: "Завод" };
    const passedText = result.passed
        ? `✅ Тест сдан (правильных: ${result.correct_count})! Ты зачислен(а) на: ${profNames[result.profession] || result.profession}.`
        : `❌ Тест не сдан (правильных: ${result.correct_count}). Ты зачислен(а) на Завод — там экзамен по вождению не нужен.`;

    root.innerHTML = `
        <div class="exam-paper">
            <div class="exam-outcome-card">
                <div class="exam-outcome-icon">${result.passed ? "🚕" : "🏭"}</div>
                <div class="exam-outcome-score">${result.passed ? "Тест ПДД сдан!" : "Тест ПДД не сдан"}</div>
                <div class="exam-outcome-text">${passedText}</div>
                <button class="btn" onclick="location.reload()">Продолжить</button>
            </div>
        </div>
    `;
    if (result.passed) {
        playSuccessSound();
        burstConfetti(root.querySelector(".exam-paper"), 36);
    } else {
        playFailSound();
    }
}

function showProfessionChosenCard(root) {
    root.innerHTML = `
        <div class="exam-paper">
            <div class="exam-outcome-card">
                <div class="exam-outcome-icon">🎉</div>
                <div class="exam-outcome-score">Готово!</div>
                <div class="exam-outcome-text">Профессия выбрана.</div>
                <button class="btn" onclick="location.reload()">Продолжить</button>
            </div>
        </div>
    `;
    playSuccessSound();
    burstConfetti(root.querySelector(".exam-paper"), 40);
}

async function chooseProfession(root, code) {
    root.innerHTML = `<div class="loading">Записываем…</div>`;
    try {
        await apiFetch("/api/exam/choose_profession", { method: "POST", body: { code } });
        showProfessionChosenCard(root);
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
    }
}

async function chooseCriminalOffer(root, choice) {
    root.innerHTML = `<div class="loading">Записываем…</div>`;
    try {
        const result = await apiFetch("/api/criminal_offer/choose", { method: "POST", body: { choice } });
        if (result.stage === "pdd_test") {
            await renderPddScreen(root);
            return;
        }
        showProfessionChosenCard(root);
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
    }
}

// ---------- восстановление незавершённых развилок (игрок вышел и вернулся) ----------

export async function renderChoosingScreen(root, stage) {
    root.innerHTML = `<div class="loading">Загружаем список профессий…</div>`;
    let data;
    try {
        data = await apiFetch("/api/exam/choosing_candidates");
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    root.innerHTML = `
        <div class="exam-paper">
            <div class="exam-title-stamp">📝 Выбери профессию</div>
            <div id="candidates"></div>
        </div>
    `;
    const el = root.querySelector("#candidates");
    data.candidates.forEach((c) => {
        const btn = document.createElement("button");
        btn.className = "exam-option-btn";
        btn.innerHTML = `<span>ℹ️ ${escapeHtml(c.name)}</span>`;
        btn.onclick = () => showProfessionInfoPopup(c.code, c.name, () => chooseProfessionForStage(root, c.code, stage));
        el.appendChild(btn);
    });
}

async function chooseProfessionForStage(root, code, stage) {
    root.innerHTML = `<div class="loading">Записываем…</div>`;
    const path = stage === "choosing_free" ? "/api/exam/choose_profession_free" : "/api/exam/choose_profession";
    try {
        await apiFetch(path, { method: "POST", body: { code } });
        showProfessionChosenCard(root);
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
    }
}

export async function renderCriminalOfferScreen(root) {
    await renderCriminalOfferChoice(root, undefined);
}

function showProfessionInfoPopup(code, name, onSelect) {
    const info = PROFESSION_INFO[code];
    const overlay = document.createElement("div");
    overlay.className = "profile-overlay";
    const box = document.createElement("div");
    box.className = "profile-overlay-box exam-info-box";
    box.innerHTML = `
        <div class="exam-info-icon">${info ? info.icon : "❔"}</div>
        <div class="exam-info-title">${escapeHtml(name)}</div>
        <div class="exam-info-summary">${info ? escapeHtml(info.summary) : "Описание пока не добавлено."}</div>
        <div class="exam-info-details">${(info ? info.details : []).map((d) => `<div class="exam-info-point">• ${escapeHtml(d)}</div>`).join("")}</div>
        <div class="exam-info-btn-row">
            <button class="btn btn-secondary" id="exam-info-close">Закрыть</button>
            <button class="btn" id="exam-info-select">Выбрать эту профессию</button>
        </div>
    `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    box.querySelector("#exam-info-close").onclick = () => overlay.remove();
    box.querySelector("#exam-info-select").onclick = () => {
        overlay.remove();
        onSelect();
    };
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
