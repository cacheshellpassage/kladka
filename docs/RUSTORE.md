# Публикация в RuStore — пошаговая подготовка

Публикацию выполняет владелец проекта. Здесь всё, что нужно подготовить. Порядок действий от репозитория до
обновлений — в [RELEASE.md](RELEASE.md).

## 1. Название, ID, версия

| Что                          | Где                                                                                                             | Сейчас             |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| Название                     | `apps/app/app.config.json` (`name`), `android/app/src/main/res/values/strings.xml`, `src-tauri/tauri.conf.json` | «Кладка»           |
| Package name (applicationId) | `app.config.json` (`appId`), `android/app/build.gradle`, `capacitor.config.ts`                                  | `app.kladka.guide` |
| Версия                       | `android/app/build.gradle`: `versionCode` (целое, растёт с каждым релизом), `versionName`                       | 1 / 1.0.0          |

> Package name после первой публикации изменить нельзя. Если у вас есть домен, используйте обратную запись
> (`ru.example.kladka`).

## 2. Ключ подписи (keystore)

Создайте ключ один раз и **храните его и пароли в надёжном месте** (без ключа нельзя выпустить обновление):

```bash
keytool -genkeypair -v -keystore kladka-release.jks -alias kladka -keyalg RSA -keysize 4096 -validity 10000
```

Создайте `apps/app/android/keystore.properties` (файл в `.gitignore`, не коммитьте его):

```properties
storeFile=C:/keys/kladka-release.jks
storePassword=********
keyAlias=kladka
keyPassword=********
```

Соберите подписанный релиз:

```bash
pnpm build:web
```

```bash
pnpm --filter @kladka/app exec cap sync android
```

```bash
cd apps/app/android && ./gradlew assembleRelease bundleRelease
```

Результат: `app/build/outputs/apk/release/app-release.apk` и `app/build/outputs/bundle/release/app-release.aab`.
Проверка подписи:

```bash
apksigner verify --print-certs app/build/outputs/apk/release/app-release.apk
```

### Подпись в GitHub Actions

Добавьте секреты репозитория: `KLADKA_KEYSTORE_BASE64` (содержимое `.jks` в base64), `KLADKA_KEYSTORE_PASSWORD`,
`KLADKA_KEY_ALIAS`, `KLADKA_KEY_PASSWORD`. Без них CI собирает неподписанный release-APK и debug-APK.

```bash
base64 -w0 kladka-release.jks > keystore.b64
```

## 3. Графика для карточки

| Материал                     | Требования RuStore (проверьте актуальные в консоли)              | Где взять                                                  |
| ---------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| Иконка                       | 512×512 PNG/JPG до 3 МБ, фон на всю площадь                      | `docs/rustore/icon-512.png`                                |
| Скриншоты                    | не менее 3, PNG/JPG до 3 МБ, пропорции 16:9 (например 1080×1920) | `docs/rustore/1-…7-*.png` — 1080×1920, встроенные текстуры |
| Обложка/баннер (опционально) | по требованиям консоли                                           | обложки построек `apps/app/public/packs/core/previews`     |

> Используйте только скриншоты со **встроенными процедурными текстурами** — не с текстурами из client.jar.

## 4. Текст описания

**Краткое описание (RU):** Пошаговые инструкции строительства: 3D, схемы слоёв, материалы. Офлайн.

**Полное описание (RU):**

> «Кладка» помогает построить красивый дом, башню или замок шаг за шагом. Каждая постройка разбита на понятные
> этапы — фундамент, каркас, стены, окна и двери, крыша, интерьер и декор — а внутри этапов на слои и небольшие
> шаги в том порядке, в котором блоки реально можно поставить руками.
>
> • 36 оригинальных построек разных стилей и размеров
> • 3D-просмотр с подсветкой текущего шага и режимом «Шейдеры» (тени, свечение, закат и ночь)
> • Схема каждого слоя с сеткой и координатами, экспорт в PNG и PDF
> • Список материалов в штуках, стаках и шалкерах — на шаг, слой, этап или всю постройку
> • Импорт своих файлов .schem, .litematic и .nbt и экспорт для Litematica, WorldEdit и структурных блоков
> • Работает без интернета. Без рекламы, покупок и регистрации. Приложение не собирает никаких данных.
>
> NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.
> Неофициальное приложение, не связано с Mojang и Microsoft.

**Short description (EN):** Step-by-step building guides: 3D, layer plans, materials. Offline.

**Full description (EN):**

> Kladka helps you build a house, tower or castle step by step. Every build is split into clear stages — foundation,
> frame, walls, windows & doors, roof, interior and decor — then into layers and small steps in an order you can
> actually place by hand.
>
> • 36 original builds in different styles and sizes
> • 3D view highlighting the current step, plus a "Shaders" mode (shadows, glow, sunset and night)
> • A plan of every layer with grid and coordinates, PNG and PDF export
> • Material lists in pieces, stacks and shulker boxes — per step, layer, stage or the whole build
> • Import your own .schem, .litematic and .nbt files and export for Litematica, WorldEdit and structure blocks
> • Works offline. No ads, purchases or sign-up. The app collects no data.
>
> NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.

Категория: «Образование» или «Развлечения / Инструменты». Ключевые слова: постройки, строительство, схемы, блоки,
инструкция, litematica, schematic.

> Не используйте слово «Minecraft» в названии, иконке и как главное ключевое слово — допустимо только
> описательное упоминание совместимости и дисклеймер.

## 5. Политика конфиденциальности

Текст (можно разместить на любой странице, например GitHub Pages, и указать ссылку в консоли):

> **Политика конфиденциальности приложения «Кладка»**
>
> Приложение не собирает, не хранит на серверах и не передаёт третьим лицам никакие персональные или иные данные.
> В приложении нет рекламы, аналитики, учётных записей и сетевых запросов: все функции работают офлайн.
> Прогресс, избранное, настройки и импортированные пользователем файлы хранятся только на устройстве пользователя
> и удаляются вместе с приложением или кнопкой «Очистить все данные» в настройках. Файлы, которые пользователь
> открывает (постройки, ресурспаки), обрабатываются только на устройстве.
> Контакт: sebastianvisconti38@gmail.com.

В анкете о данных (Data safety) отметьте: **данные не собираются и не передаются**.

Примечание про разрешения: шаблон Capacitor объявляет `android.permission.INTERNET` (WebView его ожидает для
внутреннего https://localhost). Приложение не делает сетевых запросов: это проверяется E2E-тестом и CSP без внешних
источников. Если хотите убрать разрешение, удалите строку из `AndroidManifest.xml` и проверьте запуск на устройстве.

## 6. Возрастной рейтинг

Контент: строительство, нет насилия, чатов, покупок, сбора данных → **0+ / 6+** (в анкете ответьте «нет» на все
вопросы о насилии, азартных играх, пользовательском общении, покупках и рекламе).

## 7. Чек-лист перед загрузкой

- [ ] Финальное название и иконка выбраны (название свободно, не содержит «Minecraft»)
- [ ] `applicationId` финальный
- [ ] `versionCode`/`versionName` увеличены
- [ ] Release-APK/AAB подписан вашим ключом, `apksigner verify` проходит
- [ ] Приложение запускается на реальном Android-устройстве, импорт/экспорт файлов работает (меню «Поделиться»)
- [ ] Скриншоты сделаны с процедурными текстурами
- [ ] Описание содержит дисклеймер
- [ ] Ссылка на политику конфиденциальности указана
- [ ] Анкета данных: «не собирает»
- [ ] Возрастной рейтинг заполнен
- [ ] Ключ подписи и пароли сохранены в двух местах
