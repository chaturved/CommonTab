FROM python:3.12-slim

WORKDIR /srv
COPY pyproject.toml ./
COPY app ./app
COPY migrations ./migrations
COPY alembic.ini ./
RUN pip install --no-cache-dir .

# DATABASE_URL must be set at run time. Apply migrations first: `alembic upgrade head`.
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
