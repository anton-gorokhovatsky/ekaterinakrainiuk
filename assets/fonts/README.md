# Шрифты сайта

## Golos Text

Основная типографика сайта и страницы 404 — Golos Text. Локальные WOFF2 содержат переменную ось насыщенности 400–900; в интерфейсе используются 400, 500, 600 и 700. Шрифт распространяется по SIL Open Font License 1.1; текст лицензии — `golostext-OFL.txt`.

Источник: [Golos Text Project](https://github.com/googlefonts/golos-text), веб-файлы из [Google Fonts](https://fonts.google.com/specimen/Golos+Text).

- `golostext-cyrillic.woff2` — кириллица.
- `golostext-cyrillic-ext.woff2` — расширенная кириллица.
- `golostext-latin.woff2` — латиница, цифры и пунктуация.
- `golostext-ruble.woff2` — знак рубля U+20BD из локального `golos-regular.ttf`, отсутствующий в перечисленных веб-поднаборах. Поднабор весит 888 байт вместо 64 240 байт полного TTF. Контур, ширина и отступы глифа сохранены; исходный TTF остаётся в архиве и сайтом не загружается.

Кириллица и латиница предварительно загружаются из `index.html`.

Поднабор рубля получен FontTools 4.60.2, без добавления зависимости в сайт. Лицензия остаётся SIL OFL 1.1 (`golostext-OFL.txt`); записи об авторстве сохранены внутри WOFF2. Команда воспроизведения при установленном FontTools с поддержкой WOFF2:

```sh
python -m fontTools.subset assets/fonts/golos-regular.ttf --unicodes=U+20BD --flavor=woff2 --output-file=assets/fonts/golostext-ruble.woff2 --name-IDs='*' --name-languages='*' --name-legacy --notdef-glyph --notdef-outline --recommended-glyphs
```

## Ambidexter

По одобренной примерке используется только в словах «спорт», «старт», «знак» на рубашках карт. Слово «Ваш», подписи, кнопки и названия результатов набраны Golos Text. Файл подключается из `tarot.css`; синтетическая жирность отключена.

Источник: [репозиторий Ambidexter](https://github.com/egaindahouse/Ambidexter), авторский архив `AmbidexterWEB.zip`, загружен 26 сентября 2026 года. `ambidexter-regular.woff2` — полный исходный WOFF2 размером 46 280 байт, без изменения содержимого и внутреннего имени. Лицензия SIL OFL 1.1 с сохранённым Reserved Font Name — в `ambidexter-OFL.txt`. Нужные кириллические глифы проверены в таблице cmap авторского WOFF и в реальном отображении карточек.

Внешних запросов за шрифтами нет. Остальные файлы и их лицензии сохранены для архивных изображений и сравнения; основной сайт не подключает их. Opuntia в публикуемой папке шрифтов нет.
