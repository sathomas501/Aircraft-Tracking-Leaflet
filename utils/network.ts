import dns from 'dns';
import { promisify } from 'util';

const dnsResolve = promisify(dns.resolve);

export async function checkNetwork(): Promise<boolean> {
    try {
        await dnsResolve('opensky-network.org');
        console.log('[NetworkUtils] Connection to OpenSky verified.');
        return true;
    } catch {
        console.error('[NetworkUtils] Failed to resolve OpenSky domain.');
        return false;
    }
}

export function startDnsCheck(interval: number, onStatusChange: (isAvailable: boolean) => void): NodeJS.Timeout {
    return setInterval(async () => {
        const isAvailable = await checkNetwork();
        onStatusChange(isAvailable);
    }, interval);
}
