// Картинки для карты города. Везде null — рисуется встроенная векторная
// графика. Чтобы поставить свою картинку или гифку (гифки анимируются):
// положи файл в assets/map/ и впиши путь, например "assets/map/police.gif".
//
// Размеры и расположение объектов (чтобы картинка легла ровно) — в
// assets/README.md, раздел «Карта города». Вся карта — 700×1000 единиц.

export const CITY_MAP_ASSETS = {
    // Фон под всю карту (700×1000). Если на твоём фоне уже нарисованы свои
    // дороги и кварталы — поставь hideDrawnGround: true, чтобы мои не
    // рисовались поверх. Машинки всё равно поедут по координатам улиц
    // (x = 233 и 467 — вертикальные, y = 200, 480, 760 — горизонтальные).
    background: null,
    hideDrawnGround: false,

    // Здания (картинка вписывается в прямоугольник здания с сохранением пропорций)
    buildings: {
        police: null,
        government: null,
        residence: null,
        hospital: null,
        fire: null,
        school: null,
        factory: null,
        shop: null,
        army: null,
        private_gate: null,
        office: null,
        dorm: null,
        official_house: null,
    },

    // Транспорт. Картинка должна смотреть ВПРАВО — на поворотах она
    // поворачивается сама. Размер на карте 44×24.
    vehicles: {
        car: null,
        taxi: null,
        courier: null,
        police: null,
        doctor: null,
        firefighter: null,
        teacher: null,
    },

    // Частный сектор
    privateSectorBackground: null,
    // Дом по умолчанию (если у игрока нет купленного скина дома). Скины домов
    // уже берутся из assets/houses/<скин>.png, как и раньше.
    defaultHouse: null,
};
