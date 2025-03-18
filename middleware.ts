import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const requestCounts = new Map<string, { count: number; timestamp: number }>();
const REQUESTS_PER_MINUTE = 60;

interface RequestMetrics {
  startTime: number;
  requestId: string;
  path: string;
  sourceModule: string;
}

const activeRequests = new Map<string, RequestMetrics>();

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  if (forwarded) {
    return forwarded.split(',')[0];
  }
  if (realIp) {
    return realIp;
  }
  return 'unknown';
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    try {
      const requestId = crypto.randomUUID();
      const startTime = Date.now();

      // Get client IP
      const clientIp = getClientIp(request);

      // Extract source module from custom header
      const sourceModule =
        request.headers.get('x-source-module') || 'Unknown Source';

      // Log request info
      console.log(
        `[${new Date().toISOString()}] Request from: ${sourceModule} | ${request.method} ${request.nextUrl.pathname}`
      );
      console.log(`Client IP: ${clientIp}`);

      // Track request frequency per module
      const endpointKey = `${request.nextUrl.pathname}-${sourceModule}`;
      if (!requestCounts.has(endpointKey)) {
        requestCounts.set(endpointKey, { count: 0, timestamp: Date.now() });
      }
      const requestData = requestCounts.get(endpointKey)!;
      requestData.count += 1;
      requestCounts.set(endpointKey, requestData);

      console.log(
        `API Calls to ${request.nextUrl.pathname} from ${sourceModule}: ${requestData.count}`
      );

      // Store active request
      activeRequests.set(requestId, {
        startTime,
        requestId,
        path: request.nextUrl.pathname,
        sourceModule,
      });

      // Proceed with request
      const response = NextResponse.next();

      // Log request duration after completion
      response.headers.set('X-Request-Id', requestId);
      response.headers.set('X-Source-Module', sourceModule);

      response.headers.set(
        'X-Request-Duration',
        String(Date.now() - startTime)
      );

      console.log(
        `Request ${requestId} from ${sourceModule} completed in ${Date.now() - startTime}ms`
      );

      return response;
    } catch (error) {
      console.error(`Middleware error: ${error}`);
      return new NextResponse('Internal Server Error', { status: 500 });
    }
  }
  return NextResponse.next();
}
