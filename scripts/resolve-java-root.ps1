param([Parameter(Mandatory = $true)][string]$JavaExecutable)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Split-Path (Split-Path $JavaExecutable -Parent) -Parent))
# Java 8 embeds jre/bin/java.exe without a release file; its enclosing JDK owns the metadata.
if ((Split-Path $root -Leaf) -eq 'jre') {
  $parent = Split-Path $root -Parent
  $release = Join-Path $parent 'release'
  if ((Test-Path -LiteralPath $release) -and
      (Select-String -LiteralPath $release -Pattern '^JAVA_VERSION=' -Quiet)) {
    $root = $parent
  }
}
$root
