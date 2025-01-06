// pages/api/aircraft/models.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchModels } from "@/utils/aircraftServices";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { manufacturer, activeOnly } = req.query;

    if (!manufacturer || typeof manufacturer !== 'string') {
        return res.status(400).json({ 
            message: 'Manufacturer parameter is required', 
            error: 'Missing manufacturer' 
        });
    }

    try {
        const models = await fetchModels(manufacturer, activeOnly === 'true');
        res.status(200).json({ models });
    } catch (error) {
        console.error('Error in models API handler:', error);
        res.status(500).json({ 
            message: 'Failed to fetch models', 
            error 
        });
    }
}