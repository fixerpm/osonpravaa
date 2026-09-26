Add-Type -AssemblyName System.Drawing

function Draw-Favicon([int]$size, [string]$outputPath) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Background Navy Squircle
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point(0, 0)),
        (New-Object System.Drawing.Point($size, $size)),
        [System.Drawing.Color]::FromArgb(255, 10, 21, 48),
        [System.Drawing.Color]::FromArgb(255, 7, 14, 34)
    )

    $radius = [float]($size * 0.22)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = [float]($radius * 2.0)
    $szF = [float]$size
    $path.AddArc(0.0, 0.0, $d, $d, 180.0, 90.0)
    $path.AddArc(($szF - $d), 0.0, $d, $d, 270.0, 90.0)
    $path.AddArc(($szF - $d), ($szF - $d), $d, $d, 0.0, 90.0)
    $path.AddArc(0.0, ($szF - $d), $d, $d, 90.0, 90.0)
    $path.CloseFigure()

    $g.FillPath($bgBrush, $path)

    # Outer border
    $goldPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(180, 245, 158, 11), [float]([Math]::Max(1.0, [double]$size * 0.02)))
    $g.DrawPath($goldPen, $path)

    # Scale factor for shield
    $s = [float]($size / 512.0)

    # Shield points
    $pt1 = New-Object System.Drawing.PointF([float](256.0 * $s), [float](64.0 * $s))
    $c1a = New-Object System.Drawing.PointF([float](350.0 * $s), [float](64.0 * $s))
    $c1b = New-Object System.Drawing.PointF([float](420.0 * $s), [float](100.0 * $s))
    $pt2 = New-Object System.Drawing.PointF([float](420.0 * $s), [float](175.0 * $s))

    $c2a = New-Object System.Drawing.PointF([float](420.0 * $s), [float](310.0 * $s))
    $c2b = New-Object System.Drawing.PointF([float](340.0 * $s), [float](395.0 * $s))
    $pt3 = New-Object System.Drawing.PointF([float](256.0 * $s), [float](440.0 * $s))

    $c3a = New-Object System.Drawing.PointF([float](172.0 * $s), [float](395.0 * $s))
    $c3b = New-Object System.Drawing.PointF([float](92.0 * $s), [float](310.0 * $s))
    $pt4 = New-Object System.Drawing.PointF([float](92.0 * $s), [float](175.0 * $s))

    $c4a = New-Object System.Drawing.PointF([float](92.0 * $s), [float](100.0 * $s))
    $c4b = New-Object System.Drawing.PointF([float](162.0 * $s), [float](64.0 * $s))

    $shieldPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $shieldPath.AddBezier($pt1, $c1a, $c1b, $pt2)
    $shieldPath.AddBezier($pt2, $c2a, $c2b, $pt3)
    $shieldPath.AddBezier($pt3, $c3a, $c3b, $pt4)
    $shieldPath.AddBezier($pt4, $c4a, $c4b, $pt1)
    $shieldPath.CloseFigure()

    # Shield Fill
    $shieldBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point(0, 0)),
        (New-Object System.Drawing.Point(0, $size)),
        [System.Drawing.Color]::FromArgb(255, 20, 38, 87),
        [System.Drawing.Color]::FromArgb(255, 10, 21, 48)
    )
    $g.FillPath($shieldBrush, $shieldPath)

    # Shield Gold Border
    $shieldBorderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 245, 158, 11), [float]([Math]::Max(1.5, [double](16.0 * $s))))
    $g.DrawPath($shieldBorderPen, $shieldPath)

    # Checkmark Points
    $pA = New-Object System.Drawing.PointF([float](185.0 * $s), [float](248.0 * $s))
    $pB = New-Object System.Drawing.PointF([float](236.0 * $s), [float](300.0 * $s))
    $pC = New-Object System.Drawing.PointF([float](334.0 * $s), [float](185.0 * $s))

    $pts = [System.Drawing.PointF[]]@($pA, $pB, $pC)

    # Gold Check glow / stroke
    $checkGoldPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 245, 158, 11), [float]([Math]::Max(3.0, [double](44.0 * $s))))
    $checkGoldPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $checkGoldPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $checkGoldPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $g.DrawLines($checkGoldPen, $pts)

    # White Checkmark
    $checkPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 255, 255, 255), [float]([Math]::Max(1.8, [double](32.0 * $s))))
    $checkPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $checkPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $checkPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $g.DrawLines($checkPen, $pts)

    # Apex dot
    if ($size -ge 32) {
        $dotBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 56, 189, 248))
        $dotR = [float]([Math]::Max(2.0, [double](7.0 * $s)))
        $g.FillEllipse($dotBrush, [float](256.0 * $s - $dotR), [float](116.0 * $s - $dotR), [float]($dotR * 2.0), [float]($dotR * 2.0))
    }

    $g.Dispose()
    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Created: $outputPath ($size x $size)"
}

$sizes = @(16, 32, 192, 512)
foreach ($sz in $sizes) {
    Draw-Favicon $sz "$PSScriptRoot\..\favicon-$sz.png"
}
