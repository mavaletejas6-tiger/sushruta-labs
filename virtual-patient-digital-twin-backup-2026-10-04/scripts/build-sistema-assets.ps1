# build-sistema-assets.ps1
# Extracts the SYSTEMA brand artwork out of the supplied logo mockup and writes
# transparent PNGs into assets/images/ plus the PWA icon set into assets/icons/.
#
# Why a script instead of checked-in binaries only: the source is a 1408x768
# photo-style mockup (card on linen). Everything the app needs is a clean cut-out,
# so the cut-outs are derived, not hand-traced. Re-run after replacing the mockup.
#
#   powershell -ExecutionPolicy Bypass -File scripts/build-sistema-assets.ps1 `
#     -Source "C:\Users\NISHA\Downloads\Gemini_Generated_Image_3tjfjv3tjfjv3tjf.png"
#
# Artwork regions measured on the 1408x768 source:
#   emblem    X 525..882  Y 135..493
#   wordmark  X 471..942  Y 523..595   (SYSTEMA)
#   tagline   X 467..940  Y 615..639   (ADVANCED CONFIGURATION)

[CmdletBinding()]
param(
  [string]$Source = "$env:USERPROFILE\Downloads\Gemini_Generated_Image_3tjfjv3tjfjv3tjf.png",
  [string]$ProjectRoot = ''
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

if (-not $ProjectRoot) { $ProjectRoot = Split-Path -Parent $PSScriptRoot }

if (-not (Test-Path $Source)) { throw "Source logo not found: $Source" }

$imgDir = Join-Path $ProjectRoot 'assets\images'
$icoDir = Join-Path $ProjectRoot 'assets\icons'
New-Item -ItemType Directory -Force -Path $imgDir, $icoDir | Out-Null

$src = [System.Drawing.Bitmap]::FromFile($Source)
Write-Host "source: $($src.Width)x$($src.Height)  $Source"

# The artwork is navy + gold on a warm off-white card. Sample the card colour from a
# patch that is provably inside the card and to the left of the emblem.
$rs = 0; $gs = 0; $bs = 0; $n = 0
for ($y = 220; $y -lt 300; $y += 4) {
  for ($x = 400; $x -lt 500; $x += 4) {
    $c = $src.GetPixel($x, $y); $rs += $c.R; $gs += $c.G; $bs += $c.B; $n++
  }
}
$matte = @{ r = [int]($rs / $n); g = [int]($gs / $n); b = [int]($bs / $n) }
Write-Host ("card matte: #{0:X2}{1:X2}{2:X2}" -f $matte.r, $matte.g, $matte.b)

# Crop a rectangle and knock the card matte out to a real alpha channel.
# Colour-to-alpha is exact here because every ink channel is darker than the matte
# (navy and gold both are): alpha = 1 - min(channel ratio), then un-premultiply so
# edges keep their hue instead of fringing toward the card colour.
function Get-Cutout($bmp, $rect, $mat) {
  $out = New-Object System.Drawing.Bitmap($rect.Width, $rect.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $mr = $mat.r / 255.0; $mg = $mat.g / 255.0; $mb = $mat.b / 255.0
  for ($y = 0; $y -lt $rect.Height; $y++) {
    for ($x = 0; $x -lt $rect.Width; $x++) {
      $c = $bmp.GetPixel($rect.X + $x, $rect.Y + $y)
      $a = 1.0 - [Math]::Min($c.R / 255.0 / $mr, [Math]::Min($c.G / 255.0 / $mg, $c.B / 255.0 / $mb))
      if ($a -le 0.03) { $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0)); continue }
      if ($a -gt 1) { $a = 1.0 }
      $nr = ($c.R - $mat.r * (1 - $a)) / $a
      $ng = ($c.G - $mat.g * (1 - $a)) / $a
      $nb = ($c.B - $mat.b * (1 - $a)) / $a
      $nr = [Math]::Max(0, [Math]::Min(255, [int][Math]::Round($nr)))
      $ng = [Math]::Max(0, [Math]::Min(255, [int][Math]::Round($ng)))
      $nb = [Math]::Max(0, [Math]::Min(255, [int][Math]::Round($nb)))
      $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb([int][Math]::Round($a * 255), $nr, $ng, $nb))
    }
  }
  return $out
}

