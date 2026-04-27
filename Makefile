.PHONY: install build test typecheck dev format clean docker-build docker-up docker-down docker-prod-up docker-prod-down

install:
	pnpm install

build:
	pnpm build

test:
	pnpm test

typecheck:
	pnpm run typecheck

dev:
	pnpm run dev

format:
	pnpm run format

clean:
	rm -rf packages/*/dist

docker-build:
	docker compose build

docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-prod-up:
	docker compose -f docker-compose.prod.yml up -d

docker-prod-down:
	docker compose -f docker-compose.prod.yml down
