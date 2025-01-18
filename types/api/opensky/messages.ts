// types/api/opensky/messages.ts
import type { PositionData } from '../../base';

export interface WebSocketSubscribeMessage {
  type: 'subscribe';
  filters: {
    states: boolean;
    icao24: string[];
  };
}

export interface WebSocketPositionMessage {
  type: 'positions';
  data: PositionData[];
}

export interface WebSocketStatusMessage {
  type: 'connection_status';
  connected: boolean;
}

export interface WebSocketUnsubscribeMessage {
  type: 'unsubscribe';
  filters: {
    icao24: string[];
  };
}

export interface WebSocketConnectionStatusMessage {
  type: 'connection_status';
  connected: boolean;
}

export type WebSocketMessage = 
  | WebSocketSubscribeMessage 
  | WebSocketUnsubscribeMessage 
  | WebSocketConnectionStatusMessage;

export type WebSocketOutgoingMessage = WebSocketPositionMessage | WebSocketStatusMessage;