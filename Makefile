.PHONY: backend frontend test docker clean

backend:
	cd backend && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend:
	cd frontend && npm run dev

test:
	cd backend && python -m pytest -q
	cd frontend && npm test

docker:
	docker compose up --build

clean:
	rm -rf backend/.pytest_cache backend/.mypy_cache backend/.ruff_cache frontend/.next frontend/node_modules
