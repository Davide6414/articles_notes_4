param(
  [string]$JsonPath = (Join-Path (Split-Path -Parent $PSScriptRoot) "..\data\data.json")
)

Write-Host "Loading JSON from" $JsonPath
if (-not (Test-Path $JsonPath)) { Write-Error "File not found: $JsonPath"; exit 1 }

try {
  $raw = Get-Content -Raw -LiteralPath $JsonPath
  $db = $raw | ConvertFrom-Json -Depth 100
} catch {
  Write-Error "Failed to parse JSON: $($_.Exception.Message)"; exit 1
}

$changed = 0
foreach ($doi in $db.PSObject.Properties.Name) {
  $entry = $db.$doi
  if ($null -eq $entry) { continue }
  # Normalize possible legacy single note
  if ($entry.PSObject.Properties.Name -contains 'user_note' -and -not ($entry.PSObject.Properties.Name -contains 'user_notes')) {
    $entry | Add-Member -NotePropertyName user_notes -NotePropertyValue @()
    if ($null -ne $entry.user_note) { $entry.user_notes += $entry.user_note }
    $entry.PSObject.Properties.Remove('user_note') | Out-Null
    $changed++
  }
  if ($entry.PSObject.Properties.Name -contains 'user_notes') {
    $notes = $entry.user_notes
    if ($notes -is [System.Collections.IEnumerable]) {
      for ($i = 0; $i -lt $notes.Count; $i++) {
        $n = $notes[$i]
        if ($null -eq $n) { continue }
        if (-not ($n.PSObject.Properties.Name -contains 'importanza')) {
          $n | Add-Member -NotePropertyName importanza -NotePropertyValue 1
          $changed++
        }
      }
    }
  }
}

if ($changed -gt 0) {
  Write-Host "Updated" $changed "notes with missing 'importanza'. Writing back..."
  try {
    $jsonOut = $db | ConvertTo-Json -Depth 100
    # Keep a backup
    $backup = "$JsonPath.bak"
    Copy-Item -LiteralPath $JsonPath -Destination $backup -Force
    $jsonOut | Out-File -LiteralPath $JsonPath -Encoding UTF8 -Force
    Write-Host "Done. Backup saved at" $backup
  } catch {
    Write-Error "Failed to write JSON: $($_.Exception.Message)"; exit 1
  }
} else {
  Write-Host "No changes needed. All notes already contain 'importanza'."
}

