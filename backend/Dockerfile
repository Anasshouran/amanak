FROM python:3.11-slim

# Docker Hub (python:3.11-slim) is geo-blocked in some CI environments; this
# GHCR-published image is built on the official python:3.11-slim-bookworm base,
# so the rest of this Dockerfile is unchanged.

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/srv/amanak/backend:/srv/amanak/security-engine

WORKDIR /srv/amanak

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir "setuptools<70" wheel \
    && pip install --no-cache-dir --no-build-isolation "pyyaml==5.4.1"

COPY backend/ ./backend/
COPY security-engine/ ./security-engine/
RUN ln -s security-engine security_engine
COPY ai/ ./ai/
COPY pytest.ini ./pytest.ini
COPY tests/ ./tests/
COPY docker-compose.yml ./docker-compose.yml
COPY docker-compose.staging.yml ./docker-compose.staging.yml

RUN useradd --create-home --uid 10001 amanak \
    && chown -R amanak:amanak /srv/amanak

USER amanak

EXPOSE 8000

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2"]
