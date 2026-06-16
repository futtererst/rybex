import Link from "next/link";

export default function NotFound() {
  return (
    <div className="command-grid">
      <section className="empty-state">
        <p className="page-kicker">Route Safety</p>
        <h1>Operating area not found</h1>
        <p>
          This route is not registered in the RybexOS module map. Use the Command Center
          or Admin readiness view to return to a controlled operating area.
        </p>
        <div className="header-actions">
          <Link className="button button-primary" href="/command-center">
            Command Center
          </Link>
          <Link className="button button-secondary" href="/admin">
            System Readiness
          </Link>
        </div>
      </section>
    </div>
  );
}
