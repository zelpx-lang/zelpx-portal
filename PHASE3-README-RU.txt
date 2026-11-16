ЭТАП 3 ZELPX — EMAIL-УВЕДОМЛЕНИЯ О ПОДХОДЯЩИХ ЛИДАХ
=====================================================

Подготовлено отдельно. НИЧЕГО НЕ РАЗВЁРНУТО и не включено в Production.

Состав:
- supabase-phase3-notifications.sql — outbox, журнал доставок, настройка email-предпочтения, триггер.
- supabase/functions/dispatch-lead-notifications/index.ts — Edge Function для отправки email через Resend.
- index.html — настройка «Email me when a new lead matches my service area» в разделе My Company.

КАК РАБОТАЕТ:
1. Новый лид получает status='available'.
2. SQL trigger создаёт запись в lead_notification_outbox.
3. Supabase Database Webhook вызывает Edge Function.
4. Функция выбирает только verified подрядчиков с включённым lead_email_notifications.
5. Сопоставляет ZIP-код, расстояние по ZIP-центроидам и fallback city+state.
6. Отправляет email без имени, телефона, email и точного адреса заказчика.
7. Записывает результат доставки с защитой от повторной отправки.

ПЕРЕД STAGING-ТЕСТОМ:
A. Убедиться, что Phase 1 и Phase 2 migrations применены к отдельному STAGING Supabase project.
B. Добавить Edge Function secrets:
   SUPABASE_URL
   SUPABASE_SERVICE_ROLE_KEY
   RESEND_API_KEY
   ZELPX_LEAD_WEBHOOK_SECRET (случайная длинная строка)
   ZELPX_CONTRACTOR_PORTAL_URL (например, https://staging-app.zelpx.com/contractor/login)
   ZELPX_FROM_EMAIL (подтверждённый домен отправителя Resend)
C. Развернуть Edge Function dispatch-lead-notifications с verify_jwt=false,
   поскольку вызов идёт от Database Webhook. Проверка выполняется заголовком
   x-zelpx-webhook-secret; секрет хранится только в Supabase secrets и в настройках webhook.
D. В Supabase Dashboard > Database > Webhooks создать webhook:
   Table: public.lead_notification_outbox
   Event: INSERT
   Type: Supabase Edge Function
   Function: dispatch-lead-notifications
   Header: x-zelpx-webhook-secret = тот же секрет.
E. Применить supabase-phase3-notifications.sql только на STAGING.
F. Проверить на тестовых подрядчиках с разными ZIP/radius и verified status.

ВАЖНО:
- Email provider Resend нужен с подтверждённым доменом и API key.
- Уведомления пока только email; SMS/push не реализованы.
- Отправка только verified подрядчикам; проверка лицензии и разрешений на работу
  остаётся отдельным решением администратора и зависит от штата/специальности.
- Георасстояние ZIP-centroid приблизительное.
- Если проект ещё не применил Phase 1/2, этот SQL и Edge Function не включать.
- Не публиковать в Production до тестов, проверки SPF/DKIM и согласования.
