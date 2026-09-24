// Заголовок экрана в теме «Вечерняя улица»: крупный план нужного места на
// общем фоне улицы + вывеска с названием раздела. Вся игра — одна улица,
// каждый раздел — своё место на ней. Если тема выключена — обычный заголовок.
import { USE_STREET_THEME } from "./themeConfig.js";

// Где на фоне (assets/backgrounds/game-bg.jpg) находится место раздела:
// x/y — точка кадра в процентах от картинки, zoom — насколько приблизить.
// Поменять кадр раздела — поправить цифры здесь.
export const SCENES = {
    street: { x: 60, y: 62, zoom: 160 },
    notifications: { x: 30, y: 68, zoom: 260 },
    shop: { x: 92, y: 74, zoom: 230 },
    blackmarket: { x: 21, y: 44, zoom: 260 },
    market: { x: 95, y: 48, zoom: 260 },
    chat: { x: 32, y: 62, zoom: 270 },
    army: { x: 3, y: 47, zoom: 270 },
    police: { x: 70, y: 22, zoom: 240 },
    crime: { x: 70, y: 38, zoom: 280 },
    duels: { x: 45, y: 68, zoom: 380 },
};

export function screenHeader({ scene, title, sub = "", fallbackTitle }) {
    if (!USE_STREET_THEME) {
        return `<div class="title">${fallbackTitle || title}</div>`;
    }
    const s = SCENES[scene] || SCENES.street;
    return `
        <div class="street-hero street-hero-scene" style="--scene-x:${s.x}%;--scene-y:${s.y}%;--scene-zoom:${s.zoom}%"></div>
        <div class="street-sign">
            <div class="street-sign-name">${title}</div>
            ${sub ? `<div class="street-sign-sub">${sub}</div>` : ""}
        </div>`;
}
