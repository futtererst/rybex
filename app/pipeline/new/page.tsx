import Link from "next/link";
import { createOpportunityAction } from "@/app/actions/opportunities";

export const metadata = {
  title: "New Opportunity | RybexOS"
};

type NewOpportunitySearchParams = Record<string, string | string[] | undefined>;

export default async function NewOpportunityPage({
  searchParams
}: {
  searchParams: Promise<NewOpportunitySearchParams>;
}) {
  const query = await searchParams;
  const duplicateReview = query.duplicate === "1";
  const candidate = {
    id: readParam(query.candidateId),
    stableKey: readParam(query.candidateStableKey),
    name: readParam(query.candidateName),
    customerGc: readParam(query.candidateCustomerGc),
    location: readParam(query.candidateLocation),
    lifecycleStatus: readParam(query.candidateLifecycleStatus)
  };

  return (
    <main className="command-grid" data-p1-01a-page="new-opportunity">
      <header className="page-header">
        <div>
          <p className="page-kicker">Pipeline intake</p>
          <h1>New opportunity</h1>
          <p>
            Capture the minimum facts needed to start qualification and decide who should review the pursuit package.
          </p>
        </div>
        <div className="header-actions">
          <Link className="button button-secondary" href="/pipeline">
            Back to Pipeline
          </Link>
        </div>
      </header>

      <section className="panel" data-p1-01a-surface="intake-form">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Opportunity intake</p>
            <h2>Create draft opportunity</h2>
          </div>
        </div>
        <DuplicateNotice duplicateReview={duplicateReview} candidate={candidate} />
        <form action={createOpportunityAction} className="form-grid">
          {duplicateReview ? (
            <>
              <input name="duplicateConfirmed" type="hidden" value="on" />
              <input name="duplicateCandidateId" type="hidden" value={candidate.id} />
            </>
          ) : null}
          <label>
            Opportunity name
            <input name="name" required defaultValue={readParam(query.name)} placeholder="Lake Norman Underground Conduit Package" />
          </label>
          <label>
            Customer / GC
            <input name="customerGc" required defaultValue={readParam(query.customerGc)} placeholder="Bluegrass Data Centers" />
          </label>
          <label>
            Project type
            <input name="projectType" required defaultValue={readParam(query.projectType)} placeholder="Underground conduit" />
          </label>
          <label>
            Location
            <input name="location" required defaultValue={readParam(query.location)} placeholder="Hospital access road and conduit crossing" />
          </label>
          <label className="wide-field">
            Scope summary
            <textarea name="scopeSummary" required rows={4} defaultValue={readParam(query.scopeSummary)} placeholder="Conduit, access coordination, traffic control, and restoration scope." />
          </label>
          <label>
            Estimated value
            <input name="estimatedValue" inputMode="decimal" defaultValue={readParam(query.estimatedValue)} placeholder="385000" />
          </label>
          <label>
            Anticipated start
            <input name="anticipatedStart" type="date" defaultValue={readParam(query.anticipatedStart)} />
          </label>
          <label>
            Bid due date
            <input name="bidDueDate" type="date" defaultValue={readParam(query.bidDueDate)} />
          </label>
          <div className="form-actions">
            <button className="button button-primary" type="submit">
              {duplicateReview ? "Create as separate opportunity" : "Create opportunity"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

function DuplicateNotice({
  duplicateReview,
  candidate
}: {
  duplicateReview: boolean;
  candidate: { id: string; stableKey: string; name: string; customerGc: string; location: string; lifecycleStatus: string };
}) {
  if (duplicateReview) {
    return (
      <div className="panel notice-panel" data-p1-01a-surface="duplicate-warning">
        <p className="eyebrow">Possible duplicate found</p>
        <h3>Review existing opportunity before creating a separate record</h3>
        <p>
          A matching opportunity already exists for {candidate.customerGc || "this customer"} at {candidate.location || "this location"}.
        </p>
        <div className="detail-grid">
          <div className="detail">
            <span>Matching opportunity</span>
            <strong>{candidate.name || "Existing opportunity"}</strong>
          </div>
          <div className="detail">
            <span>Customer / GC</span>
            <strong>{candidate.customerGc || "Not available"}</strong>
          </div>
          <div className="detail">
            <span>Location</span>
            <strong>{candidate.location || "Not available"}</strong>
          </div>
          <div className="detail">
            <span>State</span>
            <strong>{candidate.lifecycleStatus.replaceAll("_", " ") || "Not available"}</strong>
          </div>
        </div>
        <div className="form-actions">
          {candidate.id ? (
            <Link className="button button-secondary" href={`/pipeline/${candidate.id}`}>
              Review existing opportunity
            </Link>
          ) : null}
          <Link className="button button-secondary" href="/pipeline/new">
            Return to intake
          </Link>
        </div>
      </div>
    );
  }

  return (
    <p className="muted">
      We check customer, opportunity name, and location before creating a new record.
    </p>
  );
}

function readParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
