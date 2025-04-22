import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { countryNameToCode } from '../../utils/CountryCodes';

async function seedCountries() {
  const db = await open({
    filename: './your-database.sqlite',
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS countries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      iso_code TEXT NOT NULL,
      flag_url TEXT
    )
  `);

  const insert = await db.prepare(`
    INSERT OR IGNORE INTO countries (name, iso_code, flag_url)
    VALUES (?, ?, ?)
  `);

  for (const [name, iso] of Object.entries(countryNameToCode)) {
    const flagUrl = `https://flagcdn.com/w40/${iso.toLowerCase()}.png`;
    await insert.run(name, iso, flagUrl);
  }

  await insert.finalize();
  await db.close();
}

seedCountries().then(() => console.log('Countries seeded.'));
