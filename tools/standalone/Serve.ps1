param([int]$Port = 5183, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$siteRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'site'))
if (-not (Test-Path -LiteralPath (Join-Path $siteRoot 'index.html'))) { throw 'Missing site/index.html' }
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()
$url = "http://127.0.0.1:$Port/"
Write-Host "DND Card - single player: $url"
Write-Host 'Keep this window open. Ctrl+C stops the local server. Character data stays in your browser.'
if (-not $NoBrowser) { Start-Process $url }
$mime = @{'.html'='text/html';'.js'='text/javascript';'.css'='text/css';'.json'='application/json';'.png'='image/png';'.svg'='image/svg+xml';'.ico'='image/x-icon';'.woff2'='font/woff2';'.txt'='text/plain'}
try {
 while ($true) {
  $client=$listener.AcceptTcpClient();$client.ReceiveTimeout=3000;$client.SendTimeout=5000
  try {
   $stream=$client.GetStream();$header=''
   while ($header.Length -lt 16384 -and -not $header.EndsWith("`r`n`r`n")) { $b=$stream.ReadByte();if($b -lt 0){break};$header += [char]$b }
   $requestLine=($header -split "`r`n")[0] -split ' '
   if ($requestLine.Length -lt 2) { continue }
   $method=$requestLine[0];$requestPath=[Uri]::UnescapeDataString(($requestLine[1] -split '\?')[0]).TrimStart('/')
   if (-not $requestPath) {$requestPath='index.html'}
   $target=[System.IO.Path]::GetFullPath((Join-Path $siteRoot $requestPath))
   $valid=$target.StartsWith($siteRoot+[System.IO.Path]::DirectorySeparatorChar,[System.StringComparison]::OrdinalIgnoreCase)
   $status='200 OK';$type='text/plain';$body=[byte[]]@()
   if ($method -notin @('GET','HEAD')) {$status='405 Method Not Allowed'}
   elseif (-not $valid -or -not [System.IO.File]::Exists($target)) {$status='404 Not Found'}
   else {$body=[System.IO.File]::ReadAllBytes($target);$ext=[System.IO.Path]::GetExtension($target).ToLowerInvariant();if($mime.ContainsKey($ext)){$type=$mime[$ext]}else{$type='application/octet-stream'}}
   $head=[Text.Encoding]::ASCII.GetBytes("HTTP/1.1 $status`r`nContent-Type: $type`r`nContent-Length: $($body.Length)`r`nConnection: close`r`nCache-Control: no-cache`r`nX-Content-Type-Options: nosniff`r`n`r`n")
   $stream.Write($head,0,$head.Length);if($method -ne 'HEAD' -and $body.Length){$stream.Write($body,0,$body.Length)}
  } catch { Write-Warning $_.Exception.Message } finally { $client.Dispose() }
 }
} finally {$listener.Stop()}
