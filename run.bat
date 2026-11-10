@echo off
REM Smart Start — bitta buyruq bilan ishga tushirish (Windows)
REM Ikki marta bosing yoki: run.bat
setlocal
cd /d "%~dp0"
if "%PORT%"=="" set PORT=8000

where py >nul 2>nul
if %errorlevel%==0 (
  set PY=py -3
) else (
  where python >nul 2>nul
  if errorlevel 1 (
    echo Python topilmadi. Python 3.10+ ni https://www.python.org/downloads/ dan o'rnating
    echo O'rnatishda "Add python.exe to PATH" belgisini qo'ying.
    pause
    exit /b 1
  )
  set PY=python
)

%PY% -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)"
if errorlevel 1 (
  echo Python 3.10 yoki undan yangi versiya kerak.
  pause
  exit /b 1
)

if not exist .venv (
  echo ^>^> Virtual muhit yaratilmoqda (.venv)...
  %PY% -m venv .venv
  if errorlevel 1 ( pause & exit /b 1 )
)
call .venv\Scripts\activate.bat

if not exist .venv\.installed (
  echo ^>^> Kutubxonalar o'rnatilmoqda...
  python -m pip install --upgrade pip
  python -m pip install -r requirements.txt
  if errorlevel 1 ( echo O'rnatishda xato. Internetni tekshiring. & pause & exit /b 1 )
  echo ok> .venv\.installed
)

if not exist .env (
  copy .env.example .env >nul
  echo ^>^> .env fayli yaratildi.
)

echo.
echo ==============================================================
echo   Smart Start ishga tushmoqda:  http://localhost:%PORT%
echo   API hujjati (Swagger):        http://localhost:%PORT%/api/docs
echo   To'xtatish: Ctrl+C
echo ==============================================================
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port %PORT%
pause
