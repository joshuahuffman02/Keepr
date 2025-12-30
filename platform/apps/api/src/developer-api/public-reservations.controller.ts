import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiTokenGuard } from "./guards/api-token.guard";
import { ApiScopeGuard } from "./guards/api-scope.guard";
import { ApiScopes } from "./decorators/api-scopes.decorator";
import { PublicApiService, ApiReservationInput } from "./public-api.service";
import { IsBoolean, IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
import { ApiTags, ApiOperation, ApiResponse, ApiProperty, ApiBearerAuth } from "@nestjs/swagger";

class CreateReservationBody implements ApiReservationInput {
  @ApiProperty({ description: "ID of the site to reserve" })
  @IsString() @IsNotEmpty() siteId!: string;

  @ApiProperty({ description: "Lock the site so it cannot be auto-reassigned", required: false, default: false })
  @IsBoolean() @IsOptional() siteLocked?: boolean;

  @ApiProperty({ description: "ID of the guest making the reservation" })
  @IsString() @IsNotEmpty() guestId!: string;

  @ApiProperty({ description: "Arrival date (ISO string)", example: "2024-05-01" })
  @IsDateString() arrivalDate!: string;

  @ApiProperty({ description: "Departure date (ISO string)", example: "2024-05-05" })
  @IsDateString() departureDate!: string;

  @ApiProperty({ description: "Number of adults" })
  @IsNumber() adults!: number;

  @ApiProperty({ description: "Number of children", required: false, default: 0 })
  @IsNumber() @IsOptional() children?: number;

  @ApiProperty({ description: "Status of reservation", required: false, default: "confirmed" })
  @IsString() @IsOptional() status?: string;

  @ApiProperty({ description: "Internal notes", required: false })
  @IsString() @IsOptional() notes?: string;
}

class UpdateReservationBody {
  @ApiProperty({ description: "ID of the site to reserve", required: false })
  @IsString() @IsOptional() siteId?: string;

  @ApiProperty({ description: "Lock the site so it cannot be auto-reassigned", required: false })
  @IsBoolean() @IsOptional() siteLocked?: boolean;

  @ApiProperty({ description: "Arrival date (ISO string)", required: false })
  @IsDateString() @IsOptional() arrivalDate?: string;

  @ApiProperty({ description: "Departure date (ISO string)", required: false })
  @IsDateString() @IsOptional() departureDate?: string;

  @ApiProperty({ description: "Number of adults", required: false })
  @IsNumber() @IsOptional() adults?: number;

  @ApiProperty({ description: "Number of children", required: false })
  @IsNumber() @IsOptional() children?: number;

  @ApiProperty({ description: "Status of reservation", required: false })
  @IsString() @IsOptional() status?: string;

  @ApiProperty({ description: "Internal notes", required: false })
  @IsString() @IsOptional() notes?: string;
}

class PaymentBody {
  @ApiProperty({ description: "Payment amount in cents" })
  @IsNumber()
  amountCents!: number;

  @ApiProperty({ description: "Payment method (e.g. 'card', 'cash')", required: false, default: "card" })
  @IsString()
  @IsOptional()
  method?: string;
}

@ApiTags("Reservations")
@ApiBearerAuth("bearer")
@Controller("public/reservations")
@UseGuards(ApiTokenGuard, ApiScopeGuard)
export class PublicReservationsController {
  constructor(private readonly api: PublicApiService) { }

  @Get()
  @ApiScopes("reservations:read")
  @ApiOperation({ summary: "List reservations" })
  @ApiResponse({ status: 200, description: "List of reservations" })
  list(@Req() req: any) {
    const campgroundId = req.apiPrincipal.campgroundId;
    return this.api.listReservations(campgroundId);
  }

  @Get(":id")
  @ApiScopes("reservations:read")
  @ApiOperation({ summary: "Get a reservation" })
  @ApiResponse({ status: 200, description: "Reservation details" })
  @ApiResponse({ status: 404, description: "Reservation not found" })
  get(@Req() req: any, @Param("id") id: string) {
    const campgroundId = req.apiPrincipal.campgroundId;
    return this.api.getReservation(campgroundId, id);
  }

  @Post()
  @ApiScopes("reservations:write")
  @ApiOperation({ summary: "Create a reservation" })
  @ApiResponse({ status: 201, description: "Reservation created" })
  create(@Req() req: any, @Body() body: CreateReservationBody) {
    const campgroundId = req.apiPrincipal.campgroundId;
    return this.api.createReservation(campgroundId, body);
  }

  @Patch(":id")
  @ApiScopes("reservations:write")
  @ApiOperation({ summary: "Update a reservation" })
  @ApiResponse({ status: 200, description: "Reservation updated" })
  update(@Req() req: any, @Param("id") id: string, @Body() body: UpdateReservationBody) {
    const campgroundId = req.apiPrincipal.campgroundId;
    return this.api.updateReservation(campgroundId, id, body);
  }

  @Delete(":id")
  @ApiScopes("reservations:write")
  @ApiOperation({ summary: "Delete a reservation" })
  @ApiResponse({ status: 200, description: "Reservation deleted" })
  remove(@Req() req: any, @Param("id") id: string) {
    const campgroundId = req.apiPrincipal.campgroundId;
    return this.api.deleteReservation(campgroundId, id);
  }

  @Post(":id/payments")
  @ApiScopes("reservations:write")
  @ApiOperation({ summary: "Record a payment" })
  @ApiResponse({ status: 201, description: "Payment recorded" })
  pay(@Req() req: any, @Param("id") id: string, @Body() body: PaymentBody) {
    const campgroundId = req.apiPrincipal.campgroundId;
    return this.api.recordPayment(campgroundId, id, body.amountCents, body.method);
  }
}
