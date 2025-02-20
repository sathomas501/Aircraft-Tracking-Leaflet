// test.js
const db = require('./backendDatabaseManager');

async function test() {
  try {
    await db.init();

    // Try inserting a test record
    await db.query(
      `
            INSERT OR REPLACE INTO tracked_aircraft 
            (icao24, latitude, longitude, altitude, velocity, heading, on_ground, last_contact)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ['TEST123', 37.7749, -122.4194, 10000, 450, 270, 0, Date.now() / 1000]
    );

    // Query it back
    const results = await db.query('SELECT * FROM tracked_aircraft');
    console.log('Query results:', results);

    await db.close();
  } catch (err) {
    console.error('Test failed:', err);
  }
}

test();
