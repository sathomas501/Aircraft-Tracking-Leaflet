import { NextApiRequest, NextApiResponse } from 'next';

export async function forceJsonBodyParser(req: NextApiRequest) {
  if (req.headers['content-type']?.includes('application/json')) {
    const buffers = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }
    try {
      req.body = JSON.parse(Buffer.concat(buffers).toString());
    } catch (error) {
      console.error('Failed to parse JSON:', error);
    }
  } else {
    req.body = {};
  }
}
