const VKApp = {
    init() {
        if (typeof vkBridge !== 'undefined') {
            vkBridge.send('VKWebAppInit').then(() => {
                console.log('VK Bridge Initialized');
                this.loadUserData();
            }).catch(err => {
                console.log('VK Bridge init error or browser mode', err);
                this.loadMockData();
            });
        } else {
            this.loadMockData();
        }
    },
    loadUserData() {
        vkBridge.send('VKWebAppGetUserInfo').then(data => {
            document.getElementById('user-name').innerText = `${data.first_name} ${data.last_name}`;
            if (data.photo_200) {
                document.getElementById('user-avatar').src = data.photo_200;
            }
            GameState.user.name = `${data.first_name} ${data.last_name}`;
        }).catch(() => {
            this.loadMockData();
        });
    },
    loadMockData() {
        document.getElementById('user-name').innerText = GameState.user.name;
    },
    taptic() {
        if (typeof vkBridge !== 'undefined') {
            vkBridge.send('VKWebAppTapticImpactOccurred', { style: 'medium' }).catch(() => {});
        }
    }
};
