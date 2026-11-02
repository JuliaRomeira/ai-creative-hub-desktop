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
    var pending = new Stack<DirectoryInfo>();
    pending.Push(new DirectoryInfo(root));
    while (pending.Count > 0) {
      var directory = pending.Pop();
      try {
        // One directory read supplies cached attributes, including hidden/system entries.
        foreach (var entry in directory.EnumerateFileSystemInfos()) {
          try {
            var attributes = entry.Attributes;
            if ((attributes & FileAttributes.Directory) != 0) {
              if ((attributes & FileAttributes.ReparsePoint) == 0)
                pending.Push((DirectoryInfo)entry);
            } else if (String.Equals(entry.Name, "java.exe", StringComparison.OrdinalIgnoreCase)) {
              // File aliases are included; only directory links are skipped.
              found.Add(entry.FullName);
            }
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
