import type { Workspace } from '../../contracts/src/index';
export type CollectionKey = Exclude<keyof Workspace, 'organisation' | 'revision' | 'summary'>;
export interface TableSpec {
    key: CollectionKey;
    table: string;
    /** Fixed SQL row filter for a collection that shares its table with records outside the workspace. */
    where?: string;
    /** When set, existing rows are append-only except for these properties, which a targeted UPDATE changes. */
    mutable?: string[];
    fields: {
        property: string;
        column: string;
        type: string;
    }[];
}
export const tables: TableSpec[] = [
    {
        "key": "members",
        "table": "members",
        "fields": [
            {
                "property": "id",
                "column": "id",
                "type": "text"
            },
            {
                "property": "organizationId",
                "column": "organization_id",
                "type": "text"
            },
            {
                "property": "createdAt",
                "column": "created_at",
                "type": "timestamptz"
            },
            {
                "property": "userId",
                "column": "user_id",
                "type": "text"
            },
            {
                "property": "name",
                "column": "name",
                "type": "text"
            },
            {
                "property": "headline",
                "column": "headline",
                "type": "text"
            },
            {
                "property": "bio",
                "column": "bio",
                "type": "text"
            },
            {
                "property": "skills",
                "column": "skills",
                "type": "jsonb"
            },
            {
                "property": "colour",
                "column": "colour",
                "type": "text"
            },
            {
                "property": "avatar",
                "column": "avatar",
                "type": "text"
            },
            {
                "property": "role",
                "column": "role",
                "type": "text"
            },
            {
                "property": "status",
                "column": "status",
                "type": "text"
            }
        ]
    },
    {
        "key": "spaces",
        "table": "spaces",
        "fields": [
            {
                "property": "id",
                "column": "id",
                "type": "text"
            },
            {
                "property": "organizationId",
                "column": "organization_id",
                "type": "text"
            },
            {
                "property": "createdAt",
                "column": "created_at",
                "type": "timestamptz"
            },
            {
                "property": "name",
                "column": "name",
                "type": "text"
            },
            {
                "property": "slug",
                "column": "slug",
                "type": "text"
            },
            {
                "property": "description",
                "column": "description",
                "type": "text"
            },
            {
                "property": "colour",
                "column": "colour",
                "type": "text"
            },
            {
                "property": "kind",
                "column": "kind",
                "type": "text"
            },
            {
                "property": "visibility",
                "column": "visibility",
                "type": "text"
            }
        ]
    },
    {
        "key": "spaceMembers",
        "table": "space_members",
        "fields": [
            {
                "property": "id",
                "column": "id",
                "type": "text"
            },
            {
                "property": "organizationId",
                "column": "organization_id",
                "type": "text"
            },
            {
                "property": "createdAt",
                "column": "created_at",
                "type": "timestamptz"
            },
            {
                "property": "spaceId",
                "column": "space_id",
                "type": "text"
            },
            {
                "property": "userId",
                "column": "user_id",
                "type": "text"
            }
        ]
    },
    {
        "key": "posts",
        "table": "posts",
        "fields": [
            {
                "property": "id",
                "column": "id",
                "type": "text"
            },
            {
                "property": "organizationId",
                "column": "organization_id",
                "type": "text"
            },
            {
                "property": "createdAt",
                "column": "created_at",
                "type": "timestamptz"
            },
            {
                "property": "spaceId",
                "column": "space_id",
                "type": "text"
            },
            {
                "property": "authorId",
                "column": "author_id",
                "type": "text"
            },
            {
                "property": "kind",
                "column": "kind",
                "type": "text"
            },
            {
                "property": "title",
                "column": "title",
                "type": "text"
            },
            {
                "property": "body",
                "column": "body",
                "type": "text"
            },
            {
                "property": "pinned",
                "column": "pinned",
                "type": "boolean"
            },
            {
                "property": "hidden",
                "column": "hidden",
                "type": "boolean"
            },
            {
                "property": "cover",
                "column": "cover",
                "type": "text"
            }
        ]
    },
    {
        "key": "comments",
        "table": "comments",
        "fields": [
            {
                "property": "id",
                "column": "id",
                "type": "text"
            },
            {
                "property": "organizationId",
                "column": "organization_id",
                "type": "text"
            },
            {
                "property": "createdAt",
                "column": "created_at",
                "type": "timestamptz"
            },
            {
                "property": "postId",
                "column": "post_id",
                "type": "text"
            },
            {
                "property": "authorId",
                "column": "author_id",
                "type": "text"
            },
            {
                "property": "body",
                "column": "body",
                "type": "text"
            }
        ]
    },
    {
        "key": "reactions",
        "table": "reactions",
        "fields": [
            {
                "property": "id",
                "column": "id",
                "type": "text"
            },
            {
                "property": "organizationId",
                "column": "organization_id",
                "type": "text"
            },
            {
                "property": "createdAt",
                "column": "created_at",
                "type": "timestamptz"
            },
            {
                "property": "postId",
                "column": "post_id",
                "type": "text"
            },
            {
                "property": "userId",
                "column": "user_id",
                "type": "text"
            }
        ]
    },
    {
        "key": "bookmarks",
        "table": "bookmarks",
        "fields": [
            {
                "property": "id",
                "column": "id",
                "type": "text"
            },
            {
                "property": "organizationId",
                "column": "organization_id",
                "type": "text"
            },
            {
                "property": "createdAt",
                "column": "created_at",
                "type": "timestamptz"
            },
            {
                "property": "postId",
                "column": "post_id",
                "type": "text"
            },
            {
                "property": "userId",
                "column": "user_id",
                "type": "text"
            }
        ]
    },
    {
        "key": "tracks",
        "table": "tracks",
        "fields": [
            {
                "property": "id",
                "column": "id",
                "type": "text"
            },
            {
                "property": "organizationId",
                "column": "organization_id",
                "type": "text"
            },
            {
                "property": "createdAt",
                "column": "created_at",
                "type": "timestamptz"
            },
            {
                "property": "spaceId",
                "column": "space_id",
                "type": "text"
            },
            {
                "property": "title",
                "column": "title",
                "type": "text"
            },
            {
                "property": "summary",
                "column": "summary",
                "type": "text"
            },
            {
                "property": "description",
                "column": "description",
                "type": "text"
            },
            {
                "property": "category",
                "column": "category",
                "type": "text"
            },
            {
                "property": "level",
                "column": "level",
                "type": "text"
            },
            {
                "property": "colour",
                "column": "colour",
                "type": "text"
            },
            {
                "property": "cover",
                "column": "cover",
                "type": "text"
            },
            {
                "property": "authorId",
                "column": "author_id",
                "type": "text"
            },
            {
                "property": "published",
                "column": "published",
                "type": "boolean"
            }
        ]
    },
    {
        "key": "lessons",
        "table": "lessons",
        "fields": [
            {
                "property": "id",
                "column": "id",
                "type": "text"
            },
            {
                "property": "organizationId",
                "column": "organization_id",
                "type": "text"
            },
            {
                "property": "createdAt",
                "column": "created_at",
                "type": "timestamptz"
            },
            {
                "property": "trackId",
                "column": "track_id",
                "type": "text"
            },
            {
                "property": "title",
                "column": "title",
                "type": "text"
            },
            {
                "property": "summary",
                "column": "summary",
                "type": "text"
            },
            {
                "property": "body",
                "column": "body",
                "type": "text"
            },
            {
                "property": "position",
                "column": "position",
                "type": "integer"
            },
            {
                "property": "minutes",
                "column": "minutes",
                "type": "integer"
            },
            {
                "property": "resourceUrl",
                "column": "resource_url",
                "type": "text"
            },
            {
                "property": "published",
                "column": "published",
                "type": "boolean"
            }
        ]
    },
    {
        "key": "enrolments",
        "table": "enrolments",
        "fields": [
            {
                "property": "id",
                "column": "id",
                "type": "text"
            },
            {
                "property": "organizationId",
                "column": "organization_id",
                "type": "text"
            },
            {
                "property": "createdAt",
                "column": "created_at",
                "type": "timestamptz"
            },
            {
                "property": "trackId",
                "column": "track_id",
                "type": "text"
            },
            {
                "property": "userId",
                "column": "user_id",
                "type": "text"
            }
        ]
    },
    {
        "key": "completions",
        "table": "completions",
        "fields": [
            {
                "property": "id",
                "column": "id",
                "type": "text"
            },
            {
                "property": "organizationId",
                "column": "organization_id",
                "type": "text"
            },
            {
                "property": "createdAt",
                "column": "created_at",
                "type": "timestamptz"
            },
            {
                "property": "trackId",
                "column": "track_id",
                "type": "text"
            },
            {
                "property": "lessonId",
                "column": "lesson_id",
                "type": "text"
            },
            {
                "property": "userId",
                "column": "user_id",
                "type": "text"
            }
        ]
    },
    {
        "key": "missions",
        "table": "missions",
        "fields": [
            {
                "property": "id",
                "column": "id",
                "type": "text"
            },
            {
                "property": "organizationId",
                "column": "organization_id",
                "type": "text"
            },
            {
                "property": "createdAt",
                "column": "created_at",
                "type": "timestamptz"
            },
            {
                "property": "spaceId",
                "column": "space_id",
                "type": "text"
            },
            {
                "property": "trackId",
                "column": "track_id",
                "type": "text"
            },
            {
                "property": "title",
                "column": "title",
                "type": "text"
            },
            {
                "property": "brief",
                "column": "brief",
                "type": "text"
            },
            {
                "property": "criteria",
                "column": "criteria",
                "type": "jsonb"
            },
            {
                "property": "category",
                "column": "category",
                "type": "text"
            },
            {
                "property": "points",
                "column": "points",
                "type": "integer"
            },
            {
                "property": "dueAt",
                "column": "due_at",
                "type": "timestamptz"
            },
            {
                "property": "difficulty",
                "column": "difficulty",
                "type": "text"
            }
        ]
    },
    {
        "key": "submissions",
        "table": "submissions",
        "fields": [
            {
                "property": "id",
                "column": "id",
                "type": "text"
            },
            {
                "property": "organizationId",
                "column": "organization_id",
                "type": "text"
            },
            {
                "property": "createdAt",
                "column": "created_at",
                "type": "timestamptz"
            },
            {
                "property": "missionId",
                "column": "mission_id",
                "type": "text"
            },
            {
                "property": "authorId",
                "column": "author_id",
                "type": "text"
            },
            {
                "property": "body",
                "column": "body",
                "type": "text"
            },
            {
                "property": "url",
                "column": "url",
                "type": "text"
            },
            {
                "property": "status",
                "column": "status",
                "type": "text"
            },
            {
                "property": "feedback",
                "column": "feedback",
                "type": "text"
            },
            {
                "property": "reviewerId",
                "column": "reviewer_id",
                "type": "text"
            },
            {
                "property": "updatedAt",
                "column": "updated_at",
                "type": "timestamptz"
            }
        ]
    },
    {
        "key": "projects",
        "table": "projects",
        "fields": [
            {
                "property": "id",
                "column": "id",
                "type": "text"
            },
            {
                "property": "organizationId",
                "column": "organization_id",
                "type": "text"
            },
            {
                "property": "createdAt",
                "column": "created_at",
                "type": "timestamptz"
            },
            {
                "property": "spaceId",
                "column": "space_id",
                "type": "text"
            },
            {
                "property": "title",
                "column": "title",
                "type": "text"
            },
            {
                "property": "tagline",
                "column": "tagline",
                "type": "text"
            },
            {
                "property": "summary",
                "column": "summary",
                "type": "text"
            },
            {
                "property": "category",
                "column": "category",
                "type": "text"
            },
            {
                "property": "skills",
                "column": "skills",
                "type": "jsonb"
            },
            {
                "property": "ownerId",
                "column": "owner_id",
                "type": "text"
            },
            {
                "property": "status",
                "column": "status",
                "type": "text"
            },
            {
                "property": "cover",
                "column": "cover",
                "type": "text"
            }
        ]
    },
    {
        "key": "projectMembers",
        "table": "project_members",
        "fields": [
            {
                "property": "id",
                "column": "id",
                "type": "text"
            },
            {
                "property": "organizationId",
                "column": "organization_id",
                "type": "text"
            },
            {
                "property": "createdAt",
                "column": "created_at",
                "type": "timestamptz"
            },
            {
                "property": "projectId",
                "column": "project_id",
                "type": "text"
            },
            {
                "property": "userId",
                "column": "user_id",
                "type": "text"
            }
        ]
    },
    {
        "key": "projectUpdates",
        "table": "project_updates",
        "fields": [
            {
                "property": "id",
                "column": "id",
                "type": "text"
            },
            {
                "property": "organizationId",
                "column": "organization_id",
                "type": "text"
            },
            {
                "property": "createdAt",
                "column": "created_at",
                "type": "timestamptz"
            },
            {
                "property": "projectId",
                "column": "project_id",
                "type": "text"
            },
            {
                "property": "authorId",
                "column": "author_id",
                "type": "text"
            },
            {
                "property": "body",
                "column": "body",
                "type": "text"
            }
        ]
    },
    {
        "key": "events",
        "table": "events",
        "fields": [
            {
                "property": "id",
                "column": "id",
                "type": "text"
            },
            {
                "property": "organizationId",
                "column": "organization_id",
                "type": "text"
            },
            {
                "property": "createdAt",
                "column": "created_at",
                "type": "timestamptz"
            },
            {
                "property": "spaceId",
                "column": "space_id",
                "type": "text"
            },
            {
                "property": "title",
                "column": "title",
                "type": "text"
            },
            {
                "property": "summary",
                "column": "summary",
                "type": "text"
            },
            {
                "property": "startsAt",
                "column": "starts_at",
                "type": "timestamptz"
            },
            {
                "property": "duration",
                "column": "duration",
                "type": "integer"
            },
            {
                "property": "hostId",
                "column": "host_id",
                "type": "text"
            },
            {
                "property": "format",
                "column": "format",
                "type": "text"
            },
            {
                "property": "location",
                "column": "location",
                "type": "text"
            },
            {
                "property": "meetingUrl",
                "column": "meeting_url",
                "type": "text"
            }
        ]
    },
    {
        "key": "rsvps",
        "table": "rsvps",
        "fields": [
            {
                "property": "id",
                "column": "id",
                "type": "text"
            },
            {
                "property": "organizationId",
                "column": "organization_id",
                "type": "text"
            },
            {
                "property": "createdAt",
                "column": "created_at",
                "type": "timestamptz"
            },
            {
                "property": "eventId",
                "column": "event_id",
                "type": "text"
            },
            {
                "property": "userId",
                "column": "user_id",
                "type": "text"
            }
        ]
    },
    {
        "key": "notifications",
        "table": "notifications",
        "fields": [
            {
                "property": "id",
                "column": "id",
                "type": "text"
            },
            {
                "property": "organizationId",
                "column": "organization_id",
                "type": "text"
            },
            {
                "property": "createdAt",
                "column": "created_at",
                "type": "timestamptz"
            },
            {
                "property": "userId",
                "column": "user_id",
                "type": "text"
            },
            {
                "property": "title",
                "column": "title",
                "type": "text"
            },
            {
                "property": "body",
                "column": "body",
                "type": "text"
            },
            {
                "property": "href",
                "column": "href",
                "type": "text"
            },
            {
                "property": "readAt",
                "column": "read_at",
                "type": "timestamptz"
            }
        ]
    },
    {
        "key": "reports",
        "table": "reports",
        "fields": [
            {
                "property": "id",
                "column": "id",
                "type": "text"
            },
            {
                "property": "organizationId",
                "column": "organization_id",
                "type": "text"
            },
            {
                "property": "createdAt",
                "column": "created_at",
                "type": "timestamptz"
            },
            {
                "property": "postId",
                "column": "post_id",
                "type": "text"
            },
            {
                "property": "userId",
                "column": "user_id",
                "type": "text"
            },
            {
                "property": "reason",
                "column": "reason",
                "type": "text"
            },
            {
                "property": "status",
                "column": "status",
                "type": "text"
            }
        ]
    },
    {
        "key": "reputation",
        "table": "reputation",
        "fields": [
            {
                "property": "id",
                "column": "id",
                "type": "text"
            },
            {
                "property": "organizationId",
                "column": "organization_id",
                "type": "text"
            },
            {
                "property": "createdAt",
                "column": "created_at",
                "type": "timestamptz"
            },
            {
                "property": "userId",
                "column": "user_id",
                "type": "text"
            },
            {
                "property": "dimension",
                "column": "dimension",
                "type": "text"
            },
            {
                "property": "points",
                "column": "points",
                "type": "integer"
            },
            {
                "property": "sourceId",
                "column": "source_id",
                "type": "text"
            },
            {
                "property": "description",
                "column": "description",
                "type": "text"
            }
        ]
    },
    {
        "key": "audit",
        "table": "audit",
        "fields": [
            {
                "property": "id",
                "column": "id",
                "type": "text"
            },
            {
                "property": "organizationId",
                "column": "organization_id",
                "type": "text"
            },
            {
                "property": "createdAt",
                "column": "created_at",
                "type": "timestamptz"
            },
            {
                "property": "actorId",
                "column": "actor_id",
                "type": "text"
            },
            {
                "property": "action",
                "column": "action",
                "type": "text"
            },
            {
                "property": "objectId",
                "column": "object_id",
                "type": "text"
            },
            {
                "property": "metadata",
                "column": "metadata",
                "type": "jsonb"
            }
        ]
    },
    {
        "key": "outbox",
        "table": "outbox",
        "fields": [
            {
                "property": "id",
                "column": "id",
                "type": "text"
            },
            {
                "property": "organizationId",
                "column": "organization_id",
                "type": "text"
            },
            {
                "property": "createdAt",
                "column": "created_at",
                "type": "timestamptz"
            },
            {
                "property": "actorId",
                "column": "actor_id",
                "type": "text"
            },
            {
                "property": "type",
                "column": "type",
                "type": "text"
            },
            {
                "property": "objectId",
                "column": "object_id",
                "type": "text"
            },
            {
                "property": "payload",
                "column": "payload",
                "type": "jsonb"
            }
        ]
    }
];

