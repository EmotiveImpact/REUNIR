-- Additive: an instructor may start a track. The application creates it unpublished, with the instructor as its author,
-- and records their whole-track instructor grant in their own name. This policy admits that one grant and nothing else:
-- for the acting person, on an unpublished track they authored that has no grant yet, while they are an active
-- instructor of another whole track. Administrators publish the track as before. 0001 to 0034 are unchanged.
CREATE POLICY instructor_own_track ON track_instructors FOR INSERT WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'')
 AND user_id=nullif(current_setting('app.user_id',true),'') AND granted_by=user_id
 AND role='instructor' AND lesson_ids IS NULL
 AND EXISTS(SELECT 1 FROM tracks t WHERE t.organization_id=track_instructors.organization_id AND t.id=track_instructors.track_id
  AND t.author_id=track_instructors.user_id AND NOT t.published)
 AND NOT EXISTS(SELECT 1 FROM track_instructors o WHERE o.organization_id=track_instructors.organization_id AND o.track_id=track_instructors.track_id)
 AND EXISTS(SELECT 1 FROM track_instructors g JOIN members m ON m.organization_id=g.organization_id AND m.user_id=g.user_id
  WHERE g.organization_id=track_instructors.organization_id AND g.user_id=track_instructors.user_id AND g.track_id<>track_instructors.track_id
  AND g.role='instructor' AND g.lesson_ids IS NULL AND m.status='active')
);
