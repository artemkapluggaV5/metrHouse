<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli') exit(1);
require __DIR__.'/../config/database.php';
$root=dirname(__DIR__);
$c=json_decode(file_get_contents($root.'/storage/stand/connection.json'),true,512,JSON_THROW_ON_ERROR);
$admin=new PDO('mysql:host=127.0.0.1;port='.$c['DB_PORT'].';dbname=metr;charset=utf8mb4','root',$c['root'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$tableCount=(int)$admin->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='metr'")->fetchColumn();
if($tableCount===0) $admin->exec(file_get_contents($root.'/database/schema.sql'));
elseif($tableCount!==6) throw new RuntimeException('Incomplete schema. Restore a backup before continuing.');
require __DIR__.'/seed.php';
