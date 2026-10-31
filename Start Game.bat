@echo off
chcp 65001 >nul
setlocal
title Музеј за Луку
pushd "%~dp0"
if errorlevel 1 goto folder_error

where node >nul 2>nul
if errorlevel 1 goto node_error
where npm.cmd >nul 2>nul
if errorlevel 1 goto node_error
if not exist "node_modules\vite\bin\vite.js" goto dependencies_error

echo Покрећемо музеј...
echo Остави овај прозор отворен док играш.
echo Затвори прозор када завршиш.
echo.
call npm.cmd run dev -- --host localhost --port 5180 --strictPort --open
if errorlevel 1 goto start_error
popd
exit /b 0

:node_error
echo Потребан је Node.js. Инсталирај га, па покрени игру поново.
goto failed

:dependencies_error
echo Прво покрени npm install у фасцикли игре.
goto failed

:start_error
echo.
echo Игра није покренута. Погледај поруку изнад.
echo Ако је игра већ отворена, посети http://localhost:5180 у прегледачу.
goto failed

:folder_error
echo Фасцикла игре није доступна.
pause >nul
exit /b 1

:failed
echo Притисни било који тастер да затвориш прозор.
pause >nul
popd
exit /b 1
