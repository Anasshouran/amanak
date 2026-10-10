# Deployment

## Production Configuration

Never deploy with default configuration. All production settings must be explicitly set.

### Required Production Changes

1. **Environment variables** - Set all secrets via environment variables
2. **Debug mode** - `DEBUG=False` explicitly
3. **Allowed hosts** - `ALLOWED_HOSTS` set to production domains
4. **CORS** - `CORS_ALLOWED_ORIGINS` set to production origins
5. **Secret key** - `SECRET_KEY` from secure vault, never hardcoded

### Docker Compose Production

Update `infrastructure/docker/production-compose.yml` with:
- Production environment variables
- Proper volume backups
- Network isolation
- Health check configurations

### Nginx

Configure `infrastructure/nginx/production.conf` with:
- SSL/TLS termination
- Security headers
- Rate limiting
- Proxy to backend

### AI Gateway

AI integration requires explicit configuration:
- Set `AI_ENABLED=False` by default
- Configure API keys only when actively needed
- Never pre-configure with production AI keys

### Database Backups

Regular PostgreSQL backups scheduled via `infrastructure/scripts/`.

### Monitoring

Health checks and alerting configured in `infrastructure/monitoring/`.