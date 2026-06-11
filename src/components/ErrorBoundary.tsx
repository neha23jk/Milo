import React from "react";

interface State {
  error: Error | null;
}

/**
 * Catches render-time exceptions so a crash shows a readable message instead of
 * a blank white screen, and lets the user recover without restarting.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Render error caught by ErrorBoundary:", error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background p-8 text-foreground">
        <div className="max-w-lg space-y-3">
          <h1 className="text-lg font-semibold text-destructive">
            Something broke while rendering
          </h1>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
            {error.message}
            {error.stack ? `\n\n${error.stack}` : ""}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}
