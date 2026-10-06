import "server-only";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { WorkspaceKey } from "@/components/d5o/platform/schedule-model";
import type { SharedWorkCatalog } from "@/components/d5o/platform/work-catalog-model";
import type { PrototypeWorkState } from "@/lib/d5o/prototype-work/store";
import { lifecycleProfiles, stateFor } from "@/components/d5o/platform/lifecycle-profiles";
import { operationalCondition } from "@/components/d5o/platform/work-condition";
import { resolvePublishedPhaseConfiguration } from "@/components/d5o/platform/published-phase-configuration";
import type { WorkRecord } from "@/components/d5o/platform/work-types";
import type { ConfigurationInventory } from "@/lib/d5o/configuration/version-inventory";

// A disposable read projection. The workspace JSON stores remain the source of
// truth; deleting this file only forces an index rebuild on the next search.
const root = path.join(process.cwd(), ".rybexos-local");
const databaseFile = path.join(root, "d5o-work-search-v4.sqlite");
const pageSize = 25;
export type SearchFilter = "all" | "mine" | "attention";
export type SearchSummary = { id: string; title: string; customer: string; site: string; type: string; stage: string; owner: string; status: "attention" | "moving" | "complete" };
type Cursor = { revision: string; query: string; filter: SearchFilter; owner: string; title: string; id: string };

function summary(value: Record<string, unknown>): SearchSummary | null {
  const fields = ["id", "title", "customer", "site", "type", "stage", "owner"] as const;
  if (fields.some((field) => typeof value[field] !== "string") || !["attention", "moving", "complete"].includes(String(value.status))) return null;
  return { id: value.id as string, title: value.title as string, customer: value.customer as string, site: value.site as string,
    type: value.type as string, stage: value.stage as string, owner: value.owner as string, status: value.status as SearchSummary["status"] };
}

function openIndex() {
  const db = new DatabaseSync(databaseFile, { timeout: 5000 });
  db.exec(`
    pragma journal_mode = WAL;
    create table if not exists work_search_revision (workspace text primary key, value text not null);
    create table if not exists work_search_record (
      workspace text not null, id text not null, title text not null, sort_title text not null,
      customer text not null, site text not null, type text not null, stage text not null,
      owner text not null, status text not null, position integer not null, blocked integer not null,
      due_key text not null, impact_rank integer not null, pricing_review integer not null,
      proposal_review integer not null, definition_review_count integer not null,
      body text not null, display_body text not null,
      primary key (workspace, id)
    );
    create index if not exists work_search_order_idx on work_search_record(workspace, sort_title, id);
    create index if not exists work_search_owner_idx on work_search_record(workspace, owner, sort_title, id);
    create index if not exists work_search_status_idx on work_search_record(workspace, status, sort_title, id);
    create index if not exists work_search_position_idx on work_search_record(workspace, position, sort_title, id);
    create index if not exists work_search_blocked_idx on work_search_record(workspace, blocked, sort_title, id);
    create index if not exists work_search_action_idx on work_search_record(workspace, status, due_key, impact_rank, sort_title, id);
    create index if not exists work_search_action_owner_idx on work_search_record(workspace, owner, status, due_key, impact_rank, sort_title, id);
    create virtual table if not exists work_search_text using fts5(workspace unindexed, id, title, customer, site, type, stage, owner);
  `);
  return db;
}

