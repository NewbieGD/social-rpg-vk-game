// Картинки сцен над чатами: кафе (общий), бар (воровской), зал заседаний
// (правительственный). Везде null — рисуется встроенная графика.
// Чтобы поставить свою картинку или гифку: положи файл в assets/cafe/ и
// впиши путь, например "assets/cafe/bar-table.png".
//
// background — фон всей сцены (высота ~260px, растягивается по ширине)
// character  — посетитель без головы (аватарку рисует игра), 64×64
// table      — стол/бочка/трибуна со всем, что на нём, 72×44
// cup        — отдельно напиток (кофе/виски/вода), 28×28, можно гифку
// emptyTable — свободное место

const EMPTY = () => ({ background: null, character: null, table: null, cup: null, emptyTable: null });

export const CHAT_SCENE_ASSETS = {
    general: EMPTY(),
    thief: EMPTY(),
    gov: EMPTY(),
};
