import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] React crash:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
          <div className="bg-gray-900 border border-red-800/50 rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto text-red-400">
              <AlertTriangle size={28} />
            </div>
            <h2 className="text-xl font-bold text-white">Đã xảy ra lỗi không mong muốn</h2>
            <p className="text-sm text-gray-400">
              {this.state.error?.message || 'Giao diện gặp sự cố khi xử lý dữ liệu.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-red-900/30"
            >
              <RefreshCw size={16} /> Tải lại trang
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
