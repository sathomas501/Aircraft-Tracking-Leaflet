// pages/api/websocket.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import type { Socket } from 'net';
import type { Server as HTTPServer } from 'http';
import * as WebSocket from 'ws';
import { openSkyService } from '@/lib/api/opensky';

interface CustomServer extends HTTPServer {
  ws?: WebSocket.Server;
}

interface CustomSocket extends Socket {
  server: CustomServer;
}

interface CustomResponse extends NextApiResponse {
  socket: CustomSocket;
}

// Create WebSocket server type
type WSClient = WebSocket.WebSocket;
type WSServer = WebSocket.Server;

const wsServer: WSServer = new WebSocket.Server({ noServer: true });

let wsClients = new Set<WSClient>();

wsServer.on('connection', (ws: WSClient) => {
  wsClients.add(ws);

  ws.on('message', (message: WebSocket.RawData) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('Received:', data);
    } catch (err) {
      console.error('Failed to parse message:', err);
    }
  });

  ws.on('close', () => {
    wsClients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    wsClients.delete(ws);
  });
});

// Broadcast function for sending updates to all clients
function broadcast(data: any) {
  const message = JSON.stringify(data);
  wsClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

export default function handler(
  req: NextApiRequest,
  res: CustomResponse
) {
  if (!res.socket.server.ws) {
    // Initialize WebSocket server
    res.socket.server.ws = wsServer;

    // Set up position updates interval
    setInterval(async () => {
      try {
        const positions = await openSkyService.getPositions();
        broadcast({ type: 'positions', data: positions });
      } catch (error) {
        console.error('Failed to fetch positions:', error);
      }
    }, 5000); // Update every 5 seconds
  }

  res.end();
}

// Export WebSocket types
export type { WSClient, WSServer };