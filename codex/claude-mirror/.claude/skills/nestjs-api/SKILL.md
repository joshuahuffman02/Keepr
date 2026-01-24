---
name: nestjs-api
description: NestJS backend API patterns for building REST APIs. Use when creating controllers, services, modules, DTOs, or working on the backend API.
allowed-tools: Read, Write, Edit, Glob, Grep
---

# NestJS API for Campreserv

## Project Structure

```
src/
├── main.ts                    # Application entry
├── app.module.ts              # Root module
├── prisma/                    # Prisma module
│   ├── prisma.module.ts
│   └── prisma.service.ts
├── auth/                      # Authentication module
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── jwt.strategy.ts
│   └── dto/
├── [feature]/                 # Feature modules
│   ├── [feature].module.ts
│   ├── [feature].controller.ts
│   ├── [feature].service.ts
│   └── dto/
└── common/                    # Shared utilities
    ├── guards/
    ├── decorators/
    └── filters/
```

## Module Pattern

```typescript
// feature.module.ts
import { Module } from "@nestjs/common";
import { FeatureController } from "./feature.controller";
import { FeatureService } from "./feature.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [FeatureController],
  providers: [FeatureService],
  exports: [FeatureService], // Export if used by other modules
})
export class FeatureModule {}
```

## Controller Pattern

```typescript
// feature.controller.ts
import { Controller, Get, Post, Body, Param, UseGuards, Query } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { FeatureService } from "./feature.service";
import { CreateFeatureDto } from "./dto/create-feature.dto";

@Controller("api/features")
@UseGuards(JwtAuthGuard)
export class FeatureController {
  constructor(private readonly featureService: FeatureService) {}

  @Get()
  async findAll(@Query("campgroundId") campgroundId: string) {
    return this.featureService.findAll(campgroundId);
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.featureService.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateFeatureDto) {
    return this.featureService.create(dto);
  }
}
```

## Service Pattern

```typescript
// feature.service.ts
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateFeatureDto } from "./dto/create-feature.dto";

@Injectable()
export class FeatureService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(campgroundId: string) {
    return this.prisma.feature.findMany({
      where: { campgroundId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const feature = await this.prisma.feature.findUnique({
      where: { id },
    });
    if (!feature) {
      throw new NotFoundException(`Feature ${id} not found`);
    }
    return feature;
  }

  async create(dto: CreateFeatureDto) {
    return this.prisma.feature.create({
      data: dto,
    });
  }
}
```

## DTO Pattern

```typescript
// dto/create-feature.dto.ts
import { IsString, IsOptional, IsInt, Min, Max, IsUUID } from "class-validator";

export class CreateFeatureDto {
  @IsUUID()
  campgroundId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(0)
  @Max(10000)
  priceCents: number;
}
```

## Guards

### JWT Guard

```typescript
@UseGuards(JwtAuthGuard)
@Get("protected")
async protectedRoute() {}
```

### Custom Permission Guard

```typescript
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission("reportsRead")
@Get("reports")
async getReports() {}
```

## Error Handling

```typescript
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";

// 404
throw new NotFoundException("Resource not found");

// 400
throw new BadRequestException("Invalid input");

// 403
throw new ForbiddenException("Access denied");

// 409
throw new ConflictException("Resource already exists");
```

## Dependency Injection

```typescript
// Service depends on other services
@Injectable()
export class ReservationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly stripeService: StripeService,
  ) {}
}
```

**Important**: If a service is used from another module, that module must:

1. Export the service: `exports: [MyService]`
2. Be imported by the consuming module: `imports: [MyModule]`

## Best Practices

1. **Keep controllers thin** - Business logic in services
2. **Validate all inputs** - Use class-validator DTOs
3. **Handle errors gracefully** - Use built-in exceptions
4. **Export shared services** - Add to module exports
5. **Use dependency injection** - Let NestJS manage instances
6. **Avoid circular dependencies** - Use forwardRef sparingly
7. **Document with Swagger** - Add @ApiTags, @ApiProperty
