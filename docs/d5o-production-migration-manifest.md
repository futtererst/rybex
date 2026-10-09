# D5O production migration manifest (9 October 2026)

Target: shared Supabase project `fcawktdjoxvahhgvkebx`. This is a read-only reconciliation and proposed order; no shared migration has been applied by this release-candidate work.

The 12 already-recorded D5O/worker migrations have SQL definitions identical to the candidate files after newline normalization. Eight early releases carry Supabase-assigned versions instead of the local filename versions:

| Recorded version | Recorded name | Candidate version |
|---|---|---|
| 20261007013631 | d5o_hosted_workspace_authority | 20261007013134 |
| 20261007014024 | d5o_hosted_workspace_invoker_hardening | 20261007013707 |
| 20261007015048 | d5o_hosted_work_identity | 20261007020600 |
| 20261007015356 | d5o_hosted_create_work_authority | 20261007022200 |
| 20261007020854 | d5o_hosted_configuration_manifest | 20261007031000 |
| 20261007021942 | d5o_hosted_synthetic_prototype_state | 20261007040000 |
| 20261007025942 | d5o_hosted_prototype_nested_scope | 20261007050000 |
| 20261007225404 | d5o_hosted_worker_boundary | 20261007225404 |
| 20261008182443 | d5o_hosted_command_writer | 20261008182443 |
| 20261008185604 | d5o_hosted_worker_provisioning | 20261008185604 |
| 20261008190351 | d5o_secret_key_role_compatibility | 20261008190351 |
| 20261008200840 | restrict_worker_work_access | 20261008200840 |

The worker-excluding policies `d5o_hosted_work_member_read` and `d5o_hosted_work_event_member_read` also match the live read-only inspection. Do not rewrite the eight applied history versions. A raw version-only `supabase db push` is unsafe until the release operator explicitly reconciles those mappings; it would treat their local versions as unapplied.

## Outstanding files, in required order (53)

1. `20261008183310_d5o_prototype_authoritative_writes.sql`
2. `20261008203000_d5o_reject_imported_commercial_decisions.sql`
3. `20261008214425_hosted_pilot_role_assignments.sql`
4. `20261008221100_d5o_guard_pilot_position.sql`
5. `20261008230000_d5o_connected_work_identity.sql`
6. `20261008231000_d5o_connected_define_commands.sql`
7. `20261008232000_d5o_connected_discover_commands.sql`
8. `20261008233000_d5o_connected_draft_projection.sql`
9. `20261008234000_d5o_connected_solution_decision_lock.sql`
10. `20261008235000_d5o_connected_solution_commands.sql`
11. `20261008235500_d5o_connected_pricing_policy_commands.sql`
12. `20261008240000_d5o_connected_estimate_commands.sql`
13. `20261008241000_d5o_connected_offer_review.sql`
14. `20261008242000_d5o_connected_customer_decisions.sql`
15. `20261008243000_d5o_connected_design_handoff.sql`
16. `20261008244000_d5o_connected_package_creation.sql`
17. `20261008244500_d5o_connected_package_projection.sql`
18. `20261008245000_d5o_connected_design_drafts.sql`
19. `20261008245100_d5o_connected_design_reviews.sql`
20. `20261008245150_d5o_connected_design_demand.sql`
21. `20261008245200_d5o_connected_design_release.sql`
22. `20261008245300_d5o_connected_crew_publication.sql`
23. `20261008245400_d5o_connected_field_start.sql`
24. `20261008245450_d5o_connected_deploy_draft_rebase.sql`
25. `20261008245500_d5o_connected_field_facts.sql`
26. `20261008245600_d5o_connected_field_evidence.sql`
27. `20261008245650_d5o_connected_worker_projection.sql`
28. `20261008245700_d5o_connected_acceptance.sql`
29. `20261008245800_d5o_connected_operate_state.sql`
30. `20261008245850_d5o_connected_operate_commands.sql`
31. `20261008245900_d5o_connected_operate_draft_rebase.sql`
32. `20261008250000_d5o_connected_service_job_command.sql`
33. `20261008250100_d5o_connected_asset_acceptance.sql`
34. `20261008250200_d5o_connected_service_projection.sql`
35. `20261008250300_d5o_connected_service_draft_rebase.sql`
36. `20261009094046_d5o_connected_service_basis.sql`
37. `20261009094248_d5o_connected_service_basis_projection.sql`
38. `20261009095342_d5o_connected_service_package.sql`
39. `20261009095658_d5o_connected_design_source_adapter.sql`
40. `20261009101200_d5o_connected_service_field_source.sql`
41. `20261009102800_d5o_connected_worker_schedule_read.sql`
42. `20261009104500_d5o_connected_service_return.sql`
43. `20261009110500_d5o_connected_service_pricing.sql`
44. `20261009112000_d5o_connected_partial_service_source.sql`
45. `20261009123000_d5o_customer_decision_evidence.sql`
46. `20261009124000_d5o_empty_package_draft_compatibility.sql`
47. `20261009125000_d5o_pursuit_correction_after_source_change.sql`
48. `20261009181045_d5o_post_acceptance_scope_integrity.sql`
49. `20261009214103_d5o_connected_workforce.sql`
50. `20261009220510_d5o_connected_field_changes.sql`
51. `20261009221159_d5o_connected_job_finance.sql`
52. `20261009232739_d5o_connected_design_field_change.sql`
53. `20261009234405_d5o_current_release_field_start.sql`

A clean disposable Supabase instance replayed the first 59 hosted candidate files in filename order after repairing one invalid encoding byte in `20261009112000_d5o_connected_partial_service_source.sql`. The scope-integrity migration completed the earlier 60-file candidate. Five additional workforce, field-change and Finance migrations now make 65 hosted candidate files and 53 outstanding relative to the prior 12-file shared read-only mapping. A fresh disposable local database replayed the current candidate sequence; shared-project definitions and migration history must be rechecked at cutover. This establishes disposable candidate replay, not shared-project compatibility or authorization to apply migrations. The deployment cutover must compare names, normalized SQL, policy definitions and migration history again immediately before any shared write.
