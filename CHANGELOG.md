# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-10-07

### Added
- LCARS-themed real-time system monitor with 24th-century sci-fi aesthetic.
- Server-Sent Events (SSE) streaming engine for real-time telemetry broadcast.
- Adapters for system metrics: CPU, memory, mounted disks, process lists, network bandwidth, and system info.
- Zabbix adapter with remote telemetry polling, problem detection, and automated Red Alert escalation.
- Dual-line bandwidth history charting and telemetry ring buffer.
- Headless automated testing suite with unit, E2E Zabbix, and smoke test coverage.
- Multi-stage Dockerfile and Docker Compose orchestration for local and containerized deployments.
- Automated tag-triggered release workflow publishing GitHub Releases and GHCR container images.
- Automated security audit gates with bin/audit and CI dependency vulnerability scanning.

### Fixed
- Metric collection timeout cascades on Windows via adaptive timeout configuration, process caching, and anti-overlapping collection guard.
- Native test discovery compatibility on Node 20 and Node 22 runners.
