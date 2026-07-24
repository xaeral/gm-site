$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$prefix = "http://localhost:4173/"
$gDocUrl = "https://docs.google.com/document/d/e/2PACX-1vQS4U5rszkiEDIlirKhNGFb8nbmhQSYmHJrbwPSNvkU9P5HHdXHrDJG_i95k_ey2kSCkzh2Fjlf00vP/pub?embedded=true"

$mimeMap = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".svg"  = "image/svg+xml"
  ".ico"  = "image/x-icon"
}

function Write-BytesResponse {
  param(
    [Parameter(Mandatory=$true)] $Context,
    [Parameter(Mandatory=$true)] [byte[]] $Body,
    [Parameter(Mandatory=$true)] [string] $ContentType,
    [int] $StatusCode = 200
  )

  $resp = $Context.Response
  $resp.StatusCode = $StatusCode
  $resp.ContentType = $ContentType
  $resp.ContentLength64 = $Body.Length
  $resp.OutputStream.Write($Body, 0, $Body.Length)
  $resp.OutputStream.Close()
}

function Write-TextResponse {
  param(
    [Parameter(Mandatory=$true)] $Context,
    [Parameter(Mandatory=$true)] [string] $Text,
    [int] $StatusCode = 200
  )

  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
  Write-BytesResponse -Context $Context -Body $bytes -ContentType "text/plain; charset=utf-8" -StatusCode $StatusCode
}

function Resolve-StaticFile {
  param([string] $Path)

  if ([string]::IsNullOrWhiteSpace($Path) -or $Path -eq "/") {
    return (Join-Path $root "index.html")
  }

  $decoded = [System.Uri]::UnescapeDataString($Path.TrimStart('/'))
  $candidate = Join-Path $root $decoded

  if (Test-Path $candidate -PathType Container) {
    $indexCandidate = Join-Path $candidate "index.html"
    if (Test-Path $indexCandidate -PathType Leaf) {
      return $indexCandidate
    }
  }

  return $candidate
}

function Proxy-Remote {
  param(
    [Parameter(Mandatory=$true)] $Context,
    [Parameter(Mandatory=$true)] [string] $TargetUrl,
    [string] $RewriteMode = "None"
  )

  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $TargetUrl -Method Get -MaximumRedirection 5

    $contentType = if ($response.Headers["Content-Type"]) {
      $response.Headers["Content-Type"]
    } else {
      "text/html; charset=utf-8"
    }

    $isHtml = $contentType.ToLowerInvariant().StartsWith("text/html")

    if ($isHtml) {
      $html = [string]$response.Content

      if ($RewriteMode -eq "GDocs") {
        $html = $html -replace 'href="/(?!/)', 'href="https://docs.google.com/'
        $html = $html -replace 'src="/(?!/)', 'src="https://docs.google.com/'
      }

      if ($RewriteMode -eq "VRelations") {
        $html = $html -replace 'href="/(?!/)', 'href="/integrations/vrelations/'
        $html = $html -replace 'src="/(?!/)', 'src="/integrations/vrelations/'
        $html = $html -replace 'action="/(?!/)', 'action="/integrations/vrelations/'
        $html = $html -replace 'url\(/', 'url(/integrations/vrelations/'
      }

      $body = [System.Text.Encoding]::UTF8.GetBytes($html)
      Write-BytesResponse -Context $Context -Body $body -ContentType $contentType -StatusCode ([int]$response.StatusCode)
      return
    }

    $body = $response.RawContentStream.ToArray()

    Write-BytesResponse -Context $Context -Body $body -ContentType $contentType -StatusCode ([int]$response.StatusCode)
  } catch {
    Write-TextResponse -Context $Context -Text "Proxy request failed: $($_.Exception.Message)" -StatusCode 502
  }
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()

Write-Host "Chronicle Codex local proxy running at $prefix"
Write-Host "Press Ctrl+C to stop."

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $path = $request.Url.AbsolutePath

    if ($path.StartsWith("/integrations/gdocs-content")) {
      try {
        $docResponse = Invoke-WebRequest -UseBasicParsing -Uri $gDocUrl -Method Get -MaximumRedirection 5
        $docHtml = [string]$docResponse.Content

        $match = [System.Text.RegularExpressions.Regex]::Match($docHtml, '<body[^>]*>(?<content>[\s\S]*?)</body>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        $content = if ($match.Success) { $match.Groups["content"].Value } else { $docHtml }

        $content = [System.Text.RegularExpressions.Regex]::Replace($content, '<script[\s\S]*?</script>', '', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        $content = [System.Text.RegularExpressions.Regex]::Replace($content, '<style[\s\S]*?</style>', '', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        $content = [System.Text.RegularExpressions.Regex]::Replace($content, '<link[^>]*>', '', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        $content = $content -replace 'href="/(?!/)', 'href="https://docs.google.com/'

        $wrapped = "<article class='gdoc-proxy-content'>$content</article>"
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($wrapped)
        Write-BytesResponse -Context $context -Body $bytes -ContentType "text/html; charset=utf-8" -StatusCode 200
      } catch {
        Write-TextResponse -Context $context -Text "Unable to load GM notes content right now." -StatusCode 502
      }
      continue
    }

    if ($path.StartsWith("/integrations/gdocs")) {
      Proxy-Remote -Context $context -TargetUrl $gDocUrl -RewriteMode "GDocs"
      continue
    }

    if ($path.StartsWith("/integrations/vrelations")) {
      $suffix = $request.RawUrl.Substring("/integrations/vrelations".Length)
      if ([string]::IsNullOrEmpty($suffix)) {
        $suffix = "/"
      }
      $target = "https://v-relations.com$suffix"
      Proxy-Remote -Context $context -TargetUrl $target -RewriteMode "VRelations"
      continue
    }

    $filePath = Resolve-StaticFile -Path $path

    if (-not (Test-Path $filePath -PathType Leaf)) {
      Write-TextResponse -Context $context -Text "Not Found" -StatusCode 404
      continue
    }

    $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
    $contentType = if ($mimeMap.ContainsKey($extension)) { $mimeMap[$extension] } else { "application/octet-stream" }
    $bytes = [System.IO.File]::ReadAllBytes($filePath)

    Write-BytesResponse -Context $context -Body $bytes -ContentType $contentType -StatusCode 200
  }
}
finally {
  $listener.Stop()
  $listener.Close()
}