# Trim fully transparent margins so the PNG is exactly the artwork.
function Trim-Alpha($bmp, $threshold = 6) {
  $minX = $bmp.Width; $minY = $bmp.Height; $maxX = -1; $maxY = -1
  for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt $bmp.Width; $x++) {
      if ($bmp.GetPixel($x, $y).A -gt $threshold) {
        if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
        if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  if ($maxX -lt 0) { throw 'nothing to trim (empty cutout)' }
  $rect = New-Object System.Drawing.Rectangle($minX, $minY, ($maxX - $minX + 1), ($maxY - $minY + 1))
  $out = $bmp.Clone($rect, $bmp.PixelFormat)
  $bmp.Dispose()
  return $out
}

function Draw-Scaled($srcBmp, $dst, $dx, $dy, $dw, $dh) {
  $g = [System.Drawing.Graphics]::FromImage($dst)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.DrawImage($srcBmp, (New-Object System.Drawing.Rectangle($dx, $dy, $dw, $dh)))
  $g.Dispose()
}

# Scale an ARGB bitmap into a square canvas of $size, preserving aspect ratio.
function New-Square($bmp, $size, $pad = 0) {
  $canvas = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $avail = $size - (2 * $pad)
  $scale = [Math]::Min($avail / $bmp.Width, $avail / $bmp.Height)
  $w = [int][Math]::Round($bmp.Width * $scale)
  $h = [int][Math]::Round($bmp.Height * $scale)
  Draw-Scaled $bmp $canvas ([int](($size - $w) / 2)) ([int](($size - $h) / 2)) $w $h
  return $canvas
}

function Save-Png($bmp, $path) {
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $size = (Get-Item $path).Length
  Write-Host ("  wrote {0,-28} {1,4}x{2,-4} {3,8:N0} bytes" -f (Split-Path -Leaf $path), $bmp.Width, $bmp.Height, $size)
  $bmp.Dispose()
}
# ---------------------------------------------------------------- cut the parts
$pad = 6
function Rect($x0, $y0, $x1, $y1) {
  New-Object System.Drawing.Rectangle(($x0 - $pad), ($y0 - $pad), ($x1 - $x0 + 1 + 2 * $pad), ($y1 - $y0 + 1 + 2 * $pad))
}

Write-Host 'cutting artwork...'
$emblem = Trim-Alpha (Get-Cutout $src (Rect 525 135 882 493) $matte)
$word   = Trim-Alpha (Get-Cutout $src (Rect 471 523 942 595) $matte)
$tag    = Trim-Alpha (Get-Cutout $src (Rect 467 615 940 639) $matte)
Write-Host ("  emblem {0}x{1}  word {2}x{3}  tagline {4}x{5}" -f $emblem.Width, $emblem.Height, $word.Width, $word.Height, $tag.Width, $tag.Height)

# --------------------------------------------------------------- mark (roundel)
Save-Png (New-Square $emblem 512) (Join-Path $imgDir 'sistema-mark.png')

# ------------------------------------------- vertical lockup: emblem + wordmark
# Mirrors the supplied artwork: roundel centred above SYSTEMA above the tagline.
$emH = 420
$emW = [int][Math]::Round($emblem.Width * ($emH / $emblem.Height))
$ww  = $word.Width
$wh  = $word.Height
$tgW = $tag.Width
$th  = $tag.Height
$gap1 = 56; $gap2 = 44
$lockW = [Math]::Max([Math]::Max($emW, $ww), $tgW)
$lockH = $emH + $gap1 + $wh + $gap2 + $th
$lock = New-Object System.Drawing.Bitmap($lockW, $lockH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
Draw-Scaled $emblem $lock ([int](($lockW - $emW) / 2)) 0 $emW $emH
Draw-Scaled $word   $lock ([int](($lockW - $ww) / 2)) ($emH + $gap1) $ww $wh
Draw-Scaled $tag    $lock ([int](($lockW - $tgW) / 2)) ($emH + $gap1 + $wh + $gap2) $tgW $th
Save-Png $lock (Join-Path $imgDir 'sistema-logo.png')

# ------------------------------- horizontal lockup: roundel left, SYSTEMA right
# The header slot is a short wide bar, so the tagline is dropped (illegible at
# 38px tall) and only SYSTEMA sits beside the roundel.
$emH2 = 96
$emW2 = [int][Math]::Round($emblem.Width * ($emH2 / $emblem.Height))
$scale2 = ($emH2 * 0.86) / $word.Height
$ww2 = [int][Math]::Round($word.Width * $scale2)
$wh2 = [int][Math]::Round($word.Height * $scale2)
$gapH = 28
$horW = $emW2 + $gapH + $ww2
$hor = New-Object System.Drawing.Bitmap($horW, $emH2, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
Draw-Scaled $emblem $hor 0 0 $emW2 $emH2
Draw-Scaled $word   $hor ($emW2 + $gapH) ([int](($emH2 - $wh2) / 2)) $ww2 $wh2
Save-Png $hor (Join-Path $imgDir 'sistema-horizontal.png')

# ------------------------------------------------------------------- PWA icons
Save-Png (New-Square $emblem 96)  (Join-Path $icoDir 'icon-96.png')
Save-Png (New-Square $emblem 192) (Join-Path $icoDir 'icon-192.png')
Save-Png (New-Square $emblem 512) (Join-Path $icoDir 'icon-512.png')
Save-Png (New-Square $emblem 180) (Join-Path $icoDir 'apple-touch-icon.png')
# maskable: the art must survive a circular crop, so keep it inside the safe zone
Save-Png (New-Square $emblem 512 96) (Join-Path $icoDir 'maskable-512.png')

$src.Dispose()
$emblem.Dispose(); $word.Dispose(); $tag.Dispose()
Write-Host 'done.'