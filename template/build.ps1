param (
    [string]$Target = "userguide-example.tex",
    [string]$OutDir = "build"
)

if (-not (Test-Path -Path $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir | Out-Null
}

$env:TEXINPUTS = ".;.\latex;" + $env:TEXINPUTS

Write-Host "Building $Target -> $OutDir..." -ForegroundColor Cyan
latexmk -pdf "-output-directory=$OutDir" -interaction=nonstopmode $Target

if ($LASTEXITCODE -eq 0) {
    Write-Host "Build successful. Output is in $OutDir\" -ForegroundColor Green
} else {
    Write-Host "Build failed with exit code $LASTEXITCODE." -ForegroundColor Red
    exit $LASTEXITCODE
}
