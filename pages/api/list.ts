// pages/api/manufacturers/list.ts - GET endpoint for list
import { NextApiRequest, NextApiResponse } from 'next';


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    const manufacturers = await fetchManufacturers();
    return res.status(200).json({ manufacturers });
}