BACKEND_DIR  := backend
FRONTEND_DIR := frontend
BINARY_NAME  := ems-backend
POSTGRES_URL ?= postgres://ems:ems@localhost:5432/ems_metadata?sslmode=disable

.PHONY: run run-backend run-frontend test test-backend test-frontend \
        build build-backend build-frontend lint lint-backend lint-frontend \
        db-migrate-postgres db-seed-postgres clean help

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

run: ## Run both services via docker-compose
	docker compose up --build

run-backend: ## Run the Go backend (hot-reload via air if available)
	cd $(BACKEND_DIR) && \
	if command -v air >/dev/null 2>&1; then air; \
	else go run ./cmd/backend; fi

run-frontend: ## Run the Next.js dev server
	cd $(FRONTEND_DIR) && npm run dev

test: test-backend test-frontend ## Run all tests

test-backend: ## Run Go tests with race detector
	cd $(BACKEND_DIR) && go test -race ./...

test-frontend: ## Run Next.js / Jest tests
	cd $(FRONTEND_DIR) && npm test --if-present

build: build-backend build-frontend ## Build everything

build-backend: ## Compile the Go backend binary
	cd $(BACKEND_DIR) && go build -o bin/$(BINARY_NAME) ./cmd/backend

build-frontend: ## Build the Next.js production bundle
	cd $(FRONTEND_DIR) && npm run build

lint: lint-backend lint-frontend ## Lint everything

lint-backend: ## Run golangci-lint (or go vet as fallback)
	cd $(BACKEND_DIR) && \
	if command -v golangci-lint >/dev/null 2>&1; then golangci-lint run ./...; \
	else go vet ./...; fi

lint-frontend: ## Run ESLint via npm
	cd $(FRONTEND_DIR) && npm run lint

db-migrate-postgres: ## Run PostgreSQL migrations (golang-migrate)
	migrate -path db/postgres/migrations -database "$(POSTGRES_URL)" up

db-seed-postgres: ## Seed PostgreSQL metadata data
	psql "$(POSTGRES_URL)" -f db/postgres/seed.sql

clean: ## Remove build artifacts
	rm -rf $(BACKEND_DIR)/bin $(BACKEND_DIR)/tmp
	rm -rf $(FRONTEND_DIR)/.next $(FRONTEND_DIR)/out
