import { apiFetch } from "../api.js";

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
    const progressPct = Math.round((question.index / question.total) * 100);

    root.innerHTML = `
        <div class="card">
            <div class="subtitle">Школьный экзамен · вопрос ${question.index + 1} из ${question.total}</div>
            <div class="progress-bar"><div class="progress-bar-fill" style="width:${progressPct}%"></div></div>
            <div class="question-text">${escapeHtml(question.text)}</div>
            <div id="options"></div>
        </div>
    `;

    const optionsEl = root.querySelector("#options");
    question.options.forEach((opt) => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        btn.textContent = opt.text;
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

    renderOutcome(root, result);
}

function renderOutcome(root, result) {
    if (result.outcome === "student") {
        root.innerHTML = `
            <div class="card">
                <div class="result-outcome">Экзамен окончен: ${result.score}/100</div>
                <div class="subtitle">Ты зачислен(а) на: ${escapeHtml(result.profession_name)}. Статус: студент, идёт стипендия.</div>
                <button class="btn" onclick="location.reload()">Продолжить</button>
            </div>
        `;
        return;
    }

    if (result.outcome === "choosing") {
        root.innerHTML = `
            <div class="card">
                <div class="result-outcome">Экзамен окончен: ${result.score}/100</div>
                <div class="subtitle">Отличный результат — выбери профессию сам:</div>
                <div id="candidates"></div>
            </div>
        `;
        const el = root.querySelector("#candidates");
        result.candidates.forEach((c) => {
            const btn = document.createElement("button");
            btn.className = "option-btn";
            btn.textContent = c.name;
            btn.onclick = () => chooseProfession(root, c.code);
            el.appendChild(btn);
        });
        return;
    }

    if (result.outcome === "criminal_offer") {
        root.innerHTML = `
            <div class="card">
                <div class="result-outcome">Экзамен окончен: ${result.score}/100</div>
                <div class="subtitle">У тебя высокий показатель риска. Выбери путь:</div>
                <button class="option-btn" id="btn-zavod">🏭 Пойти на Завод (стабильно)</button>
                <button class="option-btn" id="btn-crime">🕶 Встать на криминальную дорожку (рискованно)</button>
            </div>
        `;
        root.querySelector("#btn-zavod").onclick = () => chooseCriminalOffer(root, "zavod");
        root.querySelector("#btn-crime").onclick = () => chooseCriminalOffer(root, "crime");
        return;
    }

    if (result.outcome === "pdd_test") {
        root.innerHTML = `
            <div class="card">
                <div class="result-outcome">Экзамен окончен: ${result.score}/100</div>
                <div class="subtitle">Результат ниже проходного — нужно сдать ПДД (шанс попасть в Такси/Курьер вместо Завода).</div>
                <button class="btn" id="btn-pdd">Начать тест ПДД</button>
            </div>
        `;
        root.querySelector("#btn-pdd").onclick = () => renderPddScreen(root);
        return;
    }
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
    const progressPct = Math.round((question.index / question.total) * 100);

    root.innerHTML = `
        <div class="card">
            <div class="subtitle">Тест ПДД · вопрос ${question.index + 1} из ${question.total}</div>
            <div class="progress-bar"><div class="progress-bar-fill" style="width:${progressPct}%"></div></div>
            <div class="question-text">${escapeHtml(question.text)}</div>
            <div id="pdd-options"></div>
        </div>
    `;

    const optionsEl = root.querySelector("#pdd-options");
    question.options.forEach((opt) => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        btn.textContent = opt.text;
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
        <div class="card">
            <div class="result-outcome">${result.passed ? "Тест ПДД сдан!" : "Тест ПДД не сдан"}</div>
            <div class="subtitle">${passedText}</div>
            <button class="btn" onclick="location.reload()">Продолжить</button>
        </div>
    `;
}

async function chooseProfession(root, code) {
    root.innerHTML = `<div class="loading">Записываем…</div>`;
    try {
        await apiFetch("/api/exam/choose_profession", { method: "POST", body: { code } });
        root.innerHTML = `<div class="card">Готово! Профессия выбрана.<button class="btn" onclick="location.reload()">Продолжить</button></div>`;
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
    }
}

async function chooseCriminalOffer(root, choice) {
    root.innerHTML = `<div class="loading">Записываем…</div>`;
    try {
        await apiFetch("/api/criminal_offer/choose", { method: "POST", body: { choice } });
        root.innerHTML = `<div class="card">Готово!<button class="btn" onclick="location.reload()">Продолжить</button></div>`;
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
        <div class="card">
            <div class="title">Выбери профессию</div>
            <div id="candidates"></div>
        </div>
    `;
    const el = root.querySelector("#candidates");
    data.candidates.forEach((c) => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        btn.textContent = c.name;
        btn.onclick = () => chooseProfessionForStage(root, c.code, stage);
        el.appendChild(btn);
    });
}

async function chooseProfessionForStage(root, code, stage) {
    root.innerHTML = `<div class="loading">Записываем…</div>`;
    const path = stage === "choosing_free" ? "/api/exam/choose_profession_free" : "/api/exam/choose_profession";
    try {
        await apiFetch(path, { method: "POST", body: { code } });
        root.innerHTML = `<div class="card">Готово! Профессия выбрана.<button class="btn" onclick="location.reload()">Продолжить</button></div>`;
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
    }
}

export function renderCriminalOfferScreen(root) {
    root.innerHTML = `
        <div class="card">
            <div class="title">Развилка</div>
            <div class="subtitle">Выбери путь:</div>
            <button class="option-btn" id="btn-zavod">🏭 Пойти на Завод (стабильно)</button>
            <button class="option-btn" id="btn-crime">🕶 Встать на криминальную дорожку (рискованно)</button>
        </div>
    `;
    root.querySelector("#btn-zavod").onclick = () => chooseCriminalOffer(root, "zavod");
    root.querySelector("#btn-crime").onclick = () => chooseCriminalOffer(root, "crime");
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
