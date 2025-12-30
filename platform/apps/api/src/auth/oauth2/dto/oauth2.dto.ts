import { IsString, IsOptional, IsIn, IsUrl, IsNotEmpty, Matches } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { OAuth2GrantType, OAuth2ResponseType } from "../oauth2.types";

/**
 * Token Request DTO
 */
export class OAuth2TokenRequestDto {
  @ApiProperty({
    enum: [OAuth2GrantType.CLIENT_CREDENTIALS, OAuth2GrantType.AUTHORIZATION_CODE, OAuth2GrantType.REFRESH_TOKEN],
    description: "OAuth2 grant type",
  })
  @IsString()
  @IsIn([OAuth2GrantType.CLIENT_CREDENTIALS, OAuth2GrantType.AUTHORIZATION_CODE, OAuth2GrantType.REFRESH_TOKEN])
  grant_type!: OAuth2GrantType;

  @ApiPropertyOptional({ description: "Client ID for client_credentials or authorization_code grant" })
  @IsString()
  @IsOptional()
  client_id?: string;

  @ApiPropertyOptional({ description: "Client secret for confidential clients" })
  @IsString()
  @IsOptional()
  client_secret?: string;

  @ApiPropertyOptional({ description: "Space-separated list of requested scopes" })
  @IsString()
  @IsOptional()
  scope?: string;

  @ApiPropertyOptional({ description: "Refresh token for refresh_token grant" })
  @IsString()
  @IsOptional()
  refresh_token?: string;

  @ApiPropertyOptional({ description: "Authorization code for authorization_code grant" })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ description: "Redirect URI (must match the one used in authorization request)" })
  @IsString()
  @IsOptional()
  redirect_uri?: string;

  @ApiPropertyOptional({ description: "PKCE code verifier" })
  @IsString()
  @IsOptional()
  code_verifier?: string;
}

/**
 * Authorization Request DTO
 */
export class OAuth2AuthorizeRequestDto {
  @ApiProperty({ description: "Client ID" })
  @IsString()
  @IsNotEmpty()
  client_id!: string;

  @ApiProperty({
    enum: [OAuth2ResponseType.CODE, OAuth2ResponseType.TOKEN],
    description: "Response type",
  })
  @IsString()
  @IsIn([OAuth2ResponseType.CODE, OAuth2ResponseType.TOKEN])
  response_type!: OAuth2ResponseType;

  @ApiProperty({ description: "Redirect URI (must be registered with the client)" })
  @IsUrl()
  redirect_uri!: string;

  @ApiPropertyOptional({ description: "Space-separated list of requested scopes" })
  @IsString()
  @IsOptional()
  scope?: string;

  @ApiPropertyOptional({ description: "State parameter for CSRF protection" })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiPropertyOptional({ description: "PKCE code challenge" })
  @IsString()
  @IsOptional()
  @Matches(/^[A-Za-z0-9_-]+$/, { message: "Invalid code_challenge format" })
  code_challenge?: string;

  @ApiPropertyOptional({ enum: ["S256", "plain"], description: "PKCE code challenge method" })
  @IsString()
  @IsOptional()
  @IsIn(["S256", "plain"])
  code_challenge_method?: "S256" | "plain";

  @ApiPropertyOptional({ description: "Nonce for OpenID Connect" })
  @IsString()
  @IsOptional()
  nonce?: string;
}

/**
 * Revoke Token DTO
 */
export class OAuth2RevokeRequestDto {
  @ApiProperty({ description: "Token to revoke (access_token or refresh_token)" })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiPropertyOptional({
    enum: ["access_token", "refresh_token"],
    description: "Type of token being revoked",
  })
  @IsString()
  @IsOptional()
  @IsIn(["access_token", "refresh_token"])
  token_type_hint?: "access_token" | "refresh_token";
}

/**
 * Introspection Request DTO
 */
export class OAuth2IntrospectRequestDto {
  @ApiProperty({ description: "Token to introspect" })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiPropertyOptional({
    enum: ["access_token", "refresh_token"],
    description: "Type of token being introspected",
  })
  @IsString()
  @IsOptional()
  @IsIn(["access_token", "refresh_token"])
  token_type_hint?: "access_token" | "refresh_token";
}

/**
 * Client Registration DTO (for admin/developer portal)
 */
export class OAuth2ClientRegistrationDto {
  @ApiProperty({ description: "Client application name" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: "Redirect URIs", type: [String] })
  @IsUrl({}, { each: true })
  redirect_uris!: string[];

  @ApiPropertyOptional({ description: "Allowed scopes", type: [String] })
  @IsString({ each: true })
  @IsOptional()
  scopes?: string[];

  @ApiPropertyOptional({
    description: "Allowed grant types",
    type: [String],
    enum: Object.values(OAuth2GrantType),
  })
  @IsString({ each: true })
  @IsOptional()
  grant_types?: OAuth2GrantType[];

  @ApiPropertyOptional({ description: "Is this a confidential client (server app)?" })
  @IsOptional()
  is_confidential?: boolean;
}
