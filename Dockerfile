FROM node:20-slim AS frontend
WORKDIR /web
COPY web/package.json web/package-lock.json* ./
RUN npm ci
COPY web/ .
RUN npm run build

FROM python:3.12-slim
WORKDIR /app

RUN pip install --no-cache-dir \
    fastapi>=0.110.0 \
    "uvicorn[standard]>=0.27.0" \
    aiosqlite>=0.19.0 \
    python-multipart>=0.0.6 \
    websockets>=12.0 \
    numpy>=1.24.0

COPY src/ src/
COPY pyproject.toml .
RUN pip install --no-cache-dir -e .

COPY --from=frontend /web/dist/ src/orion_voice/web/static/

EXPOSE 8080

CMD ["python", "-m", "uvicorn", "orion_voice.api.server:create_app", "--factory", "--host", "0.0.0.0", "--port", "8080"]
