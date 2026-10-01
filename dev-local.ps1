param(
  [ValidateSet('start','stop','status','token')]
  [string]$Action = 'start',
  [int]$FrontendPort = 5178,
  [int]$BackendPort = 8080,
  [string]$GoProxy = 'https://proxy.golang.org,direct',
  [string]$GoSumDB = 'sum.golang.org',
  [string]$HttpProxy = 'http://127.0.0.1:10808',
  [switch]$Fresh,
  [switch]$NoBrowser,
  [switch]$CopyToken
)

$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
$BackendDir = Join-Path $Root 'backend'
$StateDir = Join-Path $Root '.local-dev'
$PidFile = Join-Path $StateDir 'pids.json'
$Database = Join-Path $StateDir 'dnd.db'
$Credentials = Join-Path $StateDir 'bootstrap-credentials.json'
$FrontendUrl = "http://127.0.0.1:$FrontendPort"
$BackendUrl = "http://127.0.0.1:$BackendPort"

function Port-Pid([int]$Port) {
  try {
    return (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop |
      Select-Object -First 1 -ExpandProperty OwningProcess)
  } catch {
    return $null
  }
}

function Stop-Tree([int]$ProcessId) {
  if ($ProcessId -le 0) { return }
  if (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue) {
    & taskkill.exe /PID $ProcessId /T /F | Out-Null
  }
}

function Restore-Env([string]$Name, $Value) {
  if ($null -eq $Value) { Remove-Item -Path "Env:$Name" -ErrorAction SilentlyContinue }
  else { Set-Item -Path "Env:$Name" -Value ([string]$Value) }
}

function Tail-IfPresent([string]$Path) {
  if (Test-Path $Path) {
    Write-Host "--- $Path ---"
    Get-Content $Path -Tail 30
  }
}

function Read-State {
  if (!(Test-Path $PidFile)) { return $null }
  try { return Get-Content $PidFile -Raw | ConvertFrom-Json } catch { return $null }
}

function Stop-Dev {
  $state = Read-State
  if ($state) {
    Stop-Tree ([int]$state.frontendPid)
    Stop-Tree ([int]$state.backendPid)
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    Write-Host 'Local DND dev processes stopped.'
  } else {
    Write-Host 'No local dev PID file found.'
  }
}

function Wait-Http([string]$Url, [int]$Seconds = 45) {
  $deadline = (Get-Date).AddSeconds($Seconds)
  do {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { return }
    } catch {}
    Start-Sleep -Milliseconds 250
  } while ((Get-Date) -lt $deadline)
  throw "Timed out waiting for $Url"
}

function Show-Credentials([switch]$Clipboard) {
  if (!(Test-Path $Credentials)) {
    throw "Credentials not found: $Credentials. Start the backend once first."
  }
  $cred = Get-Content $Credentials -Raw | ConvertFrom-Json
  Write-Host "User:  $($cred.user.id)"
  Write-Host "Token: $($cred.token)"
  if ($Clipboard) {
    Set-Clipboard -Value ([string]$cred.token)
    Write-Host 'Token copied to clipboard.'
  }
}

switch ($Action) {
  'stop' {
    Stop-Dev
    exit 0
  }
  'status' {
    $state = Read-State
    Write-Host "Frontend: $FrontendUrl  portPid=$(Port-Pid $FrontendPort)"
    Write-Host "Backend:  $BackendUrl   portPid=$(Port-Pid $BackendPort)"
    if ($state) { Write-Host "Recorded PIDs: backend=$($state.backendPid), frontend=$($state.frontendPid)" }
    exit 0
  }
  'token' {
    Show-Credentials -Clipboard:$CopyToken
    exit 0
  }
}

