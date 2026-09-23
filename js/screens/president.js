const PresidentScreen = {
    render(container) {
        container.innerHTML = `
            <div class="city-card">
                <h2>🏛️ Политическая Арена</h2>
                <p>Действующий мэр и президент города: <b>${GameState.president.name}</b></p>
                <p><b>Активные законы:</b> ${GameState.president.laws}</p>
                <button class="city-btn gold-btn" onclick="PresidentScreen.vote()">Проголосовать за реформы</button>
            </div>
            <div class="city-card">
                <h2>🗳️ Выдвинуть свою кандидатуру</h2>
                <p>Наберите 50 единиц авторитета, чтобы участвовать в выборах президента мегаполиса и менять законы под себя.</p>
                <button class="city-btn" onclick="PresidentScreen.runForOffice()">Начать предвыборную гонку</button>
            </div>
        `;
    },
    vote() {
        GameState.user.money += 100;
        GameAPI.showPopup("Голосование", "Вы приняли участие в городском референдуме. Мэрия выплатила вам гражданскую компенсацию 100 💵.");
        App.updateHeader();
    },
    runForOffice() {
        if (GameState.user.authority < 50) {
            GameAPI.showPopup("Отказ Избиркома", "У вас недостаточно авторитета! Заработайте хотя бы 50 ⭐ через работу или улицы.");
        } else {
            GameState.president.name = GameState.user.name;
            GameState.president.laws = "Диктатура честного труда и процветания города.";
            GameAPI.showPopup("Победа на выборах!", "Поздравляем! Вы избраны новым Президентом мегаполиса!");
            this.render(document.getElementById('screen-container'));
        }
    }
};
