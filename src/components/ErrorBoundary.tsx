import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="fatal-error" role="alert">
          <h1>문학의 행성</h1>
          <p>화면을 그리는 중 오류가 발생했습니다.</p>
          <pre>{this.state.error.message}</pre>
          <button type="button" onClick={() => window.location.reload()}>
            다시 불러오기
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