if (!(Get-Command go -ErrorAction SilentlyContinue)) { throw 'Go was not found in PATH.' }
if (!(Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js was not found in PATH.' }
if (!(Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm was not found in PATH.' }

if (!(Test-Path (Join-Path $Root 'node_modules'))) {
  throw "node_modules is missing. Run 'npm ci' from Windows PowerShell first."
}

$vite = Join-Path $Root 'node_modules\vite\bin\vite.js'
if (!(Test-Path $vite)) {
  throw "Vite is missing from node_modules. Run 'npm ci' from Windows PowerShell."
}

$savedPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$viteCheck = & node $vite --version 2>&1
$viteExit = $LASTEXITCODE
$ErrorActionPreference = $savedPreference
if ($viteExit -ne 0) {
  throw "The current node_modules cannot run with Windows Node. Reinstall it from Windows PowerShell: Remove-Item node_modules -Recurse -Force; npm ci."
}

if ($Fresh) {
  Stop-Dev
  if (Test-Path $StateDir) { Remove-Item $StateDir -Recurse -Force }
}

New-Item -ItemType Directory -Force $StateDir | Out-Null

$backendOwner = Port-Pid $BackendPort
if ($backendOwner) { throw "Backend port $BackendPort is already in use by PID $backendOwner." }
$frontendOwner = Port-Pid $FrontendPort
if ($frontendOwner) { throw "Frontend port $FrontendPort is already in use by PID $frontendOwner." }

$BackendStdout = Join-Path $StateDir 'backend.stdout.log'
$BackendStderr = Join-Path $StateDir 'backend.stderr.log'
$FrontendStdout = Join-Path $StateDir 'frontend.stdout.log'
$FrontendStderr = Join-Path $StateDir 'frontend.stderr.log'
Remove-Item $BackendStdout,$BackendStderr,$FrontendStdout,$FrontendStderr -Force -ErrorAction SilentlyContinue

$goExe = (Get-Command go.exe -ErrorAction Stop).Source
$nodeExe = (Get-Command node.exe -ErrorAction Stop).Source

$oldListen = $env:DND_LISTEN
$oldDatabase = $env:DND_DATABASE
$oldOrigin = $env:DND_CORS_ORIGIN
$oldSecure = $env:DND_SECURE_COOKIE
$oldGoProxy = $env:GOPROXY
$oldGoSumDB = $env:GOSUMDB
$oldHttpProxy = $env:HTTP_PROXY
$oldHttpsProxy = $env:HTTPS_PROXY
$oldNoProxy = $env:NO_PROXY
try {
  $env:DND_LISTEN = "127.0.0.1:$BackendPort"
  $env:DND_DATABASE = $Database
  $env:DND_CORS_ORIGIN = $FrontendUrl
  $env:DND_SECURE_COOKIE = 'false'
  $env:GOPROXY = $GoProxy
  $env:GOSUMDB = $GoSumDB
  $env:HTTP_PROXY = $HttpProxy
  $env:HTTPS_PROXY = $HttpProxy
  $env:NO_PROXY = '127.0.0.1,localhost,::1'
  Write-Host 'Starting backend...'
  $backendProcess = Start-Process -FilePath $goExe -ArgumentList @('run','./cmd/server') -WorkingDirectory $BackendDir -RedirectStandardOutput $BackendStdout -RedirectStandardError $BackendStderr -PassThru -WindowStyle Hidden
} finally {
  Restore-Env 'DND_LISTEN' $oldListen
  Restore-Env 'DND_DATABASE' $oldDatabase
  Restore-Env 'DND_CORS_ORIGIN' $oldOrigin
  Restore-Env 'DND_SECURE_COOKIE' $oldSecure
  Restore-Env 'GOPROXY' $oldGoProxy
  Restore-Env 'GOSUMDB' $oldGoSumDB
  Restore-Env 'HTTP_PROXY' $oldHttpProxy
  Restore-Env 'HTTPS_PROXY' $oldHttpsProxy
  Restore-Env 'NO_PROXY' $oldNoProxy
}

try {
  try { Wait-Http "$BackendUrl/health" 60 }
  catch { Tail-IfPresent $BackendStderr; throw }

  $oldBackendUrl = $env:DND_BACKEND_URL
  try {
    $env:DND_BACKEND_URL = $BackendUrl
    Write-Host 'Starting frontend...'
    $frontendProcess = Start-Process -FilePath $nodeExe -ArgumentList @($vite,'--host','127.0.0.1','--port',"$FrontendPort") -WorkingDirectory $Root -RedirectStandardOutput $FrontendStdout -RedirectStandardError $FrontendStderr -PassThru -WindowStyle Hidden
  } finally {
    Restore-Env 'DND_BACKEND_URL' $oldBackendUrl
  }

  try { Wait-Http $FrontendUrl 60 }
  catch { Tail-IfPresent $FrontendStderr; Stop-Tree $frontendProcess.Id; throw }

  @{
    backendPid = $backendProcess.Id
    frontendPid = $frontendProcess.Id
    backendPort = $BackendPort
    frontendPort = $FrontendPort
    startedAt = (Get-Date).ToString('o')
  } | ConvertTo-Json | Set-Content $PidFile -Encoding UTF8

  Write-Host ''
  Write-Host 'DND Card local development is ready.'
  Write-Host "Frontend:       $FrontendUrl"
  Write-Host "Backend health: $BackendUrl/health"
  Write-Host "Go proxy:       $GoProxy"
  Write-Host "HTTP proxy:     $HttpProxy"
  Write-Host 'Server API in the UI: /api/v1'
  Write-Host "Dev database:   $Database"
  Write-Host "Credentials:    $Credentials"
  Write-Host "Backend log:    $BackendStderr"
  Write-Host "Frontend log:   $FrontendStdout"
  Write-Host ''
  Write-Host 'Show token: .\dev-local.ps1 token'
  Write-Host 'Copy token: .\dev-local.ps1 token -CopyToken'
  Write-Host 'Status:      .\dev-local.ps1 status'
  Write-Host 'Stop all:    .\dev-local.ps1 stop'
  Write-Host 'Fresh DB:    .\dev-local.ps1 start -Fresh'
  Write-Host 'Custom proxy example: .\dev-local.ps1 -HttpProxy http://127.0.0.1:10808'

  if ($CopyToken -and (Test-Path $Credentials)) { Show-Credentials -Clipboard }
  if (!$NoBrowser) { Start-Process $FrontendUrl }
} catch {
  Stop-Tree $backendProcess.Id
  throw
}
