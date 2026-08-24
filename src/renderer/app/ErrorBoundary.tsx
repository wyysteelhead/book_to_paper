import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
  info: ErrorInfo | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
    info: null
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ error, info });
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <main className="runtime-error-screen">
        <section>
          <p className="eyebrow">Runtime Error</p>
          <h1>页面运行时出错</h1>
          <p>{this.state.error.message}</p>
          <pre>{this.state.info?.componentStack || this.state.error.stack}</pre>
        </section>
      </main>
    );
  }
}
