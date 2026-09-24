// Общие украшения профиля — используются и в своём, и в чужом профиле,
// чтобы косметика выглядела одинаково и была видна всем, кто заходит.

// Рамки аватара, сделанные CSS-обводкой (класс на самом аватаре).
export const AVATAR_FRAME_CLASSES = {
    profile_frame_neon: " profile-avatar-neon",
    profile_frame_gold: " profile-avatar-gold",
    profile_frame_ice: " profile-avatar-ice",
    profile_frame_brill: " profile-avatar-brill",
};

// Анимированные рамки аватара — отдельная гифка поверх фото.
// Новую такую рамку добавлять сюда: код косметики -> путь к файлу.
export const ANIMATED_AVATAR_FRAMES = {
    profile_frame_brill: "assets/frames/frame_avatar_brill.gif",
};

export function avatarFrameClass(activeFrame, isPresident) {
    if (isPresident) return " profile-avatar-president";
    return AVATAR_FRAME_CLASSES[activeFrame] || "";
}

export function avatarFrameOverlay(activeFrame, isPresident) {
    const src = !isPresident && ANIMATED_AVATAR_FRAMES[activeFrame];
    return src ? `<img class="avatar-frame-gif" src="${src}" alt="" aria-hidden="true">` : "";
}

// Готовый аватар: фото из ВК (если есть) или заглушка, с рамкой.
export function avatarHtml(photoUrl, activeFrame, isPresident) {
    const cls = avatarFrameClass(activeFrame, isPresident);
    const inner = photoUrl
        ? `<img src="${photoUrl}" class="profile-avatar${cls}" alt="Фото профиля">`
        : `<div class="profile-avatar profile-avatar-placeholder${cls}">👤</div>`;
    return `<div class="avatar-frame-wrap">${inner}${avatarFrameOverlay(activeFrame, isPresident)}</div>`;
}

// Рамка вывески с именем: sign_frame_gold -> " sign-frame-gold"
export function signFrameClass(code) {
    return code ? " sign-frame-" + code.replace("sign_frame_", "") : "";
}

// Рамка всей карточки профиля: card_frame_neon -> " card-frame-neon"
export function cardFrameClass(code) {
    return code ? " card-frame-" + code.replace("card_frame_", "") : "";
}

export function nameStyleClass(activeNameStyle) {
    if (activeNameStyle === "gradient_name") return "cosmetic-gradient-name";
    if (activeNameStyle === "golden_name") return "cosmetic-golden-name";
    return "";
}

export function nameBadges(cosmetics) {
    const list = cosmetics || [];
    return [list.includes("crown_badge") ? "👑" : "", list.includes("vip_badge") ? "💎 VIP" : ""]
        .filter(Boolean).join(" ");
}
