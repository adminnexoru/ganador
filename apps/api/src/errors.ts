/** Error de dominio con código estable y mensaje localizado (contracts/app-api.md). */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    readonly params: Record<string, string | number> = {},
    readonly headers: Record<string, string> = {},
  ) {
    super(code);
    this.name = 'AppError';
  }
}

export const notFound = () => new AppError(404, 'not_found');
export const forbidden = () => new AppError(403, 'forbidden');
export const conflict = (code = 'conflict') => new AppError(409, code);
export const badRequest = (code = 'validation_error') => new AppError(400, code);
