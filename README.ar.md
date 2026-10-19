# AMANAK — أمانك

منصّة دفاعية للأمن السيبراني الشخصي. تساعد الأفراد على فهم وتقليل تعرّضهم
الرقمي: فحص الروابط والرسائل، مراقبة تسريبات البيانات، متابعة الأجهزة والحسابات،
إدارة المصادقة الثنائية وكلمات المرور، والتوعية الأمنية — عبر تطبيق ويب وتطبيق
جوال وواجهة برمجية واحدة.

> دفاعي بالتصميم: مراقبة التسريبات اختيارية، وخزنة كلمات المرور وأسرار
> المصادقة الثنائية "عمياء على الخادم" (تشفير من الطرف للطرف)، وبوابة الذكاء
> الاصطناعي معطّلة افتراضياً.

## الميزات

| المجال | الوظيفة |
| --- | --- |
| لوحة التحكم ودرجة الأمان | تقييم شامل مع اتجاهات وتوصيات |
| الماسح | تحليل التصيّد للروابط والرسائل، مع شرح اختياري بالذكاء الاصطناعي |
| مراقبة التسريبات | فحص اختياري يحفظ الخصوصية |
| الأجهزة والحوادث | جرد الأجهزة والحوادث الأمنية |
| الحسابات | جرد الحسابات الإلكترونية وتعرّضها |
| إدارة المصادقة الثنائية (`/vault`) | تخزين أسرار TOTP عمياء على الخادم |
| خزنة كلمات المرور | كلمات مرور مشفّرة من الطرف للطرف |
| حماية العائلة | ضوابط ووصاية عائلية |
| التوعية | سيناريوهات تدريب أمني وتقدّم |
| الفواتير | الخطط وإدارة الاشتراك والاستخدام |
| الإشعارات | خلاصة إشعارات داخل التطبيق |
| لوحة الطاقم | إشراف ومستخدمون وتذاكر وسجل تدقيق ومؤشرات واشتراكات وإعلانات حسب الدور |

## هيكل المستودع

```
amanak/
├── apps/
│   ├── web/            # تطبيق الويب (React + Vite + TypeScript)
│   └── mobile/         # تطبيق الجوال (React Native + Expo + Expo Router)
├── backend/            # واجهة Django + DRF (حسابات، ماسح، أجهزة، حوادث، …)
│   └── apps/           # ai_assistant, breach_monitor, notifications, two_factor,
│                       # password_vault, family, awareness, billing, staff
├── packages/
│   ├── shared-types/   # عقود TypeScript المشتركة
│   ├── api-client/     # عميل fetch مُنمّط (شكل الخطأ { code, message, details })
│   └── design-system/  # نظام التصميم والرموز المشتركة
├── security-engine/    # القواعد، المحللات، السمعة، التنقيح
├── ai/                 # بوابة ذكاء اصطناعي مستقلة عن المزوّد (معطّلة افتراضياً)
├── infrastructure/     # Docker، Nginx، المراقبة، السكربتات
├── tests/              # اختبارات التكامل والأمان (pytest)
└── docs/               # المعمارية، API، الأمان، العمليات، القرارات (ثنائية اللغة)
```

## التقنيات

- **الخادم** — Python (إنتاج 3.11، تطوير/CI 3.8)، Django + DRF، SimpleJWT،
  PostgreSQL، Redis، Celery، Gunicorn، وNginx.
- **الويب** — React 18، Vite، TypeScript، React Router؛ Vitest + Testing Library،
  وPlaywright للاختبارات من الطرف للطرف.
- **الجوال** — React Native + Expo (Expo Router)، TypeScript، تشفير `@noble`،
  وتخزين الرموز في `expo-secure-store`.
- **المشترك** — `@amanak/shared-types` و`@amanak/api-client` و`@amanak/design-system`.
- **البنية التحتية** — Docker Compose (محلي / staging / إنتاج)، Nginx، وUptime Kuma اختياري.

## الحالة

تطوير نشط وفق خطة مرحلية. المعلم الحالي: **P16.1 (مخطط اتجاه النتيجة الأمنية)**.

| الحزمة | العدد | الأمر |
| --- | --- | --- |
| الخادم (pytest) | 404 | `POSTGRES_HOST=127.0.0.1 pytest -q` |
| الويب (Vitest) | 101 | `npm test -w @amanak/web` |
| الجوال (Vitest) | 46 | `npm test -w @amanak/mobile` |
| الويب E2E (Playwright) | الطاقم + التدفقات الأساسية | `npm run e2e -w @amanak/web` |

## البدء السريع

### الخيار أ — حزمة Docker (محلي شبيه بالإنتاج)

تشغّل Postgres وRedis والخادم وNginx (واجهة API على `:8080`):

```bash
cp .env.example .env
docker compose -p amanak-local \
  -f docker-compose.prod.yml \
  -f docker-compose.local-prod.yml \
  -f docker-compose.local-prod.ports.yml \
  up -d
curl http://localhost:8080/healthz/        # {"status": "ok"}
```

### الخيار ب — الخادم على SQLite (بدون Docker)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo          # بيانات تجريبية اختيارية (demo@amanak.local)
python manage.py runserver 0.0.0.0:8000
```

قاعدة API: `http://localhost:8000/api/v1` · لوحة الإدارة: `http://localhost:8000/admin/`.

