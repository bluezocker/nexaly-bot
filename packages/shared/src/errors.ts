export type ErrorCode =
  | "UNAUTHORIZED"
  | "GUILD_FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL";

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details: unknown[];
  constructor(code: ErrorCode, message: string, statusCode: number, details: unknown[] = []) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const unauthorized = (message = "Authentication required") =>
  new AppError("UNAUTHORIZED", message, 401);
export const guildForbidden = (message = "You cannot manage this server") =>
  new AppError("GUILD_FORBIDDEN", message, 403);
export const notFound = (message = "Not found") => new AppError("NOT_FOUND", message, 404);
export const validationError = (message: string, details: unknown[] = []) =>
  new AppError("VALIDATION", message, 400, details);
