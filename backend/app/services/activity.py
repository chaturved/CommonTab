from __future__ import annotations

from uuid import UUID

from fastapi import Depends

from app.domain.rules import format_utc
from app.repositories.activity import ActivityRepository
from app.repositories.groups import GroupRepository

MAX_PAGE = 500


class ActivityService:
    def __init__(self, activity: ActivityRepository = Depends(ActivityRepository),
                 groups: GroupRepository = Depends(GroupRepository)):
        self.activity = activity
        self.groups = groups

    def feed(self, user_id: str, since: int, limit: int) -> dict:
        uid = UUID(user_id)
        rows = self.activity.since(self.groups.group_ids_for_user(uid), since, min(limit, MAX_PAGE))
        events = [{'seq': row.seq, 'groupID': str(row.group_id), 'actorID': str(row.actor_id) if row.actor_id else None,
                   'kind': row.kind, 'subjectID': str(row.subject_id) if row.subject_id else None, 'data': row.data,
                   'at': format_utc(row.created_at)} for row in rows]
        return {'events': events, 'next': events[-1]['seq'] if events else since}
