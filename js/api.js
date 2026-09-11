import { API_BASE_URL } from "./config.js";

const TOKEN_KEY = "put_session_token";

export function saveToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
}

class ApiError extends Error {
    constructor(status, detail) {
        // FastAPI при ошибке валидации (422) отдаёт detail не строкой, а
        // списком объектов вида {loc, msg, type} — раньше это просто
        // превращалось в "[object Object]" при попытке показать как текст.
        // Достаём читаемое сообщение из каждого объекта отдельно.
        let message = detail;
        if (Array.isArray(detail)) {
            message = detail.map((d) => (d && typeof d === "object" ? d.msg || JSON.stringify(d) : String(d))).join("; ");
        } else if (detail && typeof detail === "object") {
            message = detail.msg || JSON.stringify(detail);
        }
        super(message || `Ошибка ${status}`);
        this.status = status;
        this.detail = detail;
    }
}

export async function apiFetch(path, { method = "GET", body } = {}) {
    const headers = { "Content-Type": "application/json" };
    const token = getToken();
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
        let detail = `Ошибка сервера (${response.status})`;
        try {
            const data = await response.json();
            detail = data.detail || detail;
        } catch (e) {
            // тело ответа не JSON — оставляем стандартный текст
        }

        if (response.status === 401) {
            // Токен истёк (сессия живёт 24ч) или стал недействительным — сам
            // сброс и повторный вход, а не зависание на голой ошибке.
            clearToken();
            if (!window.__reloadingForAuth) {
                window.__reloadingForAuth = true;
                setTimeout(() => window.location.reload(), 800);
            }
        }

        throw new ApiError(response.status, detail);
    }

    if (response.status === 204) {
        return null;
    }
    return response.json();
}
