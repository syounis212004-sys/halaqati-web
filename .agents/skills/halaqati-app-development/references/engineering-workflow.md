# Engineering Workflow

## Feature Workflow

1. Inspect existing implementation and data model.
2. Write short spec / acceptance criteria.
3. Identify touched modules and regression risks.
4. Implement smallest vertical slice.
5. Add/update tests.
6. Run build and relevant UI/data checks.
7. Review security and performance impact.
8. Verify final user flow.

## Bug Workflow

1. Reproduce exact bug.
2. Capture evidence: errors, logs, DB state, inputs.
3. Trace data/control flow.
4. Find a similar working path.
5. State one root-cause hypothesis.
6. Test hypothesis minimally.
7. Add failing regression test if practical.
8. Apply one root-cause fix.
9. Verify original scenario.
10. Verify adjacent scenarios.

If three reasonable fixes fail, stop stacking patches and re-evaluate architecture/assumptions.

## Database Workflow

1. Inspect schema and RLS.
2. Identify old and new data shape.
3. Design migration.
4. Validate migration against representative existing rows.
5. Update queries/types.
6. Test permissions and aggregates.
7. Document one-time production action if any.

## UI Workflow

1. Inspect existing component/style system.
2. Confirm UX objective and high-frequency path.
3. Design RTL/mobile first.
4. Implement with reusable components.
5. Test long Arabic names/content.
6. Test loading/error/empty states.
7. Test narrow phone + tablet + web.
8. Check keyboard/focus behavior on web where relevant.

## Performance Workflow

Measure before optimizing:

- request count and query duration
- payload size
- render count / state churn
- expensive computation
- large list rendering
- image loading
- initial bundle cost

Then change one bottleneck and compare before/after.
