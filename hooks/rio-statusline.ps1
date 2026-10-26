# rio — statusline badge (Windows). Prints the active mode if the flag exists.
# Reads %CLAUDE_CONFIG_DIR%\.rio-active or ~\.claude\.rio-active.

$claudeDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME ".claude" }
$flag = Join-Path $claudeDir ".rio-active"

if (-not (Test-Path $flag)) { exit 0 }

$mode = (Get-Content $flag -Raw -ErrorAction SilentlyContinue).Trim()
$label = switch ($mode) {
  "lite"  { "MEMO" }
  "full"  { "SEMINAR" }
  "ultra" { "BIG-SISTER" }
  ""      { exit 0 }
  default { $mode.ToUpper() }
}

Write-Host -NoNewline "[RIO:$label]"
