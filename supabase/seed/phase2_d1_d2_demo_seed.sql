-- Optional RybexOS Phase 2 D1/D2 demo seed.
--
-- This file is not required for app build or seed-mode runtime. It is intended
-- only for a future local Postgres/Supabase read-pilot after migrations 0001 and
-- 0002 have been reviewed and applied.

insert into organizations (id, name, slug, status)
values ('00000000-0000-4000-8000-000000000001', 'Rybex Infrastructure Group', 'rybex-infrastructure-group', 'active')
on conflict (slug) do nothing;

insert into workspaces (id, organization_id, name, slug, status)
values (
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  'RybexOS Demo Workspace',
  'rybexos-demo',
  'active'
)
on conflict (organization_id, slug) do nothing;

insert into opportunities (
  id,
  organization_id,
  workspace_id,
  name,
  gc_client,
  owner_or_prime,
  project_location,
  project_type,
  status,
  d5o_phase,
  estimated_value,
  bid_due_date,
  received_date,
  probability,
  risk_level,
  decision,
  decision_date,
  next_action,
  scope_summary
) values
(
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  'I-77 Fiber Backbone Expansion - Phase 2',
  'Carolina Transport Constructors',
  'NCDOT Broadband Infrastructure Program',
  'Charlotte to Statesville, NC',
  'long_haul_fiber',
  'approved_to_bid',
  'discover',
  1850000.00,
  '2026-07-01',
  '2026-06-10',
  68,
  'moderate',
  'approve_to_bid',
  '2026-06-14',
  'Confirm utility conflict exclusions before estimate lock.',
  'Long-haul fiber backbone, handhole placement, conduit proofing, pull/splice/test support.'
),
(
  '00000000-0000-4000-8000-000000000102',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  'Lake Norman Underground Conduit Package',
  'Piedmont Civil Partners',
  'Regional Broadband Cooperative',
  'Mooresville, NC',
  'underground_infrastructure',
  'awaiting_go_no_go',
  'discover',
  940000.00,
  '2026-06-24',
  '2026-06-08',
  54,
  'high',
  'hold_for_clarification',
  null,
  'Resolve utility locate quality and access-window risk before estimating.',
  'Underground conduit installation with bore crews, traffic control, restoration, and handhole setting.'
)
on conflict (id) do nothing;

insert into opportunity_documents (
  id,
  organization_id,
  workspace_id,
  opportunity_id,
  document_type,
  title,
  status,
  received_date,
  notes
) values
(
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000101',
  'drawings',
  'I-77 backbone plan set IFC draft',
  'received',
  '2026-06-10',
  'Drawing set received with utility conflict notes still incomplete.'
),
(
  '00000000-0000-4000-8000-000000000202',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000102',
  'specifications',
  'Lake Norman conduit technical specifications',
  'received',
  '2026-06-08',
  'Bore method constraints need clarification before go/no-go approval.'
)
on conflict (id) do nothing;

insert into opportunity_reviews (
  id,
  organization_id,
  workspace_id,
  opportunity_id,
  reviewer_role,
  reviewer_name,
  review_status,
  recommendation,
  reviewed_at,
  notes
) values
(
  '00000000-0000-4000-8000-000000000211',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000101',
  'operations_leader',
  'Maya Ortiz',
  'complete',
  'pursue_with_mitigations',
  '2026-06-14 14:00:00+00',
  'Good strategic fit; require utility conflict exclusions and documented access assumptions.'
),
(
  '00000000-0000-4000-8000-000000000212',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000102',
  'safety_manager',
  'Caleb Nguyen',
  'pending',
  null,
  null,
  'Excavation competent person and locate quality must be reviewed.'
)
on conflict (id) do nothing;

insert into go_no_go_scores (
  id,
  organization_id,
  workspace_id,
  opportunity_id,
  total_score,
  recommendation,
  risk_level,
  decision,
  decision_date,
  strengths,
  concerns,
  required_mitigations,
  required_approvals
) values (
  '00000000-0000-4000-8000-000000000221',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000101',
  78,
  'pursue_with_mitigations',
  'moderate',
  'approve_to_bid',
  '2026-06-14',
  '["Strong fiber backbone fit","Repeat GC relationship","Regional crew familiarity"]'::jsonb,
  '["Utility conflict risk","Tight access windows"]'::jsonb,
  '["Carry utility conflict exclusion","Confirm access windows in writing"]'::jsonb,
  '["Operations leader","Finance review"]'::jsonb
)
on conflict (id) do nothing;

