import { IsEmail, IsEnum, IsOptional, IsString } from "class-validator";
import { UserRole } from "@prisma/client";

export class AddMemberDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsEnum(UserRole)
  role!: UserRole;
}

export class UpdateMemberRoleDto {
  @IsEnum(UserRole)
  role!: UserRole;
}
