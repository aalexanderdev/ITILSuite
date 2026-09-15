# Changelog

All notable changes to this project will be documented in this file in accordance with [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning (SemVer)](https://semver.org/).

---

## [0.0.1] - 2026-09-15

### Added
* **Base Repository Architecture**:
  * Decoupled monorepo structure with a Rust backend and a React + TypeScript frontend.
  * Comprehensive `.gitignore` configuration for Rust, Node.js, and Docker environments.
  * `docker-compose.yml` for local development services (PostgreSQL 16 and Mailpit for notification testing).
  * Project license set to **GPL-3.0-or-later (GPLv3+)**.
* **Documentation**:
  * Exhaustive `README.md` with architectural vision, local setup instructions, and release roadmap.
  * ADR 0001: Architecture Decision Record on technology stack selection (Rust + Axum + Tokio + SQLx + React/TS).
  * Architecture Guide: Conceptual domain mapping from GLPI 11 to Rust.
* **Backend (Rust + Axum)**:
  * Asynchronous web server built on Tokio, Axum, and Tower.
  * Extensible environment configuration system via `dotenvy`.
  * Structured logging and observability with `tracing` and `tracing-subscriber`.
  * Unified error handling producing standard JSON error responses.
  * Core endpoints:
    * `GET /api/v1/health` (uptime, service status, UTC timestamp, environment).
    * `GET /api/v1/version` (application name, version `0.0.1`, git commit).
  * OpenAPI 3.1 specification generation and Swagger UI hosted at `/swagger-ui`.
  * CORS middleware pre-configured for local frontend integration on port `8081`.
  * Automated integration and health tests passing in `cargo test`.
* **Frontend (TypeScript + React + Vite)**:
  * SPA project scaffolded with Vite and TypeScript in strict mode.
  * Enterprise-grade IT management layout inspired by GLPI 11 density:
    * Sidebar navigation featuring core ITIL modules (Service Desk, Assets & CMDB, Management, Administration).
    * Topbar navigation with multi-tenant hierarchical Entity selector (Root Entity).
    * Real-time connectivity pill monitoring the live Rust backend API.
    * Interactive diagnostics card with one-click API test and live JSON response viewer.
    * Initial KPI metrics cards and SemVer roadmap tracker.
