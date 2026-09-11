import { apiFetch } from "../api.js";
import { playMessageSound } from "../fx.js";
import { renderOtherProfile } from "./profile.js";

const POLL_INTERVAL_MS = 3000;
const THIEF_CHECK_INTERVAL_MS = 10000;

const CHAT_THEME = {
    general: { banner: "💬 ОБЩИЙ ЧАТ", title: "Общий чат" },
    thief: { banner: "🕶 ВОРОВСКОЙ ЧАТ", title: "Воровской чат" },
    gov: { banner: "🏛 ПРАВИТЕЛЬСТВЕННЫЙ ЧАТ", title: "Правительственный чат" },
};
let pollTimer = null;
let thiefCheckTimer = null;
let isInChatRoom = false;

// Вызывается извне (из shell.js) при уходе с этого экрана — без этого опрос
// продолжал бы стучаться на сервер даже после того, как экран уже не виден.
export function stopChatPolling() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
    if (thiefCheckTimer) {
        clearInterval(thiefCheckTimer);
        thiefCheckTimer = null;
    }
}

// Тоже вызывается из shell.js при уходе на любую другую вкладку — если человек
// был именно в комнате чата (не в списке), он должен реально выйти из чата на
// backend, а не просто перестать получать сообщения молча.
export function leaveChatOnNavigateAway() {
    stopChatPolling();
    if (isInChatRoom) {
        isInChatRoom = false;
        apiFetch("/api/chats/leave", { method: "POST" }).catch(() => {});
    }
}

