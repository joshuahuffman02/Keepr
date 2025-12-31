import { IsString, IsOptional, IsIn } from 'class-validator';

export class RegisterDeviceDto {
  @IsString()
  deviceToken!: string;

  @IsString()
  @IsIn(['ios', 'android'])
  platform!: 'ios' | 'android';

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  appBundle?: string;

  @IsOptional()
  @IsString()
  appVersion?: string;

  @IsOptional()
  @IsString()
  campgroundId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['sandbox', 'production'])
  environment?: 'sandbox' | 'production';
}

export class UnregisterDeviceDto {
  @IsString()
  deviceToken!: string;
}
