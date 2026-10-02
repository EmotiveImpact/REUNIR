-- REUNIR alpha 01. Generated from reviewed, fixed schema descriptors.
-- Real relational tables; JSONB is only for arrays and event metadata.
-- Apply through the migration runner, never automatically on API startup.


CREATE TABLE organisations (
 id text PRIMARY KEY, slug text NOT NULL UNIQUE CHECK(slug ~ '^[a-z0-9][a-z0-9-]{0,99}$'),
 name text NOT NULL, tagline text NOT NULL, accent text NOT NULL CHECK(accent IN ('violet','mint','blue','amber')),
 created_at timestamptz NOT NULL, revision integer NOT NULL DEFAULT 0 CHECK(revision>=0)
);

CREATE TABLE members (
 id text NOT NULL,
 organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL,
 user_id text NOT NULL,
 name text NOT NULL,
 headline text NOT NULL,
 bio text NOT NULL,
 skills jsonb NOT NULL,
 colour text NOT NULL,
 avatar text NOT NULL,
 role text NOT NULL,
 status text NOT NULL,
 PRIMARY KEY (organization_id,id),
 UNIQUE (organization_id,user_id),
 CHECK (role IN ('owner','admin','moderator','member')),
 CHECK (status IN ('active','suspended','left'))
);

CREATE INDEX members_tenant_time_idx ON members (organization_id,created_at DESC);

CREATE TABLE spaces (
 id text NOT NULL,
 organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL,
 name text NOT NULL,
 slug text NOT NULL,
 description text NOT NULL,
 colour text NOT NULL,
 kind text NOT NULL,
 visibility text NOT NULL,
 PRIMARY KEY (organization_id,id),
 UNIQUE (organization_id,slug),
 CHECK (visibility IN ('members','private')),
 CHECK (kind IN ('discussion','learning','project'))
);

CREATE INDEX spaces_tenant_time_idx ON spaces (organization_id,created_at DESC);

CREATE TABLE space_members (
 id text NOT NULL,
 organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL,
 space_id text NOT NULL,
 user_id text NOT NULL,
 PRIMARY KEY (organization_id,id),
 UNIQUE (organization_id,space_id,user_id),
 FOREIGN KEY (organization_id,space_id) REFERENCES spaces(organization_id,id),
 FOREIGN KEY (organization_id,user_id) REFERENCES members(organization_id,user_id)
);

CREATE INDEX space_members_tenant_time_idx ON space_members (organization_id,created_at DESC);

CREATE INDEX space_members_space_id_idx ON space_members (organization_id,space_id);

CREATE INDEX space_members_user_id_idx ON space_members (organization_id,user_id);

CREATE TABLE posts (
 id text NOT NULL,
 organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL,
 space_id text NOT NULL,
 author_id text NOT NULL,
 kind text NOT NULL,
 title text NOT NULL,
 body text NOT NULL,
 pinned boolean NOT NULL,
 hidden boolean NOT NULL,
 cover text NOT NULL,
 PRIMARY KEY (organization_id,id),
 FOREIGN KEY (organization_id,space_id) REFERENCES spaces(organization_id,id),
 FOREIGN KEY (organization_id,author_id) REFERENCES members(organization_id,user_id),
 CHECK (kind IN ('update','question','resource','project'))
);

CREATE INDEX posts_tenant_time_idx ON posts (organization_id,created_at DESC);

CREATE INDEX posts_space_id_idx ON posts (organization_id,space_id);

CREATE INDEX posts_author_id_idx ON posts (organization_id,author_id);

CREATE TABLE comments (
 id text NOT NULL,
 organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL,
 post_id text NOT NULL,
 author_id text NOT NULL,
 body text NOT NULL,
 PRIMARY KEY (organization_id,id),
 FOREIGN KEY (organization_id,post_id) REFERENCES posts(organization_id,id),
 FOREIGN KEY (organization_id,author_id) REFERENCES members(organization_id,user_id)
);

CREATE INDEX comments_tenant_time_idx ON comments (organization_id,created_at DESC);

