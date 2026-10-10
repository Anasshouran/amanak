FROM php:8.2-fpm-alpine

WORKDIR /var/www

RUN apk add --no-cache \
    git \
    curl \
    freetype \
    libjpeg-turbo \
    libpng \
    libzip \
    onigurii \
    && docker-php-ext-install pdo mysql mysqli zip mbstring pcntl bcmath

COPY . .

RUN chown -R www-data:www-data /var/www

EXPOSE 9000

CMD ["php-fpm"]