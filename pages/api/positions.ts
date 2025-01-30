import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    console.log("[Aircraft Positions] Received Request:", req.method, req.query);

    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method Not Allowed. Use GET instead." });
    }

    const { icao24List } = req.query;

    if (!icao24List) {
        return res.status(400).json({ error: "icao24List parameter is required" });
    }

    // Ensure ICAO24 list is correctly formatted
    const icao24String = Array.isArray(icao24List) ? icao24List.join(',') : icao24List;

    // Use the proxy instead of direct OpenSky requests
    const proxyUrl = `http://localhost:3001/api/proxy/opensky?icao24=${icao24String}`;
    console.log(`[Aircraft Positions] Forwarding request to Proxy: ${proxyUrl}`);

    try {
        const response = await fetch(proxyUrl, { method: "GET" });

        if (!response.ok) {
            console.error("[Aircraft Positions] Proxy Response Error:", response.status, response.statusText);
            return res.status(response.status).json({ error: "Proxy request failed" });
        }

        const data = await response.json();
        return res.status(200).json(data);
    } catch (error) {
        console.error("[Aircraft Positions] Error:", error);
        return res.status(500).json({ error: "Failed to fetch aircraft positions from proxy" });
    }
}