CREATE INDEX comments_post_id_idx ON comments (organization_id,post_id);

CREATE INDEX comments_author_id_idx ON comments (organization_id,author_id);

CREATE TABLE reactions (
 id text NOT NULL,
 organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL,
 post_id text NOT NULL,
 user_id text NOT NULL,
 PRIMARY KEY (organization_id,id),
 UNIQUE (organization_id,post_id,user_id),
 FOREIGN KEY (organization_id,post_id) REFERENCES posts(organization_id,id),
 FOREIGN KEY (organization_id,user_id) REFERENCES members(organization_id,user_id)
);

CREATE INDEX reactions_tenant_time_idx ON reactions (organization_id,created_at DESC);

CREATE INDEX reactions_post_id_idx ON reactions (organization_id,post_id);

CREATE INDEX reactions_user_id_idx ON reactions (organization_id,user_id);

CREATE TABLE bookmarks (
 id text NOT NULL,
 organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL,
 post_id text NOT NULL,
 user_id text NOT NULL,
 PRIMARY KEY (organization_id,id),
 UNIQUE (organization_id,post_id,user_id),
 FOREIGN KEY (organization_id,post_id) REFERENCES posts(organization_id,id),
 FOREIGN KEY (organization_id,user_id) REFERENCES members(organization_id,user_id)
);

CREATE INDEX bookmarks_tenant_time_idx ON bookmarks (organization_id,created_at DESC);

CREATE INDEX bookmarks_post_id_idx ON bookmarks (organization_id,post_id);

CREATE INDEX bookmarks_user_id_idx ON bookmarks (organization_id,user_id);

CREATE TABLE tracks (
 id text NOT NULL,
 organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL,
 space_id text,
 title text NOT NULL,
 summary text NOT NULL,
 description text NOT NULL,
 category text NOT NULL,
 level text NOT NULL,
 colour text NOT NULL,
 cover text NOT NULL,
 author_id text NOT NULL,
 published boolean NOT NULL,
 PRIMARY KEY (organization_id,id),
 FOREIGN KEY (organization_id,space_id) REFERENCES spaces(organization_id,id),
 FOREIGN KEY (organization_id,author_id) REFERENCES members(organization_id,user_id)
);

CREATE INDEX tracks_tenant_time_idx ON tracks (organization_id,created_at DESC);

CREATE INDEX tracks_space_id_idx ON tracks (organization_id,space_id);

CREATE INDEX tracks_author_id_idx ON tracks (organization_id,author_id);

CREATE TABLE lessons (
 id text NOT NULL,
 organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL,
 track_id text NOT NULL,
 title text NOT NULL,
 summary text NOT NULL,
 body text NOT NULL,
 position integer NOT NULL,
 minutes integer NOT NULL,
 resource_url text NOT NULL,
 published boolean NOT NULL,
 PRIMARY KEY (organization_id,id),
 UNIQUE (organization_id,track_id,position),
 UNIQUE (organization_id,track_id,id),
 FOREIGN KEY (organization_id,track_id) REFERENCES tracks(organization_id,id),
 CHECK (position > 0 AND minutes > 0 AND minutes <= 240)
);

CREATE INDEX lessons_tenant_time_idx ON lessons (organization_id,created_at DESC);

CREATE INDEX lessons_track_id_idx ON lessons (organization_id,track_id);

CREATE TABLE enrolments (
 id text NOT NULL,
 organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL,
 track_id text NOT NULL,
 user_id text NOT NULL,
 PRIMARY KEY (organization_id,id),
 UNIQUE (organization_id,track_id,user_id),
 FOREIGN KEY (organization_id,track_id) REFERENCES tracks(organization_id,id),
 FOREIGN KEY (organization_id,user_id) REFERENCES members(organization_id,user_id)
);

CREATE INDEX enrolments_tenant_time_idx ON enrolments (organization_id,created_at DESC);

CREATE INDEX enrolments_track_id_idx ON enrolments (organization_id,track_id);

CREATE INDEX enrolments_user_id_idx ON enrolments (organization_id,user_id);

