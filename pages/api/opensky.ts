import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const dbPath = process.env.SQLITE_DB_PATH || './db/aircraft.db'; // Use environment variable or default path

/**
 * Get a SQLite database connection.
 */
async function getDbConnection() {
  return open({
    filename: dbPath,
    driver: sqlite3.Database,
  });
}

/**
 * API handler for fetching aircraft data.
 */
export default async function handler(req, res) {
  const { manufacturer } = req.query;

  try {
    // Log the database path for debugging
    console.log('Using SQLite database at:', dbPath);

    // Establish a database connection
    const db = await getDbConnection();

    if (manufacturer) {
      // Fetch models for a specific manufacturer
      const models = await db.all(
        'SELECT model FROM aircraft WHERE manufacturer = ?',
        [manufacturer]
      );
      res.status(200).json(models);
    } else {
      // Fetch distinct manufacturers
      const manufacturers = await db.all(
        'SELECT DISTINCT manufacturer FROM aircraft'
      );
      res.status(200).json(manufacturers);
    }

    // Close the database connection
    await db.close();
  } catch (error) {
    // Log the error for debugging
    console.error('Database error:', error);

    // Send an error response to the client
    res.status(500).json({ error: 'Failed to fetch data from the database' });
  }
}
