@echo off
echo ======================================================================
echo 🚀 Silent SOS Local AI Engine - Environment Setup
echo ======================================================================
echo Checking Python installation...
python --version
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH. Please install Python 3.10+
    exit /b 1
)

echo.
echo Installing required AI & NLP dependencies...
pip install --upgrade pip
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install transformers datasets accelerate peft bitsandbytes sentence-transformers faiss-cpu fastapi uvicorn requests beautifulsoup4

echo.
echo ======================================================================
echo ✅ Environment successfully configured for Silent SOS AI Engine.
echo You can now run "start_ai_engine.bat" to start the local AI inference service.
echo ======================================================================

