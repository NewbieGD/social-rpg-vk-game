// Смена освещения улицы по настоящему местному времени игрока (не по
// серверному, у каждого своё). Ставит на <body> один из трёх классов —
// остальное (полупрозрачная подсветка поверх фона улицы) делает CSS
// в theme-street.css. Ничего не грузит и не считает заново, кроме
// обновления раз в 10 минут — на случай, если игрок сидит в приложении
// долго и время суток за это время меняется.

const DAY_CLASSES = ["daytime-day", "daytime-evening", "daytime-night"];

function pickDaytimeClass(hour) {
    if (hour >= 7 && hour < 18) return "daytime-day";
    if (hour >= 18 && hour < 22) return "daytime-evening";
    return "daytime-night";
}

function applyDaytimeClass() {
    const cls = pickDaytimeClass(new Date().getHours());
    DAY_CLASSES.forEach((c) => {
        if (c !== cls) document.body.classList.remove(c);
    });
    document.body.classList.add(cls);
}

export function initDayNightTheme() {
    applyDaytimeClass();
    setInterval(applyDaytimeClass, 10 * 60 * 1000);
}
