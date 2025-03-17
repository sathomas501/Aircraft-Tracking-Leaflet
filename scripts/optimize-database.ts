// scripts/optimize-database.ts
import path from 'path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function optimizeDatabases() {
  console.log('Database Optimization Tool');
  console.log('==========================');

  const dbDir = path.resolve(process.cwd(), 'lib', 'db');
  const staticDbPath = path.join(dbDir, 'static.db');
  const trackingDbPath = path.join(dbDir, 'tracking.db');

  async function optimizeDatabase(dbPath: string, dbName: string) {
    console.log(`\nOptimizing ${dbName} database at ${dbPath}...`);

    try {
      const db = await open({
        filename: dbPath,
        driver: sqlite3.Database,
      });

      console.log(`Connected to ${dbName} database.`);

      // List tables before optimization
      const tables = await db.all(
        "SELECT name FROM sqlite_master WHERE type='table'"
      );
      console.log(`Tables in ${dbName} database:`);
      tables.forEach((table: any) => console.log(`- ${table.name}`));

      // Run optimizations
      console.log(`\nRunning optimizations on ${dbName} database...`);

      // Set journal mode to WAL for better concurrency
      await db.run('PRAGMA journal_mode = WAL;');
      console.log('✅ Set journal_mode to WAL');

      // Increase cache size for better performance
      await db.run('PRAGMA cache_size = 10000;');
      console.log('✅ Increased cache size');

      // Set busy timeout to reduce "database is locked" errors
      await db.run('PRAGMA busy_timeout = 10000;');
      console.log('✅ Set busy_timeout to 10 seconds');

      // Run ANALYZE to update statistics
      await db.run('ANALYZE;');
      console.log('✅ Updated statistics with ANALYZE');

      // Run VACUUM to reclaim space
      console.log('Running VACUUM (this might take a while)...');
      await db.run('VACUUM;');
      console.log('✅ Reclaimed space with VACUUM');

      // Run integrity check
      const integrityResult = await db.get('PRAGMA integrity_check;');
      console.log(`Integrity check result: ${JSON.stringify(integrityResult)}`);

      // Optimize indexes
      await db.run('PRAGMA optimize;');
      console.log('✅ Optimized indexes');

      // Close database
      await db.close();
      console.log(`✅ Successfully optimized ${dbName} database`);
    } catch (error) {
      console.error(`❌ Error optimizing ${dbName} database:`, error);
    }
  }

  // Optimize both databases
  await optimizeDatabase(staticDbPath, 'Static');
  await optimizeDatabase(trackingDbPath, 'Tracking');

  console.log('\nOptimization complete!');
}

// Run the optimization
optimizeDatabases().catch(console.error);
