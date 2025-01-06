import type { NextApiRequest, NextApiResponse } from 'next';
import type { Socket } from 'net';
import type { Server as HTTPServer } from 'http';
import WebSocket from 'ws';
import { openSkyService } from './opensky';

interface CustomServer extends HTTPServer {
  ws?: WebSocket.Server;
}

interface CustomSocket extends Socket {
  server: CustomServer;
}

interface CustomResponse extends NextApiResponse {
  socket: CustomSocket;
}

const wsServer = new WebSocket.Server({ noServer: true });

export default function handler(
  req: NextApiRequest,
  res: CustomResponse
) {
  if (!res.socket.server.ws) {
    res.socket.server.ws = wsServer;

    wsServer.on('connection', (ws) => {
      openSkyService.addClient(ws);

      ws.on('close', () => {
        openSkyService.removeClient(ws);
      });
    });
  }

  res.end();
}