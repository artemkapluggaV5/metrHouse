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
    $result=deskPage('id,full_name,email,role,is_active','users',$where,$args,'id');
    $result['users']=$result['rows'];unset($result['rows']);return $result;
}
function deskPage(string $fields,string $from,array $where,array $args,string $order,array $search=[]): array {
    $term=val($_GET,'q',255,false);
    if($term!=='' && $search){
        $like='%'.strtr($term,['!'=>'!!','%'=>'!%','_'=>'!_']).'%';
        $where[]='('.implode(' OR ',array_map(fn($column)=>"$column LIKE ? ESCAPE '!'", $search)).')';
        foreach($search as $column) $args[]=$like;
    }
    $source=' FROM '.$from.($where?' WHERE '.implode(' AND ',$where):'');
    $total=(int)query('SELECT COUNT(*)'.$source,$args)->fetchColumn();
    $pages=max(1,(int)ceil($total/25));
    $page=min($pages,isset($_GET['page'])?integer($_GET,'page'):1);
    $offset=25*($page-1);
    $rows=query("SELECT $fields".$source." ORDER BY $order LIMIT 25 OFFSET $offset",$args)->fetchAll();
    return compact('rows','total','page','pages');
}
function transferAgents(): array {
    role('admin');
    return deskPage('id,full_name,email','users',["role='agent'",'is_active=1','id<>?'],[integer($_GET,'exclude')],'full_name,id',['full_name','email']);
}
function dashboard(): array {
    $u=user(); if(!$u) fail('Войдите в личный кабинет.','',401);
    $objects=[];$requests=[];$admin=null;
    $statuses=query('SELECT * FROM statuses ORDER BY entity_type,sort_order,id')->fetchAll();
    $pagination=null;
    $fields='o.id,o.title,o.status_id,o.version,o.moderation_note,o.address,o.agent_id';
    if($u['role']==='agent'){
        $isRequest=($_GET['tab']??'objects')==='requests';
        $where=['o.agent_id=?'];$args=[$u['id']];
        if(($_GET['status']??'')!==''){
            $where[]=($isRequest?'r':'o').'.status_id=?';
            $args[]=integer($_GET,'status',$isRequest?5:1,$isRequest?8:4);
        }
        if($isRequest){
            $pagination=deskPage('r.*,o.title,u.full_name','requests r JOIN objects o ON o.id=r.object_id JOIN users u ON u.id=r.client_id',$where,$args,'r.id DESC',['o.title','o.address','u.full_name','r.phone']);
            $requests=$pagination['rows'];
        }else{
            $pagination=deskPage($fields,'objects o',$where,$args,'o.updated_at DESC,o.id DESC',['o.title','o.address']);
            $objects=$pagination['rows'];
        }
    } elseif($u['role']==='moderator'){
        $pagination=deskPage($fields,'objects o',['o.status_id=1'],[],'o.updated_at,o.id',['o.title','o.address']);
        $objects=$pagination['rows'];
    } elseif($u['role']==='client'){
        $requests=query('SELECT r.id,r.status_id,r.created_at,r.comment,o.title FROM requests r JOIN objects o ON r.object_id=o.id WHERE r.client_id=? ORDER BY r.id DESC',[$u['id']])->fetchAll();
    } else {
        $tab=$_GET['tab']??'users';
        $admin=['page_size'=>query('SELECT setting_value FROM settings WHERE setting_key=?',['page_size'])->fetchColumn()];
        if($tab==='users') $admin+=adminUserPage();
        if($tab==='transfer'){
            $pagination=deskPage('o.id,o.title,o.address,o.agent_id,u.full_name AS agent_name','objects o JOIN users u ON u.id=o.agent_id',[],[],'o.id DESC',['o.title','o.address','u.full_name']);
            $objects=$pagination['rows'];
        }
    }
    if($pagination) unset($pagination['rows']);
    return compact('objects','requests','admin','statuses','pagination');
}
