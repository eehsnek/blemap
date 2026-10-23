1. add the admin/security-related schema
    ✅ 1.1 the current roles are: user, guest
    ✅ 1.2 Admin authentication/authorization
    🟨 1.3 submission review state
        ✅ 1.3.1 Database schema
        ✅ 1.3.2 Submission pipeline
        🟨 1.3.3 Admin review workflow
            🟨 Build admin confirm/reject path
                ⏹️ Inspect, verify admin authorization
                ⏹️ Review queue, Create a pending-review endpoint
                ⏹️ Build a separate admin page
                ⏹️ Implement confirmation
                ⏹️ Implement rejection
                ⏹️ Test the full path
    1.4 case moderation
        add moderation_status, moderated_by, moderated_at, moderation_reason
    1.5 `content_reports` in case the users/admin are doing problematic content
        id, reporter_id, target_type, target_id, reason, status, reviewer_id, decision, created_at, resolved_at
    1.6 `admin_actions` as the audit trail
        id, actor_id, action, target_type, target_id, before_data, after_data, reason, created_at
2. ??