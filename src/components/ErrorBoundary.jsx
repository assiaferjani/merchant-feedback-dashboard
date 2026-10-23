import { Component } from "react";
export default class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div className="error-state" role="alert">
          <h1>Cette page n’a pas pu s’afficher</h1>
          <p>
            Vos imports enregistrés restent sur cet appareil. Rechargez le
            tableau de bord pour réessayer.
          </p>
          <button
            className="primary-button"
            onClick={() => window.location.reload()}
          >
            Recharger
          </button>
        </div>
      );
    return this.props.children;
  }
}
