# AMANAK | أمانك

تطبيق دفاعي للأمن السيبراني الشخصي.

## هيكل المستودع

- `apps/mobile` — تطبيق الجوال (React Native + Expo + TypeScript + Expo Router)
- `apps/web` — تطبيق الويب (React + Vite + TypeScript)
- `backend` — الخادم الخلفي (Django + Django REST Framework)
- `security-engine` — القواعد الدفاعية، المحللات، السمعة
- `ai` — بوابة الذكاء الاصطناعي (معطّلة افتراضياً)
- `packages` — عميل API المشترك، الأنواع، نظام التصميم
- `infrastructure` — Docker، Nginx، المراقبة، السكربتات
- `tests` — اختبارات التكامل، من الطرف للطرف، الأمان
- `docs` — الوثائق: المعمارية، API، الأمان، العمليات، القرارات

## الحالة الحالية

P0 — تأسيس المستودع فقط. لم يتم تنفيذ أي ميزة منتج بعد.

## البدء السريع

راجع `docs/operations/local-development.ar.md`.

## الأمان

راجع `docs/security/security-baseline.ar.md`.