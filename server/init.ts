// server/init.ts

import databaseManager from '../lib/db/databaseManager';
import {
  errorHandler,
  ErrorType,
} from '../lib/services/error-handler/error-handler';

let initPromise: Promise<void> | null = null;
let isInitialized = false;

async function initializeDatabases() {
  console.log('[Init] 🔄 Initializing databases...');

  try {
    // Initialize static database first
    await databaseManager.initialize();
    console.log('[Init] ✅ Static database initialized');

    return { staticDb: databaseManager };
  } catch (error) {
    console.error('[Init] ❌ Database initialization failed:', error);
    errorHandler.handleError(
      ErrorType.CRITICAL,
      error instanceof Error
        ? error
        : new Error('Database initialization failed')
    );
    throw error;
  }
}

function createInitPromise() {
  if (initPromise) {
    console.log('[Init] 🔄 Using existing initialization promise');
    return initPromise;
  }

  initPromise = (async () => {
    if (isInitialized) {
      console.log('[Init] ✅ Services already initialized');
      return;
    }

    let dbs: { staticDb: typeof databaseManager } | undefined;

    try {
      // Step 1: Initialize databases
      dbs = await initializeDatabases();

      // Mark services as initialized
      isInitialized = true;
      console.log('[Init] ✅ All services initialized successfully');

      // Setup shutdown handlers
      setupShutdown(dbs.staticDb);
    } catch (error) {
      console.error('[Init] ❌ Initialization failed:', error);
      errorHandler.handleError(
        ErrorType.CRITICAL,
        error instanceof Error
          ? error
          : new Error('Service initialization failed')
      );
      isInitialized = false;
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

export async function initializeApp() {
  if (typeof window !== 'undefined') {
    console.log('[Init] ⚠️ Skipping initialization in browser');
    return;
  }
  return createInitPromise();
}

function setupShutdown(staticDb: typeof databaseManager) {
  if (typeof window !== 'undefined') return;

  const shutdown = async (signal: string) => {
    console.log(
      `\n[Shutdown] 🛑 Received ${signal}. Starting graceful shutdown...`
    );

    const timeoutId = setTimeout(() => {
      console.error('[Shutdown] ❌ Forced shutdown due to timeout');
      process.exit(1);
    }, 10000); // 10 seconds timeout

    try {
      // Close database connections
      console.log('[Shutdown] 🔄 Closing database connections...');
      await Promise.all([staticDb.close()]);
      console.log('[Shutdown] ✅ Database connections closed');

      console.log('[Shutdown] ✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('[Shutdown] ❌ Error during shutdown:', error);
      errorHandler.handleError(
        ErrorType.CRITICAL,
        error instanceof Error ? error : new Error('Shutdown failed')
      );
      process.exit(1);
    } finally {
      clearTimeout(timeoutId);
    }
  };

  // Handle shutdown signals
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('[Process] ❌ Uncaught exception:', error);
    errorHandler.handleError(ErrorType.CRITICAL, error);
    shutdown('UNCAUGHT_EXCEPTION');
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[Process] ❌ Unhandled rejection:', reason);
    errorHandler.handleError(
      ErrorType.CRITICAL,
      reason instanceof Error ? reason : new Error(String(reason))
    );
    shutdown('UNHANDLED_REJECTION');
  });
}
