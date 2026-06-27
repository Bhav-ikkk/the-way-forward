# Copy embedded-safe placeholder models into public/models with clean names.
# All sources verified to embed their textures (no external Textures/*.png).
$pairs = @(
  @{ src = "assets/nature_kit/Models/GLTF format/campfire_logs.glb"; out = "campfire.glb" },
  @{ src = "assets/Furniture/Models/GLTF format/bench.glb";          out = "bench.glb" },
  @{ src = "assets/Furniture/Models/GLTF format/lampRoundFloor.glb"; out = "lamp.glb" },
  @{ src = "assets/Furniture/Models/GLTF format/books.glb";          out = "books.glb" },
  @{ src = "assets/nature_kit/Models/GLTF format/tent_detailedOpen.glb"; out = "tent.glb" },
  @{ src = "assets/nature_kit/Models/GLTF format/tree_detailed.glb"; out = "tree_knowledge.glb" },
  @{ src = "assets/nature_kit/Models/GLTF format/statue_obelisk.glb"; out = "obelisk.glb" },
  @{ src = "assets/nature_kit/Models/GLTF format/statue_column.glb"; out = "column.glb" },
  @{ src = "assets/nature_kit/Models/GLTF format/sign.glb";          out = "sign.glb" }
)
New-Item -ItemType Directory -Force -Path "public/models" | Out-Null
foreach ($p in $pairs) {
  if (-not (Test-Path $p.src)) { Write-Output ("MISSING SRC: " + $p.src); continue }
  Copy-Item $p.src ("public/models/" + $p.out) -Force
  # verify embedded (no external uri) in the destination
  $dest = "public/models/" + $p.out
  $bytes = [System.IO.File]::ReadAllBytes((Resolve-Path $dest))
  $jsonLen = [BitConverter]::ToUInt32($bytes, 12)
  $json = [System.Text.Encoding]::UTF8.GetString($bytes, 20, $jsonLen)
  $uris = [regex]::Matches($json, '"uri"\s*:\s*"([^"]+)"') | ForEach-Object { $_.Groups[1].Value }
  $flag = if ($uris.Count -gt 0) { "EXTERNAL!" } else { "ok" }
  Write-Output ("{0} -> {1} [{2}] {3}KB" -f (Split-Path $p.src -Leaf), $p.out, $flag, [int]($bytes.Length/1024))
}
