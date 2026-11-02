param([Parameter(Mandatory = $true)][string]$Installer)
$ErrorActionPreference = 'Stop'
# This test changes per-user installer registration and shortcuts: only a disposable CI account is allowed.
if ($env:CI -ne 'true' -or $env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted') { throw 'Run installer lifecycle QA only in a disposable GitHub-hosted Windows runner.' }
$installerPath = (Resolve-Path -LiteralPath $Installer).Path
$expectedVersion = (Get-Content -LiteralPath (Join-Path $PSScriptRoot '../package.json') -Raw | ConvertFrom-Json).version
$uninstallRoots = @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall', 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall')
function Find-Registration {
  @($uninstallRoots | ForEach-Object { Get-ItemProperty -Path "$_\*" -ErrorAction SilentlyContinue } | Where-Object DisplayName -eq 'AI Creative Hub')
}
$desktopShortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) 'AI Creative Hub.lnk'
$menuShortcut = Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs\AI Creative Hub.lnk'
$profile = Join-Path $env:APPDATA 'ai-creative-hub-desktop'
if ((Find-Registration).Count -or (Test-Path -LiteralPath $desktopShortcut) -or (Test-Path -LiteralPath $menuShortcut) -or (Test-Path -LiteralPath $profile)) {
  throw 'Preflight refused: existing installation, shortcut or application profile must be preserved.'
}
$qaRoot = Join-Path ([IO.Path]::GetTempPath()) ('aich-installer-' + [Guid]::NewGuid())
$installDirectory = Join-Path $qaRoot 'application'
$workspace = Join-Path $profile 'workspace'
New-Item -ItemType Directory -Path $qaRoot, $workspace -Force | Out-Null
$fixture = Join-Path $workspace 'workspace.json'
Copy-Item -LiteralPath (Join-Path $PSScriptRoot '../tests/fixtures/legacy-v1.json') -Destination $fixture
$fixtureHash = (Get-FileHash -LiteralPath $fixture -Algorithm SHA256).Hash
$exe = Join-Path $installDirectory 'AI Creative Hub.exe'
function Assert-Preserved {
  if (-not (Test-Path -LiteralPath $fixture) -or (Get-FileHash -LiteralPath $fixture -Algorithm SHA256).Hash -ne $fixtureHash) {
    throw 'Installer lifecycle modified the pre-existing workspace.'
  }
}
function Install-And-Test {
  $process = Start-Process -FilePath $installerPath -ArgumentList @('/S', ('/D=' + $installDirectory)) -WindowStyle Hidden -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw "Installer exited with $($process.ExitCode)." }
  if (-not (Test-Path -LiteralPath $exe)) { throw 'Installed executable missing.' }
  $registration = Find-Registration
  if ($registration.Count -ne 1 -or $registration[0].DisplayVersion -ne $expectedVersion) { throw 'Unexpected installer registration/version.' }
  if (-not (Test-Path -LiteralPath $desktopShortcut) -or -not (Test-Path -LiteralPath $menuShortcut)) { throw 'Installer shortcuts missing.' }
  Assert-Preserved
  $env:AICH_DIRECT_EXECUTABLE = $exe
  try {
    & (Join-Path $PSScriptRoot '../node_modules/.bin/playwright.cmd') test
    if ($LASTEXITCODE -ne 0) { throw 'Installed application E2E failed.' }
  } finally { Remove-Item Env:AICH_DIRECT_EXECUTABLE -ErrorAction SilentlyContinue }
}
try {
  Install-And-Test
  Install-And-Test
  $uninstaller = Join-Path $installDirectory 'Uninstall AI Creative Hub.exe'
  if (-not (Test-Path -LiteralPath $uninstaller)) { throw 'Uninstaller missing.' }
  $process = Start-Process -FilePath $uninstaller -ArgumentList '/S' -WindowStyle Hidden -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw "Uninstaller exited with $($process.ExitCode)." }
  $deadline = (Get-Date).AddSeconds(30)
  while (((Test-Path -LiteralPath $exe) -or (Find-Registration).Count -or (Test-Path -LiteralPath $desktopShortcut) -or (Test-Path -LiteralPath $menuShortcut)) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 250 }
  if ((Test-Path -LiteralPath $exe) -or (Find-Registration).Count -or (Test-Path -LiteralPath $desktopShortcut) -or (Test-Path -LiteralPath $menuShortcut)) { throw 'Uninstall did not remove the application, registry entry and shortcuts.' }
  Assert-Preserved
  Write-Output 'PASS: install, all installed E2E, reinstall, all E2E, uninstall; existing workspace bytes preserved.'
} finally {
  # Retain a failed installation for diagnosis; never recursively remove an unverified path.
  if (-not (Find-Registration).Count) {
    $resolvedQaRoot = [IO.Path]::GetFullPath($qaRoot)
    $resolvedTemp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    if (-not $resolvedQaRoot.StartsWith($resolvedTemp, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe QA cleanup path.' }
    Remove-Item -LiteralPath $resolvedQaRoot -Recurse -Force -ErrorAction SilentlyContinue
    # Preflight established that this exact application profile did not exist before this test.
    Remove-Item -LiteralPath $profile -Recurse -Force -ErrorAction SilentlyContinue
  }
}
