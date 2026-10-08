"use client";

import { useRef, useState, type FormEvent, type PointerEvent } from "react";
import type { FieldReport, FieldSignoff } from "@/components/d5o/platform/deploy-model";

export type CapturedCustomer = { reportId: string; signerName: string; signerOrganization: string; signerRole: string; authorityBasis: string; conditions: string };
const field = (data: FormData, name: string) => String(data.get(name) ?? "").trim();

export function CrewCustomerSignature({ reports, signoffs, busy, onCapture }: { reports: FieldReport[]; signoffs: FieldSignoff[]; busy: boolean; onCapture: (details: CapturedCustomer, image: Blob) => Promise<void> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [marked, setMarked] = useState(false);
  const reviewed = reports.filter((item) => item.status === "Reviewed" && !signoffs.some((signoff) => signoff.recordId === item.id && signoff.recordRevision === item.revision));
  const position = (event: PointerEvent<HTMLCanvasElement>) => { const bounds = event.currentTarget.getBoundingClientRect(); return { x: (event.clientX - bounds.left) * event.currentTarget.width / bounds.width, y: (event.clientY - bounds.top) * event.currentTarget.height / bounds.height }; };
  const start = (event: PointerEvent<HTMLCanvasElement>) => { const surface = canvas.current; if (!surface) return; event.currentTarget.setPointerCapture(event.pointerId); const point = position(event), context = surface.getContext("2d"); if (!context) return; context.strokeStyle = "#102f48"; context.lineWidth = 2.5; context.lineCap = "round"; context.beginPath(); context.moveTo(point.x, point.y); drawing.current = true; setMarked(true); };
  const move = (event: PointerEvent<HTMLCanvasElement>) => { if (!drawing.current) return; const point = position(event), context = canvas.current?.getContext("2d"); context?.lineTo(point.x, point.y); context?.stroke(); };
  const clear = () => { canvas.current?.getContext("2d")?.clearRect(0, 0, canvas.current.width, canvas.current.height); setMarked(false); };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!marked || !canvas.current) return;
    const data = new FormData(event.currentTarget);
    const image = await new Promise<Blob | null>((resolve) => canvas.current?.toBlob(resolve, "image/png"));
    if (!image) return;
    await onCapture({ reportId: field(data, "reportId"), signerName: field(data, "signerName"), signerOrganization: field(data, "organization"), signerRole: field(data, "role"), authorityBasis: field(data, "authority"), conditions: field(data, "conditions") }, image);
  };
  return <section className="d5o-field-card"><h2>Customer report acknowledgment</h2><p>The customer acknowledges only the selected reviewed report revision. This capture does not accept the package or Work Record, and it does not authenticate the customer to D5O.</p>{reviewed.length ? <form onSubmit={submit}><label>Reviewed report<select name="reportId" required>{reviewed.map((item) => <option key={item.id} value={item.id}>{item.date} · revision {item.revision} · {item.summary}</option>)}</select></label><label>Customer name<input name="signerName" required /></label><label>Organization<input name="organization" required /></label><label>Role<input name="role" required /></label><label>Authority basis<input name="authority" required placeholder="For example, authorized site representative" /></label><label>Conditions or exclusions<input name="conditions" /></label><label>Customer signature on this device<canvas ref={canvas} width={640} height={200} onPointerDown={start} onPointerMove={move} onPointerUp={() => { drawing.current = false; }} onPointerCancel={() => { drawing.current = false; }} style={{ display: "block", width: "100%", height: 160, border: "1px solid #b7c9d5", borderRadius: 8, background: "white", touchAction: "none" }} aria-label="Customer signature pad" /></label><button type="button" onClick={clear}>Clear signature</button><button disabled={busy || !marked}>Capture against this report revision</button></form> : <p>No reviewed, unsigned report is available.</p>}{signoffs.map((item) => <article key={item.id}><strong>{item.signerName} · report revision {item.recordRevision}</strong><p>{item.method} · {item.outcome} · {item.at}</p><small>{item.statement}</small></article>)}</section>;
}
