#!/usr/bin/env python3
import sqlite3
import os
from datetime import datetime
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class DatabaseCleaner:
    def __init__(self, db_path):
        self.db_path = db_path
        self.conn = None
        self.cursor = None

    def __enter__(self):
        self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.conn:
            self.conn.close()
            logger.info("Database connection closed")

    def connect(self):
        """Establish database connection with proper settings"""
        try:
            self.conn = sqlite3.connect(self.db_path)
            self.cursor = self.conn.cursor()
            
            # Enable foreign keys and set pragmas for performance
            self.cursor.executescript("""
                PRAGMA foreign_keys = ON;
                PRAGMA journal_mode = WAL;
                PRAGMA synchronous = NORMAL;
                PRAGMA temp_store = MEMORY;
                PRAGMA mmap_size = 30000000000;
                PRAGMA page_size = 4096;
                PRAGMA cache_size = -2000;
            """)
            logger.info("Database connection established successfully")
        except sqlite3.Error as e:
            logger.error(f"Database connection failed: {e}")
            raise

    def cleanup_database(self):
        """Main cleanup function"""
        try:
            # Backup existing data
            self.backup_existing_data()
            
            # Drop existing tables
            self.drop_existing_tables()
            
            # Create new consolidated table
            self.create_new_table()
            
            # Migrate and clean data
            self.migrate_data()
            
            # Create indexes
            self.create_indexes()
            
            # Analyze and optimize
            self.optimize_database()
            
            # Verify the migration
            self.verify_migration()
            
            logger.info("Database cleanup completed successfully")
        except Exception as e:
            logger.error(f"Database cleanup failed: {e}")
            raise

    def backup_existing_data(self):
        """Backup existing data before modifications"""
        logger.info("Creating data backup...")
        self.cursor.execute("SELECT COUNT(*) FROM aircraft_data")
        count = self.cursor.fetchone()[0]
        if count > 0:
            self.cursor.execute("""
                CREATE TABLE IF NOT EXISTS aircraft_data_backup AS 
                SELECT * FROM aircraft_data
            """)
            logger.info(f"Backed up {count} rows of data")

    def drop_existing_tables(self):
        """Drop existing tables"""
        logger.info("Dropping existing tables...")
        self.cursor.execute("DROP TABLE IF EXISTS aircraft")

    def create_new_table(self):
        """Create new consolidated aircraft table with update trigger"""
        logger.info("Creating new aircraft table and trigger...")
        self.cursor.executescript("""
            CREATE TABLE aircraft (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                icao24 TEXT UNIQUE,
                "N-NUMBER" TEXT,
                manufacturer TEXT,
                model TEXT,
                operator TEXT,
                NAME TEXT,
                CITY TEXT,
                STATE TEXT,
                aircraft_type TEXT,
                owner_type TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TRIGGER IF NOT EXISTS update_aircraft_timestamp 
            AFTER UPDATE ON aircraft
            BEGIN
                UPDATE aircraft 
                SET updated_at = CURRENT_TIMESTAMP 
                WHERE id = NEW.id;
            END;
        """)

    def migrate_data(self):
        """Migrate and clean data from backup to new table"""
        logger.info("Migrating and cleaning data...")
        self.cursor.execute("""
            INSERT INTO aircraft (
                icao24,
                "N-NUMBER",
                manufacturer,
                model,
                operator,
                NAME,
                CITY,
                STATE,
                aircraft_type,
                owner_type,
                created_at,
                updated_at
            )
            SELECT 
                TRIM(icao24),
                TRIM("N-NUMBER"),
                TRIM(manufacturer),
                TRIM(model),
                TRIM(operator),
                TRIM(NAME),
                TRIM(CITY),
                TRIM(STATE),
                TRIM("TYPE AIRCRAFT"),
                TRIM("TYPE REGISTRANT"),
                COALESCE(created_at, CURRENT_TIMESTAMP),
                COALESCE(updated_at, CURRENT_TIMESTAMP)
            FROM aircraft_data_backup
            WHERE manufacturer IS NOT NULL
              AND TRIM(manufacturer) != ''
        """)
        
        rows_migrated = self.cursor.rowcount
        logger.info(f"Migrated {rows_migrated} rows of data")
        self.conn.commit()

    def create_indexes(self):
        """Create indexes for performance"""
        logger.info("Creating indexes...")
        self.cursor.executescript("""
            CREATE INDEX IF NOT EXISTS idx_aircraft_icao24 ON aircraft(icao24);
            CREATE INDEX IF NOT EXISTS idx_aircraft_manufacturer ON aircraft(manufacturer);
            CREATE INDEX IF NOT EXISTS idx_aircraft_model ON aircraft(model);
            CREATE INDEX IF NOT EXISTS idx_aircraft_type ON aircraft(aircraft_type, owner_type);
            CREATE INDEX IF NOT EXISTS idx_aircraft_operator ON aircraft(operator);
        """)

    def optimize_database(self):
        """Analyze and optimize the database"""
        logger.info("Optimizing database...")
        self.cursor.executescript("""
            ANALYZE;
            VACUUM;
        """)

    def verify_migration(self):
        """Verify the migration was successful"""
        logger.info("Verifying migration...")
        self.cursor.execute("SELECT COUNT(*) FROM aircraft")
        new_count = self.cursor.fetchone()[0]
        
        self.cursor.execute("SELECT COUNT(*) FROM aircraft_data_backup")
        old_count = self.cursor.fetchone()[0]
        
        logger.info(f"Original records: {old_count}")
        logger.info(f"Migrated records: {new_count}")
        
        if new_count == 0:
            raise Exception("Migration failed - no records in new table")

def main():
    # Get the database path from environment or use default
    db_path = os.getenv('DB_PATH', './lib/db/static.db')
    
    try:
        with DatabaseCleaner(db_path) as cleaner:
            cleaner.cleanup_database()
            logger.info("Database cleanup and migration completed successfully")
    except Exception as e:
        logger.error(f"Database cleanup failed: {e}")
        raise

if __name__ == "__main__":
    main()