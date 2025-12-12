import { PartialType } from "@nestjs/mapped-types";
import { CreateReferralProgramDto } from "./create-referral-program.dto";

export class UpdateReferralProgramDto extends PartialType(CreateReferralProgramDto) { }