function synchronize(db: DatabaseSync, workspace: WorkspaceKey, snapshot: PrototypeWorkState, catalog: SharedWorkCatalog, inventory: ConfigurationInventory) {
  const configurationHash = createHash("sha256").update(JSON.stringify(inventory)).digest("hex");
  const revision = `${snapshot.revision}:${catalog.revision}:${configurationHash}`;
  const current = db.prepare("select value from work_search_revision where workspace = ?").get(workspace) as { value?: string } | undefined;
  if (current?.value === revision) return revision;
  const records = new Map<string, Record<string, unknown>>();
  for (const record of catalog.records) records.set(record.id, record as unknown as Record<string, unknown>);
  for (const record of snapshot.records) records.set(record.id as string, record);

  db.exec("begin immediate");
  try {
    const latest = db.prepare("select value from work_search_revision where workspace = ?").get(workspace) as { value?: string } | undefined;
    if (latest?.value !== revision) {
      db.prepare("delete from work_search_text where workspace = ?").run(workspace);
      db.prepare("delete from work_search_record where workspace = ?").run(workspace);
      const insert = db.prepare(`insert into work_search_record
        (workspace,id,title,sort_title,customer,site,type,stage,owner,status,position,blocked,due_key,impact_rank,pricing_review,proposal_review,definition_review_count,body,display_body)
        values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      const insertText = db.prepare(`insert into work_search_text (workspace,id,title,customer,site,type,stage,owner) values (?,?,?,?,?,?,?,?)`);
      for (const body of records.values()) {
        const record = summary(body);
        if (!record) continue;
        const work = body as WorkRecord;
        const configuration = resolvePublishedPhaseConfiguration(inventory, workspace, record.type, work);
        const condition = operationalCondition(work, configuration);
        const position = lifecycleProfiles[workspace].states.indexOf(stateFor(workspace, record.stage, Number(body.progress) || 0));
        const blocked = condition.status !== "complete" && condition.blockers.length > 0 ? 1 : 0;
        const projected = { ...body, status: condition.status, blockers: condition.blockers };
        const dueDate = typeof body.nextActionDue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.nextActionDue)
          ? new Date(`${body.nextActionDue}T00:00:00Z`) : null;
        const due = dueDate && !Number.isNaN(dueDate.valueOf()) && dueDate.toISOString().slice(0, 10) === body.nextActionDue
          ? body.nextActionDue : "9999-12-31";
        const impactRank = ({ Critical: 0, High: 1, Standard: 2 } as Record<string, number>)[String(body.nextActionImpact)] ?? 3;
        const discovery = body.discovery as { estimate?: { status?: string; revision?: number; review?: { revision?: number } };
          proposal?: { status?: string; package?: { revision?: number }; review?: { revision?: number } } } | undefined;
        const pricingReview = discovery?.estimate?.status === "Pricing review" && Number.isInteger(discovery.estimate.revision)
          && discovery.estimate.review?.revision === discovery.estimate.revision ? 1 : 0;
        const proposalReview = discovery?.proposal?.status === "Internal review" && Number.isInteger(discovery.proposal.package?.revision)
          && discovery.proposal.review?.revision === discovery.proposal.package?.revision ? 1 : 0;
        const definition = body.definition as { status?: string; revision?: number; reviews?: { revision?: number; commercial?: string; delivery?: string } } | undefined;
        const definitionReviewCount = definition?.status === "In review" && Number.isInteger(definition.revision)
          && definition.reviews?.revision === definition.revision
          ? Number(definition.reviews?.commercial === "Pending") + Number(definition.reviews?.delivery === "Pending") : 0;
        insert.run(workspace, record.id, record.title, record.title.toLocaleLowerCase(), record.customer, record.site,
          record.type, record.stage, record.owner, condition.status, position, blocked, due, impactRank,
          pricingReview, proposalReview, definitionReviewCount, JSON.stringify(body), JSON.stringify(projected));
        insertText.run(workspace, record.id, record.title, record.customer, record.site, record.type, record.stage, record.owner);
      }
      db.prepare("insert into work_search_revision (workspace,value) values (?,?) on conflict(workspace) do update set value=excluded.value").run(workspace, revision);
    }
    db.exec("commit");
  } catch (error) { db.exec("rollback"); throw error; }
  return revision;
}

function matchExpression(query: string) {
  const words = query.normalize("NFKC").match(/[\p{L}\p{N}]+/gu)?.slice(0, 12) ?? [];
  return words.map((word) => `"${word.replaceAll('"', '')}"*`).join(" AND ");
}

export async function searchWorkspaceWork(input: {
  workspace: WorkspaceKey; snapshot: PrototypeWorkState; catalog: SharedWorkCatalog; inventory: ConfigurationInventory;
  query: string; filter: SearchFilter; owner: string; cursor: string | null;
}) {
  await mkdir(root, { recursive: true });
  const db = openIndex();
  try {
    const revision = synchronize(db, input.workspace, input.snapshot, input.catalog, input.inventory);
    const expression = matchExpression(input.query);
    const from = expression
      ? "from work_search_record r join work_search_text t on t.workspace = r.workspace and t.id = r.id"
      : "from work_search_record r";
    const where = ["r.workspace = ?"];
    const parameters: Array<string | number> = [input.workspace];
    if (expression) { where.push("work_search_text match ?"); parameters.push(expression); }
    else if (input.query) { where.push("1 = 0"); }
    if (input.filter === "mine") { where.push("r.owner = ?"); parameters.push(input.owner); }
    if (input.filter === "attention") { where.push("r.status = 'attention'"); }
    const total = (db.prepare(`select count(*) as count ${from} where ${where.join(" and ")}`).get(...parameters) as { count: number }).count;

    if (input.cursor) {
      let cursor: Cursor;
      try { cursor = JSON.parse(Buffer.from(input.cursor, "base64url").toString("utf8")) as Cursor; }
      catch { throw new Error("invalid_cursor"); }
      if (cursor.revision !== revision) throw new Error("search_changed");
      if (cursor.query !== input.query || cursor.filter !== input.filter || cursor.owner !== input.owner
          || typeof cursor.title !== "string" || typeof cursor.id !== "string" || cursor.title.length > 200 || cursor.id.length > 120)
        throw new Error("invalid_cursor");
      where.push("(r.sort_title > ? or (r.sort_title = ? and r.id > ?))");
      parameters.push(cursor.title, cursor.title, cursor.id);
    }
    const rows = db.prepare(`select r.id,r.title,r.customer,r.site,r.type,r.stage,r.owner,r.status,r.sort_title
      ${from} where ${where.join(" and ")} order by r.sort_title,r.id limit ?`).all(...parameters, pageSize + 1) as Array<SearchSummary & { sort_title: string }>;
    const visible = rows.slice(0, pageSize);
    const last = visible.at(-1);
    const nextCursor = rows.length > pageSize && last
      ? Buffer.from(JSON.stringify({ revision, query: input.query, filter: input.filter, owner: input.owner, title: last.sort_title, id: last.id })).toString("base64url") : null;
    return { records: visible.map(({ sort_title: _sortTitle, ...record }) => record), total, nextCursor };
  } finally { db.close(); }
}

export async function loadIndexedWork(workspace: WorkspaceKey, snapshot: PrototypeWorkState, catalog: SharedWorkCatalog, inventory: ConfigurationInventory, id: string) {
  await mkdir(root, { recursive: true });
  const db = openIndex();
  try {
    synchronize(db, workspace, snapshot, catalog, inventory);
    const row = db.prepare("select body from work_search_record where workspace = ? and id = ?").get(workspace, id) as { body: string } | undefined;
    return row ? JSON.parse(row.body) as Record<string, unknown> : null;
  } finally { db.close(); }
}

export type PortfolioFilter = "all" | "blocked" | "attention" | "moving" | "complete";
export async function listPortfolioWork(input: {
  workspace: WorkspaceKey; snapshot: PrototypeWorkState; catalog: SharedWorkCatalog; inventory: ConfigurationInventory;
  query: string; filter: PortfolioFilter; position: number | null; cursor: string | null;
}) {
  await mkdir(root, { recursive: true });
  const db = openIndex();
  try {
    const revision = synchronize(db, input.workspace, input.snapshot, input.catalog, input.inventory);
    const overview = db.prepare(`select count(*) as total,
      sum(case when status = 'attention' then 1 else 0 end) as attention
      from work_search_record where workspace = ?`).get(input.workspace) as { total: number; attention: number | null };
    const stages = db.prepare(`select position, count(*) as count from work_search_record
      where workspace = ? group by position`).all(input.workspace) as Array<{ position: number; count: number }>;
    const expression = matchExpression(input.query);
    const from = expression
      ? "from work_search_record r join work_search_text t on t.workspace = r.workspace and t.id = r.id"
      : "from work_search_record r";
    const where = ["r.workspace = ?"];
    const parameters: Array<string | number> = [input.workspace];
    if (expression) { where.push("work_search_text match ?"); parameters.push(expression); }
    else if (input.query) where.push("1 = 0");
    if (input.filter === "blocked") where.push("r.blocked = 1");
    else if (input.filter !== "all") { where.push("r.status = ?"); parameters.push(input.filter); }
    if (input.position !== null) { where.push("r.position = ?"); parameters.push(input.position); }
    const total = (db.prepare(`select count(*) as count ${from} where ${where.join(" and ")}`).get(...parameters) as { count: number }).count;
    if (input.cursor) {
      let cursor: { revision: string; query: string; filter: PortfolioFilter; position: number | null; title: string; id: string };
      try { cursor = JSON.parse(Buffer.from(input.cursor, "base64url").toString("utf8")); }
      catch { throw new Error("invalid_cursor"); }
      if (cursor.revision !== revision) throw new Error("search_changed");
      if (cursor.query !== input.query || cursor.filter !== input.filter || cursor.position !== input.position
          || typeof cursor.title !== "string" || typeof cursor.id !== "string" || cursor.title.length > 200 || cursor.id.length > 120)
        throw new Error("invalid_cursor");
      where.push("(r.sort_title > ? or (r.sort_title = ? and r.id > ?))");
      parameters.push(cursor.title, cursor.title, cursor.id);
    }
    const rows = db.prepare(`select r.body,r.display_body,r.sort_title,r.id ${from} where ${where.join(" and ")}
      order by r.sort_title,r.id limit ?`).all(...parameters, pageSize + 1) as Array<{ body: string; display_body: string; sort_title: string; id: string }>;
    const visible = rows.slice(0, pageSize);
    const last = visible.at(-1);
    const nextCursor = rows.length > pageSize && last
      ? Buffer.from(JSON.stringify({ revision, query: input.query, filter: input.filter, position: input.position, title: last.sort_title, id: last.id })).toString("base64url")
      : null;
    return { records: visible.map((row) => ({ ...JSON.parse(row.display_body) as Record<string, unknown>, source: JSON.parse(row.body) as Record<string, unknown> })), total, nextCursor,
      overview: { total: overview.total, attention: overview.attention ?? 0, stages: Object.fromEntries(stages.map((stage) => [stage.position, stage.count])) } };
  } finally { db.close(); }
}

export type QueueView = "actions" | "decisions";
export type QueueFilter = "all" | "mine" | "waiting" | "pricing" | "proposal" | "definition" | "blocked" | "actionable" | "completed";
export async function listQueueWork(input: {
  workspace: WorkspaceKey; snapshot: PrototypeWorkState; catalog: SharedWorkCatalog; inventory: ConfigurationInventory;
  view: QueueView; filter: QueueFilter; owner: string; role: string; cursor: string | null;
}) {
  await mkdir(root, { recursive: true });
  const db = openIndex();
  try {
    const revision = synchronize(db, input.workspace, input.snapshot, input.catalog, input.inventory);
    const action = input.view === "actions";
    const base = action ? "workspace = ? and status != 'complete'" : "workspace = ?";
    const overview = action
      ? db.prepare(`select count(*) as total,
          sum(case when owner = ? then 1 else 0 end) as mine,
          sum(case when owner != ? then 1 else 0 end) as waiting,
          sum(pricing_review) as pricing, sum(proposal_review) as proposal,
          sum(definition_review_count) as definition
          from work_search_record where ${base}`).get(input.owner, input.owner, input.workspace) as Record<string, number | null>
      : db.prepare(`select count(*) as total, sum(blocked) as blocked,
          sum(case when status != 'complete' and blocked = 0 then 1 else 0 end) as actionable,
          sum(case when status = 'complete' then 1 else 0 end) as completed
          from work_search_record where ${base}`).get(input.workspace) as Record<string, number | null>;
    const roles = action ? (db.prepare(`select distinct json_extract(body,'$.discovery.proposal.review.authorityRole') as role
      from work_search_record where workspace = ? and status != 'complete' and proposal_review = 1
      and json_extract(body,'$.discovery.proposal.review.authorityRole') is not null
      order by role`).all(input.workspace) as Array<{ role: string }>).map((row) => row.role) : [];
    const where = ["workspace = ?"];
    const params: Array<string | number> = [input.workspace];
    if (action) {
      where.push("status != 'complete'");
      if (input.filter === "mine") { where.push("owner = ?"); params.push(input.owner); }
      if (input.filter === "waiting") { where.push("owner != ?"); params.push(input.owner); }
      if (input.filter === "pricing") where.push("pricing_review = 1");
      if (input.filter === "proposal") where.push("proposal_review = 1");
      if (input.filter === "proposal" && input.role !== "all") {
        where.push("json_extract(body,'$.discovery.proposal.review.authorityRole') = ?");
        params.push(input.role);
      }
      if (input.filter === "definition") where.push("definition_review_count > 0");
    } else {
      if (input.filter === "blocked") where.push("blocked = 1");
      if (input.filter === "actionable") where.push("status != 'complete' and blocked = 0");
      if (input.filter === "completed") where.push("status = 'complete'");
    }
    const total = (db.prepare(`select count(*) as count from work_search_record where ${where.join(" and ")}`).get(...params) as { count: number }).count;
    if (input.cursor) {
      let cursor: { revision: string; view: QueueView; filter: QueueFilter; owner: string; role: string; due: string; impact: number; title: string; id: string };
      try { cursor = JSON.parse(Buffer.from(input.cursor, "base64url").toString("utf8")); }
      catch { throw new Error("invalid_cursor"); }
      if (cursor.revision !== revision) throw new Error("search_changed");
      if (cursor.view !== input.view || cursor.filter !== input.filter || cursor.owner !== input.owner || cursor.role !== input.role
          || typeof cursor.due !== "string" || typeof cursor.impact !== "number"
          || typeof cursor.title !== "string" || typeof cursor.id !== "string"
          || cursor.due.length > 20 || cursor.title.length > 200 || cursor.id.length > 120)
        throw new Error("invalid_cursor");
      if (action) {
        where.push("(due_key,impact_rank,sort_title,id) > (?,?,?,?)");
        params.push(cursor.due, cursor.impact, cursor.title, cursor.id);
      } else {
        where.push("(sort_title,id) > (?,?)");
        params.push(cursor.title, cursor.id);
      }
    }
    const order = action ? "due_key,impact_rank,sort_title,id" : "sort_title,id";
    const rows = db.prepare(`select body,display_body,due_key,impact_rank,sort_title,id from work_search_record
      where ${where.join(" and ")} order by ${order} limit ?`).all(...params, pageSize + 1) as Array<{
      body: string; display_body: string; due_key: string; impact_rank: number; sort_title: string; id: string;
    }>;
    const visible = rows.slice(0, pageSize);
    const last = visible.at(-1);
    const nextCursor = rows.length > pageSize && last
      ? Buffer.from(JSON.stringify({ revision, view: input.view, filter: input.filter, owner: input.owner, role: input.role,
        due: last.due_key, impact: last.impact_rank, title: last.sort_title, id: last.id })).toString("base64url") : null;
    return { records: visible.map((row) => ({ ...JSON.parse(row.display_body) as Record<string, unknown>,
      source: JSON.parse(row.body) as Record<string, unknown> })), total, nextCursor,
      overview: Object.fromEntries(Object.entries(overview).map(([key, value]) => [key, value ?? 0])), roles };
  } finally { db.close(); }
}
