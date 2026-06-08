$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$sourcePath = Join-Path $projectRoot "public\pets\goldpotato\goldpotato.png"
$iconsDir = Join-Path $projectRoot "src-tauri\icons"
$icoPath = Join-Path $iconsDir "icon.ico"
$pngPath = Join-Path $iconsDir "icon.png"

New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null

function New-IconBitmap {
  param(
    [System.Drawing.Bitmap] $Source,
    [int] $Size
  )

  $frame = New-Object System.Drawing.Bitmap 204, 256, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $frameGraphics = [System.Drawing.Graphics]::FromImage($frame)
  $frameGraphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
  $frameGraphics.DrawImage($Source, (New-Object System.Drawing.Rectangle 0, 0, 204, 256), 0, 0, 204, 256, [System.Drawing.GraphicsUnit]::Pixel)
  $frameGraphics.Dispose()

  $canvas = New-Object System.Drawing.Bitmap $Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($canvas)
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $drawHeight = [int]($Size * 0.88)
  $drawWidth = [int]($drawHeight * 204 / 256)
  $drawX = [int](($Size - $drawWidth) / 2)
  $drawY = [int](($Size - $drawHeight) / 2)
  $graphics.DrawImage($frame, $drawX, $drawY, $drawWidth, $drawHeight)

  $graphics.Dispose()
  $frame.Dispose()

  return $canvas
}

function New-DibIconBytes {
  param(
    [System.Drawing.Bitmap] $Bitmap
  )

  $width = $Bitmap.Width
  $height = $Bitmap.Height
  $xorStride = $width * 4
  $maskStride = [int]([Math]::Ceiling($width / 32.0) * 4)
  $xorSize = $xorStride * $height

  $stream = New-Object System.IO.MemoryStream
  $writer = New-Object System.IO.BinaryWriter $stream

  $writer.Write([UInt32]40)
  $writer.Write([Int32]$width)
  $writer.Write([Int32]($height * 2))
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]32)
  $writer.Write([UInt32]0)
  $writer.Write([UInt32]$xorSize)
  $writer.Write([Int32]0)
  $writer.Write([Int32]0)
  $writer.Write([UInt32]0)
  $writer.Write([UInt32]0)

  for ($y = $height - 1; $y -ge 0; $y--) {
    for ($x = 0; $x -lt $width; $x++) {
      $color = $Bitmap.GetPixel($x, $y)
      $writer.Write([byte]$color.B)
      $writer.Write([byte]$color.G)
      $writer.Write([byte]$color.R)
      $writer.Write([byte]$color.A)
    }
  }

  for ($y = $height - 1; $y -ge 0; $y--) {
    $maskRow = New-Object byte[] $maskStride
    for ($x = 0; $x -lt $width; $x++) {
      $color = $Bitmap.GetPixel($x, $y)
      if ($color.A -lt 128) {
        $byteIndex = [int][Math]::Floor($x / 8)
        $bitIndex = 7 - ($x % 8)
        $maskRow[$byteIndex] = [byte]($maskRow[$byteIndex] -bor (1 -shl $bitIndex))
      }
    }
    $writer.Write($maskRow)
  }

  $bytes = $stream.ToArray()
  $writer.Dispose()
  $stream.Dispose()

  return ,$bytes
}

$source = [System.Drawing.Bitmap]::FromFile($sourcePath)

try {
  $preview = New-IconBitmap -Source $source -Size 512
  $preview.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $preview.Dispose()

  $sizes = @(256, 128, 64, 48, 32, 16)
  $images = @()

  foreach ($size in $sizes) {
    $bitmap = New-IconBitmap -Source $source -Size $size
    try {
      $images += ,[pscustomobject]@{
        Size = $size
        Bytes = [byte[]](New-DibIconBytes -Bitmap $bitmap)
      }
    }
    finally {
      $bitmap.Dispose()
    }
  }

  $stream = New-Object System.IO.FileStream $icoPath, ([System.IO.FileMode]::Create), ([System.IO.FileAccess]::Write)
  $writer = New-Object System.IO.BinaryWriter $stream

  $writer.Write([UInt16]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]$images.Count)

  $offset = 6 + (16 * $images.Count)
  foreach ($image in $images) {
    $sizeByte = if ($image.Size -eq 256) { 0 } else { [byte]$image.Size }
    $writer.Write([byte]$sizeByte)
    $writer.Write([byte]$sizeByte)
    $writer.Write([byte]0)
    $writer.Write([byte]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]32)
    $writer.Write([UInt32]$image.Bytes.Length)
    $writer.Write([UInt32]$offset)
    $offset += $image.Bytes.Length
  }

  foreach ($image in $images) {
    $writer.Write($image.Bytes)
  }

  $writer.Dispose()
  $stream.Dispose()
}
finally {
  $source.Dispose()
}

Write-Output "Generated $icoPath"
