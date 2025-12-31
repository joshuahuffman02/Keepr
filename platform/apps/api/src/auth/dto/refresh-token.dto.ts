import { IsString, IsOptional } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  refreshToken!: string;
}

export class MobileLoginDto {
  @IsString()
  email!: string;

  @IsString()
  password!: string;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  deviceName?: string;

  @IsOptional()
  @IsString()
  platform?: string; // 'ios' or 'android'

  @IsOptional()
  @IsString()
  appVersion?: string;
}
