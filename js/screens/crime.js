const CrimeScreen = {
    render(container) {
        container.innerHTML = `
            <div class="city-card">
                <h2>🕶️ Улица и Криминал</h2>
                <p>Здесь правят авторитеты, воры в законе и уличные группировки. Противостояние с народом в самом разгаре.</p>
                <p>Ваша банда: <b>${GameState.user.gang}</b></p>
                <button class="city-btn crime-btn" onclick="CrimeScreen.robStore()">Ограбить ларек (+350 💵, +5 ⭐)</button>
            </div>
            <div class="city-card">
                <h2>⚖️ Черный рынок</h2>
                <p>Торговля влияния крышеванием бизнеса. Поднимите свой авторитет в криминальных кругах.</p>
                <button class="city-btn crime-btn" onclick="CrimeScreen.joinMafia()">Вступить в крупный синдикат</button>
            </div>
        `;
    },
    robStore() {
        if (GameState.user.energy < 25) {
            GameAPI.showPopup("Истощение", "Слишком мало энергии для криминальных дел!");
            return;
        }
        GameState.user.money += 350;
        GameState.user.authority += 5;
        GameState.user.energy -= 25;
        GameState.user.roleType = "crime";
        GameState.user.role = "Вор / Рецидивист";
        App.updateHeader();
        this.render(document.getElementById('screen-container'));
        GameAPI.showPopup("Успешное дело", "Вы «навели порядок» в ночном ларьке. Получена добыча и авторитет!");
    },
    joinMafia() {
        GameState.user.gang = "Клан Черного Асфальта";
        GameState.user.authority += 20;
        App.updateHeader();
        GameAPI.showPopup("Сходка", "Воры в законе приняли вас в клан. Теперь вы под защитой влиятельных людей.");
    }
};
