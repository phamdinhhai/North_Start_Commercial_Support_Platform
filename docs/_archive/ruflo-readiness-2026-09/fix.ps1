$ErrorActionPreference="Stop"
$p = "D:\AI-for-Enterprise\North_Start_Commercial_Support_Platform\docs\project\ruflo-readiness\01a-repository-forensics.md"
$c = Get-Content $p -Raw
$c = $c -replace [regex]::Escape("3x ``npx ruflo@3.42.4 mcp start`` processes running (from Bernstein CLI probe"), "3x ``ruflo@3.42.4 mcp start`` descendants of live Codex CLI sessions; no orphaned Ruflo MCP processes observed; no Bernstein process-tree link observed (see Section 10.3)"
Write-Output "edit1 done: $($c.Length)"
Set-Content $p $c -Encoding UTF8
