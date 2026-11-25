<?php

function incomingPhotos(array &$created): array
{
    if (!isset($_FILES['photos'])) {
        return [];
    }
    $f = $_FILES['photos'];
    $rows = [];
    if (!is_array($f['error']) || count($f['error']) > 8) {
        fail('За один раз можно загрузить до 8 снимков.', 'photos');
    }
    foreach ($f['error'] as $i => $err) {
        if ($err === UPLOAD_ERR_NO_FILE) {
            continue;
        }
        if ($err !== UPLOAD_ERR_OK || $f['size'][$i] > 5 * 1024 * 1024) {
            fail('Не удалось принять снимок. Лимит — 5 МБ.', 'photos');
        }
        $path = $f['tmp_name'][$i];
        if (!is_uploaded_file($path)) {
            fail('Файл не получен.', 'photos');
        }
        $info = @getimagesize($path);
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($path);
        if (
            !$info ||
            !in_array($mime, ['image/jpeg', 'image/png'], true) ||
            $info['mime'] !== $mime ||
            $info[0] * $info[1] > 16000000
        ) {
            fail('Нужен JPEG или PNG размером до 16 мегапикселей.', 'photos');
        }
        // Turn decoder warnings (including truncated images) into validation errors.
        set_error_handler(static function () {
            throw new FormError('Изображение повреждено.', 'photos');
        });
        try {
            $src = $mime === 'image/jpeg' ? imagecreatefromjpeg($path) : imagecreatefrompng($path);
        } finally {
            restore_error_handler();
        }
        if (!$src) {
            fail('Не удалось прочитать снимок.', 'photos');
        }
        $ratio = min(1, 1600 / max($info[0], $info[1]));
        $w = max(1, (int) round($ratio * $info[0]));
        $h = max(1, (int) round($ratio * $info[1]));
        $canvas = imagecreatetruecolor($w, $h);
        imagefill($canvas, 0, 0, imagecolorallocate($canvas, 255, 255, 255));
        imagecopyresampled($canvas, $src, 0, 0, 0, 0, $w, $h, $info[0], $info[1]);
        $name = bin2hex(random_bytes(24)) . '.jpg';
        $created[] = $name;
        if (!imagejpeg($canvas, PHOTOS . $name, 85)) {
            throw new RuntimeException('Image write failed');
        }
        $rows[] = [$name, 'image/jpeg', $w, $h];
        unset($canvas, $src);
    }
    return $rows;
}

function saveObject(): array
{
    $u = role('agent');
    $title = val($_POST, 'title', 255);
    $type = choice($_POST, 'property_type', ['flat', 'house', 'office']);
    $deal = choice($_POST, 'deal_type', ['sale', 'rent']);
    $price = decimal($_POST, 'price', 13);
    $area = decimal($_POST, 'area', 6);
    $rooms =
        $type === 'flat' || ($_POST['rooms'] ?? '') !== ''
            ? integer($_POST, 'rooms', 0, 999)
            : null;
    $address = val($_POST, 'address', 255);
    $desc = val($_POST, 'description', 10000);
    $id = empty($_POST['id']) ? null : integer($_POST, 'id');
    $fields = [$title, $type, $deal, $price, $area, $rooms, $address, $desc];
    $created = [];
    $removed = [];
    try {
        $id = tx(function () use ($u, $fields, $id, &$created, &$removed) {
            if (
                !one(
                    "SELECT id
                     FROM users
                     WHERE id = ? AND role = 'agent' AND is_active = 1
                     FOR UPDATE",
                    [$u['id']],
                )
            ) {
                fail('Доступ агента изменился.', '', 403);
            }
            if ($id) {
                $o = prop($id, true);
                owner($o, $u);
                version($o);
                query(
                    'UPDATE objects
                     SET title = ?,
                         property_type = ?,
                         deal_type = ?,
                         price = ?,
                         area = ?,
                         rooms = ?,
                         address = ?,
                         description = ?,
                         status_id = 1,
                         moderation_note = NULL,
                         version = version + 1
                     WHERE id = ?',
                    [...$fields, $id],
                );
                $ids = $_POST['remove'] ?? [];
                if (!is_array($ids)) {
                    fail('Проверьте выбранные снимки.', 'photos');
                }
                foreach ($ids as $photoId) {
                    $p = one('SELECT stored_name FROM object_photos WHERE id=? AND object_id=?', [
                        $photoId,
                        $id,
                    ]);
                    if (!$p) {
                        fail('Снимок недоступен.', 'photos');
                    }
                    query('DELETE FROM object_photos WHERE id=? AND object_id=?', [$photoId, $id]);
                    $removed[] = $p['stored_name'];
                }
            } else {
                query(
                    'INSERT INTO objects (
                         title, property_type, deal_type, price, area, rooms, address,
                         description, agent_id
                     )
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [...$fields, $u['id']],
                );
                $id = (int) db()->lastInsertId();
            }
            $photos = incomingPhotos($created);
            $count = (int) query('SELECT COUNT(*) FROM object_photos WHERE object_id=?', [
                $id,
            ])->fetchColumn();
            if ($count + count($photos) > 8) {
                fail('У объекта может быть до 8 снимков.', 'photos');
            }
            foreach ($photos as $row) {
                query(
                    'INSERT INTO object_photos (object_id, stored_name, mime_type, width, height)
                     VALUES (?, ?, ?, ?, ?)',
                    [$id, ...$row],
                );
            }
            return $id;
        });
    } catch (Throwable $e) {
        foreach ($created as $name) {
            unlinkPhoto($name);
        }
        throw $e;
    }
    foreach ($removed as $name) {
        unlinkPhoto($name);
    }
    return ['id' => $id];
}

function retireObject(bool $delete): array
{
    $u = role('agent');
    $removed = tx(function () use ($u, $delete) {
        $o = prop(integer($_POST, 'id'), true);
        owner($o, $u);
        version($o);
        if (!$delete) {
            query('UPDATE objects SET status_id=4,version=version+1 WHERE id=?', [$o['id']]);
            return [];
        }
        if (
            !in_array((int) $o['status_id'], [1, 3], true) ||
            one('SELECT id FROM requests WHERE object_id=? LIMIT 1', [$o['id']])
        ) {
            fail(
                'Удаление доступно только для карточки на проверке или после отклонения без заявок. Используйте архив.',
            );
        }
        $files = query('SELECT stored_name FROM object_photos WHERE object_id=?', [
            $o['id'],
        ])->fetchAll(PDO::FETCH_COLUMN);
        query('DELETE FROM objects WHERE id=?', [$o['id']]);
        return $files;
    });
    foreach ($removed as $name) {
        unlinkPhoto($name);
    }
    return [];
}
