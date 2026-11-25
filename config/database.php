<?php
declare(strict_types=1);

function db(): PDO
{
    static $db;
    if (!$db) {
        $config = is_file(__DIR__ . '/local.php')
            ? require __DIR__ . '/local.php'
            : (is_file(__DIR__ . '/../storage/stand/connection.json')
                ? json_decode(
                    file_get_contents(__DIR__ . '/../storage/stand/connection.json'),
                    true,
                )
                : []);
        $get = fn($key, $fallback) => getenv($key) ?: $config[$key] ?? $fallback;
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
            $get('DB_HOST', '127.0.0.1'),
            $get('DB_PORT', '3306'),
            $get('DB_NAME', 'metr'),
        );
        $db = new PDO($dsn, $get('DB_USER', 'metr'), $get('DB_PASSWORD', ''), [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }
    return $db;
}