### تطبيق الويب

```bash
npm install                         # مرة واحدة من جذر المستودع (workspaces)
npm run dev:web                     # http://localhost:5173
```

### تطبيق الجوال

```bash
npm run dev:mobile                  # خادم Expo (اختر i / a / w)
```

## تشغيل الاختبارات

شغّل اختبارات الخادم دائماً من **جذر المستودع** — يجمع `pytest.ini` الجذري كلاً من
`backend/tests/` و`tests/security/`:

```bash
POSTGRES_HOST=127.0.0.1 pytest -q
```

الويب والجوال:

```bash
npm run typecheck                   # جميع الـ workspaces
npm test -w @amanak/web
npm test -w @amanak/mobile
```

### الطرف للطرف (Playwright)

تعمل اختبارات E2E على الويب مقابل خادم Docker. كل تحميل صفحة يجدّد الجلسة، وهو ما
يتجاوز حد المصادقة في الإنتاج (20/دقيقة)، كما تُجري الاختبارات عمليات فحص أكثر بكثير
من مستخدم حقيقي فتتجاوز حد الفحص لكل عنوان IP (60/دقيقة). لذا استهدف خادماً يعمل بـ
`DJANGO_DEBUG=true` مع رفع `AUTH_THROTTLE_RATE` و`SCAN_*_THROTTLE_RATE`
(قابلة للتجاوز في وضع التصحيح فقط):

```bash
cd apps/web
npx playwright install --with-deps chromium   # مرة واحدة
npm run e2e
```

## الإعدادات

انسخ `.env.example` إلى `.env` واملأ القيم. أهم المجموعات:

- **التطبيق / Django** — `APP_ENV`، `DJANGO_SECRET_KEY`، `DJANGO_ALLOWED_HOSTS`،
  `DJANGO_CORS_ORIGIN_WHITELIST`.
- **قاعدة البيانات / Redis** — `DB_*`، `REDIS_HOST`، `REDIS_PORT`.
- **محرّك الأمان** — `RULES_DIRECTORY`، `REPUTATION_ENABLED`.
- **بوابة الذكاء الاصطناعي** — `AI_ENABLED=false` افتراضياً؛ `AI_PROVIDER`، `AI_API_KEY`، …
- **مراقبة التسريبات** — `BREACH_MONITOR_ENABLED=False` افتراضياً؛ `HIBP_API_KEY`.
- **البريد** — `EMAIL_*`، `PUBLIC_BASE_URL` لروابط التحقق/إعادة التعيين.

## نظرة على API

المسار الأساسي `api/v1/`؛ و`healthz/` غير محمي. المصادقة بـ JWT فقط
(`JWTAuthentication` + صنف انتحال الطاقم)، ومصادقة جلسات Django **غير** مفعّلة
على الـ API.

```
auth/            register, login, refresh-token, logout, verify-email, password-reset-*
me/              المستخدم الحالي
dashboard/       درجة الأمان والملخص
accounts/        جرد الحسابات (مقيّد بالمستخدم)
devices/         جرد الأجهزة (مقيّد بالمستخدم)
incidents/       تتبّع الحوادث (مقيّد بالمستخدم)
scan/            url, message, history
ai/              explain-scan, guidance            (معطّل افتراضياً)
breach/          check, hits                       (اختياري)
two-factor/      مصادقة ثنائية عمياء على الخادم
password-vault/  خزنة كلمات مرور عمياء على الخادم
family/          حماية العائلة
awareness/       categories, scenarios, answer, progress, reset
billing/         plans, subscription, usage
notifications/   list, mark-read
staff/           users, moderation, tickets, audit, metrics, subscriptions, announcements
```

المواصفة الكاملة: [`docs/api/openapi.yaml`](docs/api/openapi.yaml).

## الأمان

- مصادقة ثنائية وخزنة كلمات مرور عمياء على الخادم (تشفير في العميل).
- مراقبة تسريبات اختيارية تحفظ الخصوصية.
- مصادقة API بـ JWT فقط؛ نقاط المصادقة محدودة المعدّل.
- راجع [`docs/security/security-baseline.ar.md`](docs/security/security-baseline.ar.md).

## الوثائق

- [المعمارية](docs/architecture/initial-architecture.ar.md)
- [API (OpenAPI)](docs/api/openapi.yaml)
- [الخط الأساسي للأمان](docs/security/security-baseline.ar.md)
- [التطوير المحلي](docs/operations/local-development.ar.md)
- [النشر](docs/operations/deployment.ar.md)
- [قرارات المعمارية (ADR)](docs/decisions/)
- الفهرس العربي: [`docs/README.ar.md`](docs/README.ar.md)

## المساهمة

- حافظ على نجاح حزم الاختبارات (أعلاه) وشغّل المدقّقات/الأنواع قبل فتح تغيير.
- الوثائق تُصان ثنائية اللغة (`*.md` و`*.ar.md`).
- القرارات المهمة تُدوّن كـ ADR في `docs/decisions/`.
- على الوكلاء/الأتمتة اتباع [`AGENTS.md`](AGENTS.md).