const purposeTables: TableSpec[] = [
  {
    "key": "purposes",
    "table": "purposes",
    "fields": [
      {
        "property": "id",
        "column": "id",
        "type": "text"
      },
      {
        "property": "organizationId",
        "column": "organization_id",
        "type": "text"
      },
      {
        "property": "createdAt",
        "column": "created_at",
        "type": "timestamptz"
      },
      {
        "property": "kind",
        "column": "kind",
        "type": "text"
      },
      {
        "property": "title",
        "column": "title",
        "type": "text"
      },
      {
        "property": "description",
        "column": "description",
        "type": "text"
      },
      {
        "property": "status",
        "column": "status",
        "type": "text"
      }
    ]
  },
  {
    "key": "paths",
    "table": "paths",
    "fields": [
      {
        "property": "id",
        "column": "id",
        "type": "text"
      },
      {
        "property": "organizationId",
        "column": "organization_id",
        "type": "text"
      },
      {
        "property": "createdAt",
        "column": "created_at",
        "type": "timestamptz"
      },
      {
        "property": "purposeId",
        "column": "purpose_id",
        "type": "text"
      },
      {
        "property": "spaceId",
        "column": "space_id",
        "type": "text"
      },
      {
        "property": "title",
        "column": "title",
        "type": "text"
      },
      {
        "property": "summary",
        "column": "summary",
        "type": "text"
      },
      {
        "property": "status",
        "column": "status",
        "type": "text"
      }
    ]
  },
  {
    "key": "milestones",
    "table": "milestones",
    "fields": [
      {
        "property": "id",
        "column": "id",
        "type": "text"
      },
      {
        "property": "organizationId",
        "column": "organization_id",
        "type": "text"
      },
      {
        "property": "createdAt",
        "column": "created_at",
        "type": "timestamptz"
      },
      {
        "property": "pathId",
        "column": "path_id",
        "type": "text"
      },
      {
        "property": "title",
        "column": "title",
        "type": "text"
      },
      {
        "property": "description",
        "column": "description",
        "type": "text"
      },
      {
        "property": "position",
        "column": "position",
        "type": "integer"
      },
      {
        "property": "lessonId",
        "column": "lesson_id",
        "type": "text"
      },
      {
        "property": "missionId",
        "column": "mission_id",
        "type": "text"
      },
      {
        "property": "projectId",
        "column": "project_id",
        "type": "text"
      }
    ]
  },
  {
    "key": "pathEnrolments",
    "table": "path_enrolments",
    "fields": [
      {
        "property": "id",
        "column": "id",
        "type": "text"
      },
      {
        "property": "organizationId",
        "column": "organization_id",
        "type": "text"
      },
      {
        "property": "createdAt",
        "column": "created_at",
        "type": "timestamptz"
      },
      {
        "property": "pathId",
        "column": "path_id",
        "type": "text"
      },
      {
        "property": "userId",
        "column": "user_id",
        "type": "text"
      }
    ]
  },
  {
    "key": "contributions",
    "table": "contributions",
    "fields": [
      {
        "property": "id",
        "column": "id",
        "type": "text"
      },
      {
        "property": "organizationId",
        "column": "organization_id",
        "type": "text"
      },
      {
        "property": "createdAt",
        "column": "created_at",
        "type": "timestamptz"
      },
      {
        "property": "projectId",
        "column": "project_id",
        "type": "text"
      },
      {
        "property": "userId",
        "column": "user_id",
        "type": "text"
      },
      {
        "property": "title",
        "column": "title",
        "type": "text"
      },
      {
        "property": "body",
        "column": "body",
        "type": "text"
      },
      {
        "property": "evidenceUrl",
        "column": "evidence_url",
        "type": "text"
      },
      {
        "property": "status",
        "column": "status",
        "type": "text"
      },
      {
        "property": "reviewerId",
        "column": "reviewer_id",
        "type": "text"
      },
      {
        "property": "reviewedAt",
        "column": "reviewed_at",
        "type": "timestamptz"
      },
      {
        "property": "feedback",
        "column": "feedback",
        "type": "text"
      }
    ]
  },
  {
    "key": "outcomes",
    "table": "outcomes",
    "fields": [
      {
        "property": "id",
        "column": "id",
        "type": "text"
      },
      {
        "property": "organizationId",
        "column": "organization_id",
        "type": "text"
      },
      {
        "property": "createdAt",
        "column": "created_at",
        "type": "timestamptz"
      },
      {
        "property": "purposeId",
        "column": "purpose_id",
        "type": "text"
      },
      {
        "property": "projectId",
        "column": "project_id",
        "type": "text"
      },
      {
        "property": "submissionId",
        "column": "submission_id",
        "type": "text"
      },
      {
        "property": "contributionId",
        "column": "contribution_id",
        "type": "text"
      },
      {
        "property": "authorId",
        "column": "author_id",
        "type": "text"
      },
      {
        "property": "title",
        "column": "title",
        "type": "text"
      },
      {
        "property": "summary",
        "column": "summary",
        "type": "text"
      },
      {
        "property": "evidenceUrl",
        "column": "evidence_url",
        "type": "text"
      },
      {
        "property": "status",
        "column": "status",
        "type": "text"
      },
      {
        "property": "reviewerId",
        "column": "reviewer_id",
        "type": "text"
      },
      {
        "property": "reviewedAt",
        "column": "reviewed_at",
        "type": "timestamptz"
      },
      {
        "property": "feedback",
        "column": "feedback",
        "type": "text"
      }
    ]
  },
  {
    "key": "communityOutputs",
    "table": "community_outputs",
    "fields": [
      {
        "property": "id",
        "column": "id",
        "type": "text"
      },
      {
        "property": "organizationId",
        "column": "organization_id",
        "type": "text"
      },
      {
        "property": "createdAt",
        "column": "created_at",
        "type": "timestamptz"
      },
      {
        "property": "purposeId",
        "column": "purpose_id",
        "type": "text"
      },
      {
        "property": "outcomeId",
        "column": "outcome_id",
        "type": "text"
      },
      {
        "property": "projectId",
        "column": "project_id",
        "type": "text"
      },
      {
        "property": "title",
        "column": "title",
        "type": "text"
      },
      {
        "property": "summary",
        "column": "summary",
        "type": "text"
      },
      {
        "property": "kind",
        "column": "kind",
        "type": "text"
      },
      {
        "property": "evidenceUrl",
        "column": "evidence_url",
        "type": "text"
      },
      {
        "property": "publishedBy",
        "column": "published_by",
        "type": "text"
      }
    ]
  },
  {
    "key": "memberGoals",
    "table": "member_goals",
    "fields": [
      {
        "property": "id",
        "column": "id",
        "type": "text"
      },
      {
        "property": "organizationId",
        "column": "organization_id",
        "type": "text"
      },
      {
        "property": "createdAt",
        "column": "created_at",
        "type": "timestamptz"
      },
      {
        "property": "userId",
        "column": "user_id",
        "type": "text"
      },
      {
        "property": "purposeId",
        "column": "purpose_id",
        "type": "text"
      },
      {
        "property": "pathId",
        "column": "path_id",
        "type": "text"
      },
      {
        "property": "title",
        "column": "title",
        "type": "text"
      },
      {
        "property": "visibility",
        "column": "visibility",
        "type": "text"
      },
      {
        "property": "status",
        "column": "status",
        "type": "text"
      },
      {
        "property": "completedAt",
        "column": "completed_at",
        "type": "timestamptz"
      }
    ]
  },
{
  "key": "lessonDrafts",
  "table": "lesson_drafts",
  "fields": [
    {
      "property": "id",
      "column": "id",
      "type": "text"
    },
    {
      "property": "organizationId",
      "column": "organization_id",
      "type": "text"
    },
    {
      "property": "createdAt",
      "column": "created_at",
      "type": "timestamptz"
    },
    {
      "property": "trackId",
      "column": "track_id",
      "type": "text"
    },
    {
      "property": "lessonId",
      "column": "lesson_id",
      "type": "text"
    },
    {
      "property": "title",
      "column": "title",
      "type": "text"
    },
    {
      "property": "summary",
      "column": "summary",
      "type": "text"
    },
    {
      "property": "body",
      "column": "body",
      "type": "text"
    },
    {
      "property": "minutes",
      "column": "minutes",
      "type": "int4"
    },
    {
      "property": "resourceUrl",
      "column": "resource_url",
      "type": "text"
    },
    {
      "property": "version",
      "column": "version",
      "type": "int4"
    },
    {
      "property": "publishedVersion",
      "column": "published_version",
      "type": "int4"
    },
    {
      "property": "archived",
      "column": "archived",
      "type": "bool"
    },
    {
      "property": "createdBy",
      "column": "created_by",
      "type": "text"
    },
    {
      "property": "updatedBy",
      "column": "updated_by",
      "type": "text"
    },
    {
      "property": "updatedAt",
      "column": "updated_at",
      "type": "timestamptz"
    }
  ]
},
{
  "key": "lessonRevisions",
  "table": "lesson_revisions",
  "fields": [
    {
      "property": "id",
      "column": "id",
      "type": "text"
    },
    {
      "property": "organizationId",
      "column": "organization_id",
      "type": "text"
    },
    {
      "property": "createdAt",
      "column": "created_at",
      "type": "timestamptz"
    },
    {
      "property": "trackId",
      "column": "track_id",
      "type": "text"
    },
    {
      "property": "lessonId",
      "column": "lesson_id",
      "type": "text"
    },
    {
      "property": "draftId",
      "column": "draft_id",
      "type": "text"
    },
    {
      "property": "title",
      "column": "title",
      "type": "text"
    },
    {
      "property": "summary",
      "column": "summary",
      "type": "text"
    },
    {
      "property": "body",
      "column": "body",
      "type": "text"
    },
    {
      "property": "minutes",
      "column": "minutes",
      "type": "int4"
    },
    {
      "property": "resourceUrl",
      "column": "resource_url",
      "type": "text"
    },
    {
      "property": "sequence",
      "column": "sequence",
      "type": "int4"
    },
    {
      "property": "kind",
      "column": "kind",
      "type": "text"
    },
    {
      "property": "actorId",
      "column": "actor_id",
      "type": "text"
    }
  ]
},
];
// Purpose must precede project inserts; all other new relationships follow the existing records.
tables.splice(1, 0, purposeTables[0]);
tables.find(t => t.key === 'projects')!.fields.push({property:'purposeId',column:'purpose_id',type:'text'});
tables.push(...purposeTables.slice(1));

