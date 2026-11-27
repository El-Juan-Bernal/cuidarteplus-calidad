@echo off
echo Iniciando SonarScanner para CuidartePlus Backend...
docker run --rm -v "%cd%\BACKEND:/usr/src" --env-file .env.sonar sonarsource/sonar-scanner-cli
echo Iniciando SonarScanner para CuidartePlus Frontend...
docker run --rm -v "%cd%\FRONTEND:/usr/src" --env-file .env.sonar sonarsource/sonar-scanner-cli
echo Analisis finalizado.
pause