CREATE TABLE completions (
 id text NOT NULL,
 organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL,
 track_id text NOT NULL,
 lesson_id text NOT NULL,
 user_id text NOT NULL,
 PRIMARY KEY (organization_id,id),
 UNIQUE (organization_id,lesson_id,user_id),
 FOREIGN KEY (organization_id,track_id) REFERENCES tracks(organization_id,id),
 FOREIGN KEY (organization_id,lesson_id) REFERENCES lessons(organization_id,id),
 FOREIGN KEY (organization_id,user_id) REFERENCES members(organization_id,user_id),
 FOREIGN KEY (organization_id, track_id, lesson_id) REFERENCES lessons(organization_id, track_id, id)
);

CREATE INDEX completions_tenant_time_idx ON completions (organization_id,created_at DESC);

CREATE INDEX completions_track_id_idx ON completions (organization_id,track_id);

CREATE INDEX completions_lesson_id_idx ON completions (organization_id,lesson_id);

CREATE INDEX completions_user_id_idx ON completions (organization_id,user_id);

CREATE TABLE missions (
 id text NOT NULL,
 organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL,
 space_id text,
 track_id text,
 title text NOT NULL,
 brief text NOT NULL,
 criteria jsonb NOT NULL,
 category text NOT NULL,
 points integer NOT NULL,
 due_at timestamptz NOT NULL,
 difficulty text NOT NULL,
 PRIMARY KEY (organization_id,id),
 FOREIGN KEY (organization_id,space_id) REFERENCES spaces(organization_id,id),
 FOREIGN KEY (organization_id,track_id) REFERENCES tracks(organization_id,id),
 CHECK (points >= 0 AND points <= 500)
);

CREATE INDEX missions_tenant_time_idx ON missions (organization_id,created_at DESC);

CREATE INDEX missions_space_id_idx ON missions (organization_id,space_id);

CREATE INDEX missions_track_id_idx ON missions (organization_id,track_id);

CREATE TABLE submissions (
 id text NOT NULL,
 organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL,
 mission_id text NOT NULL,
 author_id text NOT NULL,
 body text NOT NULL,
 url text NOT NULL,
 status text NOT NULL,
 feedback text NOT NULL,
 reviewer_id text,
 updated_at timestamptz NOT NULL,
 PRIMARY KEY (organization_id,id),
 UNIQUE (organization_id,mission_id,author_id),
 FOREIGN KEY (organization_id,mission_id) REFERENCES missions(organization_id,id),
 FOREIGN KEY (organization_id,author_id) REFERENCES members(organization_id,user_id),
 FOREIGN KEY (organization_id,reviewer_id) REFERENCES members(organization_id,user_id),
 CHECK (status IN ('pending','approved','changes_requested'))
);

CREATE INDEX submissions_tenant_time_idx ON submissions (organization_id,created_at DESC);

CREATE INDEX submissions_mission_id_idx ON submissions (organization_id,mission_id);

CREATE INDEX submissions_author_id_idx ON submissions (organization_id,author_id);

CREATE INDEX submissions_reviewer_id_idx ON submissions (organization_id,reviewer_id);

CREATE TABLE projects (
 id text NOT NULL,
 organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL,
 space_id text,
 title text NOT NULL,
 tagline text NOT NULL,
 summary text NOT NULL,
 category text NOT NULL,
 skills jsonb NOT NULL,
 owner_id text NOT NULL,
 status text NOT NULL,
 cover text NOT NULL,
 PRIMARY KEY (organization_id,id),
 FOREIGN KEY (organization_id,space_id) REFERENCES spaces(organization_id,id),
 FOREIGN KEY (organization_id,owner_id) REFERENCES members(organization_id,user_id),
 CHECK (status IN ('idea','building','launched'))
);

CREATE INDEX projects_tenant_time_idx ON projects (organization_id,created_at DESC);

CREATE INDEX projects_space_id_idx ON projects (organization_id,space_id);

CREATE INDEX projects_owner_id_idx ON projects (organization_id,owner_id);

