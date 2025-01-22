// position-service-factory.ts
import { WebSocketService, WebSocketConfig } from './websocket/websocket-service';

export class PositionServiceFactory {
    private static wsService: WebSocketService | null = null;

    static createWebSocketService(): WebSocketService {
        if (!this.wsService) {
            const config: WebSocketConfig = {
                url: 'wss://opensky-network.org/api/states/all/ws',
                reconnectAttempts: 3,
                reconnectDelay: 5000,
                authRequired: true
            };
            this.wsService = new WebSocketService(config);
        }
        return this.wsService;
    }
}