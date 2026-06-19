import { Component } from 'react'
import { AlertTriangle } from 'lucide-react'

/* Keeps one misbehaving page from blanking the whole app. Wraps the active view;
   resetKey (the current view id) clears the error when the user navigates away. */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Page error:', error, info)
  }

  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="card flex flex-col items-center px-6 py-12 text-center">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-coral-50 text-coral-500">
            <AlertTriangle size={22} />
          </span>
          <p className="eyebrow mb-1.5">Something went sideways</p>
          <h3 className="text-2xl text-slate-800">This page hit a snag</h3>
          <p className="mt-2 max-w-sm text-sm font-medium text-slate-500">
            Pick another page from the menu — the rest of the app is working fine.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}
