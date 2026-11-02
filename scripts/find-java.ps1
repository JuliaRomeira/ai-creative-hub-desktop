param([Parameter(Mandatory = $true)][string]$Root)
$ErrorActionPreference = 'Stop'
$scanRoot = [IO.Path]::GetFullPath($Root)
if (-not [IO.Directory]::Exists($scanRoot)) { throw "Scan root unavailable: $scanRoot" }
if (-not ('AichJavaInventory' -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.IO;

public static class AichJavaInventory {
  public static string[] Find(string root) {
    var found = new List<string>();
    var pending = new Stack<string>();
    pending.Push(root);
    while (pending.Count > 0) {
      var directory = pending.Pop();
      try {
        // Include file aliases, hidden and system files; only directory links are skipped.
        found.AddRange(Directory.EnumerateFiles(directory, "java.exe", SearchOption.TopDirectoryOnly));
      } catch (UnauthorizedAccessException) {
      } catch (IOException) {
      }
      try {
        foreach (var child in Directory.EnumerateDirectories(directory)) {
          try {
            if ((File.GetAttributes(child) & FileAttributes.ReparsePoint) == 0)
              pending.Push(child);
          } catch (UnauthorizedAccessException) {
          } catch (IOException) {
          }
        }
      } catch (UnauthorizedAccessException) {
      } catch (IOException) {
      }
    }
    return found.ToArray();
  }
}
'@
}
Write-Host "Scanning accessible files on $scanRoot for external java.exe..."
[AichJavaInventory]::Find($scanRoot)
