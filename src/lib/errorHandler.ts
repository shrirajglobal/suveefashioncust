/**
 * Error sanitizer utility to prevent exposing internal system details to users.
 * Maps technical database/system errors to user-friendly messages.
 */

export function getSafeErrorMessage(error: unknown): string {
  const message = getErrorMessage(error).toLowerCase();
  
  // Permission/authorization errors
  if (message.includes('permission denied') || message.includes('not authorized')) {
    return 'You do not have permission to perform this action';
  }
  
  // Constraint violations
  if (message.includes('violates') || message.includes('constraint')) {
    if (message.includes('unique')) {
      return 'This record already exists';
    }
    if (message.includes('foreign key')) {
      return 'This operation references data that does not exist';
    }
    if (message.includes('not-null') || message.includes('null value')) {
      return 'Required information is missing. Please check your input';
    }
    return 'Invalid data provided. Please check your input';
  }
  
  // Duplicate key errors
  if (message.includes('duplicate key')) {
    return 'This record already exists';
  }
  
  // Not found errors
  if (message.includes('not found') || message.includes('does not exist')) {
    return 'The requested resource was not found';
  }
  
  // RLS policy violations
  if (message.includes('row-level security') || message.includes('rls')) {
    return 'You do not have access to this data';
  }
  
  // Authentication errors
  if (message.includes('invalid login') || message.includes('invalid credentials')) {
    return 'Invalid email or password';
  }
  if (message.includes('email not confirmed')) {
    return 'Please confirm your email address before signing in';
  }
  if (message.includes('user already registered')) {
    return 'An account with this email already exists';
  }
  
  // Network errors
  if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
    return 'Unable to connect. Please check your internet connection and try again';
  }
  
  // Timeout errors
  if (message.includes('timeout') || message.includes('timed out')) {
    return 'The operation took too long. Please try again';
  }
  
  // Generic fallback for unexpected errors - don't expose internal details
  return 'An error occurred. Please try again or contact support';
}

/**
 * Safely extract error message from various error types
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Unknown error';
}

/**
 * Log error details for debugging (server-side only in production)
 * In development, logs to console. In production, this should use a proper
 * error monitoring service like Sentry.
 */
export function logError(context: string, error: unknown): void {
  // Log detailed error for debugging - in production, use error monitoring service
  console.error(`[${context}]`, {
    message: getErrorMessage(error),
    error,
    timestamp: new Date().toISOString(),
  });
}
