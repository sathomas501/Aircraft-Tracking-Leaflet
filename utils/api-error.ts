// utils/api-error.ts
export class APIError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly shouldExposeMessage: boolean = false
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export function handleAPIError(error: unknown) {
  if (error instanceof APIError) {
    return {
      error: error.message,
      message: error.shouldExposeMessage ? error.message : undefined,
      statusCode: error.statusCode
    };
  }

  if (error instanceof Error) {
    return {
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      statusCode: 500
    };
  }

  return {
    error: 'Unknown Error',
    statusCode: 500
  };
}