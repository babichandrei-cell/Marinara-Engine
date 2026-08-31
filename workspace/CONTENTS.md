# Содержание рабочей папки Marinara Engine

Документ описывает состояние папки на 29 августа 2026 года. Он не заменяет документацию Marinara Engine, а служит навигацией по локальным материалам: кампании, настройкам и доработкам.

## Общая структура

| Путь | Назначение |
| --- | --- |
| `lore/` | Папка с материалами миров и кампаний; сейчас содержит **The Pentad Bureau**. |
| `agents/` | Импортируемые архивы агентов кампании. |
| `connections/` | Экспортированные настройки подключений, используемых кампанией. |
| `prompt-templates/` | Актуальные текстовые шаблоны для агентов и сжатого состояния чата. |
| `preset/` | Импортируемый пресет поведения для RP. |
| `chat-settings/` | Профиль настроек чата кампании. |
| `patches/` | Актуальные патчи и скрипты их применения; в `archive/` лежит история старых вариантов. |
| `backup/` | Полная локальная резервная копия Marinara Engine и манифест её контрольной суммы. |
| `README.md` | Точка входа в проект: назначение, структура, сервер и правила работы. |
| `CURRENT_STATE.md` | Живой журнал: текущая задача, решения, изменения и точка продолжения. |
| `AGENTS.md` | Обязательные правила работы с проектом для новых сессий. |
| `PATCHES.md` | Назначение, статус и безопасный порядок проверки серверных патчей. |
| `RUNBOOK.md` | Операционная инструкция для диагностики, обновления и отката сервера. |
| `CONTENTS.md` | Этот навигационный документ по содержимому рабочей папки. |
| `TECHNICAL_INFO.md` | Техническая информация о развёртывании, сервере и моделях. |
| `.DS_Store` | Служебные файлы Finder в macOS (в корне и в `lore/The-Pentad-Bureau/`); для проекта не нужны. |

## `lore/The-Pentad-Bureau/` — кампания

### Путеводитель по миру

- `WORLD_GUIDE.md` — основная сводка по миру The Pentad Bureau: жанр, Alderwick, Бюро, внешние силы, технологии, социальные правила и источники конфликтов.

### `Characters/`

Шесть экспортированных карточек персонажей в формате `.marinara.json`. В этих файлах хранятся не только карточки, но и связанные данные кампании, поэтому их размер — несколько мегабайт.

| Файл | Персонаж |
| --- | --- |
| `Anya Taylor-Joy.marinara.json` | Anya Taylor-Joy |
| `Emma Stone.marinara.json` | Emma Stone |
| `Eva Green.marinara.json` | Eva Green |
| `Milla Jovovich.marinara.json` | Milla Jovovich |
| `Natalie Dormer.marinara.json` | Natalie Dormer |
| `Robert Downey Jr..marinara.json` | Robert Downey Jr. |

### `World-Lorebook/`

- `Alderwick.marinara.json` — экспорт лорбука мира Alderwick от 29 августа 2026 года. Содержит 96 записей: 39 отдельных normal-записей возможных повторяющихся NPC с ключами и включённой векторизацией, а также отключённый совместимый индекс прежнего общего roster.

### `NPCs/`

- `Alderwick-NPCs-list.txt` — исходный список 39 NPC Альдервика с их публичными ролями и обычными локациями; имена служат только визуальными якорями для консистентности изображений.

## `agents/`

Импортируемые архивы агентов. Каждый архив содержит манифест, настройки и основной prompt. Prompts четырёх агентов идентичны одноимённым шаблонам в `prompt-templates/`.

- `World-State.agent.zip` — ведёт дату, время, место, погоду, температуру и пользовательские поля мира.
- `Character-Tracker.agent.zip` — отслеживает присутствующих персонажей, их состояние и внешний вид.
- `Custom-Tracker.agent.zip` — обновляет визуальное состояние сцены по пользовательским полям.
- `Illustrator.agent.zip` — вариант агента для визуального описания текущей сцены.

### `Pics/`

- `Pics/Characters/` — шесть PNG-портретов: `AnyaTaylorJoy.png`, `EmmaStone.png`, `EvaGreen.png`, `MillaJovovich.png`, `NatalieDormer.png`, `RobertDownieJr.png`.
- `Pics/Logos/` — три PNG-логотипа: `AlderwickLogo.png`, `PresetLogo.png`, `ThePentadBureauLogo.png`.

### `FirstMessages/`

- `001-SalmaHyek-JennaOrtega.txt` — стартовая сцена расследования пропажи в Alderwick: 12 июля, 11:32.

## `connections/`

Экспортированные настройки подключений, вынесенные из папки кампании:

- `ComfyUI_Krea2.connection.json` — подключение `ComfyUI Krea2` для генерации изображений.
- `Deckards_Brain_31B.connection.json` — пользовательское подключение `Deckards Brain 31B`.

## `prompt-templates/`

Исходные тексты инструкций для агентов:

- `worldState.txt` — обновление времени, места, погоды и пользовательских полей мира.
- `characterTracker.txt` — JSON-состояние NPC и участников текущей сцены.
- `customTracker.txt` — JSON визуального состояния: сеттинг, освещение, атмосфера, объекты и расположение.
- `illustrator.txt` — шаблон визуального состояния сцены, аналогичный `customTracker.txt`.
- `chatSummary.txt` — компактное итоговое WORLD STATE чата: сохраняет только установленное текущее состояние симуляции.

## `preset/`

