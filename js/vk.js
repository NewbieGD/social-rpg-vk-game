// VK передаёт параметры запуска (vk_user_id, sign и т.д.) прямо в адресной строке,
// когда открывает наше приложение внутри себя. Здесь их просто читаем из URL —
// bridge.send('VKWebAppInit') нужен для остальных возможностей VK (плашки,
// уведомления и т.д.), сам факт открытия внутри VK он не подтверждает, это делает
// подпись 'sign', которую проверяет backend.

export function getVkLaunchParams() {
    const params = new URLSearchParams(window.location.search);
    const out = {};
    for (const [key, value] of params.entries()) {
        if (key.startsWith("vk_") || key === "sign") {
            out[key] = value;
        }
    }
    return Object.keys(out).length > 0 ? out : null;
}

export async function getVkUserInfo() {
    if (!window.vkBridge) return null;
    // Как и VKWebAppInit ниже, этот вызов вне настоящего VK (или без выданного
    // разрешения) может зависнуть навсегда, не ответив ни успехом, ни ошибкой —
    // именно из-за этого экран профиля мог виснуть на "Загружаем...". Поэтому
    // тоже ограничиваем ожидание по времени.
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 2000));
    try {
        const result = await Promise.race([window.vkBridge.send("VKWebAppGetUserInfo"), timeout]);
        if (!result) return null;
        return {
            photoUrl: result.photo_200 || result.photo_100 || null,
            fullName: [result.first_name, result.last_name].filter(Boolean).join(" ") || null,
        };
    } catch (e) {
        // Вне настоящего VK (или если пользователь не разрешил) — просто нет данных,
        // не критично, профиль показывается и без них.
        return null;
    }
}

export async function initVkBridge() {
    if (!window.vkBridge) {
        return;
    }
    // Вне настоящего VK send('VKWebAppInit') может не ответить ни успехом, ни
    // ошибкой вообще — просто зависнуть. Поэтому ждём максимум 2 секунды и
    // в любом случае продолжаем работу дальше (это только "приветствие" VK,
    // без него можно жить — важна только подпись, которую проверяет backend).
    const timeout = new Promise((resolve) => setTimeout(resolve, 2000));
    try {
        await Promise.race([window.vkBridge.send("VKWebAppInit"), timeout]);
    } catch (e) {
        console.warn("VKWebAppInit пропущен (не внутри VK):", e);
    }
}