CREATE TABLE project_members (
 id text NOT NULL,
 organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL,
 project_id text NOT NULL,
 user_id text NOT NULL,
 PRIMARY KEY (organization_id,id),
 UNIQUE (organization_id,project_id,user_id),
 FOREIGN KEY (organization_id,project_id) REFERENCES projects(organization_id,id),
 FOREIGN KEY (organization_id,user_id) REFERENCES members(organization_id,user_id)
);

CREATE INDEX project_members_tenant_time_idx ON project_members (organization_id,created_at DESC);

CREATE INDEX project_members_project_id_idx ON project_members (organization_id,project_id);

CREATE INDEX project_members_user_id_idx ON project_members (organization_id,user_id);

CREATE TABLE project_updates (
 id text NOT NULL,
 organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL,
 project_id text NOT NULL,
 author_id text NOT NULL,
 body text NOT NULL,
 PRIMARY KEY (organization_id,id),
 FOREIGN KEY (organization_id,project_id) REFERENCES projects(organization_id,id),
 FOREIGN KEY (organization_id,author_id) REFERENCES members(organization_id,user_id)
);

CREATE INDEX project_updates_tenant_time_idx ON project_updates (organization_id,created_at DESC);

CREATE INDEX project_updates_project_id_idx ON project_updates (organization_id,project_id);

CREATE INDEX project_updates_author_id_idx ON project_updates (organization_id,author_id);

CREATE TABLE events (
 id text NOT NULL,
 organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL,
 space_id text,
 title text NOT NULL,
 summary text NOT NULL,
 starts_at timestamptz NOT NULL,
 duration integer NOT NULL,
 host_id text NOT NULL,
 format text NOT NULL,
 location text NOT NULL,
 meeting_url text NOT NULL,
 PRIMARY KEY (organization_id,id),
 FOREIGN KEY (organization_id,space_id) REFERENCES spaces(organization_id,id),
 FOREIGN KEY (organization_id,host_id) REFERENCES members(organization_id,user_id),
 CHECK (duration BETWEEN 15 AND 1440),
 CHECK (format IN ('workshop','critique','coworking','social'))
);

CREATE INDEX events_tenant_time_idx ON events (organization_id,created_at DESC);

CREATE INDEX events_space_id_idx ON events (organization_id,space_id);

CREATE INDEX events_host_id_idx ON events (organization_id,host_id);

CREATE TABLE rsvps (
 id text NOT NULL,
 organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL,
 event_id text NOT NULL,
 user_id text NOT NULL,
 PRIMARY KEY (organization_id,id),
 UNIQUE (organization_id,event_id,user_id),
 FOREIGN KEY (organization_id,event_id) REFERENCES events(organization_id,id),
 FOREIGN KEY (organization_id,user_id) REFERENCES members(organization_id,user_id)
);

CREATE INDEX rsvps_tenant_time_idx ON rsvps (organization_id,created_at DESC);

CREATE INDEX rsvps_event_id_idx ON rsvps (organization_id,event_id);

CREATE INDEX rsvps_user_id_idx ON rsvps (organization_id,user_id);

CREATE TABLE notifications (
 id text NOT NULL,
 organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL,
 user_id text NOT NULL,
 title text NOT NULL,
 body text NOT NULL,
 href text NOT NULL,
 read_at timestamptz,
 PRIMARY KEY (organization_id,id),
 FOREIGN KEY (organization_id,user_id) REFERENCES members(organization_id,user_id)
);

CREATE INDEX notifications_tenant_time_idx ON notifications (organization_id,created_at DESC);

CREATE INDEX notifications_user_id_idx ON notifications (organization_id,user_id);

CREATE TABLE reports (
 id text NOT NULL,
 organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL,
 post_id text NOT NULL,
 user_id text NOT NULL,
 reason text NOT NULL,
 status text NOT NULL,
 PRIMARY KEY (organization_id,id),
 FOREIGN KEY (organization_id,post_id) REFERENCES posts(organization_id,id),
 FOREIGN KEY (organization_id,user_id) REFERENCES members(organization_id,user_id),
 CHECK (status IN ('open','resolved'))
);