tables.find(t => t.key === 'memberGoals')!.fields.push({property:'outcomeId',column:'outcome_id',type:'text'});

// Alpha 05: tasks reference the existing contribution records; notes follow tasks.
tables.push({"key": "projectTasks", "table": "project_tasks", "fields": [{"property": "id", "column": "id", "type": "text"}, {"property": "organizationId", "column": "organization_id", "type": "text"}, {"property": "createdAt", "column": "created_at", "type": "timestamptz"}, {"property": "projectId", "column": "project_id", "type": "text"}, {"property": "title", "column": "title", "type": "text"}, {"property": "brief", "column": "brief", "type": "text"}, {"property": "criteria", "column": "criteria", "type": "jsonb"}, {"property": "assigneeId", "column": "assignee_id", "type": "text"}, {"property": "dueOn", "column": "due_on", "type": "text"}, {"property": "priority", "column": "priority", "type": "text"}, {"property": "workState", "column": "work_state", "type": "text"}, {"property": "contributionId", "column": "contribution_id", "type": "text"}, {"property": "createdBy", "column": "created_by", "type": "text"}, {"property": "updatedAt", "column": "updated_at", "type": "timestamptz"}, {"property": "version", "column": "version", "type": "integer"}, {"property": "archived", "column": "archived", "type": "boolean"}]});
tables.push({"key": "taskNotes", "table": "task_notes", "fields": [{"property": "id", "column": "id", "type": "text"}, {"property": "organizationId", "column": "organization_id", "type": "text"}, {"property": "createdAt", "column": "created_at", "type": "timestamptz"}, {"property": "projectId", "column": "project_id", "type": "text"}, {"property": "taskId", "column": "task_id", "type": "text"}, {"property": "authorId", "column": "author_id", "type": "text"}, {"property": "body", "column": "body", "type": "text"}, {"property": "hidden", "column": "hidden", "type": "boolean"}]});

