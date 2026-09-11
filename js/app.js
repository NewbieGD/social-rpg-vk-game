import { DEV_MODE } from "./config.js";
import { getVkLaunchParams, initVkBridge } from "./vk.js";
import { apiFetch, saveToken, getToken } from "./api.js";
import { renderExamScreen, renderPddScreen, renderChoosingScreen, renderCriminalOfferScreen } from "./screens/exam.js";
import { renderShell } from "./shell.js";

const root = document.getElementById("app");

async function main() {
    await initVkBridge();

    if (!getToken()) {
        const launchParams = getVkLaunchParams();

        if (launchParams) {
            await authenticate(launchParams);
        } else if (DEV_MODE) {
            renderDevLogin();
            return;
        } else {
            root.innerHTML = `<div class="error">Это приложение открывается только внутри VK.</div>`;
            return;
        }
    }

    await startGame();
}

function renderDevLogin() {
    root.innerHTML = `
        <div class="card dev-login">
            <div class="title">Локальный тест</div>
            <div class="subtitle">Настоящих параметров VK не найдено — это нормально при запуске
            не изнутри VK. Введи любой номер, чтобы протестировать под этим игроком.</div>
            <input type="number" id="dev-id" placeholder="Например, 12345" />
            <button class="btn" id="dev-login-btn">Войти</button>
        </div>
    `;
    root.querySelector("#dev-login-btn").onclick = async () => {
        const id = root.querySelector("#dev-id").value;
        if (!id) return;
        await authenticate({ dev_vk_id: id });
        await startGame();
    };
}

async function authenticate(launchParams) {
    root.innerHTML = `<div class="loading">Входим…</div>`;
    try {
        const result = await apiFetch("/api/auth", { method: "POST", body: launchParams });
        saveToken(result.token);
    } catch (e) {
        root.innerHTML = `<div class="error">Не удалось войти: ${e.message}</div>`;
        throw e;
    }
}

async function startGame() {
    let registerResult;
    try {
        const refParam = new URLSearchParams(window.location.search).get("ref");
        const referrerVkId = refParam ? parseInt(refParam, 10) : null;
        registerResult = await apiFetch("/api/register", {
            method: "POST",
            body: referrerVkId ? { referrer_vk_id: referrerVkId } : {},
        });
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    if (registerResult.status === "registered") {
        await renderExamScreen(root);
        return;
    }

    const stage = registerResult.stage;
    if (stage === "pdd_test") {
        await renderPddScreen(root);
        return;
    }
    if (stage === "choosing" || stage === "choosing_free") {
        await renderChoosingScreen(root, stage);
        return;
    }
    if (stage === "criminal_offer") {
        renderCriminalOfferScreen(root);
        return;
    }
    const examStages = ["school"];
    if (examStages.includes(stage)) {
        await renderExamScreen(root);
        return;
    }

    await renderShell(root);
}

main();
