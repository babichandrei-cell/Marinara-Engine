# Техническая информация: Marinara Engine

Документ фиксирует рабочую конфигурацию проекта и сервера на 27 августа 2026 года. Он предназначен для сопровождения, обновления и восстановления развёртывания. Секреты (пароли, токены, API-ключи, содержимое `.env` и приватные SSH-ключи) здесь намеренно не хранятся.

## Исходный код

| Параметр | Значение |
| --- | --- |
| Рабочий репозиторий | `babichandrei-cell/Marinara-Engine` |
| HTTP-доступ к репозиторию | `https://github.com/babichandrei-cell/Marinara-Engine.git` |
| SSH-доступ к репозиторию | `git@github.com:babichandrei-cell/Marinara-Engine.git` |
| Удалённый репозиторий `origin` | `git@github.com:babichandrei-cell/Marinara-Engine.git` |
| Вышестоящий репозиторий `upstream` | `git@github.com:Pasta-Devs/Marinara-Engine.git` |
| Ветка развёртывания | `staging` |
| Текущий commit | `9535709bb` |
| Версия | `v2.4.4-6-g9535709bb` — шесть коммитов после тега `v2.4.4` |

## Сервер и доступ

| Параметр | Значение |
| --- | --- |
| Имя сервера | `comfy-server` |
| Каталог проекта | `/srv/marinara/Marinara-Engine` |
| SSH-доступ | Используются профили `comfy-local` и `comfy-remote` из SSH-конфигурации. |
| Доступ из локальной сети | `http://192.168.1.27:7860` |
| Доступ извне | Через туннель: `http://10.20.0.1:7860` |
| Публикация контейнера | `0.0.0.0:7860 → 7860/tcp` |

## Развёртывание Marinara Engine

Приложение запускается в Docker Compose, с локальной сборкой образа из исходного кода, а не из готового образа из registry.

| Параметр | Значение |
| --- | --- |
| Compose-сервис | `marinara` |
| Контейнер | `marinara-engine-marinara-1` |
| Образ | `marinara-engine-local` |
| Способ сборки | Dockerfile в корне репозитория; build context — корень проекта |
| Команда запуска | `docker compose up -d --build` из `/srv/marinara/Marinara-Engine` |
| Перезапуск | `unless-stopped` |
| Постоянные данные | Docker volume `marinara-data`, примонтирован в `/app/data` |
| Основные пути в контейнере | `DATA_DIR=/app/data`, `FILE_STORAGE_DIR=/app/data/storage` |

В Compose включён `host.docker.internal` через `host-gateway`, поэтому контейнер Marinara может обращаться к сервисам, работающим на хосте.

## Модели и сервисы ИИ

### Текстовая генерация и embeddings

| Параметр | Значение |
| --- | --- |
| Backend | `llama.cpp` |
| Подключение в Marinara | `Deckards Brain 31B` |
| Основная модель | `Gemma-4-The-Deckards-Brain-31B-NVFP4` |
| Embedding-модель | `BGE-M3-Q8` |
| OpenAI-совместимый endpoint из контейнера | `http://host.docker.internal:8081/v1` |

### Генерация изображений

| Параметр | Значение |
| --- | --- |
| Backend | ComfyUI |
| Подключение в Marinara | `ComfyUI Krea2` |
| Модель | `KREA2/krea2_turbo_int8_convrot.safetensors` |
| Endpoint из контейнера | `http://172.17.0.1:8188` |
| Дополнительные компоненты workflow | `KREA2/qwen3vl_4b_bf16.safetensors`, `WAN22/wan_2.1_vae.safetensors`, LoRA `KREA2/KNP_000003000.safetensors` |

## Аппаратная конфигурация

| Компонент | Значение |
| --- | --- |
| CPU | AMD Ryzen 9 9950X |
| Оперативная память | 96 ГБ DDR5 (2 × 48 ГБ) |
| GPU | MSI GeForce RTX 5090 Gaming Trio OC, 32 ГБ VRAM |
| Лимит мощности GPU | 450 Вт, установлен программно |
| Накопители | SSD 2 ТБ и SSD 4 ТБ |

## Переменные окружения и безопасность

В Compose определены следующие параметры: `NODE_ENV=production`, `MARINARA_DOCKER=true`, `PROVIDER_LOCAL_URLS_ENABLED=true`, а также пути данных. Значения чувствительных переменных не фиксируются в этом документе:

- `ADMIN_SECRET` — административные операции;
- `BASIC_AUTH_USER` и `BASIC_AUTH_PASS` — Basic Auth при публикации сервиса;
- `ENCRYPTION_KEY` — шифрование API-ключей;
- `TRUSTED_HOSTS`, `CORS_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `IP_ALLOWLIST` — контроль сетевого доступа;
- `ENABLE_EXTERNAL_EXTENSIONS` — по умолчанию выключено.

Перед публикацией за пределы доверенной сети необходимо задать `BASIC_AUTH_USER`, `BASIC_AUTH_PASS` и `ADMIN_SECRET`, а также ограничить источники доступа через allowlist или proxy.

## Быстрые команды сопровождения

Все команды ниже выполняются на сервере из `/srv/marinara/Marinara-Engine`.

```bash
# Состояние приложения
docker compose ps
docker compose logs --tail=200 marinara

# Пересобрать и перезапустить после обновления исходного кода
git fetch origin
git pull --ff-only origin staging
docker compose up -d --build

# Проверить точную версию развёрнутого кода
git branch --show-current
git describe --tags --always
git rev-parse --short HEAD
```

## Связанные локальные материалы

- [Описание содержимого рабочей папки](CONTENTS.md).
- `connections/Deckards_Brain_31B.connection.json` — экспорт подключения текстовой модели и embeddings.
- `connections/ComfyUI_Krea2.connection.json` — экспорт подключения и workflow ComfyUI.
- `patches/` — два актуальных патча, используемых с текущим развёртыванием.
