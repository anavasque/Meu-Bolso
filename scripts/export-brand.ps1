$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
public static class BolsoBounds {
  public static int[] Find(byte[] pixels, int stride, int width, int height) {
    int left=width, top=height, right=0, bottom=0;
    for(int y=0;y<height;y++) for(int x=0;x<width;x++) {
      if(pixels[y*stride+x*4+3]<8) continue;
      left=Math.Min(left,x); top=Math.Min(top,y); right=Math.Max(right,x); bottom=Math.Max(bottom,y);
    }
    if(right<left || bottom<top) throw new Exception("Empty logo");
    return new int[]{left,top,right-left+1,bottom-top+1};
  }
}
'@
$projectRoot = Split-Path -Parent $PSScriptRoot
$source = [System.Drawing.Bitmap]::new((Join-Path $projectRoot 'branding/logo-bolso-tres-moedas-v6.png'))
$full = [System.Drawing.Rectangle]::new(0,0,$source.Width,$source.Height)
$locked = $source.LockBits($full,[System.Drawing.Imaging.ImageLockMode]::ReadOnly,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$pixels = [byte[]]::new($locked.Stride*$source.Height)
[System.Runtime.InteropServices.Marshal]::Copy($locked.Scan0,$pixels,0,$pixels.Length)
$found = [BolsoBounds]::Find($pixels,$locked.Stride,$source.Width,$source.Height)
$source.UnlockBits($locked)
$bounds = [System.Drawing.Rectangle]::new($found[0],$found[1],$found[2],$found[3])
foreach ($variant in @(@('logo-bolso.png',512,$true,0.94),@('icon-bolso-192.png',192,$false,0.76),@('icon-bolso-512.png',512,$false,0.70),@('apple-touch-icon-bolso.png',180,$false,0.76),@('favicon-bolso.png',48,$false,0.88))) {
  $size = [int]$variant[1]
  $bitmap = [System.Drawing.Bitmap]::new($size,$size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $background = if($variant[2]) {[System.Drawing.Color]::Transparent} else {[System.Drawing.ColorTranslator]::FromHtml('#fffaf7')}
  $graphics.Clear($background)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $scale = $size * [double]$variant[3] / [Math]::Max($bounds.Width,$bounds.Height)
  $width = [int][Math]::Round($bounds.Width*$scale)
  $height = [int][Math]::Round($bounds.Height*$scale)
  $target = [System.Drawing.Rectangle]::new([int](($size-$width)/2),[int](($size-$height)/2),$width,$height)
  $graphics.DrawImage($source,$target,$bounds,[System.Drawing.GraphicsUnit]::Pixel)
  $bitmap.Save((Join-Path $projectRoot ('dist/'+$variant[0])),[System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose(); $bitmap.Dispose()
}
$source.Dispose()
