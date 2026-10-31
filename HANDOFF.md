# InCIT handoff

## Done

- User-requested UI Step 1: moved the signed-in user name, role, and Sign out
  button from a fixed overlay into the top bar's single flex row. The row has
  gaps, shrinking text, and mobile-safe spacing so it cannot overlap the event
  label or search control.

## Next

- User-requested UI Step 2: make the AI booking chat friendly for every
  logged-in role. Only creating the final booking should check booking roles.

## Known issues

- Earlier Step 9a LLM-parser changes are still uncommitted alongside this UI
  fix. Review all files in `git status` together before committing.
