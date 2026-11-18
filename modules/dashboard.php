<?php
function dashboard(): array {
    $u=user(); if(!$u) fail('Войдите в личный кабинет.','',401);
    $objects=[];$requests=[];$admin=null;
    $statuses=query('SELECT * FROM statuses ORDER BY entity_type,sort_order,id')->fetchAll();
    $list='SELECT o.id,o.title,o.status_id,o.version,o.moderation_note,o.address,o.agent_id FROM objects o ';
    if($u['role']==='agent'){
        $objects=query($list.'WHERE o.agent_id=? ORDER BY o.updated_at DESC,o.id DESC',[$u['id']])->fetchAll();
        $requests=query('SELECT r.*,o.title,u.full_name FROM requests r JOIN objects o ON o.id=r.object_id JOIN users u ON u.id=r.client_id WHERE o.agent_id=? ORDER BY r.id DESC',[$u['id']])->fetchAll();
    } elseif($u['role']==='moderator'){
        $objects=query($list.'WHERE o.status_id=? ORDER BY o.updated_at,o.id',[1])->fetchAll();
    } elseif($u['role']==='client'){
        $requests=query('SELECT r.id,r.status_id,r.created_at,r.comment,o.title FROM requests r JOIN objects o ON r.object_id=o.id WHERE r.client_id=? ORDER BY r.id DESC',[$u['id']])->fetchAll();
    } else {
        $objects=query('SELECT id,title,agent_id FROM objects ORDER BY id DESC')->fetchAll();
        $admin=['users'=>query('SELECT id,full_name,email,role,is_active FROM users ORDER BY id')->fetchAll(),'page_size'=>query('SELECT setting_value FROM settings WHERE setting_key=?',['page_size'])->fetchColumn()];
    }
    return compact('objects','requests','admin','statuses');
}
