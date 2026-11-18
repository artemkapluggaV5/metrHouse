<?php
function catalog(): array {
    $where=['o.status_id=2']; $args=[];
    foreach(['deal_type'=>['sale','rent'],'property_type'=>['flat','house','office']] as $k=>$values){
        if(($_GET[$k]??'')!==''){ $where[]="o.$k=?"; $args[]=choice($_GET,$k,$values);}
    }
    $q=val($_GET,'q',255,false);
    if($q!==''){ $where[]="(o.title LIKE ? ESCAPE '!' OR o.address LIKE ? ESCAPE '!')";$like='%'.strtr($q,['!'=>'!!','%'=>'!%','_'=>'!_']).'%';array_push($args,$like,$like); }
    $range=[];
    foreach(['min'=>'>=','max'=>'<='] as $k=>$operator){
        if(($_GET[$k]??'')!==''){ $range[$k]=decimal($_GET,$k,13,true);$where[]="o.price $operator ?"; $args[]=$range[$k];}
    }
    if(isset($range['min'],$range['max'])&&(float)$range['min']>(float)$range['max']) fail('Верхняя цена меньше нижней.','max');
    $order=['new'=>'o.id DESC','cheap'=>'o.price ASC,o.id DESC','expensive'=>'o.price DESC,o.id DESC','area'=>'o.area DESC,o.id DESC'][$_GET['sort']??'new']??'o.id DESC';
    $cond=implode(' AND ',$where);
    $total=(int)query("SELECT COUNT(*) FROM objects o WHERE $cond",$args)->fetchColumn();
    $size=(int)query("SELECT setting_value FROM settings WHERE setting_key=?",['page_size'])->fetchColumn();
    $size=max(1,min(48,$size)); $pages=max(1,(int)ceil($total/$size));
    $page=min($pages,isset($_GET['page_no'])?integer($_GET,'page_no'):1); $offset=($page-1)*$size;
    $rows=query("SELECT o.id,o.title,o.property_type,o.deal_type,o.address,o.area,o.rooms,o.price,
        (SELECT p.id FROM object_photos p WHERE p.object_id=o.id ORDER BY p.sort_order,p.id LIMIT 1) photo_id
        FROM objects o WHERE $cond ORDER BY $order LIMIT $size OFFSET $offset",$args)->fetchAll();
    return compact('rows','total','pages','page');
}
function detail(): array {
    $o=prop(integer($_GET,'id')); $u=user();
    if(!readable($o,$u)) fail('Объект недоступен.','',404);
    $o['photos']=query('SELECT id FROM object_photos WHERE object_id=? ORDER BY sort_order,id',[$o['id']])->fetchAll(PDO::FETCH_COLUMN);
    $o['agent']=query('SELECT full_name FROM users WHERE id=?',[$o['agent_id']])->fetchColumn();
    if(!$u || !in_array($u['role'],['agent','moderator'],true)) unset($o['moderation_note']);
    return $o;
}
function photo(): never {
    $p=one('SELECT p.stored_name,p.mime_type,o.agent_id,o.status_id FROM object_photos p JOIN objects o ON o.id=p.object_id WHERE p.id=?',[integer($_GET,'id')]);
    if(!$p||!readable($p,user())||!is_file(PHOTOS.$p['stored_name'])) fail('Фото недоступно.','',404);
    session_write_close();header('Content-Type: '.$p['mime_type']);readfile(PHOTOS.$p['stored_name']);exit;
}
