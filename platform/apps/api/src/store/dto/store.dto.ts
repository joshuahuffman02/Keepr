import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  Min,
  IsArray,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateProductCategoryDto {
  @IsString()
  campgroundId!: string;

  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @IsOptional()
  sortOrder?: number;
}

export class UpdateProductCategoryDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateProductDto {
  @IsString()
  campgroundId!: string;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(0)
  priceCents!: number;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  stockQty?: number;

  @IsInt()
  @IsOptional()
  lowStockAlert?: number;

  @IsBoolean()
  @IsOptional()
  trackInventory?: boolean;

  @IsString()
  @IsOptional()
  channelInventoryMode?: "shared" | "split";

  @IsInt()
  @IsOptional()
  @Min(0)
  posStockQty?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  onlineStockQty?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  onlineBufferQty?: number;

  @IsInt()
  @IsOptional()
  sortOrder?: number;

  @IsString()
  @IsOptional()
  glCode?: string;

  @IsBoolean()
  @IsOptional()
  afterHoursAllowed?: boolean;
}

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  priceCents?: number;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  stockQty?: number;

  @IsInt()
  @IsOptional()
  lowStockAlert?: number;

  @IsBoolean()
  @IsOptional()
  trackInventory?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  channelInventoryMode?: "shared" | "split";

  @IsInt()
  @IsOptional()
  @Min(0)
  posStockQty?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  onlineStockQty?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  onlineBufferQty?: number;

  @IsInt()
  @IsOptional()
  sortOrder?: number;

  @IsString()
  @IsOptional()
  glCode?: string;

  @IsBoolean()
  @IsOptional()
  afterHoursAllowed?: boolean;
}

export class CreateAddOnDto {
  @IsString()
  campgroundId!: string;

  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(0)
  priceCents!: number;

  @IsString()
  @IsOptional()
  pricingType?: "flat" | "per_night" | "per_person";

  @IsInt()
  @IsOptional()
  sortOrder?: number;

  @IsString()
  @IsOptional()
  glCode?: string;
}

export class UpdateAddOnDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  priceCents?: number;

  @IsString()
  @IsOptional()
  pricingType?: "flat" | "per_night" | "per_person";

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @IsOptional()
  sortOrder?: number;

  @IsString()
  @IsOptional()
  glCode?: string;
}

export class CreateOrderItemDto {
  @IsString()
  @IsOptional()
  productId?: string;

  @IsString()
  @IsOptional()
  addOnId?: string;

  @IsInt()
  @Min(1)
  qty!: number;
}

export class CreateOrderDto {
  @IsString()
  campgroundId!: string;

  @IsString()
  @IsOptional()
  reservationId?: string;

  @IsString()
  @IsOptional()
  guestId?: string;

  @IsString()
  @IsOptional()
  siteNumber?: string;

  @IsString()
  @IsOptional()
  paymentMethod?: "card" | "cash" | "charge_to_site";

  @IsString()
  @IsOptional()
  channel?: "pos" | "online" | "kiosk" | "portal" | "internal";

  @IsString()
  @IsOptional()
  fulfillmentType?: "pickup" | "curbside" | "delivery" | "table_service";

  @IsString()
  @IsOptional()
  deliveryInstructions?: string;

  @IsInt()
  @IsOptional()
  prepTimeMinutes?: number;

  @IsString()
  @IsOptional()
  promisedAt?: string;

  @IsString()
  @IsOptional()
  locationId?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}
