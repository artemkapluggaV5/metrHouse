<?php
function adminUserPage(): array {
    $term=val($_GET,'q',255,false);
    $where=[]; $args=[];
    if($term!==''){
        $fragment='%'.strtr($term,['!'=>'!!','%'=>'!%','_'=>'!_']).'%';
        $where[]="(full_name LIKE ? ESCAPE '!' OR email LIKE ? ESCAPE '!')";
        array_push($args,$fragment,$fragment);
    }
    if(($_GET['role']??'')!==''){
        $where[]='role=?'; $args[]=choice($_GET,'role',['client','agent','moderator','admin']);
    }
    if(($_GET['active']??'')!==''){
        $where[]='is_active=?'; $args[]=integer($_GET,'active',0,1);
    }
    $condition=$where?' WHERE '.implode(' AND ',$where):'';
    $total=(int)query('SELECT COUNT(*) FROM users'.$condition,$args)->fetchColumn();
    $pages=max(1,(int)ceil($total/25));
    $page=min($pages,isset($_GET['page'])?integer($_GET,'page'):1);
    $offset=25*($page-1);
    $users=query('SELECT id,full_name,email,role,is_active FROM users'.$condition." ORDER BY id LIMIT 25 OFFSET $offset",$args)->fetchAll();
    return compact('users','total','page','pages');
}
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
        $tab=$_GET['tab']??'users';
        $admin=['page_size'=>query('SELECT setting_value FROM settings WHERE setting_key=?',['page_size'])->fetchColumn()];
        if($tab==='users') $admin+=adminUserPage();
        if($tab==='transfer'){
            $objects=query('SELECT o.id,o.title,o.agent_id,u.full_name AS agent_name FROM objects o JOIN users u ON u.id=o.agent_id ORDER BY o.id DESC')->fetchAll();
            $admin['agents']=query("SELECT id,full_name FROM users WHERE role='agent' AND is_active=1 ORDER BY full_name,id")->fetchAll();
        }
    }
    return compact('objects','requests','admin','statuses');
}