// Nullable structured content preserves all legacy plaintext rows.
for (const key of ['lessons','lessonDrafts','lessonRevisions']) tables.find(t=>t.key===key)!.fields.push({property:'richBody',column:'rich_body',type:'jsonb'});

// Alpha 09: lesson files reuse the existing upload intents. Member-private uploads stay outside workspace reads.
for (const key of ['lessons','lessonDrafts','lessonRevisions']) tables.find(t=>t.key===key)!.fields.push({property:'resources',column:'resources',type:'jsonb'});
tables.push({key:'uploads',table:'upload_intents',where:"purpose IN ('lesson_resource','cover_image','cover_library')",fields:[
    {property:'id',column:'id',type:'text'},{property:'organizationId',column:'organization_id',type:'text'},{property:'createdAt',column:'created_at',type:'timestamptz'},
    {property:'userId',column:'user_id',type:'text'},{property:'purpose',column:'purpose',type:'text'},{property:'trackId',column:'track_id',type:'text'},
    {property:'originalName',column:'original_name',type:'text'},{property:'contentType',column:'content_type',type:'text'},{property:'sizeBytes',column:'size_bytes',type:'integer'},
    {property:'status',column:'status',type:'text'},{property:'objectKey',column:'object_key',type:'text'},{property:'completedAt',column:'completed_at',type:'timestamptz'},
    {property:'generation',column:'generation',type:'text'},
    // Alpha 11: cover uploads name exactly one track or project.
    {property:'coverTrackId',column:'cover_track_id',type:'text'},{property:'coverProjectId',column:'cover_project_id',type:'text'}]});