export async function renderChatsScreen(root) {
    stopChatPolling();
    isInChatRoom = false;
    root.innerHTML = `<div class="loading">Загружаем список чатов…</div>`;

    let chats;
    try {
        chats = await apiFetch("/api/chats");
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    if (chats.current_session) {
        await renderChatRoom(root, chats.current_session, chats.current_session_last_message_id || 0);
        return;
    }

    root.innerHTML = `<div class="title">💬 Чаты</div><div id="peoples-rep-card"></div><div id="chat-list"></div>`;
    await renderPeoplesRepCard(root);
    const list = root.querySelector("#chat-list");
    chats.available.forEach((c) => {
        const btn = document.createElement("button");
        btn.className = `option-btn chat-list-btn-${c.type}`;
        if (c.is_muted) {
            btn.textContent = `🔔 Снять заглушку: ${c.label}`;
            btn.onclick = () => unmuteChat(root, c.type);
        } else {
            btn.textContent = c.label;
            btn.onclick = () => enterChat(root, c.type);
        }
        list.appendChild(btn);
    });
}

async function renderPeoplesRepCard(root) {
    const container = root.querySelector("#peoples-rep-card");
    container.innerHTML = `<div class="loading">Загружаем…</div>`;

    let status, myProfile;
    try {
        [status, myProfile] = await Promise.all([
            apiFetch("/api/chats/peoples_rep/status"),
            apiFetch("/api/profile"),
        ]);
    } catch (e) {
        container.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    const isCurrentRep = status.active && status.vk_id === myProfile.tg_id;
    const repLine = status.active
        ? `<div class="profile-row">📜 Представитель народа сегодня: ${status.username ? "@" + escapeHtml(status.username) : "ID " + status.vk_id}${isCurrentRep ? " (это ты!)" : ""}</div>`
        : `<div class="profile-dim">📜 Представитель народа сегодня не выбран.</div>`;

    container.innerHTML = `
        <div class="card">
            <div class="subtitle">📜 Представитель народа</div>
            ${repLine}
            <div class="profile-dim">Голосование за завтрашнего представителя идёт весь сегодняшний день.</div>
            <button class="btn btn-secondary" id="rep-register-btn">🙋 Стать кандидатом на завтра</button>
            <div id="rep-candidates"></div>
            ${isCurrentRep ? '<button class="btn" id="rep-petition-btn">📝 Отправить обращение президенту</button>' : ""}
            <div id="rep-result"></div>
        </div>
    `;

    container.querySelector("#rep-register-btn").onclick = () => registerCandidate(container);
    if (isCurrentRep) {
        container.querySelector("#rep-petition-btn").onclick = () => sendPetition(container);
    }
    await loadCandidates(container);
}

async function registerCandidate(container) {
    const resultEl = container.querySelector("#rep-result");
    resultEl.innerHTML = `<div class="loading">Регистрируем…</div>`;
    try {
        await apiFetch("/api/chats/peoples_rep/register", { method: "POST" });
        resultEl.innerHTML = `<div class="profile-row" style="color:#7ee787">✅ Ты в списке кандидатов на завтра!</div>`;
        await loadCandidates(container);
    } catch (e) {
        resultEl.innerHTML = `<div class="error">${e.message}</div>`;
    }
}

async function loadCandidates(container) {
    const listEl = container.querySelector("#rep-candidates");
    let candidates;
    try {
        candidates = await apiFetch("/api/chats/peoples_rep/candidates");
    } catch (e) {
        listEl.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }

    if (candidates.length === 0) {
        listEl.innerHTML = `<div class="profile-dim">Кандидатов пока нет.</div>`;
        return;
    }

    listEl.innerHTML = "";
    candidates.forEach((c) => {
        const row = document.createElement("div");
        row.className = "shop-item";
        const name = c.username ? "@" + escapeHtml(c.username) : "ID " + c.vk_id;
        row.innerHTML = `<div class="shop-item-name">${name}</div><div class="shop-item-price">${c.votes} 🗳</div>`;
        const voteBtn = document.createElement("button");
        voteBtn.className = "btn btn-secondary";
        voteBtn.textContent = "Голосовать";
        voteBtn.onclick = async () => {
            try {
                await apiFetch("/api/chats/peoples_rep/vote", { method: "POST", body: { candidate_vk_id: c.vk_id } });
                await loadCandidates(container);
            } catch (e) {
                alert(e.message);
            }
        };
        row.appendChild(voteBtn);
        listEl.appendChild(row);
    });
}

async function sendPetition(container) {
    const text = prompt("Текст обращения к президенту (на основе того, что обсуждали в чате):");
    if (!text) return;
    const resultEl = container.querySelector("#rep-result");
    resultEl.innerHTML = `<div class="loading">Отправляем на голосование граждан…</div>`;
    try {
        await apiFetch("/api/chats/peoples_rep/petition", { method: "POST", body: { text } });
        resultEl.innerHTML = `<div class="profile-row" style="color:#7ee787">✅ Обращение вынесено на голосование граждан (1 час).</div>`;
    } catch (e) {
        resultEl.innerHTML = `<div class="error">${e.message}</div>`;
    }
}

async function enterChat(root, chatType) {
    root.innerHTML = `<div class="loading">Заходим…</div>`;
    let enterResult;
    try {
        enterResult = await apiFetch(`/api/chats/${chatType}/enter`, { method: "POST" });
    } catch (e) {
        root.innerHTML = `<div class="error">${e.message}</div>`;
        return;
    }
    await renderChatRoom(root, chatType, enterResult.last_message_id || 0);
}

async function renderChatRoom(root, chatType, startAfterId = 0) {
    isInChatRoom = true;
    const theme = CHAT_THEME[chatType] || CHAT_THEME.general;
    root.innerHTML = `
        <div class="chat-room-banner chat-room-banner-${chatType}">${theme.banner}</div>
        <div class="title">${theme.title}</div>
        <div id="who-panel"></div>
        <div id="messages" class="chat-messages chat-messages-${chatType}"></div>
        <div class="chat-input-row">
            <input type="text" id="chat-input" placeholder="Сообщение…" maxlength="500" />
            <button class="btn" id="send-btn" style="width:auto">➤</button>
        </div>
        <button class="btn btn-secondary" id="who-btn">👥 Кто в чате</button>
        ${chatType === "general" ? '<div id="call-police-container"></div>' : ""}
        <button class="btn btn-secondary" id="mute-btn">🔕 Заглушить этот чат себе</button>
        <button class="btn btn-secondary" id="leave-btn">🚪 Выйти из чата</button>
        <div id="chat-error"></div>
    `;

    let myVkId = null;
    try {
        const profile = await apiFetch("/api/profile");
        myVkId = profile.tg_id;
    } catch (e) {
        // не критично — просто не подсветим свои сообщения отдельным цветом
    }

    let lastId = startAfterId;
    const messagesEl = root.querySelector("#messages");

    async function poll() {
        try {
            const newMessages = await apiFetch(`/api/chats/${chatType}/messages?after_id=${lastId}`);
            newMessages.forEach((m) => {
                lastId = m.id;
                appendMessage(messagesEl, m, myVkId);
            });
        } catch (e) {
            root.querySelector("#chat-error").innerHTML = `<div class="error">${e.message}</div>`;
            stopChatPolling();
        }
    }

    await poll();
    pollTimer = setInterval(poll, POLL_INTERVAL_MS);

    root.querySelector("#send-btn").onclick = () => sendMessage(root, chatType);
    root.querySelector("#chat-input").onkeydown = (e) => {
        if (e.key === "Enter") sendMessage(root, chatType);
    };
    root.querySelector("#who-btn").onclick = () => showWho(root);
    root.querySelector("#mute-btn").onclick = () => muteChat(root, chatType);
    if (chatType === "general") {
        await refreshThiefAlert(root);
        thiefCheckTimer = setInterval(() => refreshThiefAlert(root), THIEF_CHECK_INTERVAL_MS);
    }
    root.querySelector("#leave-btn").onclick = () => leaveChat(root);
}

async function muteChat(root, chatType) {
    stopChatPolling();
    try {
        await apiFetch("/api/chats/mute", { method: "POST", body: { chat_type: chatType } });
        await renderChatsScreen(root);
    } catch (e) {
        alert(e.message);
    }
}

async function unmuteChat(root, chatType) {
    try {
        await apiFetch("/api/chats/unmute", { method: "POST", body: { chat_type: chatType } });
        await renderChatsScreen(root);
    } catch (e) {
        alert(e.message);
    }
}

function showProfileOverlay(vkId) {
    const overlay = document.createElement("div");
    overlay.className = "profile-overlay";
    const box = document.createElement("div");
    box.className = "profile-overlay-box";
    const closeBtn = document.createElement("button");
    closeBtn.className = "btn btn-secondary profile-overlay-close";
    closeBtn.textContent = "✕ Закрыть";
    closeBtn.onclick = () => overlay.remove();
    box.appendChild(closeBtn);
    const content = document.createElement("div");
    box.appendChild(content);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    renderOtherProfile(content, vkId);
}

function appendMessage(container, m, myVkId) {
    const el = document.createElement("div");
    if (m.is_system) {
        el.className = "chat-msg chat-msg-system";
        el.textContent = m.text;
    } else {
        const isOwn = myVkId !== null && m.sender_vk_id === myVkId;
        el.className = isOwn ? "chat-msg chat-msg-own" : "chat-msg";
        const canOpenProfile = !isOwn && !m.identity_hidden;
        const senderLine = canOpenProfile
            ? `<div class="chat-msg-sender chat-msg-sender-clickable" id="sender-${m.id}">${m.sender_vk_photo_url ? `<img src="${m.sender_vk_photo_url}" class="oko-clicker-photo" alt="">` : ""}${escapeHtml(m.sender_vk_first_name || m.sender_display)}</div>`
            : `<div class="chat-msg-sender">${escapeHtml(m.sender_display)}</div>`;
        el.innerHTML = isOwn ? escapeHtml(m.text) : `${senderLine}${escapeHtml(m.text)}`;
        if (canOpenProfile) {
            container.appendChild(el);
            el.querySelector(`#sender-${m.id}`).onclick = () => showProfileOverlay(m.sender_vk_id);
            container.scrollTop = container.scrollHeight;
            if (!isOwn) playMessageSound();
            return;
        }
        if (!isOwn) {
            playMessageSound();
        }
    }
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

async function refreshThiefAlert(root) {
    const container = root.querySelector("#call-police-container");
    if (!container) return;

    let who;
    try {
        who = await apiFetch("/api/chats/who");
    } catch (e) {
        return; // не критично — просто не обновим в этот раз
    }

    container.innerHTML = "";
    (who.revealed_thieves || []).forEach((thief) => {
        const btn = document.createElement("button");
        btn.className = "btn btn-secondary";
        const label = thief.username ? "@" + thief.username : "ID " + thief.vk_id;
        btn.textContent = `🚨 Вызвать полицию на вора (${label})`;
        btn.onclick = () => callPoliceOnThief(root, thief.vk_id, btn);
        container.appendChild(btn);
    });
}

async function callPoliceOnThief(root, targetVkId, btn) {
    btn.disabled = true;
    const errorEl = root.querySelector("#chat-error");
    try {
        await apiFetch("/api/chats/call_police_on_thief", { method: "POST", body: { target_vk_id: targetVkId } });
        btn.textContent = "✅ Полиция вызвана";
    } catch (e) {
        errorEl.innerHTML = `<div class="error">${e.message}</div>`;
        btn.disabled = false;
    }
}

async function sendMessage(root, chatType) {
    const input = root.querySelector("#chat-input");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    try {
        await apiFetch("/api/chats/send", { method: "POST", body: { text } });
    } catch (e) {
        root.querySelector("#chat-error").innerHTML = `<div class="error">${e.message}</div>`;
    }
}

async function showWho(root) {
    try {
        const who = await apiFetch("/api/chats/who");
        root.querySelector("#who-panel").innerHTML = `
            <div class="card"><div class="subtitle">👥 Сейчас в чате:</div>${who.people.map((p) => `<div class="profile-row">${p}</div>`).join("")}</div>
        `;
    } catch (e) {
        root.querySelector("#who-panel").innerHTML = `<div class="error">${e.message}</div>`;
    }
}

async function leaveChat(root) {
    stopChatPolling();
    isInChatRoom = false;
    try {
        await apiFetch("/api/chats/leave", { method: "POST" });
    } catch (e) {
        // не критично — просто вернёмся к списку
    }
    await renderChatsScreen(root);
}
