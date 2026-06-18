# Articles API

REST API на **NestJS** с аутентификацией (JWT + refresh-токен в httpOnly-куке), CRUD для статей,
хранением в **PostgreSQL** (TypeORM + миграции) и кэшированием в **Redis**.

Проект выполнен по тестовому заданию (см. [task.txt](task.txt)).

---

## Содержание

- [Стек](#стек)
- [Реализованная функциональность](#реализованная-функциональность)
- [Структура проекта](#структура-проекта)
- [Требования](#требования)
- [Быстрый старт](#быстрый-старт)
- [Переменные окружения](#переменные-окружения)
- [Миграции](#миграции)
- [Запуск](#запуск)
- [Документация API (Swagger)](#документация-api-swagger)
- [Примеры запросов](#примеры-запросов)
- [Кэширование](#кэширование)
- [Тесты](#тесты)
- [CI](#ci)

---

## Стек

| Назначение            | Технология                                    |
| --------------------- | --------------------------------------------- |
| Фреймворк             | NestJS 11                                      |
| Язык                  | TypeScript                                     |
| База данных           | PostgreSQL 16 + TypeORM (миграции)             |
| Кэш                   | Redis 7 (`@nestjs/cache-manager` + `@keyv/redis`) |
| Аутентификация        | Passport JWT (access) + refresh-токен в httpOnly-куке |
| Валидация             | `class-validator` / `class-transformer`        |
| Документация          | Swagger (OpenAPI) на `/docs`                   |
| Тесты                 | Jest                                           |

---

## Реализованная функциональность

Соответствие пунктам тестового задания:

1. **Аутентификация** — регистрация и логин, JWT access-токен; дополнительно refresh-токен
   с **ротацией** и серверным logout (хэш refresh-токена хранится в БД), refresh передаётся
   в **httpOnly-куке** (защита от XSS), `SameSite=lax` (защита от CSRF).
2. **PostgreSQL + TypeORM** — соединение настроено через `ConfigService`, структура БД
   управляется **миграциями** (`synchronize: false`).
3. **CRUD «Статья»** — поля `title`, `description`, `publicationDate`, `author`;
   валидация входных данных, **пагинация**, **фильтрация** по автору и диапазону дат публикации;
   создание/обновление/удаление закрыты авторизацией (обновление и удаление — только автором).
4. **Кэширование Redis** — кэш на чтение статей (одиночные и списки) с **инвалидацией**
   при создании/обновлении/удалении.
5. **Тесты** — unit-тесты бизнес-логики (`AuthService`, `ArticlesService`).

---

## Структура проекта

```
src/
├── app.module.ts            # корневой модуль: Config, TypeORM, Cache(Redis), Auth, Articles
├── main.ts                  # bootstrap: ValidationPipe, cookie-parser, Swagger
├── config/
│   └── typeorm.config.ts     # билдер опций TypeORM (общий для Nest и CLI)
├── database/
│   ├── data-source.ts        # DataSource для TypeORM CLI (миграции)
│   └── migrations/           # миграции
├── users/                    # сущность User + UsersService
├── auth/                     # JWT-стратегии, guards, AuthService/Controller
└── articles/                 # сущность Article + CRUD + кэширование
```

---

## Требования

- Node.js 20+
- Docker (для PostgreSQL и Redis) — либо локально установленные PostgreSQL и Redis

---

## Быстрый старт

```bash
# 1. Установить зависимости
npm install

# 2. Создать .env (можно скопировать пример)
cp .env.example .env

# 3. Поднять PostgreSQL и Redis
docker compose up -d

# 4. Применить миграции
npm run migration:run

# 5. Запустить приложение в dev-режиме
npm run start:dev
```

Приложение поднимется на `http://localhost:3000`, Swagger — на `http://localhost:3000/docs`.

---

## Переменные окружения

См. [.env.example](.env.example):

| Переменная               | По умолчанию            | Описание                          |
| ------------------------ | ----------------------- | --------------------------------- |
| `PORT`                   | `3000`                  | Порт приложения                   |
| `DB_HOST`                | `localhost`             | Хост PostgreSQL                   |
| `DB_PORT`                | `5432`                  | Порт PostgreSQL                   |
| `DB_USERNAME`            | `postgres`              | Пользователь БД                   |
| `DB_PASSWORD`            | `postgres`              | Пароль БД                         |
| `DB_NAME`                | `nest_test`             | Имя БД                            |
| `REDIS_HOST`             | `localhost`             | Хост Redis                        |
| `REDIS_PORT`             | `6379`                  | Порт Redis                        |
| `CACHE_TTL`              | `60000`                 | TTL кэша, мс                      |
| `JWT_SECRET`             | —                       | Секрет access-токена              |
| `JWT_EXPIRES_IN`         | `900s`                  | Время жизни access-токена         |
| `JWT_REFRESH_SECRET`     | —                       | Секрет refresh-токена             |
| `JWT_REFRESH_EXPIRES_IN` | `7d`                    | Время жизни refresh-токена        |

---

## Миграции

```bash
# Сгенерировать миграцию по изменениям сущностей
npm run migration:generate src/database/migrations/MyMigration

# Создать пустую миграцию
npm run migration:create src/database/migrations/MyMigration

# Применить миграции
npm run migration:run

# Откатить последнюю
npm run migration:revert
```

Структура БД меняется только через миграции (`synchronize: false`).

---

## Запуск

```bash
npm run start          # обычный запуск
npm run start:dev      # watch-режим
npm run build          # сборка в dist/
npm run start:prod     # запуск собранного (node dist/main)
```

---

## Документация API (Swagger)

После запуска доступна по адресу **`http://localhost:3000/docs`**.
JSON-спека OpenAPI — `http://localhost:3000/docs-json`.

Для защищённых эндпоинтов нажмите **Authorize** и вставьте access-токен (Bearer).

---

## Примеры запросов

### Регистрация

```http
POST /auth/register
Content-Type: application/json

{ "email": "user@test.io", "name": "User", "password": "secret123" }
```

Ответ `201` (refresh-токен ставится в httpOnly-куке `refresh_token`):

```json
{
  "accessToken": "eyJhbGciOi...",
  "user": { "id": "uuid", "email": "user@test.io", "name": "User" }
}
```

### Логин

```http
POST /auth/login
Content-Type: application/json

{ "email": "user@test.io", "password": "secret123" }
```

### Обновление токенов (ротация)

```http
POST /auth/refresh
Cookie: refresh_token=<значение из куки>
```

### Создание статьи (требует авторизации)

```http
POST /articles
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "title": "My article", "description": "Body", "publicationDate": "2026-06-01T00:00:00Z" }
```

### Список статей с пагинацией и фильтрами (публично)

```http
GET /articles?page=1&limit=10&order=DESC&authorId=<uuid>&publishedFrom=2026-01-01&publishedTo=2026-12-31
```

Ответ:

```json
{
  "data": [ { "id": "uuid", "title": "My article", "...": "..." } ],
  "meta": { "total": 1, "page": 1, "limit": 10, "totalPages": 1 }
}
```

### Обновление / удаление (требует авторизации, только автор)

```http
PATCH  /articles/:id     # Authorization: Bearer <accessToken>
DELETE /articles/:id     # Authorization: Bearer <accessToken>
```

---

## Кэширование

- **Чтение** статей кэшируется в Redis:
  - одиночная статья — ключ `article:<id>`;
  - список — ключ `articles:list:v<версия>:<хэш фильтров>`.
- **Инвалидация** при записи:
  - `update`/`remove` удаляют ключ `article:<id>`;
  - `create`/`update`/`remove` инкрементят версию списков (`articles:list:version`),
    из-за чего ранее закэшированные списки становятся недостижимыми и истекают по TTL.
    Такой приём избавляет от удаления ключей по паттерну в Redis.

---

## Тесты

```bash
npm test            # unit-тесты
npm run test:cov    # с покрытием
```

Покрыта бизнес-логика `AuthService` (регистрация/логин/refresh/logout) и `ArticlesService`
(CRUD, попадание/промах кэша, инвалидация, проверка владельца). Зависимости (репозиторий,
кэш, JWT, bcrypt) замоканы, поэтому тесты не требуют запущенных БД и Redis.

---

## CI

GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)) на каждый push/PR:

1. `npm ci` — установка зависимостей;
2. `npm run lint:check` — проверка линтером (без автофикса);
3. `npm run build` — сборка;
4. `npm test` — unit-тесты.
