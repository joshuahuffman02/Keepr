import { BadRequestException, Body, Controller, Post } from "@nestjs/common";
import { IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ApiAuthService } from "./api-auth.service";

class TokenRequestDto {
  @IsString()
  @IsIn(["client_credentials", "refresh_token"])
  grant_type!: "client_credentials" | "refresh_token";

  @IsString()
  @IsOptional()
  client_id?: string;

  @IsString()
  @IsOptional()
  client_secret?: string;

  @IsString()
  @IsOptional()
  scope?: string;

  @IsString()
  @IsOptional()
  refresh_token?: string;
}

@Controller("developer/oauth")
export class ApiAuthController {
  constructor(private readonly apiAuth: ApiAuthService) {}

  @Post("token")
  async token(@Body() body: TokenRequestDto) {
    if (body.grant_type === "client_credentials") {
      if (!body.client_id || !body.client_secret) {
        throw new BadRequestException("client_id and client_secret are required");
      }
      return this.apiAuth.issueClientCredentialsToken({
        clientId: body.client_id,
        clientSecret: body.client_secret,
        scope: body.scope,
      });
    }

    if (body.grant_type === "refresh_token") {
      if (!body.refresh_token) {
        throw new BadRequestException("refresh_token is required");
      }
      return this.apiAuth.refreshAccessToken(body.refresh_token);
    }

    throw new BadRequestException("Unsupported grant type");
  }
}
