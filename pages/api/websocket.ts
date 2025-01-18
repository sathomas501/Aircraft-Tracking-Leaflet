import type { NextApiRequest, NextApiResponse } from 'next';
import WebSocket from 'ws';
import { OpenSkyManager } from '@/lib/services/openSkyService';

const openSkyService = OpenSkyManager.getInstance();

export default function handler(req: NextApiRequest, res: NextApiResponse): void {
    const { action } = req.query;

    if (action === 'subscribe') {
        const client = new WebSocket('ws://example.com'); // Ensure compatibility with the ws module
        openSkyService.addClient(client);
        res.status(200).send('Subscribed');
    } else if (action === 'cleanup') {
        openSkyService.cleanup();
        res.status(200).send('Cleaned up');
    } else {
        res.status(400).send('Unknown action');
    }
}
