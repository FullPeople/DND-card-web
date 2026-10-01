param(
  [switch]$IncludeBackend,
  [switch]$TypeCheck,
  [string]$GoProxy = 'https://proxy.golang.org,direct',
  [string]$GoSumDB = 'sum.golang.org',
  [string]$HttpProxy = 'http://127.0.0.1:10808'
)

$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
Set-Location $Root

if (!(Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js was not found in PATH.' }
if (!(Get-Command go -ErrorAction SilentlyContinue)) { throw 'Go was not found in PATH.' }
if (!(Test-Path 'node_modules')) { throw "node_modules is missing. Run 'npm ci' from Windows PowerShell first." }

$vitest = Join-Path $Root 'node_modules\vitest\vitest.mjs'
if (!(Test-Path $vitest)) { throw "Vitest is missing. Run 'npm ci' from Windows PowerShell." }
if ($env:OS -eq 'Windows_NT' -and !(Test-Path (Join-Path $Root 'node_modules\@rolldown\binding-win32-x64-msvc'))) {
  throw "node_modules contains no Windows Rolldown binding (it was likely installed from WSL/Linux). From Windows PowerShell run: Remove-Item node_modules -Recurse -Force; npm ci"
}
$savedPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$vitestCheck = & node $vitest --version 2>&1
$vitestExit = $LASTEXITCODE
$ErrorActionPreference = $savedPreference
if ($vitestExit -ne 0) {
  throw "The current node_modules cannot run Vitest with Windows Node. Reinstall it from Windows PowerShell: Remove-Item node_modules -Recurse -Force; npm ci."
}

$tests = @(
  'tests/legacy-workspace-read.test.ts',
  'tests/server-sync-core.test.ts',
  'tests/server-sync-ws.test.ts',
  'tests/server-sync-backend.test.ts',
  'tests/server-sync-review.test.ts'
)

$oldGoProxy = $env:GOPROXY
$oldGoSumDB = $env:GOSUMDB
$oldHttpProxy = $env:HTTP_PROXY
$oldHttpsProxy = $env:HTTPS_PROXY
$oldNoProxy = $env:NO_PROXY
$env:GOPROXY = $GoProxy
$env:GOSUMDB = $GoSumDB
$env:HTTP_PROXY = $HttpProxy
$env:HTTPS_PROXY = $HttpProxy
$env:NO_PROXY = '127.0.0.1,localhost,::1'
Write-Host 'Running focused sync tests (real Go backend + temporary SQLite where required)...'
& node $vitest run @tests
$vitestCode = $LASTEXITCODE
if ($null -eq $oldGoProxy) { Remove-Item Env:GOPROXY -ErrorAction SilentlyContinue } else { $env:GOPROXY = $oldGoProxy }
if ($null -eq $oldGoSumDB) { Remove-Item Env:GOSUMDB -ErrorAction SilentlyContinue } else { $env:GOSUMDB = $oldGoSumDB }
if ($null -eq $oldHttpProxy) { Remove-Item Env:HTTP_PROXY -ErrorAction SilentlyContinue } else { $env:HTTP_PROXY = $oldHttpProxy }
if ($null -eq $oldHttpsProxy) { Remove-Item Env:HTTPS_PROXY -ErrorAction SilentlyContinue } else { $env:HTTPS_PROXY = $oldHttpsProxy }
if ($null -eq $oldNoProxy) { Remove-Item Env:NO_PROXY -ErrorAction SilentlyContinue } else { $env:NO_PROXY = $oldNoProxy }
if ($vitestCode -ne 0) { exit $vitestCode }

if ($TypeCheck) {
  Write-Host 'Running TypeScript check...'
  & node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if ($IncludeBackend) {
  Write-Host 'Running Go backend tests...'
  $oldGoProxy = $env:GOPROXY
  $oldGoSumDB = $env:GOSUMDB
  $oldHttpProxy = $env:HTTP_PROXY
  $oldHttpsProxy = $env:HTTPS_PROXY
  $oldNoProxy = $env:NO_PROXY
  $env:GOPROXY = $GoProxy
  $env:GOSUMDB = $GoSumDB
  $env:HTTP_PROXY = $HttpProxy
  $env:HTTPS_PROXY = $HttpProxy
  $env:NO_PROXY = '127.0.0.1,localhost,::1'
  Push-Location backend
  try {
    & go test ./...
    $goCode = $LASTEXITCODE
  } finally {
    Pop-Location
    if ($null -eq $oldGoProxy) { Remove-Item Env:GOPROXY -ErrorAction SilentlyContinue } else { $env:GOPROXY = $oldGoProxy }
    if ($null -eq $oldGoSumDB) { Remove-Item Env:GOSUMDB -ErrorAction SilentlyContinue } else { $env:GOSUMDB = $oldGoSumDB }
    if ($null -eq $oldHttpProxy) { Remove-Item Env:HTTP_PROXY -ErrorAction SilentlyContinue } else { $env:HTTP_PROXY = $oldHttpProxy }
    if ($null -eq $oldHttpsProxy) { Remove-Item Env:HTTPS_PROXY -ErrorAction SilentlyContinue } else { $env:HTTPS_PROXY = $oldHttpsProxy }
    if ($null -eq $oldNoProxy) { Remove-Item Env:NO_PROXY -ErrorAction SilentlyContinue } else { $env:NO_PROXY = $oldNoProxy }
  }
  if ($goCode -ne 0) { exit $goCode }
}

Write-Host 'Quick validation passed.'