CREATE INDEX reports_tenant_time_idx ON reports (organization_id,created_at DESC);

CREATE INDEX reports_post_id_idx ON reports (organization_id,post_id);

CREATE INDEX reports_user_id_idx ON reports (organization_id,user_id);

CREATE TABLE reputation (
 id text NOT NULL,
 organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL,
 user_id text NOT NULL,
 dimension text NOT NULL,
 points integer NOT NULL,
 source_id text NOT NULL,
 description text NOT NULL,
 PRIMARY KEY (organization_id,id),
 UNIQUE (organization_id,user_id,source_id),
 FOREIGN KEY (organization_id,user_id) REFERENCES members(organization_id,user_id),
 CHECK (dimension IN ('learning','building','contribution')),
 CHECK (points >= 0)
);

CREATE INDEX reputation_tenant_time_idx ON reputation (organization_id,created_at DESC);

CREATE INDEX reputation_user_id_idx ON reputation (organization_id,user_id);

CREATE TABLE audit (
 id text NOT NULL,
 organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL,
 actor_id text NOT NULL,
 action text NOT NULL,
 object_id text NOT NULL,
 metadata jsonb NOT NULL,
 PRIMARY KEY (organization_id,id),
 FOREIGN KEY (organization_id,actor_id) REFERENCES members(organization_id,user_id)
);

CREATE INDEX audit_tenant_time_idx ON audit (organization_id,created_at DESC);

CREATE INDEX audit_actor_id_idx ON audit (organization_id,actor_id);

CREATE TABLE outbox (
 id text NOT NULL,
 organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL,
 actor_id text NOT NULL,
 type text NOT NULL,
 object_id text NOT NULL,
 payload jsonb NOT NULL,
 PRIMARY KEY (organization_id,id),
 FOREIGN KEY (organization_id,actor_id) REFERENCES members(organization_id,user_id)
);

CREATE INDEX outbox_tenant_time_idx ON outbox (organization_id,created_at DESC);

CREATE INDEX outbox_actor_id_idx ON outbox (organization_id,actor_id);

CREATE TABLE command_receipts (
 organization_id text NOT NULL REFERENCES organisations(id), user_id text NOT NULL, request_key text NOT NULL,
 body_hash text NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,user_id,request_key), FOREIGN KEY(organization_id,user_id) REFERENCES members(organization_id,user_id)
);
CREATE TABLE request_limits (key text PRIMARY KEY, count integer NOT NULL, window_start timestamptz NOT NULL);
CREATE TABLE upload_intents (
 organization_id text NOT NULL REFERENCES organisations(id), id text NOT NULL, user_id text NOT NULL,
 object_key text NOT NULL UNIQUE, content_type text NOT NULL, size_bytes integer NOT NULL CHECK(size_bytes>0 AND size_bytes<=10485760),
 original_name text NOT NULL, created_at timestamptz NOT NULL, status text NOT NULL CHECK(status IN ('pending','ready','rejected')),
 PRIMARY KEY(organization_id,id), FOREIGN KEY(organization_id,user_id) REFERENCES members(organization_id,user_id)
);

CREATE TABLE auth_user (id text PRIMARY KEY,name text NOT NULL,email text NOT NULL UNIQUE,email_verified boolean NOT NULL DEFAULT false,image text,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL);
CREATE TABLE auth_session (id text PRIMARY KEY,expires_at timestamptz NOT NULL,token text NOT NULL UNIQUE,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,ip_address text,user_agent text,user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE);
CREATE INDEX auth_session_user_idx ON auth_session(user_id);
CREATE TABLE auth_account (id text PRIMARY KEY,account_id text NOT NULL,provider_id text NOT NULL,user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,access_token text,refresh_token text,id_token text,access_token_expires_at timestamptz,refresh_token_expires_at timestamptz,scope text,password text,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,UNIQUE(provider_id,account_id));
CREATE INDEX auth_account_user_idx ON auth_account(user_id);
CREATE TABLE auth_verification (id text PRIMARY KEY,identifier text NOT NULL,value text NOT NULL,expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL);
CREATE INDEX auth_verification_identifier_idx ON auth_verification(identifier);
CREATE TABLE auth_rate_limit (id text PRIMARY KEY,key text NOT NULL UNIQUE,count integer NOT NULL,last_request bigint NOT NULL);

