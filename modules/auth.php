<?php
function authenticate(bool $register): array {
    $email=strtolower(val($_POST,'email',255));
    if(!filter_var($email,FILTER_VALIDATE_EMAIL)) fail('Введите адрес электронной почты.','email');
    $pass=$_POST['password']??'';
    if(!is_string($pass)||strlen($pass)>72||strlen($pass)<($register?8:1)) fail('Пароль должен содержать от 8 до 72 байт.','password');
    if($register){
        $name=val($_POST,'full_name',150);
        try {query('INSERT INTO users(full_name,email,password_hash) VALUES(?,?,?)',[$name,$email,password_hash($pass,PASSWORD_DEFAULT)]);}
        catch(PDOException $e){if(($e->errorInfo[1]??0)==1062) fail('Этот адрес уже зарегистрирован.','email');throw $e;}
        $id=db()->lastInsertId();
    } else {
        $u=one('SELECT * FROM users WHERE email=? AND is_active=1',[$email]);
        if(!$u||!password_verify($pass,$u['password_hash'])) fail('Проверьте почту и пароль или обратитесь к администратору.','email',401);
        $id=$u['id'];
    }
    $_SESSION=[]; session_regenerate_id(true); $_SESSION['uid']=$id; $_SESSION['csrf']=bin2hex(random_bytes(32));
    return ['user'=>user(),'csrf'=>$_SESSION['csrf']];
}
