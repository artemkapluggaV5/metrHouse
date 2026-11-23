<?php
function challenge(): array {
    role('client');return issueChallenge('tasks');
}
function applyForObject(): array {
    $u=role('client');$id=integer($_POST,'id');
    $phone=val($_POST,'phone',30);$comment=val($_POST,'comment',2000,false);
    checkContact('phone',$phone);
    verifyChallenge('tasks');
    return tx(function() use ($u,$id,$phone,$comment){
        one('SELECT id FROM users WHERE id=? FOR UPDATE',[$u['id']]);
        $o=prop($id,true);if($o['status_id']!=2) fail('Объявление снято с публикации.');
        if(one('SELECT id FROM requests WHERE client_id=? AND object_id=? AND active_slot=1',[$u['id'],$id])) fail('У вас уже есть открытая заявка по этому объекту.','',409);
        if(one('SELECT id FROM requests WHERE client_id=? AND created_at>NOW()-INTERVAL 30 SECOND LIMIT 1',[$u['id']])) fail('Между заявками должно пройти 30 секунд.','',429);
        query('INSERT INTO requests(object_id,client_id,phone,comment) VALUES(?,?,?,?)',[$id,$u['id'],$phone,$comment]);return [];
    });
}
function moveRequest(): array {
    $u=role('agent');$id=integer($_POST,'id');$to=integer($_POST,'status',6,8);
    return tx(function() use($u,$id,$to){
        $r=one('SELECT r.status_id,o.agent_id FROM requests r JOIN objects o ON o.id=r.object_id WHERE r.id=? FOR UPDATE',[$id]);
        if(!$r) fail('Заявка недоступна.','',404);owner($r,$u);
        if(!($r['status_id']==5 && $to===6)&&!($r['status_id']==6 && in_array($to,[7,8],true))) fail('Переход из текущего статуса недоступен.','',409);
        query('UPDATE requests SET status_id=? WHERE id=?',[$to,$id]);return [];
    });
}
