<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    exit(1);
}
require __DIR__ . '/../config/database.php';
$root = dirname(__DIR__);
$c = json_decode(
    file_get_contents($root . '/storage/stand/connection.json'),
    true,
    512,
    JSON_THROW_ON_ERROR,
);
$admin = new PDO(
    'mysql:host=127.0.0.1;port=' . $c['DB_PORT'] . ';dbname=metr;charset=utf8mb4',
    'root',
    $c['root'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION],
);
$tables = $admin->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
if (!$tables) {
    $admin->exec(file_get_contents($root . '/database/schema.sql'));
} elseif (array_diff(['users', 'statuses', 'objects', 'object_photos', 'requests', 'settings'], $tables)) {
    throw new RuntimeException('Incomplete schema. Restore a backup before continuing.');
} elseif (!in_array('favorites', $tables, true)) {
    $admin->exec(file_get_contents($root . '/database/migrations/001_favorites.sql'));
}
$clientColumn = $admin->query("SHOW COLUMNS FROM requests LIKE 'client_id'")->fetch(PDO::FETCH_ASSOC);
if ($clientColumn['Null'] === 'NO') {
    $admin->exec(file_get_contents($root . '/database/migrations/002_request_client.sql'));
}
if (!$admin->query("SHOW COLUMNS FROM users LIKE 'last_login_at'")->fetch()) {
    $admin->exec(file_get_contents($root . '/database/migrations/003_last_login.sql'));
}
require __DIR__ . '/seed.php';
