param(
    [switch]$Stop,
    [switch]$NoBrowser,
    [ValidateRange(1024, 65535)][int]$WebPort = 8092,
    [ValidateRange(1024, 65535)][int]$DbPort = 33429
)

$ErrorActionPreference = 'Stop'
$project = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$runtime = Join-Path $project 'runtime'
$state = Join-Path $project 'storage/stand'
$php = Join-Path $runtime 'php'
$mysql = Join-Path $runtime 'mysql'
$apache = Join-Path $runtime 'Apache24'
$httpd = Join-Path $apache 'bin/httpd.exe'
$mysqld = Join-Path $mysql 'bin/mysqld.exe'
$conf = Join-Path $state 'httpd.conf'
$data = Join-Path $state 'db'
$creds = Join-Path $state 'connection.json'
$endpoint = "http://127.0.0.1:$WebPort/"
$utf8 = New-Object Text.UTF8Encoding($false)

function SaveText($path, $value) {
    [IO.File]::WriteAllText($path, $value, $utf8)
}

function UnixPath($path) {
    $path.Replace('\', '/')
}

function PortBusy($port) {
    $c = New-Object Net.Sockets.TcpClient
    try {
        $c.Connect('127.0.0.1', $port)
        return $true
    } catch {
        return $false
    } finally {
        $c.Dispose()
    }
}

function RandomKey {
    $b = New-Object byte[] 24
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $rng.GetBytes($b)
    } finally {
        $rng.Dispose()
    }
    return [BitConverter]::ToString($b).Replace('-', '')
}

function IsOurs($file, $exe) {
    if (!(Test-Path $file)) {
        return $false
    }
    $num = ([IO.File]::ReadAllText($file)).Trim()
    if ($num -notmatch '^\d+$') {
        return $false
    }
    $proc = Get-Process -Id ([int]$num) -ErrorAction SilentlyContinue
    return ($null -ne $proc -and $proc.Path -and
        $proc.Path.Equals($exe, [StringComparison]::OrdinalIgnoreCase))
}

function Checked([string]$exe, [string[]]$argv) {
    & $exe @argv
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed: $exe (exit $LASTEXITCODE)"
    }
}

foreach ($folder in @($state, "$project/storage/photos", "$project/storage/logs", "$project/storage/sessions")) {
    [IO.Directory]::CreateDirectory($folder) | Out-Null
}
$dbPid = Join-Path $state 'mysql.pid'
$webPid = Join-Path $state 'httpd.pid'
$env:PATH = "$php;$env:PATH"

if ($Stop) {
    if (IsOurs $webPid $httpd) {
        Stop-Process -Id ([int](Get-Content $webPid))
        Start-Sleep -Milliseconds 700
        Get-CimInstance Win32_Process -Filter "Name='httpd.exe'" |
            Where-Object { $_.ExecutablePath -eq $httpd -and $_.CommandLine -like "*$conf*" } |
            ForEach-Object { Stop-Process -Id $_.ProcessId -ErrorAction SilentlyContinue }
    }

    if (IsOurs $dbPid $mysqld) {
        $c = Get-Content -Raw $creds | ConvertFrom-Json
        $env:MYSQL_PWD = $c.root
        try {
            Checked "$mysql/bin/mysqladmin.exe" @(
                '--no-defaults', '--protocol=TCP', '-h127.0.0.1', "-P$DbPort", '-uroot', 'shutdown'
            )
        } finally {
            Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
        }
    }

    Write-Host 'Stand stopped.'
    return
}

if (!(Test-Path $httpd) -or !(Test-Path $mysqld)) {
    throw 'Extract the entire Windows archive before launching Start.cmd.'
}
if ((PortBusy $WebPort) -and !(IsOurs $webPid $httpd)) {
    throw "Port $WebPort is in use."
}
if ((PortBusy $DbPort) -and !(IsOurs $dbPid $mysqld)) {
    throw "Port $DbPort is in use."
}

if (!(Test-Path $creds)) {
    if (Test-Path "$data/mysql") {
        throw 'Connection settings missing for existing database.'
    }
    $c = @{
        DB_PORT = "$DbPort"
        DB_USER = 'metr'
        DB_NAME = 'metr'
        DB_PASSWORD = (RandomKey)
        root = (RandomKey)
    }
    SaveText $creds ($c | ConvertTo-Json)
}
$c = Get-Content -Raw $creds | ConvertFrom-Json

