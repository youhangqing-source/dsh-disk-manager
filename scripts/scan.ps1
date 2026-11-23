param(
  [Parameter(Mandatory=$true)][string]$Root,
  [Parameter(Mandatory=$true)][string]$OutFile,
  [double]$MinBigGB = 1.0,
  [double]$MinTopMB = 50
)

$ErrorActionPreference = 'SilentlyContinue'
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$rootFull = [System.IO.Path]::GetFullPath($Root)
if (-not $rootFull.EndsWith('\')) { $rootFull = $rootFull + '\' }

$topStats = @{}
$big = New-Object System.Collections.Generic.List[object]
$errCount = 0
$totalBytes = [long]0
$totalFiles = [long]0

function Get-TopName([string]$full) {
  $rel = $full.Substring($rootFull.Length).TrimStart('\')
  $idx = $rel.IndexOf('\')
  if ($idx -ge 0) { return $rel.Substring(0, $idx) } else { return $rel }
}

function Add-File([string]$f) {
  $script:totalFiles++
  $fi = New-Object System.IO.FileInfo $f
  $len = $fi.Length
  $script:totalBytes += $len
  $n = Get-TopName $f
  if ($script:topStats.ContainsKey($n)) {
    $script:topStats[$n].Size = [long]$script:topStats[$n].Size + $len
    $script:topStats[$n].Files = $script:topStats[$n].Files + 1
  } else {
    $script:topStats[$n] = [pscustomobject]@{ Size = [long]$len; Files = [long]1 }
  }
  if ($len -ge ($script:MinBigGB * 1GB)) {
    $script:big.Add([pscustomobject]@{ Path = $f; GB = [math]::Round($len / 1GB, 2); Modified = $fi.LastWriteTime.ToString('yyyy-MM-dd') })
  }
}

$stack = New-Object System.Collections.Generic.Stack[string]

# files directly in root
try {
  foreach ($f in [System.IO.Directory]::EnumerateFiles($rootFull)) {
    try { Add-File $f } catch { $script:errCount++ }
  }
} catch { $script:errCount++ }

# immediate subdirectories (skipping junctions/reparse points)
try {
  foreach ($d in [System.IO.Directory]::EnumerateDirectories($rootFull)) {
    try {
      $attr = [System.IO.File]::GetAttributes($d)
      if (($attr -band [System.IO.FileAttributes]::ReparsePoint) -eq 0) { $stack.Push($d) }
    } catch { $script:errCount++ }
  }
} catch { $script:errCount++ }

while ($stack.Count -gt 0) {
  $cur = $stack.Pop()
  try {
    foreach ($f in [System.IO.Directory]::EnumerateFiles($cur)) {
      try { Add-File $f } catch { $script:errCount++ }
    }
  } catch { $script:errCount++ }
  try {
    foreach ($d in [System.IO.Directory]::EnumerateDirectories($cur)) {
      try {
        $attr = [System.IO.File]::GetAttributes($d)
        if (($attr -band [System.IO.FileAttributes]::ReparsePoint) -eq 0) { $stack.Push($d) }
      } catch { $script:errCount++ }
    }
  } catch { $script:errCount++ }
}

$top = @()
foreach ($k in $topStats.Keys) {
  $gb = [math]::Round($topStats[$k].Size / 1GB, 2)
  if (($gb * 1024) -ge $MinTopMB) {
    $top += [pscustomobject]@{ Name = $k; GB = $gb; Files = $topStats[$k].Files }
  }
}

$result = [pscustomobject]@{
  Root       = $rootFull
  ElapsedSec = [math]::Round($sw.Elapsed.TotalSeconds, 1)
  Errors     = $errCount
  TotalGB    = [math]::Round($totalBytes / 1GB, 2)
  TotalFiles = $totalFiles
  Top        = ($top | Sort-Object GB -Descending)
  BigFiles   = ($big | Sort-Object GB -Descending | Select-Object -First 300)
}

$result | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $OutFile -Encoding UTF8

"### {0}  total {1} GB / {2} files / {3}s / errors {4}" -f $rootFull, $result.TotalGB, $result.TotalFiles, $result.ElapsedSec, $result.Errors
$result.Top | Select-Object Name, GB, Files | Format-Table -AutoSize | Out-String -Width 200
"--- big files (>= {0} GB) ---" -f $MinBigGB
$result.BigFiles | Select-Object -First 60 | Format-Table -AutoSize | Out-String -Width 200