- `RP Core v0.6 Universal Dense.marinara.json` — экспорт от 29 августа 2026 года пресета **RP Core v0.6 Universal Dense** для импорта в Marinara Engine; 11 секций, 3 группы и 4 блока выбора.

## `chat-settings/`

- `The Pentad Bureau v2.marinara-settings-profile.json` — экспорт профиля настроек чата **The Pentad Bureau v2**.

## `patches/` — актуальные доработки

Это набор файлов для изменения исходного кода Marinara Engine и упаковки capability-пакета **Character Lore Sync**. Скрипты применяются из корня исходного репозитория Marinara Engine, на который рассчитаны их пути.

| Файл | Назначение |
| --- | --- |
| `capability-api-1.14-current.patch` | Текущий крупный патч Capability API 1.14; затрагивает 20 файлов. |
| `marinara-empty-send-continue-v8.patch` | Патч поведения пустой отправки/продолжения сообщения. |
| `marinara-storyboard-after-trackers-v2.4.4.patch` | Запускает Storyboard и Illustrator после трёх трекеров и передаёт им успешные результаты текущего хода. |
| `marinara-roleplay-storyboard-wait-for-trackers-v1.patch` | Серверный барьер: автоматический Roleplay Storyboard ждёт сохранения трекеров текущего хода. |
| `marinara-storyboard-planner-output-budget-v1.patch` | Повышает output budget Roleplay Storyboard planner до 4096 и объясняет fallback при обрезанном JSON. |
| `marinara-roleplay-storyboard-known-characters-v2.patch` | Накопительный каталог `knownCharacters`: Character Tracker сохраняет последние состояния даже отсутствующих в финале персонажей, а Roleplay Storyboard получает его как визуальную справку; собран на фактической серверной базе `9535709bb`. |
| `marinara-roleplay-storyboard-known-custom-tracker-scenes-v1.patch` | Накопительный каталог `knownCustomTrackerScenes`: Custom Tracker сохраняет последнее известное визуальное состояние каждой локации по полю `Setting`, а Roleplay Storyboard получает его как справку для ранних кадров эпизода. |
| `marinara-roleplay-storyboard-first-response-v1.patch` | Клиентская стартовая логика автоматического Roleplay Storyboard: первый новый ответ модели в пустом чате запускает генерацию, а открытие старого чата — нет. |
| `marinara-world-maps-final-scene-location-v1.patch` | Серверная поддержка финальной сценической локации при пустом roleplay-автопродолжении и доверенная локальная установка capability-пакета. |
| `hierarchical-maps-1.4.3-alderwick.1.zip` | Переупакованный World Maps для патча выше: инструкция модели отправлять скрытую директиву финальной локации. |

### `patches/archive/2026-08-22/`

Архив промежуточных версий и заметок от 22 августа 2026 года. Он сохранён для истории и сравнения с актуальными патчами, а не для обычного применения.

- Скрипты применения: `add-capability-character-lore-behavior-regression.py`, `apply-capability-api-1.14.py`, `apply-capability-api-1.14-v2.py`, `apply-capability-api-1.14-create-entry.py`, `apply-capability-api-1.14-character-lore.py`, `apply-capability-local-artifact-installer.py`.
- Патчи Capability API: `marinara-capability-api-1.14-draft.patch`, `capability-api-1.14-working.patch`, `capability-api-1.14-final.patch`.
- Патч трекера: `marinara-referenced-character-tracker.patch`.
- Архивы ранних Character Lore Sync: `character-lore-sync-0.1.0.marinara.zip`, `character-lore-sync-0.1.1.marinara.zip`, `character-lore-sync-0.2.0.marinara.zip`, `character-lore-sync-0.2.1.marinara.zip`.
- Заметки: `marinara-capability-api-1.14-notes.md`, `marinara-referenced-character-tracker-NOTES.txt`.

### `patches/archive/2026-08-27/`

Файлы, которые больше не должны лежать среди актуальных патчей, но сохранены без изменения:

- `character-lore-sync-0.2.3.marinara.zip` и `character-lore-sync-0.2.3.server.mjs` — готовый capability-пакет Character Lore Sync 0.2.3 и его исходный серверный модуль.
- `add-character-lore-sync-semantics-regression.py` — сценарий регрессионной проверки семантики синхронизации лора персонажей.
- `apply-capability-embedded-lorebook-sync.py` — скрипт изменений для встроенной синхронизации лорбука персонажа.
- `apply-post-generation-character-resource-refresh.py` — скрипт обновления ресурсов персонажей после генерации.

### `patches/archive/2026-08-31/`

- `marinara-roleplay-storyboard-known-characters-v1.patch` — первая версия патча каталога состояний. Не применялась и заменена вариантом `v2`, собранным на фактической серверной базе и дополненным диагностическими логами.

## `backup/`

- `marinara-backup-2026-08-27_14-32-52.zip` — резервная копия размером около 270 МБ, созданная 27 августа 2026 года в 14:32:52. Архив содержит профиль Marinara и таблицы данных, включая чаты, сообщения, варианты сообщений и данные сессий вызовов.
- `README.md` — размер и SHA-256 архива; сам ZIP не включается в Git-зеркало из-за размера.

## Краткая статистика

- 37 файлов материалов проекта и девять Markdown-документов вне архивов патчей, не считая служебных `.DS_Store`.
- Самые объёмные части: `backup/` (около 270 МБ) и `lore/The-Pentad-Bureau/` (около 47 МБ).
