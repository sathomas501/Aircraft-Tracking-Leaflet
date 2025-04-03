// components/debug/ZipCodeTester.tsx
import React, { useState } from 'react';

const ZipCodeTester: React.FC = () => {
  const [zipCode, setZipCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    if (!zipCode || zipCode.length !== 5) {
      setError('Please enter a valid 5-digit ZIP code');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // Test direct API call to your proxy
      console.log(`Testing ZIP code: ${zipCode}`);
      const response = await fetch(`/api/proxy/geocode?zip=${zipCode}`);

      // Get both the raw response and the JSON
      const responseText = await response.text();
      let responseJson;

      try {
        responseJson = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse response as JSON:', e);
      }

      setResult({
        status: response.status,
        ok: response.ok,
        responseText:
          responseText.substring(0, 1000) +
          (responseText.length > 1000 ? '...' : ''),
        responseJson,
      });

      if (!response.ok) {
        setError(`API returned status ${response.status}`);
      }
    } catch (err) {
      console.error('Error testing ZIP code:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm">
      <h2 className="text-lg font-semibold mb-4">ZIP Code Geocoding Tester</h2>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          ZIP Code
        </label>
        <div className="flex">
          <input
            type="text"
            value={zipCode}
            onChange={(e) =>
              setZipCode(e.target.value.replace(/\D/g, '').substring(0, 5))
            }
            className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Enter 5-digit ZIP code"
            maxLength={5}
          />
          <button
            onClick={handleTest}
            disabled={isLoading || !zipCode || zipCode.length !== 5}
            className={`px-4 py-2 rounded-r-md text-white font-medium ${
              isLoading || !zipCode || zipCode.length !== 5
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {isLoading ? 'Testing...' : 'Test'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="mb-4">
          <h3 className="text-md font-medium mb-2">Result:</h3>
          <div className="p-3 bg-gray-50 rounded-md">
            <p className="mb-1">
              <span className="font-medium">Status:</span>{' '}
              <span className={result.ok ? 'text-green-600' : 'text-red-600'}>
                {result.status} ({result.ok ? 'OK' : 'Error'})
              </span>
            </p>

            {result.responseJson && (
              <div className="mt-2">
                <p className="font-medium">Response Data:</p>

                {result.responseJson.error ? (
                  <div className="p-2 bg-red-50 text-red-700 rounded-md mt-1">
                    Error: {result.responseJson.error}
                    {result.responseJson.message && (
                      <div className="mt-1 text-sm">
                        Message: {result.responseJson.message}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    {result.responseJson.result?.addressMatches?.length > 0 ? (
                      <div className="mt-2 p-2 bg-green-50 text-green-700 rounded-md">
                        Found {result.responseJson.result.addressMatches.length}{' '}
                        matches!
                        {result.responseJson.result.addressMatches[0]
                          .coordinates && (
                          <div className="mt-1">
                            <p>
                              <span className="font-medium">Latitude:</span>{' '}
                              {
                                result.responseJson.result.addressMatches[0]
                                  .coordinates.y
                              }
                            </p>
                            <p>
                              <span className="font-medium">Longitude:</span>{' '}
                              {
                                result.responseJson.result.addressMatches[0]
                                  .coordinates.x
                              }
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-2 p-2 bg-yellow-50 text-yellow-700 rounded-md">
                        No address matches found for this ZIP code
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {!result.responseJson && (
              <div className="mt-2">
                <p className="font-medium">Raw Response:</p>
                <pre className="mt-1 p-2 bg-gray-100 rounded-md overflow-x-auto text-xs">
                  {result.responseText}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="text-sm text-gray-500">
        <p>This tool tests the ZIP code geocoding endpoint directly.</p>
        <p className="mt-1">
          Add this component temporarily to debug geocoding issues.
        </p>
      </div>
    </div>
  );
};

export default ZipCodeTester;
