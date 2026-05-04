@echo off
setlocal

set TARGET=userguide-example.tex
set OUTDIR=build

if not exist "%OUTDIR%" (
    mkdir "%OUTDIR%"
)

set TEXINPUTS=.;.\latex;%TEXINPUTS%

if /i "%~1"=="clean" (
    echo Cleaning build artifacts...
    latexmk -C -output-directory="%OUTDIR%" "%TARGET%" 2>nul
    echo Clean complete.
    exit /b 0
)

echo Building %TARGET% -^> %OUTDIR%...
latexmk -pdf -output-directory="%OUTDIR%" -interaction=nonstopmode -g "%TARGET%"

if %ERRORLEVEL% neq 0 (
    echo Build failed with exit code %ERRORLEVEL%.
    exit /b %ERRORLEVEL%
) else (
    echo Build successful. Output is in %OUTDIR%\
)
endlocal
