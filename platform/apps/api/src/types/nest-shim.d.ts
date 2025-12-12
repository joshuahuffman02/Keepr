// Local shim so tsc can resolve @nestjs/common symbols during build.
declare module "@nestjs/common" {
  export const Module: any;
  export const Injectable: any;
  export const Controller: any;
  export const Get: any;
  export const Post: any;
  export const Put: any;
  export const Patch: any;
  export const Delete: any;
  export const Body: any;
  export const Param: any;
  export const Query: any;
  export const Headers: any;
  export const Req: any;
  export const Res: any;
  export const Request: any;
  export const Response: any;
  export const RawBodyRequest: any;
  export const UseGuards: any;
  export const UseInterceptors: any;
  export const UsePipes: any;
  export const ValidationPipe: any;
  export const BadRequestException: any;
  export const InternalServerErrorException: any;
  export const NotFoundException: any;
  export const UnauthorizedException: any;
  export const ForbiddenException: any;
  export const ConflictException: any;
  export const TooManyRequestsException: any;
  export const SetMetadata: any;
  export const Logger: any;
  export const Global: any;
  export const ExecutionContext: any;
  export type ExecutionContext = any;
  export const INestApplication: any;
  export type INestApplication = any;
  export const ValidationPipe: any;
  export type ValidationPipe = any;
  export type PipeTransform = any;
  export const PipeTransform: any;
  export type ArgumentMetadata = any;
  export const ArgumentMetadata: any;
  export type CallHandler = any;
  export const CallHandler: any;
  export const NestInterceptor: any;
  export type NestInterceptor = any;
  export const HttpException: any;
  export const HttpStatus: any;
  export const RawBodyRequest: any;
  export type RawBodyRequest<T = any> = any;
  export type Response = any;
  export type Request = any;
  export interface CanActivate {
    canActivate(context: ExecutionContext): boolean | Promise<boolean>;
  }
  export interface OnModuleInit {
    onModuleInit(): any;
  }
  export interface OnModuleDestroy {
    onModuleDestroy(): any;
  }
}