// Alpha 10: knowledge checks live in lesson content; attempts are immutable apart from review fields.
for (const key of ['lessons','lessonDrafts','lessonRevisions']) tables.find(t=>t.key===key)!.fields.push({property:'quiz',column:'quiz',type:'jsonb'});
tables.push({key:'quizAttempts',table:'quiz_attempts',mutable:['results','score','passed','status','feedback','reviewerId','reviewedAt','version'],fields:[
    {property:'id',column:'id',type:'text'},{property:'organizationId',column:'organization_id',type:'text'},{property:'createdAt',column:'created_at',type:'timestamptz'},
    {property:'lessonId',column:'lesson_id',type:'text'},{property:'trackId',column:'track_id',type:'text'},{property:'userId',column:'user_id',type:'text'},
    {property:'attemptNumber',column:'attempt_number',type:'integer'},{property:'quiz',column:'quiz',type:'jsonb'},{property:'answers',column:'answers',type:'jsonb'},
    {property:'results',column:'results',type:'jsonb'},{property:'score',column:'score',type:'integer'},{property:'maxScore',column:'max_score',type:'integer'},
    {property:'status',column:'status',type:'text'},{property:'passed',column:'passed',type:'boolean'},{property:'feedback',column:'feedback',type:'text'},
    {property:'reviewerId',column:'reviewer_id',type:'text'},{property:'reviewedAt',column:'reviewed_at',type:'timestamptz'},{property:'version',column:'version',type:'integer'}]});

