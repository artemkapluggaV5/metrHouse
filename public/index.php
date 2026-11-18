<?php
declare(strict_types=1);
require __DIR__.'/../modules/common.php';
foreach(['auth','catalog','properties','moderation','requests','admin','dashboard'] as $module) require ROOT.'/modules/'.$module.'.php';
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header("Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
$op=$_GET['api']??null;
if($op===null) {require ROOT.'/templates/app.php';exit;}
ini_set('session.use_strict_mode','1');session_save_path(ROOT.'/storage/sessions');
session_set_cookie_params(['httponly'=>true,'samesite'=>'Lax','secure'=>(($_SERVER['HTTPS']??'')==='on')]);session_start();
header('Cache-Control: no-store');header('Content-Type: application/json; charset=utf-8');
$_SESSION['csrf']??=bin2hex(random_bytes(32));
try {
    $reads=['session','catalog','detail','photo','dashboard','challenge'];
    if(!in_array($op,$reads,true)){
        if($_SERVER['REQUEST_METHOD']!=='POST') fail('Требуется отправка формы.','',405);
        if(!hash_equals($_SESSION['csrf'],$_SERVER['HTTP_X_CSRF_TOKEN']??'')) fail('Сеанс изменился. Обновите страницу.','',403);
    }
    $result=match($op){
        'session'=>['user'=>user(),'csrf'=>$_SESSION['csrf']], 'catalog'=>catalog(), 'detail'=>detail(), 'photo'=>photo(),
        'login'=>authenticate(false),'register'=>authenticate(true),'logout'=>(function(){$_SESSION=[];session_destroy();return [];})(),
        'dashboard'=>dashboard(),'save'=>saveObject(),'archive'=>retireObject(false),'delete'=>retireObject(true),
        'moderate'=>moderate(),'challenge'=>challenge(),'apply'=>applyForObject(),'request_status'=>moveRequest(),
        'user'=>adminUser(),'transfer'=>transfer(),'setting'=>adminSetting(),'status'=>adminStatus(),
        default=>throw new FormError('Страница не найдена.','',404)
    };
    echo json_encode($result,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE);
} catch(FormError $e){http_response_code($e->getCode());echo json_encode(['error'=>$e->getMessage(),'field'=>$e->field],JSON_UNESCAPED_UNICODE);}
catch(Throwable $e){error_log((string)$e,3,ROOT.'/storage/logs/app.log');http_response_code(500);echo json_encode(['error'=>'Не удалось выполнить операцию. Проверьте подключение к базе или журнал приложения.'],JSON_UNESCAPED_UNICODE);}
