# Runbook: Marinara Engine

Операционная инструкция для сервера `comfy-server`. Команды выполняй по SSH из каталога `/srv/marinara/Marinara-Engine`, если не указано иное.

Сведения о сети, моделях и точной версии находятся в `TECHNICAL_INFO.md`. Не выводи в чат и не записывай в этот файл значения секретов.

## Быстрая диагностика

```bash
cd /srv/marinara/Marinara-Engine

# Код и состояние Compose
git branch --show-current
git rev-parse --short HEAD
git status --short
docker compose ps

# Последние сообщения приложения
docker compose logs --tail=200 marinara

# Проверка, отвечает ли интерфейс локально на сервере
curl -fsS http://127.0.0.1:7860/ >/dev/null && echo 'Marinara отвечает'
```

Также проверь интерфейс вручную:

- из локальной сети: `http://192.168.1.27:7860`;
- через внешний туннель: `http://10.20.0.1:7860`.

Если контейнер не запущен, сразу собери сведения из `docker compose ps` и `docker compose logs --tail=200 marinara` до перезапуска.

## Обычный перезапуск

```bash
cd /srv/marinara/Marinara-Engine
docker compose restart marinara
docker compose ps
docker compose logs --tail=100 marinara
```

Перезапуск не пересобирает образ и не должен затрагивать volume `marinara-data`.

## Обновление ветки `staging`

Перед обновлением создай резервную копию через штатный механизм Marinara Engine или по утверждённой процедуре volume-backup. Убедись, что backup появился и читается.

```bash
cd /srv/marinara/Marinara-Engine

# Предварительная проверка: рабочее дерево должно быть чистым.
git status --short
git fetch origin
git log --oneline HEAD..origin/staging

# Безопасное обновление без merge-коммита.
git pull --ff-only origin staging
docker compose up -d --build

# Проверка после обновления.
git rev-parse --short HEAD
docker compose ps
docker compose logs --tail=200 marinara
curl -fsS http://127.0.0.1:7860/ >/dev/null && echo 'Marinara отвечает'
```

Если `git status --short` не пуст или `git pull --ff-only` не проходит, остановись: сначала сохрани и разберись с локальными изменениями. Не используй принудительный reset без отдельного решения.

## Откат к известному рабочему commit

1. Запиши текущий commit и причину отката в `CURRENT_STATE.md`.
2. Выбери известный рабочий SHA из `git log --oneline` или тега.
3. Переключись на него без переписывания истории и пересобери образ:

```bash
cd /srv/marinara/Marinara-Engine
git log --oneline -20
git switch --detach <рабочий-SHA>
docker compose up -d --build
docker compose ps
```

4. Проверь интерфейс и логи. Чтобы вернуться к ветке, выполни `git switch staging` и затем пройди обычное обновление.

## Патчи

Перед работой с патчами прочитай `PATCHES.md`. Никогда не применяй `.patch` без предварительного `git apply --check`.

На состоянии сервера, зафиксированном 27 августа 2026 года:

- `marinara-empty-send-continue-v8.patch` уже присутствует в коде;
- `capability-api-1.14-current.patch` требует ручной ревизии, поскольку не накладывается целиком на текущую `staging`.

## Проверка конфигурации и безопасности

Приложение слушает `0.0.0.0:7860`, поэтому настройки доступа особенно важны. Проверь, что обязательные чувствительные параметры заданы, не раскрывая их значения:

```bash
cd /srv/marinara/Marinara-Engine
for var in ADMIN_SECRET BASIC_AUTH_USER BASIC_AUTH_PASS ENCRYPTION_KEY; do
  if test -f .env && grep -q "^${var}=." .env; then
    echo "${var}: задана"
  else
    echo "${var}: не задана или не найдена в .env"
  fi
done
```

При публикации за пределы доверенной сети должны быть заданы Basic Auth и `ADMIN_SECRET`. При необходимости проверь также `TRUSTED_HOSTS`, `CORS_ORIGINS`, `CSRF_TRUSTED_ORIGINS` и `IP_ALLOWLIST`.

## Резервное копирование и восстановление

- Локальный архив в рабочей папке: `backup/marinara-backup-2026-08-27_14-32-52.zip`.
- Данные контейнера хранятся в Docker volume `marinara-data`, смонтированном в `/app/data`.
- Перед обновлением делай новый backup и храни хотя бы одну копию вне сервера.
- Не восстанавливай volume поверх работающего контейнера. Сначала останови сервис, сделай отдельную копию текущих данных и только потом выполняй проверенную процедуру восстановления.

Полный сценарий восстановления должен быть проверен отдельно в безопасной среде: нужно подтвердить источник backup, фактический способ импорта и успешный запуск после восстановления. До такой проверки не заменяй содержимое volume вручную.

## Когда обновлять журнал

После обновления, отката, применения патча, инцидента, смены модели или восстановления добавь запись в `CURRENT_STATE.md` с датой, причиной, выполненными действиями, результатом и следующим шагом.
