# TeveroSEO Development Commands
# Single command: make dev

.PHONY: dev dev-build dev-down dev-logs dev-clean dev-proxy dev-reset help

# Default target
.DEFAULT_GOAL := help

# ===== MAIN COMMANDS =====

dev: ## Start all services (first run builds automatically)
	@echo "🚀 Starting TeveroSEO development environment..."
	@echo ""
	@echo "Services starting on:"
	@echo "  📱 Main app (Next.js):     http://localhost:53000"
	@echo "  🔍 SEO Engine:             http://localhost:53001"
	@echo "  ✍️  AI-Writer API:          http://localhost:58000"
	@echo "  🎨 AI-Writer UI:           http://localhost:58080"
	@echo "  🐘 PostgreSQL:             localhost:54320"
	@echo "  📦 Redis:                  localhost:63790"
	@echo ""
	docker compose -f docker-compose.dev.yml --env-file .env.dev up --build

dev-build: ## Build all containers without starting
	docker compose -f docker-compose.dev.yml --env-file .env.dev build

dev-down: ## Stop all services
	docker compose -f docker-compose.dev.yml down

dev-logs: ## Tail logs from all services
	docker compose -f docker-compose.dev.yml logs -f

dev-clean: ## Stop and remove all containers, volumes, and images
	docker compose -f docker-compose.dev.yml down -v --rmi local
	@echo "✨ Cleaned up all dev containers and volumes"

dev-proxy: ## Start with nginx proxy (production-like routing at localhost:50080)
	@echo "🌐 Starting with unified nginx proxy at http://localhost:50080"
	docker compose -f docker-compose.dev.yml --env-file .env.dev --profile proxy up --build

dev-reset: ## Full reset: clean everything and rebuild from scratch
	@echo "🔄 Resetting development environment..."
	docker compose -f docker-compose.dev.yml down -v --rmi local
	docker compose -f docker-compose.dev.yml --env-file .env.dev up --build

# ===== INDIVIDUAL SERVICES =====

dev-open-seo: ## Start only open-seo with dependencies
	docker compose -f docker-compose.dev.yml --env-file .env.dev up --build postgres redis open-seo

dev-ai-writer: ## Start only AI-Writer with dependencies
	docker compose -f docker-compose.dev.yml --env-file .env.dev up --build postgres redis ai-writer-backend ai-writer-frontend

dev-web: ## Start only tevero-web with dependencies
	docker compose -f docker-compose.dev.yml --env-file .env.dev up --build postgres redis open-seo ai-writer-backend tevero-web

# ===== DATABASE =====

dev-db: ## Start only database services
	docker compose -f docker-compose.dev.yml --env-file .env.dev up -d postgres redis
	@echo "📊 Databases ready:"
	@echo "  PostgreSQL: localhost:54320 (user: postgres, pass: devpass123)"
	@echo "  Redis:      localhost:63790"

dev-db-reset: ## Reset database (destroys all data!)
	docker compose -f docker-compose.dev.yml down -v postgres redis
	docker volume rm tevero-dev-pg tevero-dev-redis 2>/dev/null || true
	@echo "🗑️  Database volumes removed. Run 'make dev' to recreate."

dev-psql: ## Open psql shell to open_seo database
	docker exec -it tevero-dev-postgres psql -U postgres -d open_seo

# ===== VPS DEPLOYMENT =====

vps-build: ## Build for VPS deployment
	docker compose -f docker-compose.vps.yml build

vps-up: ## Start VPS services (requires .env.vps)
	docker compose -f docker-compose.vps.yml --env-file .env.vps up -d

vps-down: ## Stop VPS services
	docker compose -f docker-compose.vps.yml down

vps-logs: ## Tail VPS logs
	docker compose -f docker-compose.vps.yml logs -f

# ===== HELP =====

help: ## Show this help
	@echo "TeveroSEO Development Commands"
	@echo ""
	@echo "Quick Start:"
	@echo "  make dev          - Start everything with hot-reload"
	@echo "  make dev-down     - Stop everything"
	@echo "  make dev-clean    - Stop and remove all data"
	@echo ""
	@echo "All Commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
