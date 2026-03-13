# Backup Runbook

## Automated backups

A GitHub Actions workflow (`.github/workflows/backup.yml`) triggers a Supabase database backup daily at 03:00 UTC. It can also be triggered manually from the Actions tab.

### Required secrets

| Secret                  | Description                                                      |
| ----------------------- | ---------------------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN` | Personal access token from supabase.com/dashboard/account/tokens |
| `SUPABASE_PROJECT_REF`  | Project reference ID (found in project settings)                 |

### Monitoring

- Check the **Actions** tab for the "Daily Supabase backup" workflow.
- 422 responses are normal — they mean a backup was already completed recently.
- Set up a GitHub Actions failure notification (email or Slack) to catch silent failures.

## Manual backup

```bash
curl -X POST \
  "https://api.supabase.com/v1/projects/<PROJECT_REF>/database/backups" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json"
```

## Listing backups

```bash
curl "https://api.supabase.com/v1/projects/<PROJECT_REF>/database/backups" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

## Restore procedure

1. **Go to** Supabase Dashboard → Project → Database → Backups.
2. **Select** the backup to restore from.
3. **Click "Restore"** — this replaces the current database with the backup.
4. **Verify** the restore by checking a known recent record.

### Point-in-time recovery (PITR)

If your Supabase plan includes PITR (Pro plan and above):

1. Dashboard → Database → Backups → Point-in-time Recovery.
2. Select the exact timestamp to restore to.
3. Confirm — the database will be rolled back to that point.

### Post-restore checklist

- [ ] Verify auth.users table has expected row count
- [ ] Verify profiles table matches
- [ ] Check a recent project exists and has canvases
- [ ] Confirm Stripe subscription records are consistent
- [ ] Run `npm run test:e2e:smoke` against the restored database
- [ ] Notify team that restore is complete

## Storage backups

Supabase Storage (project files, avatars) is NOT covered by database backups. For storage:

- Files are stored in Supabase Storage buckets (`projects`, `uploads`).
- Consider periodic `supabase storage cp` to an external backup location.
- Critical: user-uploaded files are referenced by DB records — restoring the DB without storage may leave broken references.
