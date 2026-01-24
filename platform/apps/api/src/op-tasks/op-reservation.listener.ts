import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { OpTriggerService, TriggerContext } from "./services/op-trigger.service";
import { OpTriggerEvent } from "@prisma/client";

/**
 * Event payload types for reservation events
 */
export interface ReservationEventPayload {
  reservationId: string;
  campgroundId: string;
  siteId: string;
  siteClassId?: string;
  siteName?: string;
  guestName?: string;
  guestId?: string;
  arrivalDate?: Date;
  departureDate?: Date;
  nights?: number;
  petCount?: number;
  stayType?: string;
  userId?: string; // User who triggered the action
}

/**
 * Listens for reservation events and triggers task creation
 */
@Injectable()
export class OpReservationListener {
  private readonly logger = new Logger(OpReservationListener.name);

  constructor(private triggerService: OpTriggerService) {}

  /**
   * Handle guest checkout - create turnover/cleaning tasks
   */
  @OnEvent("reservation.checked_out")
  async handleCheckout(payload: ReservationEventPayload) {
    this.logger.log(`Checkout event received for reservation ${payload.reservationId}`);

    try {
      const context = this.buildContext(payload);
      const tasks = await this.triggerService.executeTriggers(
        payload.campgroundId,
        OpTriggerEvent.reservation_checkout,
        context,
      );

      this.logger.log(`Created ${tasks.length} tasks for checkout of ${payload.reservationId}`);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to process checkout event: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Handle guest check-in - create prep tasks
   */
  @OnEvent("reservation.checked_in")
  async handleCheckin(payload: ReservationEventPayload) {
    this.logger.log(`Check-in event received for reservation ${payload.reservationId}`);

    try {
      const context = this.buildContext(payload);
      const tasks = await this.triggerService.executeTriggers(
        payload.campgroundId,
        OpTriggerEvent.reservation_checkin,
        context,
      );

      this.logger.log(`Created ${tasks.length} tasks for check-in of ${payload.reservationId}`);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to process check-in event: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Handle new reservation created
   */
  @OnEvent("reservation.created")
  async handleCreated(payload: ReservationEventPayload) {
    this.logger.log(`Reservation created event received: ${payload.reservationId}`);

    try {
      const context = this.buildContext(payload);
      const tasks = await this.triggerService.executeTriggers(
        payload.campgroundId,
        OpTriggerEvent.reservation_created,
        context,
      );

      this.logger.log(`Created ${tasks.length} tasks for new reservation ${payload.reservationId}`);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to process reservation created event: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Handle reservation cancelled
   */
  @OnEvent("reservation.cancelled")
  async handleCancelled(payload: ReservationEventPayload) {
    this.logger.log(`Reservation cancelled event received: ${payload.reservationId}`);

    try {
      const context = this.buildContext(payload);
      const tasks = await this.triggerService.executeTriggers(
        payload.campgroundId,
        OpTriggerEvent.reservation_cancelled,
        context,
      );

      this.logger.log(
        `Created ${tasks.length} tasks for cancelled reservation ${payload.reservationId}`,
      );
    } catch (error: unknown) {
      this.logger.error(
        `Failed to process reservation cancelled event: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Handle reservation modified
   */
  @OnEvent("reservation.modified")
  async handleModified(payload: ReservationEventPayload) {
    this.logger.log(`Reservation modified event received: ${payload.reservationId}`);

    try {
      const context = this.buildContext(payload);
      const tasks = await this.triggerService.executeTriggers(
        payload.campgroundId,
        OpTriggerEvent.reservation_modified,
        context,
      );

      this.logger.log(
        `Created ${tasks.length} tasks for modified reservation ${payload.reservationId}`,
      );
    } catch (error: unknown) {
      this.logger.error(
        `Failed to process reservation modified event: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Build trigger context from event payload
   */
  private buildContext(payload: ReservationEventPayload): TriggerContext {
    return {
      reservationId: payload.reservationId,
      siteId: payload.siteId,
      siteClassId: payload.siteClassId,
      siteName: payload.siteName,
      guestName: payload.guestName,
      userId: payload.userId,
      arrivalDate: payload.arrivalDate,
      departureDate: payload.departureDate,
      nights: payload.nights,
      hasPets: (payload.petCount ?? 0) > 0,
      stayType: payload.stayType,
    };
  }
}
