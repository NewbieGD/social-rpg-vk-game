// Единый словарь визуальных элементов карты города.
//
// КАК ПОДСТАВИТЬ СВОЮ КАРТИНКУ/ГИФКУ:
// 1. Положи файл в папку assets/map/ (например assets/map/police.gif)
// 2. Поменяй у нужной записи ниже поле "image" с null на путь к файлу,
//    например: image: "assets/map/police.gif"
// Пока "image" стоит null — используется запасной эмодзи из поля "emoji",
// остальной код ничего не замечает и работает одинаково в обоих случаях.

export const BUILDING_ASSETS = {
    dorm: { emoji: "🏢", image: null, label: "Общага" },
    university: { emoji: "🎓", image: null, label: "Университет" },
    police: { emoji: "👮", image: null, label: "Полицейский участок" },
    prison: { emoji: "🔒", image: null, label: "Тюрьма" },
    mchs: { emoji: "🚒", image: null, label: "МЧС" },
    hospital: { emoji: "🏥", image: null, label: "Больница" },
    pharmacy: { emoji: "💊", image: null, label: "Аптека" },
    construction: { emoji: "🏗", image: null, label: "Строительная организация" },
    zavod: { emoji: "🏭", image: null, label: "Завод" },
    army: { emoji: "🎖", image: null, label: "Военная база" },
    government: { emoji: "🏛", image: null, label: "Правительство" },
    private_sector: { emoji: "🏘", image: null, label: "Частный сектор" },
    shop: { emoji: "🛍", image: null, label: "Магазин" },
    blackmarket: { emoji: "🕶", image: null, label: "Чёрный рынок" },
    market: { emoji: "🏪", image: null, label: "Рынок" },
    chat: { emoji: "💬", image: null, label: "Чат" },
    leaderboard: { emoji: "🏆", image: null, label: "Доска лидеров" },
    modernization: { emoji: "🏭", image: null, label: "Фабрики" },
    bureaucrat: { emoji: "🗂", image: null, label: "Бюрократ" },
};

// Персонажи/декоративные элементы — тоже заглушки-эмодзи по умолчанию.
export const CHARACTER_ASSETS = {
    player_avatar_idle: { emoji: "🧍", image: null, label: "Твой персонаж (в покое)" },
    player_avatar_walk: { emoji: "🚶", image: null, label: "Твой персонаж (идёт)" },
    hospital_receptionist: { emoji: "💁‍♀️", image: null, label: "Девушка на ресепшене больницы" },
    police_officer_desk: { emoji: "👮", image: null, label: "Дежурный в участке" },
    pharmacist: { emoji: "🧑‍⚕️", image: null, label: "Провизор в аптеке" },
    taxi_car: { emoji: "🚕", image: null, label: "Машина такси (в движении по карте)" },
    courier_bike: { emoji: "🛵", image: null, label: "Курьер (в движении по карте)" },
};

export function getBuildingAsset(code) {
    return BUILDING_ASSETS[code] || { emoji: "📍", image: null, label: code };
}

export function getCharacterAsset(code) {
    return CHARACTER_ASSETS[code] || { emoji: "❓", image: null, label: code };
}

// Возвращает готовый HTML для картинки ИЛИ эмодзи-заглушки — единая точка,
// весь остальной код карты вызывает только эту функцию, не проверяет
// вручную, есть картинка или нет.
export function renderAssetHtml(asset, className = "") {
    if (asset.image) {
        return `<img src="${asset.image}" alt="${escapeAttr(asset.label)}" class="map-asset-img ${className}">`;
    }
    return `<span class="map-asset-emoji ${className}">${asset.emoji}</span>`;
}

function escapeAttr(str) {
    return String(str).replace(/"/g, "&quot;");
}
