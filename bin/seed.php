<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli') exit(1);
require __DIR__.'/../modules/common.php';
foreach(['photos','sessions','logs'] as $dir) if(!is_dir(ROOT.'/storage/'.$dir)) mkdir(ROOT.'/storage/'.$dir,0770,true);
if(query('SELECT COUNT(*) FROM users')->fetchColumn()>0) {echo "Seed skipped: users already exist.\n";exit;}
$demoPassword=bin2hex(random_bytes(8));
$rows=[
 ['Квартира у Патриарших','flat','sale',32400000,78,3,'Москва, Большой Козихинский пер., 12','Угловая гостиная с большими окнами, две спальни и отдельная кухня. Окна выходят в тихий переулок.'],
 ['Дом с садом в Жуковке','house','sale',48500000,216,5,'Московская область, Жуковка, Садовая ул., 7','Дом с террасой и собственным садом. На первом этаже расположены кухня и гостиная, на втором — спальни.'],
 ['Офис в деловом квартале','office','rent',195000,124,null,'Москва, ул. Лесная, 5','Офис с переговорной, общей рабочей зоной и отдельным входом. В пешей доступности Белорусский вокзал.'],
 ['Квартира на Фрунзенской','flat','rent',145000,82,3,'Москва, Фрунзенская наб., 34','Просторная квартира с кухней-гостиной и двумя спальнями. Рядом прогулочная набережная.'],
 ['Дом с панорамной террасой','house','sale',37900000,192,4,'Московская область, Истра, Парковая ул., 8','Светлый двухэтажный дом с выходом на террасу, кабинетом и гаражом.'],
 ['Студия для команды','office','rent',128000,96,null,'Москва, Нижняя Сыромятническая ул., 10','Рабочее пространство с высокими потолками, зоной отдыха и переговорной.'],
 ['Квартира в Хамовниках','flat','sale',26800000,67,2,'Москва, ул. Усачёва, 19','Квартира с открытой кухней и отдельной спальней. Закрытый двор и парк рядом с домом.'],
 ['Дом у соснового леса','house','rent',230000,186,4,'Московская область, Одинцово, Лесная ул., 14','Дом с собственной парковкой и выходом к лесу. Кухня и столовая объединены в общее пространство.'],
 ['Двухуровневая квартира','flat','sale',41200000,112,4,'Москва, ул. Малая Ордынка, 16','Гостиная с высоким потолком и лестницей на приватный этаж. В квартире три спальни и две ванные комнаты.']
];
$files=[];
try{
 tx(function() use($rows,$demoPassword,&$files){
    foreach(['client'=>'Алина Смирнова','agent'=>'Михаил Орлов','moderator'=>'Анна Волкова','admin'=>'Артём Соколов'] as $role=>$name){
        query('INSERT INTO users(full_name,email,password_hash,role) VALUES(?,?,?,?)',[$name,$role.'@metr.test',password_hash($demoPassword,PASSWORD_DEFAULT),$role]);
        if($role==='agent') $agent=db()->lastInsertId();
    }
    foreach(array_reverse($rows,true) as $i=>$r){
        query('INSERT INTO objects(title,property_type,deal_type,price,area,rooms,address,description,agent_id,status_id) VALUES(?,?,?,?,?,?,?,?,?,2)',[...$r,$agent]);
        $id=db()->lastInsertId();$name=bin2hex(random_bytes(20)).'.jpg';$src=ROOT.'/demo/'.($i+1).'.jpg';
        $files[]=$name;if(!copy($src,PHOTOS.$name)) throw new RuntimeException('Demo photo unavailable');
        [$w,$h]=getimagesize($src);query('INSERT INTO object_photos(object_id,stored_name,mime_type,width,height) VALUES(?,?,?,?,?)',[$id,$name,'image/jpeg',$w,$h]);
    }
    $contents="Доступ к учебному стенду «Метр»\r\n\r\nКлиент: client@metr.test\r\nАгент: agent@metr.test\r\nМодератор: moderator@metr.test\r\nАдминистратор: admin@metr.test\r\n\r\nПароль для четырёх учебных записей: ".$demoPassword."\r\n";
    if(file_put_contents(ROOT.'/storage/access.txt',$contents)===false) throw new RuntimeException('Cannot write account details');
 });
} catch(Throwable $e) {foreach($files as $f) unlinkPhoto($f);throw $e;}
echo "Demo ready. Credentials: storage/access.txt\n";