insert into go_no_go_score_dimensions (
  id,
  organization_id,
  workspace_id,
  opportunity_id,
  score_id,
  dimension_key,
  label,
  score,
  rationale,
  weight
) values
(
  '00000000-0000-4000-8000-000000000231',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000221',
  'strategic_fit',
  'Strategic fit',
  86,
  'Backbone fiber scope matches Rybex service line and repeat-work strategy.',
  1.00
),
(
  '00000000-0000-4000-8000-000000000232',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000221',
  'execution_fit',
  'Execution fit',
  74,
  'Crew capability is strong, but utility conflict exposure needs mitigation.',
  1.00
),
(
  '00000000-0000-4000-8000-000000000233',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000221',
  'commercial_fit',
  'Commercial fit',
  80,
  'Value supports bid effort; terms require notice and change-order review.',
  1.00
),
(
  '00000000-0000-4000-8000-000000000234',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000221',
  'risk_exposure',
  'Risk exposure',
  70,
  'Moderate underground and schedule-risk exposure if conflict exclusions are weak.',
  1.00
)
on conflict (score_id, dimension_key) do nothing;

insert into projects (
  id,
  organization_id,
  workspace_id,
  source_opportunity_id,
  project_number,
  name,
  gc_client,
  owner_or_prime,
  location,
  project_type,
  d5o_phase,
  health_status,
  contract_status,
  contract_value,
  next_milestone,
  next_action
) values
(
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000101',
  'RYB-2026-077',
  'I-77 Fiber Backbone Expansion - Phase 2',
  'Carolina Transport Constructors',
  'NCDOT Broadband Infrastructure Program',
  'Charlotte to Statesville, NC',
  'long_haul_fiber',
  'define',
  'watch',
  'under_review',
  1815000.00,
  'D2 contract baseline review',
  'Complete flow-down and notice review before D3 handoff.'
),
(
  '00000000-0000-4000-8000-000000000302',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  null,
  'RYB-2026-081',
  'CLT Data Center Structured Cabling Buildout',
  'Southeast Data Builders',
  'Confidential Data Center Operator',
  'Charlotte, NC',
  'data_center',
  'define',
  'on_track',
  'approved',
  1260000.00,
  'Budget and schedule baseline approval',
  'Confirm submittal register and closeout document list.'
)
on conflict (id) do nothing;

insert into contract_baselines (
  id,
  organization_id,
  workspace_id,
  project_id,
  contract_status,
  contract_value,
  original_estimate_value,
  retainage_percent,
  payment_terms,
  notice_requirements_summary,
  change_order_terms,
  schedule_penalty_exposure,
  insurance_requirements,
  bonding_requirements,
  certified_payroll_required,
  review_notes,
  approved_at
) values (
  '00000000-0000-4000-8000-000000000401',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000301',
  'under_review',
  1815000.00,
  1760000.00,
  5.00,
  'Net 45 after approved pay application.',
  'Written notice required within 48 hours for changed conditions or delay.',
  'CO pricing requires daily records, photos, and written GC direction.',
  'Schedule acceleration may be required if access windows slip.',
  'Standard GL and umbrella coverage per subcontract.',
  'Bonding not required for current package.',
  false,
  'Retainage and notice requirements need PM/finance signoff.',
  null
)
on conflict (id) do nothing;

insert into scope_matrix_items (id, organization_id, workspace_id, project_id, item_type, title, description, owner, status, notes)
values
('00000000-0000-4000-8000-000000000411','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000301','included_scope','Fiber pull and placement','Place backbone fiber through approved conduit and handholes.','Rybex','approved','Included in subcontract scope.'),
('00000000-0000-4000-8000-000000000412','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000301','excluded_scope','Unmarked utility relocation','Utility relocation and redesign caused by unmarked conflicts are excluded.','GC/Owner','open','Must be reflected in proposal assumptions.'),
('00000000-0000-4000-8000-000000000413','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000301','assumption','Night lane access','Estimate assumes two approved night access windows per week.','GC','open','Confirm before mobilization planning.')
on conflict (id) do nothing;

