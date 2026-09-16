// Единый попап-уведомление в игровом стиле — используется по всей игре
// (голосования, покупки, задания и т.д.), чтобы визуально всё было
// одинаково, а не разными способами в разных местах.

export function showGameStylePopup(title, text, opts = {}) {
    const overlay = document.createElement("div");
    overlay.className = "profile-overlay";
    const box = document.createElement("div");
    box.className = "profile-overlay-box gov-popup-box";
    box.innerHTML = `
        <div class="gov-popup-title">${title}</div>
        <div class="profile-dim" style="margin:10px 0 16px">${text}</div>
        <button class="btn" id="game-popup-close">${opts.closeLabel || "Понятно"}</button>
    `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    box.querySelector("#game-popup-close").onclick = () => overlay.remove();
    return overlay;
}

/**
 * То же самое игровое окно, но с полностью произвольным содержимым —
 * для случаев, где нужен не просто текст, а список, кнопки, картинки и т.д.
 * fillFn(contentEl) — наполняет контейнер как хочет (innerHTML/appendChild).
 * Возвращает { overlay, content } — content можно перенаполнять повторно,
 * не открывая новый попап (например, при подгрузке данных).
 */
export function showGamePopupWithContent(title, fillFn, opts = {}) {
    const overlay = document.createElement("div");
    overlay.className = "profile-overlay";
    const box = document.createElement("div");
    box.className = "profile-overlay-box gov-popup-box";
    box.style.textAlign = "left";
    const closeBtn = document.createElement("button");
    closeBtn.className = "btn btn-secondary profile-overlay-close";
    closeBtn.textContent = "✕ Закрыть";
    closeBtn.onclick = () => overlay.remove();
    box.appendChild(closeBtn);
    if (title) {
        const titleEl = document.createElement("div");
        titleEl.className = "gov-popup-title";
        titleEl.style.textAlign = "center";
        titleEl.style.marginBottom = "8px";
        titleEl.innerHTML = title;
        box.appendChild(titleEl);
    }
    const content = document.createElement("div");
    box.appendChild(content);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    if (fillFn) fillFn(content);
    return { overlay, content };
}
