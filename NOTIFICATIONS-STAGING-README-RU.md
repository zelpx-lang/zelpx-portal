# ZELPX — изолированная staging-среда push-уведомлений

## Границы окружений
- Отдельный Supabase staging-проект: `uxqykfrzowprkemokhfo` (`zelpx-portal`).
- Production Supabase `zsrnjkndgbchfxibxiyd` (`zelpx-database`) не изменялся.
- Production VAPID-ключи и подписки пользователей не копировались.
- Тестовая страница использует отдельную область service worker `/staging-push-test/`; существующие Production `zelpx-push.js` и корневой service worker не изменяются.

## Что реализовано
- `supabase-notifications-staging.sql` — минимальная тестовая схема, outbox и правила маршрутизации событий.
- `supabase-notifications-staging-hardening.sql` — атомарная блокировка outbox, защита от дублей, RLS и индексы.
- `supabase-notifications-staging-webhook.sql` — Database Webhook через Vault и таблица подписок тестовых устройств.
- `supabase-functions/dispatch-push-notification/index.ts` — серверная отправка push-уведомлений.
- `supabase-functions/staging-push-test/index.ts` — регистрация тестового устройства, удаление подписки и отправка тестового push.
- `staging-push-test/index.html` и `staging-push-test/sw.js` — изолированная страница тестирования и отдельный service worker.

## Секреты
В Supabase Vault сохранены четыре независимых staging-секрета:
- `zelpx_push_webhook_secret`
- `zelpx_vapid_public_key`
- `zelpx_vapid_private_key`
- `zelpx_vapid_subject`

VAPID subject указывает на публичный сайт Zelpex. Значения секретов не хранятся в GitHub или SQL-файлах. RPC `get_push_runtime_secrets()` доступна только роли `service_role`.

## Развёрнутые Edge Functions
- `dispatch-push-notification` — ACTIVE, `verify_jwt=false`; проверяет отдельный длинный webhook-секрет из Vault.
- `staging-push-test` — ACTIVE, `verify_jwt=true`; требует действующую staging Auth-сессию и отправляет тестовое уведомление только на устройства этого аккаунта.

## Логика и безопасность
1. Новый лид создаёт события только для подрядчиков со статусом `verified`, если совпадает ZIP, расстояние попадает в радиус обслуживания или совпадают город и штат при отсутствии координат.
2. Сообщение в чате создаёт уведомление для второго участника диалога.
3. Текст сообщения, телефоны, адреса и приватные данные лида не включаются в push payload.
4. Дубли предотвращаются уникальным ключом по типу события, исходной записи и получателю.
5. `claim_push_notification` атомарно блокирует событие на пять минут, предотвращая параллельную повторную отправку.
6. Устаревшие push-endpoints с ответом 404/410 удаляются.
7. Тестовый endpoint проверяет JWT, привязывает подписку к текущему пользователю и принимает только HTTPS push endpoints известных провайдеров.
8. Прямой доступ ролей `anon` и `authenticated` к outbox и таблицам подписок закрыт; серверные операции выполняются через `service_role`.

## Что проверено
- Тест географии: два подходящих проверенных подрядчика получили события; подрядчик вне радиуса и подрядчик со статусом pending исключены.
- Тест чата: события клиента и подрядчика направлены противоположному участнику; приватный текст не попал в уведомление.
- Тест блокировки: первый claim успешен, второй параллельный claim не получил запись.
- Webhook базы → Edge Function: 8 запросов вернули HTTP 200; все 8 синтетических событий обработаны, 0 осталось в ожидании и 0 в обработке.
- На момент серверных тестов реальные браузерные подписки ещё не были зарегистрированы, поэтому внешние push-уведомления не отправлялись.

## Как проверить на реальном устройстве
Откройте `/staging-push-test/` на HTTPS Preview-деплое feature-ветки:
1. Создайте отдельную тестовую учётную запись в staging-проекте. Не используйте пароль от Production.
2. Если включено подтверждение email, подтвердите адрес и вернитесь на ту же Preview-страницу для входа.
3. Нажмите **Enable push on this device** и разрешите уведомления браузера.
4. Нажмите **Send a test notification**. Страница должна сообщить об успешной отправке на одно устройство; браузер должен показать тестовое уведомление ZELPX.
5. Для второго устройства войдите в ту же staging-учётную запись и повторите шаги 3–4.
6. Кнопка **Remove this device subscription** удаляет тестовую подписку.

Страница доступна на Vercel Preview feature-ветки, защищённой Vercel SSO. Production-домен и Production-переменные окружения не меняются.

## Что остаётся для полного end-to-end теста
Тестовая страница проверяет VAPID, регистрацию устройства и фактическую доставку push. Она пока не подключает существующие Production customer/contractor страницы к staging Auth. Для сквозной проверки лидов и чата нужно отдельно настроить staging frontend, создать тестовые профили клиента и подрядчика и зарегистрировать их подписки в `contractor_push_subscriptions` и `chat_push_subscriptions`.

Не меняйте Production VAPID key и Production `send-chat-push` в рамках staging-проверки.

## Безопасность
Production-миграции, Production Edge Functions, Stripe, Vercel Production environment variables и Production deployments не менялись. Слияние с `main` не выполнялось.
