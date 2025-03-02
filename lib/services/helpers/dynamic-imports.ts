// lib/services/helpers/dynamic-imports.ts

/**
 * Safely import a module with a fallback
 * @param modulePath Path to the module to import
 * @param fallback Fallback value if the import fails
 * @returns Module default export or fallback value
 */
export async function safeImport<T>(
  modulePath: string,
  fallback: T
): Promise<T> {
  try {
    // Use dynamic import to avoid static import errors
    const module = await import(modulePath);
    return module.default || fallback;
  } catch (error) {
    console.warn(`Failed to import module: ${modulePath}`, error);
    return fallback;
  }
}

/**
 * Safely require a module with a fallback
 * @param modulePath Path to the module to require
 * @param fallback Fallback value if the require fails
 * @returns Module default export or fallback value
 */
export function safeRequire<T>(modulePath: string, fallback: T): T {
  try {
    const module = require(modulePath);
    return module.default || fallback;
  } catch (error) {
    console.warn(`Failed to require module: ${modulePath}`, error);
    return fallback;
  }
}
