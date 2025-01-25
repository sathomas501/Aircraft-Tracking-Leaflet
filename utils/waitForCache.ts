// utils/waitForCache.ts
import { unifiedCache } from '../lib/services/managers/unified-cache-system';

export async function waitForCache(maxAttempts = 10, interval = 1000): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
        const data = await unifiedCache.getLatestData();
        // Adjust based on the actual structure of data
        if (Array.isArray(data) && data.length) return;

        await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error('Cache initialization timeout');
}
