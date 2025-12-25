import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsPositive, IsString, ValidateNested } from "class-validator";

class CartItemInput {
  @IsString()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  qty!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  overridePriceCents?: number;
}

class CartItemUpdateInput {
  @IsString()
  cartItemId!: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  qty!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  overridePriceCents?: number;
}

class PaymentInput {
  @IsIn(["card", "cash", "gift", "store_credit", "charge_to_site", "guest_wallet"])
  method!: "card" | "cash" | "gift" | "store_credit" | "charge_to_site" | "guest_wallet";

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  amountCents!: number;

  @IsString()
  currency!: string;

  @IsString()
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  referenceType?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsString()
  walletId?: string;
}

export class CreateCartDto {
  @IsOptional()
  @IsString()
  terminalId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemInput)
  items!: CartItemInput[];

  @IsOptional()
  @IsString()
  pricingVersion?: string;

  @IsOptional()
  @IsString()
  taxVersion?: string;
}

export class UpdateCartDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemInput)
  add?: CartItemInput[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemUpdateInput)
  update?: CartItemUpdateInput[];

  @IsOptional()
  @IsArray()
  remove?: { cartItemId: string }[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  discountCents?: number;
}

export class CheckoutCartDto {
  @IsOptional()
  @IsString()
  pricingVersion?: string;

  @IsOptional()
  @IsString()
  taxVersion?: string;

  @IsOptional()
  @IsString()
  chargeToSiteRef?: string;

  @IsOptional()
  @IsString()
  giftCode?: string;

  @IsOptional()
  @IsString()
  guestId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentInput)
  payments!: PaymentInput[];
}

export class OfflineReplayDto {
  @IsString()
  clientTxId!: string;

  @IsString()
  pricingVersion!: string;

  @IsString()
  taxVersion!: string;

  payload!: any; // raw offline cart payload for server reprice

  @IsOptional()
  @IsString()
  recordedTotalsHash?: string;
}

export class CreateReturnDto {
  @IsString()
  originalCartId!: string;

  @IsOptional()
  @IsArray()
  items?: { cartItemId?: string; qty?: number; amountCents?: number }[];

  @IsOptional()
  @IsString()
  reasonCode?: string;

  @IsOptional()
  @IsBoolean()
  restock?: boolean;
}
