// scripts/repair-database.js
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Configuration
const DB_DIR = path.resolve(process.cwd(), 'lib', 'db');
const STATIC_DB_PATH = path.join(DB_DIR, 'static.db');
const TRACKING_DB_PATH = path.join(DB_DIR, 'tracking.db');
const WAL_FILES = ['-wal', '-shm'];

// Color console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(color + message + colors.reset);
}

async function repairDatabase() {
  log('=== Aircraft Tracking Database Repair Tool ===', colors.cyan);
  log('This tool will analyze and fix database issues', colors.cyan);
  console.log('');

  // Check database directory
  log('Checking database directory...', colors.blue);
  if (!fs.existsSync(DB_DIR)) {
    log(`Creating database directory: ${DB_DIR}`, colors.yellow);
    fs.mkdirSync(DB_DIR, { recursive: true });
  } else {
    log(`Database directory exists: ${DB_DIR}`, colors.green);
  }

  // List all files in the database directory
  const files = fs.readdirSync(DB_DIR);
  log(`\nFiles in ${DB_DIR}:`, colors.blue);
  files.forEach((file) => {
    const filePath = path.join(DB_DIR, file);
    const stats = fs.statSync(filePath);
    console.log(`- ${file} (${formatSize(stats.size)})`);
  });

  // Function to check and fix a database
  async function checkAndFixDatabase(dbPath, dbName) {
    log(`\n=== Checking ${dbName} Database ===`, colors.magenta);

    // Step 1: Check if database file exists
    if (!fs.existsSync(dbPath)) {
      log(
        `${dbName} database file not found. Creating empty file.`,
        colors.yellow
      );
      fs.writeFileSync(dbPath, '');
      log('Created empty database file.', colors.green);
    } else {
      log(`${dbName} database file exists.`, colors.green);

      // Check if file is empty
      const stats = fs.statSync(dbPath);
      log(`File size: ${formatSize(stats.size)}`, colors.blue);

      if (stats.size === 0) {
        log('WARNING: Database file is empty!', colors.red);
      }
    }

    // Step 2: Check for WAL files
    let walFilesExist = false;
    for (const ext of WAL_FILES) {
      const walPath = dbPath + ext;
      if (fs.existsSync(walPath)) {
        walFilesExist = true;
        const walStats = fs.statSync(walPath);
        log(`Found ${ext} file: ${formatSize(walStats.size)}`, colors.yellow);
      }
    }

    // Step 3: Try to open the database
    try {
      log(`\nAttempting to open ${dbName} database...`, colors.blue);

      return new Promise((resolve) => {
        const db = new sqlite3.Database(
          dbPath,
          sqlite3.OPEN_READWRITE,
          async (err) => {
            if (err) {
              log(
                `ERROR: Could not open ${dbName} database: ${err.message}`,
                colors.red
              );

              // Step 4a: If database is corrupted, try to fix it
              log(
                '\nDatabase appears to be corrupted. Attempting to fix...',
                colors.yellow
              );

              // Backup the corrupted database
              const backupPath = `${dbPath}.backup-${Date.now()}`;
              if (fs.existsSync(dbPath) && fs.statSync(dbPath).size > 0) {
                fs.copyFileSync(dbPath, backupPath);
                log(`Created backup at: ${backupPath}`, colors.green);
              }

              // Remove WAL files
              for (const ext of WAL_FILES) {
                const walPath = dbPath + ext;
                if (fs.existsSync(walPath)) {
                  fs.unlinkSync(walPath);
                  log(`Removed ${walPath}`, colors.green);
                }
              }

              // Create fresh database
              fs.writeFileSync(dbPath, '');
              log(`Created fresh ${dbName} database file`, colors.green);

              resolve({
                success: false,
                error: err.message,
                fixed: true,
              });
            } else {
              log(`Successfully opened ${dbName} database`, colors.green);

              // Step 4b: Run integrity check
              db.get('PRAGMA integrity_check', (err, result) => {
                if (err) {
                  log(
                    `Error running integrity check: ${err.message}`,
                    colors.red
                  );
                } else {
                  const integrity = result.integrity_check || 'unknown';
                  if (integrity === 'ok') {
                    log('Integrity check passed: Database is OK', colors.green);
                  } else {
                    log(`Integrity check failed: ${integrity}`, colors.red);
                  }
                }

                // Step 5: Get database info
                db.all(
                  "SELECT name FROM sqlite_master WHERE type='table'",
                  [],
                  (err, tables) => {
                    if (err) {
                      log(`Error listing tables: ${err.message}`, colors.red);
                    } else {
                      log(`\nFound ${tables.length} tables:`, colors.blue);
                      if (tables.length === 0) {
                        log('No tables found in database', colors.yellow);
                      } else {
                        tables.forEach((table) => {
                          console.log(`- ${table.name}`);
                        });
                      }
                    }

                    // Step 6: Try to optimize the database
                    if (walFilesExist) {
                      log('\nOptimizing database...', colors.blue);
                      db.exec('PRAGMA wal_checkpoint(TRUNCATE);', (err) => {
                        if (err) {
                          log(
                            `Error truncating WAL file: ${err.message}`,
                            colors.red
                          );
                        } else {
                          log('Successfully truncated WAL file', colors.green);
                        }

                        // Step 7: Close the database
                        db.close((err) => {
                          if (err) {
                            log(
                              `Error closing database: ${err.message}`,
                              colors.red
                            );
                          } else {
                            log('Database closed successfully', colors.green);
                          }

                          resolve({
                            success: true,
                            tables: tables.length,
                            optimized: true,
                          });
                        });
                      });
                    } else {
                      // Close without optimization
                      db.close((err) => {
                        if (err) {
                          log(
                            `Error closing database: ${err.message}`,
                            colors.red
                          );
                        } else {
                          log('Database closed successfully', colors.green);
                        }

                        resolve({
                          success: true,
                          tables: tables.length,
                          optimized: false,
                        });
                      });
                    }
                  }
                );
              });
            }
          }
        );
      });
    } catch (error) {
      log(`Unexpected error: ${error.message}`, colors.red);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // First check static database
  const staticResult = await checkAndFixDatabase(STATIC_DB_PATH, 'Static');

  // Then check tracking database
  const trackingResult = await checkAndFixDatabase(
    TRACKING_DB_PATH,
    'Tracking'
  );

  // Final summary
  log('\n=== Repair Summary ===', colors.cyan);
  log(
    `Static Database: ${staticResult.success ? 'OK' : 'Fixed'}`,
    staticResult.success ? colors.green : colors.yellow
  );
  log(
    `Tracking Database: ${trackingResult.success ? 'OK' : 'Fixed'}`,
    trackingResult.success ? colors.green : colors.yellow
  );

  log('\nCOMPLETED: Database check and repair', colors.green);
  log('You can now restart your application.', colors.cyan);
}

// Helper function to format file size
function formatSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizes[i]}`;
}

// Run the repair function
repairDatabase().catch((error) => {
  console.error('Uncaught error:', error);
});