// Alpha 11: uploaded covers replace the decorative art. NULL keeps the plain panel.
for (const key of ['tracks','projects']) tables.find(t=>t.key===key)!.fields.push({property:'coverImage',column:'cover_image',type:'jsonb'});

// Alpha 12: explicit track instructors. Grants are never updated in place; revoking deletes the row.
tables.push({key:'trackInstructors',table:'track_instructors',mutable:[],fields:[
    {property:'id',column:'id',type:'text'},{property:'organizationId',column:'organization_id',type:'text'},{property:'createdAt',column:'created_at',type:'timestamptz'},
    {property:'trackId',column:'track_id',type:'text'},{property:'userId',column:'user_id',type:'text'},{property:'grantedBy',column:'granted_by',type:'text'}]});

// Alpha 13: the community cover library. Pictures are added or removed, never rewritten in place.
tables.push({key:'coverLibrary',table:'cover_library',mutable:[],fields:[
    {property:'id',column:'id',type:'text'},{property:'organizationId',column:'organization_id',type:'text'},{property:'createdAt',column:'created_at',type:'timestamptz'},
    {property:'fileId',column:'file_id',type:'text'},{property:'label',column:'label',type:'text'},{property:'contentType',column:'content_type',type:'text'},
    {property:'sizeBytes',column:'size_bytes',type:'integer'},{property:'addedBy',column:'added_by',type:'text'}]});

