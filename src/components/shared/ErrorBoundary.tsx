import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

// ✅ NEW — global error boundary. Without this, any render-time exception
// anywhere in the tree (a null-ref on a malformed API response, a bad prop,
// etc.) used to unmount the whole app and leave a blank white screen with
// nothing but a console error the user never sees. This catches it and shows
// a recoverable card instead, with a "Try again" (resets the boundary,
// re-renders the tree) and a "Go home" escape hatch.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  handleGoHome = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl shadow-sm p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h1 className="text-lg font-bold text-gray-900 mb-1.5">Something went wrong</h1>
            <p className="text-sm text-gray-500 mb-5">
              An unexpected error occurred while displaying this page. You can try again, or head back to the home screen.
            </p>
            {this.state.error?.message && (
              <div className="text-left text-[11px] font-mono text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 mb-5 break-words">
                {this.state.error.message}
              </div>
            )}
            <div className="flex items-center gap-3">
              <button onClick={this.handleReset}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                <RefreshCcw className="w-4 h-4" /> Try again
              </button>
              <button onClick={this.handleGoHome}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors">
                <Home className="w-4 h-4" /> Go home
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
