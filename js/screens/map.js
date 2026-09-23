const MapScreen = {
    render(container) {
        container.innerHTML = `
            <div class="city-card">
                <h2>🏙️ Центр Мегаполиса</h2>
                <p>Сердце города. Здесь решаются судьбы бизнеса, проходят выборы и кипит жизнь обычных горожан.</p>
                <button class="city-btn" onclick="MapScreen.exploreDistrict('center') осмотреть район</button>
            </div>
            <div class="city-card">
                <h2>🏛️ Здание Мэрии</h2>
                <p>Место силы политиков. Голосуйте за законы или выдвигайте свою кандидатуру на пост президента.</p>
                <button class="city-btn gold-btn" onclick="App.navigate('president')">Перейти в Мэрию</button>
            </div>
            <div class="city-card">
                <h2>🕶️ Темные Переулки</h2>
                <p>Территория воров в законе, черного рынка и ночных разборок. Осторожнее с кошельков!</p>
                <button class="city-btn crime-btn" onclick="App.navigate('crime')">Войти в переулки</button>
            </div>
        `;
    },
    exploreDistrict(type) {
        GameState.user.money += 50;
        GameState.user.energy = Math.max(0, GameState.user.energy - 5);
        App.updateHeader();
        GameAPI.showPopup("Осмотр района", "Вы прогулялись по центру, нашли на асфальте забытые 50 💵 и немного устали.");
    }
};
