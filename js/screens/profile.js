const ProfileScreen = {
    render(container) {
        container.innerHTML = `
            <div class="city-card">
                <h2>👤 Паспорт Гражданина</h2>
                <p><b>Имя:</b> ${GameState.user.name}</p>
                <p><b>Профессия / Статус:</b> ${GameState.user.job} (${GameState.user.role})</p>
                <p><b>Группировка:</b> ${GameState.user.gang}</p>
                <p><b>Личный баланс:</b> ${GameState.user.money} 💵</p>
                <p><b>Авторитет в городе:</b> ${GameState.user.authority} ⭐</p>
                <button class="city-btn" onclick="ProfileScreen.rest()">Отдохнуть в квартире (+50 ⚡)</button>
            </div>
        `;
    },
    rest() {
        GameState.user.energy = 100;
        App.updateHeader();
        GameAPI.showPopup("Отдых", "Вы выспались в своей квартире. Энергия полностью восстановлена!");
    }
};
