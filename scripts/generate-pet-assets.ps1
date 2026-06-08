param(
  [ValidateSet("all", "moyu-cat", "offwork-hero", "lightwing-adept")]
  [string]$Pet = "all",

  [ValidateSet("low", "medium", "high", "auto")]
  [string]$Quality = "high",

  [ValidateSet("auto", "opaque")]
  [string]$Background = "opaque",

  [switch]$SkipChromaKey,

  [string]$SkillDir = "$env:USERPROFILE\.codex\skills\gpt-image"
)

$ErrorActionPreference = "Stop"

$localBin = Join-Path $env:USERPROFILE ".local\bin"
if (Test-Path -LiteralPath $localBin) {
  $env:Path = "$localBin;$env:Path"
}

$projectEnv = Join-Path (Resolve-Path ".") ".env"
$homeEnv = Join-Path $env:USERPROFILE ".env"

function Import-EnvVarFromFile {
  param(
    [string]$Path,
    [string]$Name
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    return $false
  }

  $content = Get-Content -Path $Path -Raw -Encoding UTF8
  $escapedName = [regex]::Escape($Name)
  $match = [regex]::Match($content, "(?m)^\s*$escapedName\s*=\s*(?<value>.+?)\s*$")

  if (-not $match.Success) {
    return $false
  }

  $value = $match.Groups["value"].Value.Trim()
  if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
    $value = $value.Substring(1, $value.Length - 2)
  }

  if (-not $value) {
    return $false
  }

  [Environment]::SetEnvironmentVariable($Name, $value, "Process")
  return $true
}

if (-not $env:OPENAI_API_KEY) {
  [void](Import-EnvVarFromFile -Path $projectEnv -Name "OPENAI_API_KEY")
}

if (-not $env:OPENAI_API_KEY) {
  [void](Import-EnvVarFromFile -Path $homeEnv -Name "OPENAI_API_KEY")
}

if (-not $env:OPENAI_API_KEY) {
  throw "OPENAI_API_KEY is not set. Set it in the shell, project .env, or user profile .env before running asset generation."
}

if (-not $env:OPENAI_BASE_URL) {
  [void](Import-EnvVarFromFile -Path $projectEnv -Name "OPENAI_BASE_URL")
}

if (-not $env:OPENAI_BASE_URL) {
  [void](Import-EnvVarFromFile -Path $homeEnv -Name "OPENAI_BASE_URL")
}

if ($env:OPENAI_BASE_URL) {
  $baseUrl = $env:OPENAI_BASE_URL.Trim().TrimEnd("/")
  if ($baseUrl -notmatch "/v1$") {
    $baseUrl = "$baseUrl/v1"
  }
  [Environment]::SetEnvironmentVariable("OPENAI_BASE_URL", $baseUrl, "Process")
}

$skillGenerate = Join-Path $SkillDir "scripts\generate.py"
if (-not (Test-Path -LiteralPath $skillGenerate)) {
  throw "gpt-image skill launcher not found: $skillGenerate"
}

$uv = Get-Command uv -ErrorAction SilentlyContinue
$uvx = Get-Command uvx -ErrorAction SilentlyContinue
$python = Get-Command python -ErrorAction SilentlyContinue
$py = Get-Command py -ErrorAction SilentlyContinue

if ($uv) {
  $runner = @($uv.Source, "run", $skillGenerate)
} elseif ($python) {
  $runner = @($python.Source, $skillGenerate)
} elseif ($py) {
  $runner = @($py.Source, "-3.11", $skillGenerate)
} elseif ($uvx) {
  $runner = @($uvx.Source, "--from", "git+https://github.com/wuyoscar/gpt_image_2_skill", "gpt-image")
} else {
  throw "No suitable Python/uv runner found. Install uv or Python 3.11+ before running asset generation."
}

$runnerExe = $runner[0]
$runnerArgs = @()
if ($runner.Count -gt 1) {
  $runnerArgs = $runner[1..($runner.Count - 1)]
}

if ($uv) {
  $chromaRunner = @($uv.Source, "run", "scripts\chroma-key-spritesheet.py")
} elseif ($python) {
  $chromaRunner = @($python.Source, "scripts\chroma-key-spritesheet.py")
} elseif ($py) {
  $chromaRunner = @($py.Source, "-3.11", "scripts\chroma-key-spritesheet.py")
} else {
  $chromaRunner = @()
}

$pets = @("moyu-cat", "offwork-hero", "lightwing-adept")
if ($Pet -ne "all") {
  $pets = @($Pet)
}

foreach ($petId in $pets) {
  $promptPath = Join-Path "docs\gpt-image\prompts" "$petId-spritesheet.prompt.txt"
  $outputDir = Join-Path "public\pets" $petId
  $outputPath = Join-Path $outputDir "spritesheet.webp"
  $chromaPath = Join-Path $outputDir "spritesheet_chroma.webp"

  if (-not (Test-Path -LiteralPath $promptPath)) {
    throw "Prompt not found: $promptPath"
  }

  New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
  $prompt = Get-Content -Path $promptPath -Raw -Encoding UTF8

  Write-Host "Generating $petId -> $outputPath"
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & $runnerExe @runnerArgs `
      -p $prompt `
      -f $outputPath `
      --model gpt-image-2 `
      --size "1024x1536" `
      --quality $Quality `
      --format webp `
      --background $Background 2>&1
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  if ($exitCode -ne 0) {
    $redactedOutput = ($output | ForEach-Object {
      ($_ -replace "sk-[A-Za-z0-9_-]+", "sk-***REDACTED***")
    }) -join [Environment]::NewLine

    if ($redactedOutput) {
      Write-Error $redactedOutput -ErrorAction Continue
    }

    throw "gpt-image failed for $petId with exit code $exitCode"
  }

  $output

  if (-not $SkipChromaKey) {
    if (-not $chromaRunner.Count) {
      throw "No suitable runner found for chroma-key postprocessing."
    }

    if (Test-Path -LiteralPath $chromaPath) {
      Remove-Item -LiteralPath $chromaPath -Force
    }

    Move-Item -LiteralPath $outputPath -Destination $chromaPath -Force

    $chromaExe = $chromaRunner[0]
    $chromaArgs = @()
    if ($chromaRunner.Count -gt 1) {
      $chromaArgs = $chromaRunner[1..($chromaRunner.Count - 1)]
    }

    Write-Host "Removing chroma-key background: $chromaPath -> $outputPath"
    & $chromaExe @chromaArgs $chromaPath $outputPath

    if ($LASTEXITCODE -ne 0) {
      throw "chroma-key postprocessing failed for $petId with exit code $LASTEXITCODE"
    }
  }
}
