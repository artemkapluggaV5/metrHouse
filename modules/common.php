<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/validation.php';
const ROOT = __DIR__ . '/..';
const PHOTOS = ROOT . '/storage/photos/';

class FormError extends RuntimeException
{
    public function __construct(string $message, public string $field = '', int $status = 422)
    {
        parent::__construct($message, $status);
    }
}

function fail(string $message, string $field = '', int $status = 422): never
{
    throw new FormError($message, $field, $status);
}

function query(string $sql, array $args = []): PDOStatement
{
    $stmt = db()->prepare($sql);
    $stmt->execute($args);
    return $stmt;
}

function one(string $sql, array $args = []): ?array
{
    return query($sql, $args)->fetch() ?: null;
}

function tx(callable $fn): mixed
{
    db()->beginTransaction();
    try {
        $v = $fn();
        db()->commit();
        return $v;
    } catch (Throwable $e) {
        if (db()->inTransaction()) {
            db()->rollBack();
        }
        throw $e;
    }
}

function val(array $data, string $key, int $max, bool $required = true): string
{
    $v = $data[$key] ?? '';
    if (!is_string($v)) {
        fail('Некорректное значение.', $key);
    }
    $v = trim($v);
    if (($required && $v === '') || mb_strlen($v) > $max) {
        fail("Заполните поле (до $max символов).", $key);
    }
    return $v;
}

function choice(array $d, string $key, array $allowed): string
{
    $v = $d[$key] ?? '';
    if (!in_array($v, $allowed, true)) {
        fail('Выберите значение из списка.', $key);
    }
    return $v;
}

function integer(array $d, string $key, int $min = 1, int $max = 2147483647): int
{
    $v = filter_var($d[$key] ?? null, FILTER_VALIDATE_INT);
    if ($v === false || $v < $min || $v > $max) {
        fail("Введите целое число от $min до $max.", $key);
    }
    return $v;
}

function decimal(array $d, string $key, int $digits, bool $zero = false): string
{
    $v = str_replace(',', '.', val($d, $key, 30));
    if (!preg_match('/^\d{1,' . $digits . '}(\.\d{1,2})?$/D', $v) || (!$zero && (float) $v <= 0)) {
        fail('Укажите допустимую сумму или площадь.', $key);
    }
    return $v;
}

function user(): ?array
{
    if (empty($_SESSION['uid'])) {
        return null;
    }
    return one('SELECT id,full_name,email,role FROM users WHERE id=? AND is_active=1', [
        $_SESSION['uid'],
    ]);
}

function role(string $role): array
{
    $u = user();
    if (!$u || $u['role'] !== $role) {
        fail('Недостаточно прав.', '', 403);
    }
    return $u;
}

function prop(int $id, bool $lock = false): array
{
    $o = one('SELECT * FROM objects WHERE id=?' . ($lock ? ' FOR UPDATE' : ''), [$id]);
    if (!$o) {
        fail('Объект недоступен.', '', 404);
    }
    return $o;
}

function readable(array $o, ?array $u): bool
{
    return $o['status_id'] == 2 ||
        ($u &&
            (($u['role'] === 'agent' && $o['agent_id'] == $u['id']) ||
                ($u['role'] === 'moderator' && $o['status_id'] == 1)));
}

function owner(array $o, array $u): void
{
    if ($o['agent_id'] != $u['id']) {
        fail('Это объект другого агента.', '', 403);
    }
}

function version(array $o): void
{
    if (integer($_POST, 'version') != $o['version']) {
        fail('Версия изменилась. Откройте карточку заново.', '', 409);
    }
}

function unlinkPhoto(string $name): void
{
    $path = PHOTOS . basename($name);
    if (is_file($path) && !unlink($path)) {
        error_log('Photo cleanup failed: ' . basename($name));
    }
}

function issueChallenge(string $bucket): array
{
    $a = random_int(2, 15);
    $b = random_int(1, 12);
    $token = bin2hex(random_bytes(12));
    $_SESSION[$bucket] = array_slice(
        array_filter($_SESSION[$bucket] ?? [], fn($v) => $v[1] >= time()),
        -7,
        null,
        true,
    );
    $lifetime = 300;
    $_SESSION[$bucket][$token] = [$a + $b, time() + $lifetime];
    return ['token' => $token, 'question' => "$a + $b", 'expires_in' => $lifetime];
}

function verifyChallenge(string $bucket): void
{
    $token = val($_POST, 'token', 32, false);
    $task = $_SESSION[$bucket][$token] ?? null;
    unset($_SESSION[$bucket][$token]);
    if (!$task || $task[1] < time() || strval($task[0]) !== val($_POST, 'answer', 5, false)) {
        fail('Проверочный ответ неверен или задание истекло. Решите новый пример.', 'answer');
    }
}
