// Все звуки генерируются осциллятором Web Audio на лету — файлы не нужны.
// Все визуальные эффекты (конфетти, тряска, летящие цифры) — чистый CSS/DOM.

let audioCtx = null;
function getAudioCtx() {
    if (!audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            return null;
        }
    }
    return audioCtx;
}

function beep({ freq = 440, duration = 0.15, type = "sine", volume = 0.15, delay = 0 } = {}) {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const startAt = ctx.currentTime + delay;
    gain.gain.setValueAtTime(volume, startAt);
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
    osc.start(startAt);
    osc.stop(startAt + duration);
}

export function playSuccessSound() {
    beep({ freq: 523, duration: 0.1 });
    beep({ freq: 659, duration: 0.15, delay: 0.1 });
    beep({ freq: 784, duration: 0.22, delay: 0.2 });
}

export function playFailSound() {
    beep({ freq: 220, duration: 0.25, type: "sawtooth", volume: 0.1 });
    beep({ freq: 165, duration: 0.3, type: "sawtooth", volume: 0.1, delay: 0.15 });
}

export function playCoinSound() {
    beep({ freq: 988, duration: 0.08, type: "square", volume: 0.08 });
    beep({ freq: 1319, duration: 0.12, type: "square", volume: 0.08, delay: 0.06 });
}

export function playMessageSound() {
    beep({ freq: 880, duration: 0.09, type: "sine", volume: 0.07 });
}

// Анимированный счётчик числа (например, баланс от 0 до текущего значения при
// открытии профиля) — плавно, с замедлением к концу.
export function animateCounter(el, from, to, duration = 800, formatFn = (v) => v.toFixed(2)) {
    const start = performance.now();
    function tick(now) {
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = from + (to - from) * eased;
        el.textContent = formatFn(value);
        if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

// Тряска элемента — для негативных событий (ограбление, проигрыш дуэли).
export function shakeElement(el) {
    el.classList.remove("fx-shake");
    void el.offsetWidth; // форсируем reflow, чтобы анимация запустилась заново при повторном вызове
    el.classList.add("fx-shake");
}

// Конфетти — для побед (сдал экзамен, выиграл дуэль). container должен быть
// position:relative (или .card, у которой уже так).
export function burstConfetti(container, count = 24) {
    container.style.position = container.style.position || "relative";
    container.style.overflow = "hidden";
    const colors = ["#6c5ce7", "#a29bfe", "#ffd873", "#7ee787", "#ff6b81"];
    for (let i = 0; i < count; i++) {
        const piece = document.createElement("div");
        piece.className = "fx-confetti-piece";
        piece.style.left = `${Math.random() * 100}%`;
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDelay = `${(Math.random() * 0.3).toFixed(2)}s`;
        piece.style.setProperty("--drift", `${Math.round((Math.random() - 0.5) * 120)}px`);
        container.appendChild(piece);
        setTimeout(() => piece.remove(), 1500);
    }
}

// Летящий текст "+50₭" / "-20₭" над элементом.
export function floatingCoinText(anchorEl, text, positive = true) {
    anchorEl.style.position = anchorEl.style.position || "relative";
    const el = document.createElement("div");
    el.className = positive ? "fx-float-coin fx-float-positive" : "fx-float-coin fx-float-negative";
    el.textContent = text;
    anchorEl.appendChild(el);
    setTimeout(() => el.remove(), 1200);
}
