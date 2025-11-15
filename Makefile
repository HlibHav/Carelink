SHELL := /bin/bash

.PHONY: install install-services install-engines install-agents install-gateway install-frontend \
	run-physical run-mind run-memory run-dialogue run-gateway run-frontend

install: install-services install-engines install-agents install-gateway install-frontend ## Install all dependencies

install-services: ## Install service dependencies
	@cd services/memory-manager && npm install

install-engines: ## Install engine dependencies
	@cd engines/physical && npm install
	@cd engines/mind-behavior && npm install

install-agents: ## Install agent dependencies
	@cd agents/dialogue && npm install

install-gateway: ## Install gateway dependencies
	@cd apps/gateway && npm install

install-frontend: ## Install frontend dependencies
	@cd frontend && npm install

run-physical: ## Start Physical Engine (Port 4101)
	@cd engines/physical && npm run dev

run-mind: ## Start Mind & Behavior Engine (Port 4102)
	@cd engines/mind-behavior && npm run dev

run-memory: ## Start Memory Manager (Port 4103)
	@cd services/memory-manager && npm run dev

run-dialogue: ## Start Dialogue Agent (Port 4200)
	@cd agents/dialogue && npm run dev

run-gateway: ## Start Gateway API (Port 8080)
	@cd apps/gateway && npm run dev

run-frontend: ## Start Frontend Playground (Port 5173)
	@cd frontend && npm run dev
