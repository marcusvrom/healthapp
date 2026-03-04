.PHONY: up down restart logs migrate migrate-revert migrate-show seed build clean

# ── Docker ────────────────────────────────────────────────────────────────────
up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f

build:
	docker compose build --no-cache

clean:
	docker compose down -v --remove-orphans

# ── Database Migrations (TypeORM CLI via ts-node) ─────────────────────────────
# Run inside the backend directory so typeorm.config.ts is found correctly.
# Requires a local Node environment with dependencies installed.

migrate:
	cd backend && npx typeorm migration:run -d src/config/typeorm.config.ts

migrate-revert:
	cd backend && npx typeorm migration:revert -d src/config/typeorm.config.ts

migrate-show:
	cd backend && npx typeorm migration:show -d src/config/typeorm.config.ts

migrate-generate:
	@read -p "Migration name: " name; \
	cd backend && npx typeorm migration:generate src/migrations/$$name -d src/config/typeorm.config.ts

migrate-create:
	@read -p "Migration name: " name; \
	cd backend && npx typeorm migration:create src/migrations/$$name

# ── Development helpers ───────────────────────────────────────────────────────
install:
	cd backend && npm install
	cd frontend && npm install

dev-backend:
	cd backend && npm run dev

dev-frontend:
	cd frontend && npm start

# ── Docker-based migration (runs inside the running backend container) ────────
migrate-docker:
	docker compose exec backend npx --yes tsx node_modules/typeorm/cli.js migration:run -d src/config/typeorm.config.ts

migrate-revert-docker:
	docker compose exec backend npx typeorm migration:revert -d src/config/typeorm.config.ts
