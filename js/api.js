const GameAPI = {
    showPopup(title, text) {
        document.getElementById('popup-title').innerText = title;
        document.getElementById('popup-text').innerText = text;
        document.getElementById('game-popup').classList.remove('hidden');
        VKApp.taptic();
    }
};

document.getElementById('popup-close').addEventListener('click', () => {
    document.getElementById('game-popup').classList.add('hidden');
});
