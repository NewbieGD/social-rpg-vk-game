const WorkScreen = {
    render(container) {
        container.innerHTML = `
            <div class="city-card">
                <h2>🔨 Биржа Труда и Профессий</h2>
                <p>Ваша текущая работа: <b>${GameState.user.job}</b></p>
                <p>Честный труд приносит стабильные деньги, но требует сил и времени.</p>
                <button class="city-btn" onclick="WorkScreen.doShift()">Отработать смену (+200 💵)</button>
            </div>
            <div class="city-card">
                <h2>📈 Карьерный рост</h2>
                <p>Выберите специализацию: Курьер доставки, водитель такси, муниципальный служащий или стартапер.</p>
                <button class="city-btn" onclick="WorkScreen.changeJob('Менеджер городского проекта')">Устроиться в Мэрию</button>
            </div>
        `;
    },
    doShift() {
        if (GameState.user.energy < 15) {
            GameAPI.showPopup("Усталость", "У вас недостаточно энергии! Отдохните или перекусите.");
            return;
        }
        GameState.user.money += 200;
        GameState.user.energy -= 15;
        App.updateHeader();
        GameAPI.showPopup("Смена окончена", "Вы успешно отработали смену и получили зарплату на банковский счет!");
    },
    changeJob(newJob) {
        GameState.user.job = newJob;
        GameState.user.roleType = "legal";
        GameState.user.role = "Служащий";
        App.updateHeader();
        this.render(document.getElementById('screen-container'));
        GameAPI.showPopup("Трудоустройство", `Вы сменили профессию на: ${newJob}.`);
    }
};
