@echo off
setlocal enabledelayedexpansion

echo MTCode Release Helper
echo =====================
echo.

rem Check if version argument provided
if "%~1"=="" (
    echo Usage: release.bat ^<version^>
    echo Example: release.bat 0.2.0
    echo.
    echo This will:
    echo  1. Update package.json version
    echo  2. Update tauri.conf.json version
    echo  3. Create git tag v^<version^>
    echo  4. Push tag to trigger GitHub Actions release
    echo.
    exit /b 1
)

set VERSION=%~1

echo Current version: 
node -p "require('./package.json').version"

echo.
echo Updating version to %VERSION%...

rem Update package.json
node -e "const p=require('./package.json'); p.version='%VERSION%'; require('fs').writeFileSync('package.json', JSON.stringify(p, null, 4) + '\n');"

rem Update tauri.conf.json
node -e "const p=require('./src-tauri/tauri.conf.json'); p.package.version='%VERSION%'; require('fs').writeFileSync('src-tauri/tauri.conf.json', JSON.stringify(p, null, 4) + '\n');"

echo.
echo Committing changes...
git add package.json src-tauri/tauri.conf.json
git commit -m "chore: bump version to %VERSION%"

echo.
echo Creating tag v%VERSION%...
git tag -a "v%VERSION%" -m "Release v%VERSION%"

echo.
echo Pushing to GitHub...
echo This will trigger the release workflow.
echo Check https://github.com/mtronape-tech/mtcode/actions for progress.
echo.

git push origin main --tags

echo.
echo Done! Monitor the Actions tab for build progress.
echo Once complete, binaries will be attached to the GitHub Release.

endlocal
