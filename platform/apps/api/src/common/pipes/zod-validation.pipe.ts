import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from "@nestjs/common";
import { ZodSchema, ZodError } from "zod";

/**
 * Zod Validation Pipe for NestJS
 *
 * Usage:
 * @UsePipes(new ZodValidationPipe(YourSchema))
 * async yourEndpoint(@Body() body: YourType) { ... }
 *
 * This pipe validates incoming data against a Zod schema and throws
 * BadRequestException with detailed error messages if validation fails.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    try {
      // Parse and validate the value
      const parsedValue = this.schema.parse(value);
      return parsedValue;
    } catch (error) {
      if (error instanceof ZodError) {
        // Format Zod errors into a readable message
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        }));

        throw new BadRequestException({
          message: "Validation failed",
          errors: formattedErrors,
          statusCode: 400,
        });
      }
      throw new BadRequestException("Validation failed");
    }
  }
}
