# Known Regression Risks

This is a risk register based on previously encountered Halaqati problem classes. It is not a claim that every issue is currently present.

## Sync / Aggregates

Risk:

- Session/recitation records save, but total memorized/reviewed pages shown on another device do not update.

Regression check:

- Save activity on device/session A.
- Confirm DB write.
- Open/refresh on independent session B.
- Confirm totals and underlying entries match.

## Smart Plan Assignment Drift

Risk:

- UI displays a fabricated/duplicated ayah assignment rather than the plan's actual next segment.

Regression check:

- Compare UI assignment with persisted active plan assignment for multiple students.

## Plan Counter Drift

Risk:

- Target and completed counters display 0 or inconsistent values despite completed activity.

Regression check:

- Validate numerator/denominator against source records and across all screens that show the same metric.

## Long Lists / Oversized Rows

Risk:

- Quick-action student list becomes too tall, requiring excessive scrolling.

Regression check:

- Test realistic number of students on common Android phone height.

## Missing Icon / Broken Visual State

Risk:

- action icon fails to render, leaving unclear UI.

Regression check:

- verify icon asset/import and fallback; inspect production build, not dev only.

## Title / Layout Overlap

Risk:

- Arabic page titles or header actions overlap at narrow widths.

Regression check:

- narrow phone viewport + long Arabic labels.

## Workflow / Deployment Drift

Risk:

- GitHub Actions produces the wrong artifact or workflow disappears/changes expected build path.

Regression check:

- inspect workflow triggers and artifact paths;
- verify version in generated web/app artifact;
- do not assume a successful Actions job means the correct artifact was published.

## Track Duplication

Risk:

- a feature creates additional logical tracks rather than using the two existing ones.

Regression check:

- inspect database enum/values and all report filters.
