# Copy additional embedded-safe placeholder models (composition/atmosphere) from
# the existing nature_kit pack into public/models. Verifies each has NO external
# texture (skips any that do, to avoid the colormap 404 class of bug).
$pairs = @(
  @{ src = "assets/nature_kit/Models/GLTF format/fence_simple.glb";  out = "fence.glb" },
  @{ src = "assets/nature_kit/Models/GLTF format/fence_corner.glb";  out = "fence_corner.glb" },
  @{ src = "assets/nature_kit/Models/GLTF format/plant_bush.glb";    out = "bush.glb" },
  @{ src = "assets/nature_kit/Models/GLTF format/grass.glb";         out = "grass.glb" },
  @{ src = "assets/nature_kit/Models/GLTF format/grass_large.glb";   out = "grass_large.glb" },
  @{ src = "assets/nature_kit/Models/GLTF format/flower_redA.glb";   out = "flower_red.glb" },
  @{ src = "assets/nature_kit/Models/GLTF format/flower_yellowA.glb"; out = "flower_yellow.glb" },
  @{ src = "assets/nature_kit/Models/GLTF format/mushroom_red.glb";  out = "mushroom.glb" },
  @{ src = "assets/nature_kit/Models/GLTF format/lily_small.glb";    out = "lily.glb" },
  @{ src = "assets/nature_kit/Models/GLTF format/log.glb";           out = "log.glb" },
  @{ src = "assets/nature_kit/Models/GLTF format/stone_smallA.glb";  out = "stone_small.glb" },
  @{ src = "assets/nature_kit/Models/GLTF format/tree_pineTallA.glb"; out = "tree_pine_tall.glb" }
)
foreach ($p in $pairs) {
  if (-not (Test-Path $p.src)) { Write-Output ("MISSING SRC: " + $p.src); continue }
  $bytes = [System.IO.File]::ReadAllBytes((Resolve-Path $p.src))
  $jsonLen = [BitConverter]::ToUInt32($bytes, 12)
  $json = [System.Text.Encoding]::UTF8.GetString($bytes, 20, $jsonLen)
  $uris = [regex]::Matches($json, '"uri"\s*:\s*"([^"]+)"') | ForEach-Object { $_.Groups[1].Value }
  if ($uris.Count -gt 0) { Write-Output ("SKIP (external tex): " + $p.out + " -> [" + ($uris -join ",") + "]"); continue }
  Copy-Item $p.src ("public/models/" + $p.out) -Force
  Write-Output ("ok " + $p.out + " (" + [int]($bytes.Length/1024) + "KB)")
}
