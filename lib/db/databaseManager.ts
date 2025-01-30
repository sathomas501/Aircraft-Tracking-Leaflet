import { open, Database } from 'sqlite';
import path from 'path';

let sqlite3: typeof import('sqlite3') | null = null;
if (typeof window === 'undefined') {
    try {
        sqlite3 = require('sqlite3');
        console.log('[Database] Successfully loaded sqlite3');
    } catch (error) {
        console.error('[Database] Failed to load sqlite3:', error);
    }
} else {
    console.warn('[Database] sqlite3 is not available in the browser.');
}

const STATIC_DB_PATH = path.join(process.cwd(), 'lib', 'db', 'static.db');
console.log('[Database] Database path:', STATIC_DB_PATH);

export class DatabaseManager {
    private static instance: DatabaseManager;
    private db: Database | null = null;
    private isInitialized: boolean = false;
    private isInitializing: boolean = false; // ✅ Prevents simultaneous initializations

    private constructor() {}

    public static getInstance(): DatabaseManager {
        if (!DatabaseManager.instance) {
            DatabaseManager.instance = new DatabaseManager();
        }
        return DatabaseManager.instance;
    }

    private async initializeConnection(): Promise<Database> {
        if (!sqlite3) {
            throw new Error('[DatabaseManager] sqlite3 is only available in the server environment.');
        }

        if (!this.db) {
            try {
                console.log('[DatabaseManager] Initializing database connection...');
                this.db = await open({
                    filename: STATIC_DB_PATH,
                    driver: sqlite3.Database
                });
                console.log('[DatabaseManager] Database connection established.');
            } catch (error) {
                console.error('[DatabaseManager] Error initializing database connection:', error);
                throw error;
            }
        }

        return this.db;
    }

    public async initializeDatabase(): Promise<void> {
        if (this.isInitialized) {
            console.log('[DatabaseManager] Database already initialized. Skipping.');
            return;
        }
    
        if (this.isInitializing) {
            console.log('[DatabaseManager] Database initialization already in progress. Waiting...');
            while (!this.isInitialized) {
                await new Promise(resolve => setTimeout(resolve, 50));  // ✅ Wait for completion
            }
            return;
        }
    
        this.isInitializing = true;
    
        try {
            await this.initializeConnection();
            if (!this.db) {
                throw new Error('[DatabaseManager] Database connection is null.');
            }

            console.log('[Database] Starting database initialization...');
            const tables = await this.db.all("SELECT name FROM sqlite_master WHERE type='table'");
            console.log('[Database] Existing tables:', tables);

            const [{ count }] = await this.db.all("SELECT COUNT(*) AS count FROM aircraft");
            console.log(`[Database] Aircraft count: ${count}`);

            this.isInitialized = true;
            console.log('[DatabaseManager] Database successfully initialized.');
        } catch (error) {
            console.error('[DatabaseManager] Database initialization failed:', error);
            throw error;
        } finally {
            this.isInitializing = false;
        }
    }


    public async executeQuery<T = any>(query: string, params: any[] = []): Promise<T[]> {
        if (!this.isInitialized || !this.db) {
            console.warn("[DatabaseManager] Database not fully initialized. Ensuring completion...");
            await this.initializeDatabase();  // ✅ Wait for initialization if not ready
        }
    
        if (!this.db) {
            throw new Error("[DatabaseManager] Database connection is still null after initialization.");
        }
    
        try {
            return this.db.all(query, params);
        } catch (error) {
            console.error(`[DatabaseManager] Query execution failed: ${query}`, error);
            throw error;
        }
    }
    
    

}


const databaseManager = DatabaseManager.getInstance();
export default databaseManager;