insert into budget_baselines (id, organization_id, workspace_id, project_id, status, original_estimate_value, approved_budget_value, contingency_value, margin_target_percent, approved_at, notes)
values (
  '00000000-0000-4000-8000-000000000421',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000301',
  'draft',
  1760000.00,
  1695000.00,
  60000.00,
  18.50,
  null,
  'Pending production-rate validation for handhole and pull segments.'
)
on conflict (id) do nothing;

insert into budget_baseline_items (id, organization_id, workspace_id, project_id, budget_baseline_id, cost_code, category, description, amount, notes)
values
('00000000-0000-4000-8000-000000000431','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000421','3000','labor','Fiber placement and splice labor',720000.00,'Crew loading assumes two pull crews.'),
('00000000-0000-4000-8000-000000000432','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000421','4100','materials','Fiber, enclosures, handhole hardware',510000.00,'Material quotes valid through July.'),
('00000000-0000-4000-8000-000000000433','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000421','5200','equipment','Pulling equipment, traffic support, testing gear',245000.00,'Traffic support may shift to GC depending on final terms.')
on conflict (id) do nothing;

insert into schedule_baselines (id, organization_id, workspace_id, project_id, status, planned_start_date, planned_finish_date, approved_at, constraints_summary, notes)
values (
  '00000000-0000-4000-8000-000000000441',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000301',
  'draft',
  '2026-08-03',
  '2026-11-20',
  null,
  'Night access windows and utility conflict resolution control production sequencing.',
  'Schedule cannot be approved until access windows are confirmed.'
)
on conflict (id) do nothing;

insert into schedule_milestones (id, organization_id, workspace_id, project_id, schedule_baseline_id, milestone_name, milestone_type, planned_date, owner, status, notes)
values
('00000000-0000-4000-8000-000000000451','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000441','D3 mobilization package complete','mobilization','2026-07-24','Project Manager','planned','Requires contract baseline and submittal register.'),
('00000000-0000-4000-8000-000000000452','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000441','Segment A field start','field_start','2026-08-03','Superintendent','planned','Subject to access window approval.')
on conflict (id) do nothing;

insert into flow_down_obligations (id, organization_id, workspace_id, project_id, obligation_type, title, description, source_reference, owner, due_date, status, risk_level, notes)
values
('00000000-0000-4000-8000-000000000461','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000301','notice','48-hour changed condition notice','Rybex must notify GC in writing within 48 hours of changed condition discovery.','Subcontract 8.4','Project Manager','2026-07-01','open','high','Must be built into field reporting prompts.'),
('00000000-0000-4000-8000-000000000462','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000301','documentation','Daily production backup','Daily reports, photos, and quantities required for pay app support.','Subcontract Exhibit C','Superintendent','2026-07-15','open','moderate','Tie to D4 daily report compliance.')
on conflict (id) do nothing;

insert into notice_requirements (id, organization_id, workspace_id, project_id, notice_type, trigger_event, deadline_days, delivery_method, responsible_role, risk_if_missed, notes)
values
('00000000-0000-4000-8000-000000000471','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000301','changed_condition','Utility conflict, access delay, added scope, or GC-directed method change',2,'Email notice to GC PM with daily report reference','project_manager','Potential loss of entitlement for cost or schedule recovery.','Field supervisors should flag same day.'),
('00000000-0000-4000-8000-000000000472','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000301','delay','Denied access or unplanned crew standby',1,'Email notice plus schedule impact log','operations_leader','Standby labor may be unrecoverable without timely notice.','Coordinate with change control workflow.')
on conflict (id) do nothing;

insert into project_setup_artifacts (id, organization_id, workspace_id, project_id, artifact_type, title, status, required_for_d2_gate, owner, due_date, notes)
values
('00000000-0000-4000-8000-000000000481','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000301','scope_matrix','Approved scope matrix','in_progress',true,'Project Manager','2026-06-28','Scope exclusions still need GC acknowledgment.'),
('00000000-0000-4000-8000-000000000482','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000301','baseline_schedule','Baseline schedule','draft',true,'Operations Lead','2026-07-03','Cannot approve until night access windows are confirmed.'),
('00000000-0000-4000-8000-000000000483','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000301','notice_requirements','Notice requirement summary','complete',true,'Finance Admin','2026-06-24','Ready for D2 gate review.')
on conflict (id) do nothing;