// Alpha 19: a member's notice settings. One row per member; only the member changes it, the digest job stamps lastDigestAt.
tables.push({key:'notificationPreferences',table:'notification_preferences',fields:[
    {property:'id',column:'id',type:'text'},{property:'organizationId',column:'organization_id',type:'text'},{property:'createdAt',column:'created_at',type:'timestamptz'},
    {property:'userId',column:'user_id',type:'text'},{property:'muted',column:'muted',type:'jsonb'},{property:'digest',column:'digest',type:'text'},
    {property:'updatedAt',column:'updated_at',type:'timestamptz'},{property:'lastDigestAt',column:'last_digest_at',type:'timestamptz'}]});

// Alpha 25: a teaching grant names its role. Changing a role replaces the grant; it is never rewritten in place.
tables.find(t => t.key === 'trackInstructors')!.fields.push({property:'role',column:'role',type:'text'});
// Appeals against moderation. Posts record who last hid or restored them; an appeal changes only its decision fields.
tables.find(t => t.key === 'posts')!.fields.push({property:'moderatedBy',column:'moderated_by',type:'text'},{property:'moderatedAt',column:'moderated_at',type:'timestamptz'});
tables.push({key:'moderationAppeals',table:'moderation_appeals',mutable:['status','decidedBy','decidedAt','response'],fields:[
    {property:'id',column:'id',type:'text'},{property:'organizationId',column:'organization_id',type:'text'},{property:'createdAt',column:'created_at',type:'timestamptz'},
    {property:'subject',column:'subject',type:'text'},{property:'subjectId',column:'subject_id',type:'text'},{property:'appellantId',column:'appellant_id',type:'text'},
    {property:'hiddenBy',column:'hidden_by',type:'text'},{property:'hiddenAt',column:'hidden_at',type:'timestamptz'},
    {property:'reason',column:'reason',type:'text'},{property:'status',column:'status',type:'text'},{property:'decidedBy',column:'decided_by',type:'text'},
    {property:'decidedAt',column:'decided_at',type:'timestamptz'},{property:'response',column:'response',type:'text'}]});
// Evidence history: corrections and withdrawals of reviewed evidence. A change is never rewritten; only its decision is recorded.
tables.push({key:'evidenceChanges',table:'evidence_changes',mutable:['status','decidedBy','decidedAt','response'],fields:[
    {property:'id',column:'id',type:'text'},{property:'organizationId',column:'organization_id',type:'text'},{property:'createdAt',column:'created_at',type:'timestamptz'},
    {property:'subject',column:'subject',type:'text'},{property:'subjectId',column:'subject_id',type:'text'},{property:'kind',column:'kind',type:'text'},
    {property:'requestedBy',column:'requested_by',type:'text'},{property:'reason',column:'reason',type:'text'},
    {property:'previous',column:'previous',type:'jsonb'},{property:'proposed',column:'proposed',type:'jsonb'},{property:'previousStatus',column:'previous_status',type:'text'},
    {property:'status',column:'status',type:'text'},{property:'decidedBy',column:'decided_by',type:'text'},{property:'decidedAt',column:'decided_at',type:'timestamptz'},
    {property:'response',column:'response',type:'text'}]});
