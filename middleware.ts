// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const requestCounts = new Map<string, { count: number; timestamp: number }>();
const REQUESTS_PER_MINUTE = 60;

interface RequestMetrics {
    startTime: number;
    requestId: string;
    path: string;
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
            const currentCount = requestCounts.get(clientIp);

            if (currentCount) {
                if (Date.now() - currentCount.timestamp < 60000) {
                    if (currentCount.count >= REQUESTS_PER_MINUTE) {
                        return new NextResponse(
                            JSON.stringify({ 
                                error: 'Rate limit exceeded',
                                message: 'Too many requests, please try again later'
                            }), 
                            { 
                                status: 429,
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Retry-After': '60'
                                }
                            }
                        );
                    }
                    currentCount.count++;
                } else {
                    requestCounts.set(clientIp, { count: 1, timestamp: Date.now() });
                }
            } else {
                requestCounts.set(clientIp, { count: 1, timestamp: Date.now() });
            }

            activeRequests.set(requestId, {
                startTime,
                requestId,
                path: request.nextUrl.pathname
            });

            const response = NextResponse.next();

            response.headers.set('x-request-id', requestId);
            response.headers.set('Access-Control-Allow-Origin', '*');
            response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

            console.log({
                type: 'request_start',
                requestId,
                method: request.method,
                path: request.nextUrl.pathname,
                timestamp: new Date(startTime).toISOString(),
                clientIp
            });

            response.headers.set('x-response-time', `${Date.now() - startTime}ms`);
            activeRequests.delete(requestId);

            return response;

        } catch (error) {
            console.error('Middleware error:', error);
            return new NextResponse(
                JSON.stringify({ 
                    error: 'Internal server error',
                    message: 'An unexpected error occurred'
                }), 
                { 
                    status: 500,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );
        }
    }

    return NextResponse.next();
}

// Cleanup old rate limit entries
setInterval(() => {
    const now = Date.now();
    const entries = Array.from(requestCounts.entries());
    for (const [ip, data] of entries) {
        if (now - data.timestamp >= 60000) {
            requestCounts.delete(ip);
        }
    }
}, 60000);

export const config = {
    matcher: [
        '/api/:path*',
    ],
}