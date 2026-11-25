<?php

function moderate(): array
{
    role('moderator');
    $decision = choice($_POST, 'decision', ['publish', 'reject']);
    $note = $decision === 'reject' ? val($_POST, 'note', 1200) : null;
    return tx(function () use ($decision, $note) {
        $o = prop(integer($_POST, 'id'), true);
        version($o);
        if ($o['status_id'] != 1) {
            fail('Карточка уже рассмотрена.', '', 409);
        }
        query('UPDATE objects SET status_id=?,moderation_note=?,version=version+1 WHERE id=?', [
            $decision === 'publish' ? 2 : 3,
            $note,
            $o['id'],
        ]);
        return [];
    });
}
