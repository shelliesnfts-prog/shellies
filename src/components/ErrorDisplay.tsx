'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, XCircle, RefreshCw, X } from 'lucide-react';

/**
 * Error severity levels
 */
export type ErrorSeverity = 'error' | 'warning' | 'info';

/**
 * Props for ErrorDisplay component
 */
interface ErrorDisplayProps {
  message: string;
  severity?: ErrorSeverity;
  onRetry?: () => void;
  onDismiss?: () => void;
  canRetry?: boolean;
  className?: string;
  retryButtonText?: string;
}

/**
 * ErrorDisplay Component
 * 
 * A reusable component for displaying user-friendly error messages with:
 * - Different severity levels (error, warning, info)
 * - Optional retry button
 * - Optional dismiss button
 * - Animated entrance/exit
 * - Consistent styling across the app
 */
export default function ErrorDisplay({
  message,
  severity = 'error',
  onRetry,
  onDismiss,
  canRetry = true,
  className = '',
  retryButtonText = 'Try Again',
}: ErrorDisplayProps) {
  
  /**
   * Get styling based on severity
   */
  const getSeverityStyles = () => {
    switch (severity) {
      case 'error':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-700',
          icon: 'text-red-500',
          button: 'bg-red-100 hover:bg-red-200 text-red-700',
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          text: 'text-yellow-700',
          icon: 'text-yellow-500',
          button: 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700',
        };
      case 'info':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          text: 'text-blue-700',
          icon: 'text-blue-500',
          button: 'bg-blue-100 hover:bg-blue-200 text-blue-700',
        };
    }
  };

  const styles = getSeverityStyles();

  /**
   * Get icon based on severity
   */
  const getIcon = () => {
    switch (severity) {
      case 'error':
        return <XCircle className={`w-5 h-5 ${styles.icon} flex-shrink-0`} />;
      case 'warning':
      case 'info':
        return <AlertCircle className={`w-5 h-5 ${styles.icon} flex-shrink-0`} />;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
        className={`${styles.bg} border ${styles.border} rounded-xl p-4 ${className}`}
      >
        <div className="flex items-start gap-3">
          {getIcon()}
          
          <div className="flex-1 min-w-0">
            <p className={`text-sm ${styles.text} break-words`}>
              {message}
            </p>
            
            {/* Action buttons */}
            {(onRetry || onDismiss) && (
              <div className="flex items-center gap-2 mt-3">
                {onRetry && canRetry && (
                  <button
                    onClick={onRetry}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 ${styles.button}`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {retryButtonText}
                  </button>
                )}
                
                {onDismiss && (
                  <button
                    onClick={onDismiss}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 ${styles.button}`}
                  >
                    Dismiss
                  </button>
                )}
              </div>
            )}
          </div>
          
          {/* Close button */}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className={`p-1 rounded-lg transition-colors duration-200 ${styles.icon} hover:bg-black/5`}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