if (!(Test-Path "$data/mysql")) {
    Write-Host 'Initializing the local MySQL database...'
    Checked $mysqld @(
        '--no-defaults', '--initialize-insecure', "--basedir=$mysql",
        "--datadir=$data", "--log-error=$state/mysql-init.log"
    )
}

$bootstrap = Join-Path $state 'bootstrap.sql'
if (!(IsOurs $dbPid $mysqld)) {
    $adminPass = $c.root
    $appPass = $c.DB_PASSWORD
    SaveText $bootstrap @"
ALTER USER 'root'@'localhost' IDENTIFIED BY '$adminPass';
CREATE DATABASE IF NOT EXISTS metr CHARACTER SET utf8mb4;
CREATE USER IF NOT EXISTS 'metr'@'127.0.0.1' IDENTIFIED BY '$appPass';
GRANT SELECT,INSERT,UPDATE,DELETE ON metr.* TO 'metr'@'127.0.0.1';

"@

    $mysqlArgs = @(
        '--no-defaults',
        ('--basedir="' + $mysql + '"'),
        ('--datadir="' + $data + '"'),
        "--port=$DbPort",
        '--bind-address=127.0.0.1',
        '--mysqlx=OFF',
        '--skip-log-bin',
        '--performance-schema=OFF',
        '--innodb-buffer-pool-size=64M',
        ('--pid-file="' + $dbPid + '"'),
        ('--init-file="' + $bootstrap + '"'),
        ('--log-error="' + $state + '/mysql.log"')
    )
    Start-Process -FilePath $mysqld -ArgumentList $mysqlArgs -WindowStyle Hidden

    for ($i = 0; $i -lt 100 -and !(PortBusy $DbPort); $i++) {
        Start-Sleep -Milliseconds 400
    }
    if (!(PortBusy $DbPort)) {
        throw "MySQL failed to start. See $state/mysql.log"
    }
}

$ini = @"
extension_dir="$(UnixPath "$php/ext")"
extension=pdo_mysql
extension=fileinfo
extension=gd
extension=mbstring
default_charset=UTF-8
display_errors=Off
log_errors=On
error_log="$(UnixPath "$project/storage/logs/php.log")"
date.timezone=Europe/Moscow
upload_max_filesize=5M
post_max_size=42M
memory_limit=256M
max_file_uploads=20
expose_php=Off
"@
SaveText "$state/php.ini" $ini
Checked "$php/php.exe" @('-c', "$state/php.ini", "$project/bin/install.php")

if (Test-Path $bootstrap) {
    Remove-Item -LiteralPath $bootstrap
}
if (!(IsOurs $webPid $httpd)) {
    $cfg = @"
ServerRoot "$(UnixPath $apache)"
Listen 127.0.0.1:$webPort
ServerName 127.0.0.1
PidFile "$(UnixPath $webPid)"
LoadModule authz_core_module modules/mod_authz_core.so
LoadModule dir_module modules/mod_dir.so
LoadModule mime_module modules/mod_mime.so
LoadModule php_module "$(UnixPath "$php/php8apache2_4.dll")"
PHPIniDir "$(UnixPath $state)"
TypesConfig conf/mime.types
DirectoryIndex index.php
DocumentRoot "$(UnixPath "$project/public")"
ErrorLog "$(UnixPath "$project/storage/logs/apache.log")"
<Directory />
 Require all denied
</Directory>
<Directory "$(UnixPath "$project/public")">
 Options -Indexes
 AllowOverride None
 Require all granted
</Directory>
<FilesMatch "\.php$">
 SetHandler application/x-httpd-php
</FilesMatch>
"@
    SaveText $conf $cfg
    Checked $httpd @('-t', '-f', $conf)
    Start-Process -FilePath $httpd -ArgumentList @('-f', ('"' + $conf + '"')) -WindowStyle Hidden

    for ($i = 0; $i -lt 50 -and !(PortBusy $WebPort); $i++) {
        Start-Sleep -Milliseconds 200
    }
}
if (!(PortBusy $WebPort)) {
    throw 'Apache did not start. See storage/logs/apache.log.'
}

Write-Host "Catalog: $endpoint"
Write-Host "Demo accounts: $project/storage/access.txt"
if (!$NoBrowser) {
    Start-Process $endpoint
}
