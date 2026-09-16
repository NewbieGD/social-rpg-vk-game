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
