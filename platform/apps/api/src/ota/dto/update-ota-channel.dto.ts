import { PartialType } from "@nestjs/mapped-types";
import { CreateOtaChannelDto } from "./create-ota-channel.dto";

export class UpdateOtaChannelDto extends PartialType(CreateOtaChannelDto) {}
