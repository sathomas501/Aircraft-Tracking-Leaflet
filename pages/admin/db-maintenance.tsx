// pages/admin/db-maintenance.tsx
'use client';
import { useState } from 'react';

export default function DbMaintenance() {
    const [status, setStatus] = useState('');
    const [stats, setStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    const syncDatabase = async () => {
        try {
            setIsLoading(true);
            setStatus('Starting sync...');

            const response = await fetch('/api/sync-aircraft-data', {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                setStatus('Sync completed successfully');
                setStats(data.stats);
            } else {
                setStatus(`Sync failed: ${data.message}`);
            }
        } catch (error) {
            setStatus(`Error during sync: ${error}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-6">Database Maintenance</h1>

            <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg shadow">
                    <h2 className="text-xl font-semibold mb-4">Aircraft Data Sync</h2>
                    <button
                        onClick={syncDatabase}
                        disabled={isLoading}
                        className={`px-4 py-2 rounded ${
                            isLoading 
                                ? 'bg-gray-400' 
                                : 'bg-blue-500 hover:bg-blue-600'
                        } text-white`}
                    >
                        {isLoading ? 'Syncing...' : 'Start Sync'}
                    </button>

                    {status && (
                        <div className="mt-4 p-4 bg-gray-50 rounded">
                            <p className="font-medium">Status:</p>
                            <p>{status}</p>
                        </div>
                    )}

                    {stats && (
                        <div className="mt-4 p-4 bg-gray-50 rounded">
                            <p className="font-medium mb-2">Sync Results:</p>
                            <ul className="space-y-1">
                                <li>Total Records: {stats.total}</li>
                                <li>Unique Manufacturers: {stats.manufacturers}</li>
                                <li>Unique Models: {stats.models}</li>
                                <li>Aircraft Types: {stats.types}</li>
                                <li>Owner Types: {stats.owner_types}</li>
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}