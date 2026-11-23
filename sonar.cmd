@echo off
echo Iniciando SonarScanner para CuidartePlus...
docker run --rm -v "%cd%\BACKEND:/usr/src" --env-file .env.sonar sonarsource/sonar-scanner-cli
echo Analisis finalizado.
pause
