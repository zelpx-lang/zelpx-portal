ZELPX — исправление ошибки отправки заявки (Supabase)

Подтверждённая причина:
- В production-проекте таблица public.service_requests не содержит service_city, service_state, service_zip_code, service_latitude, service_longitude.
- Именно поэтому форма выдаёт ошибку `Could not find the 'service_city' column of 'service_requests' in the schema cache`.
- Также проверка показала, что в public.leads отсутствуют service_city/service_state/координаты, а public.contractors пока содержит только базовые поля. После исправления формы эти несовпадения могут вызывать следующие ошибки в географическом подборе и профиле подрядчика.

Что делает SQL:
- Добавляет отсутствующие колонки с `IF NOT EXISTS`.
- Создаёт индексы для поиска по ZIP и городу/штату.
- Просит Supabase обновить schema cache.
- Не удаляет таблицы, записи, пользователей, лиды, кошельки или платежи.
- Не изменяет Stripe-функции и настройки оплаты.

Как применить:
1. Откройте Supabase Dashboard именно проекта `zelpx-database` (project ref `zsrnjkndgbchfxibxiyd`).
2. Сделайте резервную копию базы.
3. Откройте SQL Editor.
4. Вставьте содержимое `supabase-schema-repair.sql` и выполните.
5. Обновите страницу ZELPX и повторите отправку тестовой заявки.

Важно:
- SQL подготовлен, но не применён. Никакие изменения в Supabase/Vercel/GitHub не выполнялись.
- Сначала проверьте, что выбран именно проект `zelpx-database`, а не пустой `zelpx-portal`.
- Это исправляет несовпадение схемы колонок. Географическая логика matching и миграции функций/RLS — отдельная проверка; этот SQL их не разворачивает.