ALTER TABLE members ENABLE ROW LEVEL SECURITY;

ALTER TABLE members FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON members USING (organization_id = nullif(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),''));

ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;

ALTER TABLE spaces FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON spaces USING (organization_id = nullif(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),''));

ALTER TABLE space_members ENABLE ROW LEVEL SECURITY;

ALTER TABLE space_members FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON space_members USING (organization_id = nullif(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),''));

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

ALTER TABLE posts FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON posts USING (organization_id = nullif(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),''));

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

ALTER TABLE comments FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON comments USING (organization_id = nullif(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),''));

ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

ALTER TABLE reactions FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON reactions USING (organization_id = nullif(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),''));

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

ALTER TABLE bookmarks FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON bookmarks USING (organization_id = nullif(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),''));

ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;

ALTER TABLE tracks FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON tracks USING (organization_id = nullif(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),''));

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

ALTER TABLE lessons FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON lessons USING (organization_id = nullif(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),''));

ALTER TABLE enrolments ENABLE ROW LEVEL SECURITY;

ALTER TABLE enrolments FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON enrolments USING (organization_id = nullif(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),''));

ALTER TABLE completions ENABLE ROW LEVEL SECURITY;

ALTER TABLE completions FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON completions USING (organization_id = nullif(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),''));

ALTER TABLE missions ENABLE ROW LEVEL SECURITY;

ALTER TABLE missions FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON missions USING (organization_id = nullif(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),''));

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

ALTER TABLE submissions FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON submissions USING (organization_id = nullif(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),''));

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

ALTER TABLE projects FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON projects USING (organization_id = nullif(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),''));

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

ALTER TABLE project_members FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON project_members USING (organization_id = nullif(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),''));

ALTER TABLE project_updates ENABLE ROW LEVEL SECURITY;

ALTER TABLE project_updates FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON project_updates USING (organization_id = nullif(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),''));

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

ALTER TABLE events FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON events USING (organization_id = nullif(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),''));

ALTER TABLE rsvps ENABLE ROW LEVEL SECURITY;

ALTER TABLE rsvps FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON rsvps USING (organization_id = nullif(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),''));

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

ALTER TABLE notifications FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON notifications USING (organization_id = nullif(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),''));

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

ALTER TABLE reports FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON reports USING (organization_id = nullif(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),''));

ALTER TABLE reputation ENABLE ROW LEVEL SECURITY;

ALTER TABLE reputation FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON reputation USING (organization_id = nullif(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),''));

ALTER TABLE audit ENABLE ROW LEVEL SECURITY;

ALTER TABLE audit FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON audit USING (organization_id = nullif(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),''));

ALTER TABLE outbox ENABLE ROW LEVEL SECURITY;

ALTER TABLE outbox FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON outbox USING (organization_id = nullif(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),''));

ALTER TABLE command_receipts ENABLE ROW LEVEL SECURITY;

ALTER TABLE command_receipts FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON command_receipts USING (organization_id = nullif(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),''));

ALTER TABLE upload_intents ENABLE ROW LEVEL SECURITY;

ALTER TABLE upload_intents FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON upload_intents USING (organization_id = nullif(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),''));

CREATE POLICY own_memberships ON members FOR SELECT USING (user_id = nullif(current_setting('app.user_id',true),'') AND status='active');

ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;

ALTER TABLE organisations FORCE ROW LEVEL SECURITY;

CREATE POLICY organisation_scope ON organisations USING (id = nullif(current_setting('app.organization_id',true),'')) WITH CHECK (id = nullif(current_setting('app.organization_id',true),''));

CREATE POLICY membership_discovery ON organisations FOR SELECT USING (EXISTS(SELECT 1 FROM members m WHERE m.organization_id=organisations.id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active'));

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
