import Link from "next/link";

type NextBestActionProps = {
  title: string;
  why: string;
  after: string;
  evidence?: string;
  href?: string;
  ctaLabel?: string;
};

export function NextBestAction({ title, why, after, evidence, href, ctaLabel = "Take action" }: NextBestActionProps) {
  return (
    <section className="next-best-action">
      <div>
        <p className="eyebrow">Next Best Action</p>
        <h2>{title}</h2>
      </div>
      <div>
        <span>Why</span>
        <strong>{why}</strong>
      </div>
      <div>
        <span>After</span>
        <strong>{after}</strong>
      </div>
      {evidence ? (
        <div>
          <span>Evidence</span>
          <strong>{evidence}</strong>
        </div>
      ) : null}
      {href ? (
        <Link className="button button-primary" href={href}>
          {ctaLabel}
        </Link>
      ) : null}
    </section>
  );
}
