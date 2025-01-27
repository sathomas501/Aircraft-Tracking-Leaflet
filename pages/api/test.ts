// pages/api/test.ts
import { NextApiRequest, NextApiResponse } from 'next';


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[TEST] Hit test endpoint');
  res.status(200).json({ message: 'Test endpoint' });
}