# التطوير المحلي — أمانك

## المتطلبات الأساسية

- Git
- Docker + Docker Compose
- Node.js 20+ (للجوال/الويب)
- Python 3.12+ (للخادم الخلفي)

## الإعداد

1. انسخ نموذج البيئة:

   ```bash
   cp .env.example .env
   ```

2. عدّل `.env` وضع القيم المحلية. لا تودع `.env` أبداً.

3. شغّل PostgreSQL و Redis:

   ```bash
   docker compose up -d postgres redis
   ```

4. خدمة الخادم الخلفي مؤقتة حالياً. نفّذ مشروع Django أولاً ثم استبدل أمرها في `docker-compose.yml`.

## متغيرات البيئة

راجع `.env.example`. المتغيرات الأساسية:

- `DEBUG`
- `SECRET_KEY`
- `ALLOWED_HOSTS`
- `CORS_ALLOWED_ORIGINS`
- `POSTGRES_*`
- `REDIS_URL`
- `AI_ENABLED`, `AI_PROVIDER`, `AI_API_KEY`, `AI_BASE_URL`

## الاختبارات

- الخادم الخلفي: `pytest`
- الواجهات: مشغّل اختبارات TypeScript (سيُضاف مع بناء التطبيقات)
- اختبارات التكامل/من الطرف للطرف/الأمان في مجلد `tests/`.

## أوامر مفيدة

```bash
docker compose config
docker compose ps
docker compose logs -f postgres redis
```