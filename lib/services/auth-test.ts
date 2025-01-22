import fetch from 'node-fetch';


(async () => {
    const username = 'fatboy501';
    const password = '703476Ind!an';
    const url = 'https://opensky-network.org/api/states/all';
    const headers = {
        Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
    };

    try {
        console.log(`Sending request to ${url} with headers:`, headers);
        const response = await fetch(url, { headers });
        console.log('Response Status:', response.status);
        const data = await response.text();
        console.log('Response Body:', data);
    } catch (error) {
        console.error('Error:', error);
    }
})();
