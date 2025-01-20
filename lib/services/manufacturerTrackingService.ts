import WebSocket from 'ws';

let ws: WebSocket | null = null;

/**
 * Starts tracking a manufacturer using a WebSocket connection.
 * @param manufacturer - The manufacturer to track.
 * @param onUpdate - Callback to handle updates from the WebSocket.
 */
export function startTrackingManufacturer(
    manufacturer: string,
    onUpdate: (data: any) => void
): Promise<void> {
    return new Promise((resolve, reject) => {
        const url = `wss://opensky-network.org/api/realtime-data?manufacturer=${encodeURIComponent(
            manufacturer
        )}`;

        // Close any existing WebSocket connection
        if (ws) {
            stopTrackingManufacturer();
        }

        ws = new WebSocket(url);

        ws.on('open', () => {
            console.log(`[WebSocket] Connection established for manufacturer: ${manufacturer}`);
            resolve();
        });

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message.toString());
                onUpdate(data); // Pass the parsed data to the callback
            } catch (err) {
                console.error('[WebSocket] Error parsing message:', err);
            }
        });

        ws.on('error', (err) => {
            console.error('[WebSocket] Connection error:', err);
            reject(err);
        });

        ws.on('close', (code, reason) => {
            console.log(`[WebSocket] Connection closed. Code: ${code}, Reason: ${reason}`);
            ws = null; // Reset WebSocket reference
        });
    });
}

/**
 * Stops tracking the manufacturer by closing the WebSocket connection.
 */
export function stopTrackingManufacturer(): void {
    if (ws) {
        console.log('[WebSocket] Closing connection...');
        ws.close();
        ws = null;
    } else {
        console.log('[WebSocket] No active connection to close.');
    }
}

/**
 * Utility to check WebSocket connection status.
 * @returns `true` if the WebSocket is connected, `false` otherwise.
 */
export function isTrackingActive(): boolean {
    return ws !== null && ws.readyState === WebSocket.OPEN;
}
