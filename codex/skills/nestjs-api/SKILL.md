---
name: nestjs-api
description: NestJS backend API patterns for controllers, services, and DTOs.
allowed-tools: Read, Write, Edit, Glob, Grep
---

# NestJS API (Codex)

## Use when

- Creating or changing API controllers, services, modules, or DTOs.

## Core patterns

- Controllers handle routing; services handle business logic.
- Use class-validator DTOs for input validation.
- Protect endpoints with guards and explicit permissions.
- Throw NestJS exceptions for error responses.

## Checklist

- RESTful routes and status codes.
- DTO validation and Swagger decorators.
- No N+1 queries; use include/select.
- No business logic in controllers.

## Allowed scope

- API guidance and patterns only unless asked to implement.

## Ask before proceeding if unclear

- The endpoint contract or auth rules are unspecified.

## Stop condition

- A clear NestJS pattern and checklist are provided.
