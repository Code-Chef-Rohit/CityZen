import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-3xl text-center space-y-4 my-2">
          <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-red-900 dark:text-red-200">
              {this.props.fallbackTitle || 'Component Notice'}
            </h3>
            <p className="text-xs text-red-700 dark:text-red-300 mt-1 max-w-sm mx-auto">
              {this.state.error?.message || 'An unexpected issue occurred while rendering this module.'}
            </p>
          </div>
          <Button
            onClick={this.handleReset}
            size="sm"
            variant="outline"
            className="border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 font-bold mx-auto"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Reload Module
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
