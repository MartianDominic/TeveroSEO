/**
 * ChartErrorBoundary
 * Phase UI-06: Error boundary for chart components
 *
 * Catches rendering errors in chart components and displays
 * a friendly fallback with retry functionality.
 */
import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/client/components/ui/button';
import { Card } from '@/client/components/ui/card';

interface ChartErrorBoundaryProps {
  children: ReactNode;
  /** Minimum height for the fallback UI */
  fallbackHeight?: number;
  /** Custom fallback render function */
  fallback?: (error: Error, retry: () => void) => ReactNode;
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ChartErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ChartErrorBoundary extends Component<
  ChartErrorBoundaryProps,
  ChartErrorBoundaryState
> {
  constructor(props: ChartErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ChartErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error for debugging
    console.error('[ChartErrorBoundary] Chart render error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    // Call optional error callback
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: undefined });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallbackHeight = 300, fallback } = this.props;

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback(error, this.handleRetry);
      }

      // Default fallback UI
      return (
        <Card
          className="flex flex-col items-center justify-center gap-4 border-dashed bg-muted/30 p-6"
          style={{ minHeight: fallbackHeight }}
        >
          <div className="rounded-full bg-muted p-3">
            <AlertTriangle className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              Failed to render chart
            </p>
            <p className="mt-1 text-xs-safe text-muted-foreground">
              {error.message || 'An unexpected error occurred'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={this.handleRetry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </Card>
      );
    }

    return children;
  }
}

export default ChartErrorBoundary;
