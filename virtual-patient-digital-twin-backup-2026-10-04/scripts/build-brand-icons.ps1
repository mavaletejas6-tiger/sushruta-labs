# build-brand-icons.ps1
# Derives the favicon + PWA icon set from assets/images/sushruta-labs-mark.svg.
#
# The mark is authored as SVG (see build-brand-assets.js), but several consumers
# still need raster: the <link rel="icon"> fallbacks, apple-touch-icon, and the
# manifest entries. Rather than checking in opaque binaries of unknown provenance,
# the 512px master is rasterised once and every size is derived from it, so the
# icons can never drift from the SVG.
#
#   node scripts/build-brand-assets.js
#   powershell -ExecutionPolicy Bypass -File scripts/build-brand-icons.ps1
#
# The master raster (assets/images/sushruta-labs-mark-512.png) is checked in so
# this runs without a browser; regenerate it by screenshotting the mark SVG at
# 512x512 with a transparent background.
#
[CmdletBinding()]
param([string]$ProjectRoot = '')

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

if (-not $ProjectRoot) { $ProjectRoot = Split-Path -Parent $PSScriptRoot }

$master = Join-Path $ProjectRoot 'assets\images\sushruta-labs-mark-512.png'
$icoDir = Join-Path $ProjectRoot 'assets\icons'
if (-not (Test-Path $master)) { throw "Master raster not found: $master (run build-brand-assets.js + rasterise first)" }
New-Item -ItemType Directory -Force -Path $icoDir | Out-Null

$src = [System.Drawing.Bitmap]::FromFile($master)
Write-Host ("master: {0}x{1}" -f $src.Width, $src.Height)

# $pad = extra transparent margin as a fraction of the canvas. Maskable icons get
# a large pad because the launcher may crop them to a circle: the artwork has to
# survive inside the inner safe zone or the wings get clipped off.
function New-Icon([int]$size, [double]$pad) {
    $canvas = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($canvas)
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $avail = [int]($size * (1 - 2 * $pad))
    $scale = [Math]::Min($avail / $src.Width, $avail / $src.Height)
    $w = [int][Math]::Round($src.Width * $scale)
    $h = [int][Math]::Round($src.Height * $scale)
    $g.DrawImage($src, [int](($size - $w) / 2), [int](($size - $h) / 2), $w, $h)
    $g.Dispose()
    return $canvas
}

function Save-Png($bmp, $name) {
    $p = Join-Path $icoDir $name
    $bmp.Save($p, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host ("  wrote {0,-22} {1,4}x{2,-4} {3,8:N0} bytes" -f $name, $bmp.Width, $bmp.Height, (Get-Item $p).Length)
    $bmp.Dispose()
}

Save-Png (New-Icon 96 0)   'icon-96.png'
Save-Png (New-Icon 180 0)  'apple-touch-icon.png'
Save-Png (New-Icon 192 0)  'icon-192.png'
Save-Png (New-Icon 512 0)  'icon-512.png'
Save-Png (New-Icon 512 0.14) 'maskable-512.png'   # inside the circular safe zone

$src.Dispose()
Write-Host 'done.'