const App = {
    currentScreen: 'map',

    init() {
        VKApp.init();
        this.setupNavigation();
        this.navigate('map');
    },

    setupNavigation() {
        const buttons = document.querySelectorAll('.nav-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const target = btn.getAttribute('data-target');
                this.navigate(target);
            });
        });
    },

    navigate(screenName) {
        this.currentScreen = screenName;
        const container = document.getElementById('screen-container');
        container.innerHTML = '';

        switch (screenName) {
            case 'map':
                MapScreen.render(container);
                break;
            case 'work':
                WorkScreen.render(container);
                break;
            case 'crime':
                CrimeScreen.render(container);
                break;
            case 'president':
                PresidentScreen.render(container);
                break;
            case 'profile':
                ProfileScreen.render(container);
                break;
            default:
                MapScreen.render(container);
        }
        VKApp.taptic();
    },

    updateHeader() {
        document.getElementById('res-money').innerText = GameState.user.money;
        document.getElementById('res-auth').innerText = GameState.user.authority;
        document.getElementById('res-energy').innerText = GameState.user.energy;

        const statusEl = document.getElementById('user-status');
        statusEl.innerText = GameState.user.role;
        statusEl.className = `badge ${GameState.user.roleType}`;
    }
};

window.addEventListener('DOMContentLoaded', () => {
    App.init();
    App.updateHeader();
});
