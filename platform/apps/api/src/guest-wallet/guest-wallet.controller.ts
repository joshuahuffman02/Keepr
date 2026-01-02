import {
  Controller,
  Get,
  Post,
  BadRequestException,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";
import { ScopeGuard } from "../permissions/scope.guard";
import { GuestWalletService } from "./guest-wallet.service";
import {
  AddWalletCreditDto,
  DebitWalletDto,
  WalletTransactionsQueryDto,
} from "./guest-wallet.dto";
import { UserRole } from "@prisma/client";

@Controller()
export class GuestWalletController {
  constructor(private readonly guestWalletService: GuestWalletService) {}

  private assertCampgroundAccess(campgroundId: string, user: any): void {
    const isPlatformStaff = user?.platformRole === "platform_admin" ||
                            user?.platformRole === "platform_superadmin" ||
                            user?.platformRole === "support_agent";
    if (isPlatformStaff) {
      return;
    }

    const userCampgroundIds = user?.memberships?.map((m: any) => m.campgroundId) ?? [];
    if (!userCampgroundIds.includes(campgroundId)) {
      throw new BadRequestException("You do not have access to this campground");
    }
  }

  // ==========================================
  // Guest Portal Endpoints (Guest JWT Auth)
  // ==========================================

  /**
   * Get all wallets for the authenticated guest (across all campgrounds)
   */
  @Get("portal/wallet")
  @UseGuards(AuthGuard("guest-jwt"))
  async getMyWallets(@Request() req: any) {
    const guestId = req.user.id;
    return this.guestWalletService.getGuestWallets(guestId);
  }

  /**
   * Get wallet transactions for the authenticated guest at a campground
   */
  @Get("portal/wallet/:campgroundId/transactions")
  @UseGuards(AuthGuard("guest-jwt"))
  async getMyTransactions(
    @Request() req: any,
    @Param("campgroundId") campgroundId: string,
    @Query() query: WalletTransactionsQueryDto
  ) {
    const guestId = req.user.id;
    const wallet = query.walletId
      ? await this.guestWalletService.resolveWalletForGuest(guestId, query.walletId, campgroundId)
      : await this.guestWalletService.findWallet(campgroundId, guestId);
    if (!wallet) {
      return { transactions: [], total: 0 };
    }

    return this.guestWalletService.listTransactions(
      wallet.id,
      query.limit ?? 50,
      query.offset ?? 0
    );
  }

  // ==========================================
  // Staff Endpoints (Staff JWT Auth)
  // ==========================================

  /**
   * Get guest's wallet balance at a campground
   */
  @Get("campgrounds/:campgroundId/guests/:guestId/wallet")
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance)
  async getWalletBalance(
    @Param("campgroundId") campgroundId: string,
    @Param("guestId") guestId: string,
    @Request() req: any
  ) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.guestWalletService.getGuestBalance(campgroundId, guestId);
  }

  /**
   * Get wallets for a guest that can be used at this campground
   */
  @Get("campgrounds/:campgroundId/guests/:guestId/wallets")
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance)
  async getWalletsForGuest(
    @Param("campgroundId") campgroundId: string,
    @Param("guestId") guestId: string,
    @Request() req: any
  ) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.guestWalletService.getGuestWalletsForCampground(campgroundId, guestId);
  }

  /**
   * Add credit to guest's wallet
   */
  @Post("campgrounds/:campgroundId/guests/:guestId/wallet/credit")
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance)
  async addCredit(
    @Param("campgroundId") campgroundId: string,
    @Param("guestId") guestId: string,
    @Body() dto: Omit<AddWalletCreditDto, "guestId">,
    @Request() req: any
  ) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.guestWalletService.addCredit(
      campgroundId,
      { ...dto, guestId },
      undefined,
      req.user
    );
  }

  /**
   * Get wallet transaction history
   */
  @Get("campgrounds/:campgroundId/guests/:guestId/wallet/transactions")
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance)
  async getTransactions(
    @Param("campgroundId") campgroundId: string,
    @Param("guestId") guestId: string,
    @Query() query: WalletTransactionsQueryDto,
    @Request() req: any
  ) {
    this.assertCampgroundAccess(campgroundId, req.user);
    const wallet = query.walletId
      ? await this.guestWalletService.resolveWalletForGuest(guestId, query.walletId, campgroundId)
      : await this.guestWalletService.findWallet(campgroundId, guestId);
    if (!wallet) {
      return { transactions: [], total: 0 };
    }

    return this.guestWalletService.listTransactions(
      wallet.id,
      query.limit ?? 50,
      query.offset ?? 0
    );
  }

  /**
   * Use wallet to pay for something (internal endpoint for POS/reservations)
   */
  @Post("campgrounds/:campgroundId/wallet/debit")
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance)
  async debitWallet(
    @Param("campgroundId") campgroundId: string,
    @Body() dto: DebitWalletDto,
    @Request() req: any
  ) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.guestWalletService.debitForPayment(
      campgroundId,
      dto,
      undefined,
      req.user
    );
  }

  /**
   * Credit wallet from reservation refund
   */
  @Post("campgrounds/:campgroundId/wallet/credit-from-refund")
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance)
  async creditFromRefund(
    @Param("campgroundId") campgroundId: string,
    @Body()
    dto: {
      reservationId: string;
      guestId: string;
      amountCents: number;
      reason: string;
    },
    @Request() req: any
  ) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.guestWalletService.creditFromRefund(
      campgroundId,
      dto.reservationId,
      dto.guestId,
      dto.amountCents,
      dto.reason,
      undefined,
      req.user
    );
  }
}
