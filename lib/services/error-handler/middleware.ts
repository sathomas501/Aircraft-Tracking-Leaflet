// lib/middleware/error-handler.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { handleAPIError } from './api-error';

type ApiHandler = (req: NextApiRequest, res: NextApiResponse) => Promise<void>;

export function withErrorHandler(handler: ApiHandler): ApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      await handler(req, res);
    } catch (error) {
      const errorResponse = handleAPIError(error);
      res.status(errorResponse.statusCode).json(errorResponse);
    }
  };
}

// For convenience, export a createHandler function that applies multiple middlewares
export function createHandler(
  ...middlewares: Array<(handler: ApiHandler) => ApiHandler>
) {
  return (handler: ApiHandler) =>
    middlewares.reduceRight((h, middleware) => middleware(h), handler);
}

// Usage example:
// export default createHandler(
//     withErrorHandler,
//     withAuth,  // if you have auth middleware
//     withRateLimit  // if you have rate limit middleware
// )(async function handler(req, res) {
//     // Your handler code
// });
