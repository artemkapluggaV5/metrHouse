<?php
function adminUser(): array {
    $admin=role('admin');$id=integer($_POST,'id'); $role=choice($_POST,'role',['agent','client','moderator','admin']);$active=integer($_POST,'active',0,1);
    if($id==$admin['id'] && (!$active || $role!=='admin')) fail('Нельзя лишить доступа собственную учётную запись.');
    return tx(function() use($id,$role,$active){
        if(!one('SELECT id FROM users WHERE id=? FOR UPDATE',[$id])) fail('Пользователь не найден.');
        if($role!=='agent'&&one('SELECT id FROM objects WHERE agent_id=? LIMIT 1',[$id])) fail('Перед сменой роли передайте объекты другому агенту.');
        query('UPDATE users SET role=?,is_active=? WHERE id=?',[$role,$active,$id]);return [];
    });
}
function transfer(): array {
    role('admin');$id=integer($_POST,'id');$agent=integer($_POST,'agent_id');
    return tx(function() use($id,$agent){
        if(!one("SELECT id FROM users WHERE id=? AND role='agent' AND is_active=1 FOR UPDATE",[$agent])) fail('Выберите действующего агента.','agent_id');
        prop($id,true);query('UPDATE objects SET agent_id=?,version=version+1 WHERE id=?',[$agent,$id]);return [];
    });
}
function adminSetting(): array {
    role('admin');$size=integer($_POST,'page_size',1,48);query('UPDATE settings SET setting_value=? WHERE setting_key=?',[$size,'page_size']);return [];
}
function adminStatus(): array {
    role('admin');$name=val($_POST,'name',80);$order=integer($_POST,'sort_order',0,65535);$id=integer($_POST,'id',1,8);
    query('UPDATE statuses SET name=?,sort_order=? WHERE id=?',[$name,$order,$id]);return [];
}
