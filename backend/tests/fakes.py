"""A minimal in-memory stand-in for the Supabase client, used only in tests.

Supports exactly the query-builder calls this backend's services use
(select/insert/delete/eq/order/range/limit/maybe_single/execute) so tests
don't require a live Supabase project.
"""
from __future__ import annotations

import uuid
from collections import Counter
from datetime import date, datetime, timezone


class FakeResponse:
    def __init__(self, data, count=None):
        self.data = data
        self.count = count


class FakeApiError(Exception):
    """Shaped like postgrest.exceptions.APIError (message + PostgREST code)."""

    def __init__(self, message: str, code: str):
        super().__init__(message)
        self.message = message
        self.code = code


class FakeQuery:
    def __init__(self, store: dict, table_name: str, client: "FakeSupabaseClient | None" = None):
        self.store = store
        self.table_name = table_name
        self.client = client
        self._op = None
        self._insert_rows = None
        self._filters: list[tuple[str, str]] = []
        self._in_filters: list[tuple[str, list]] = []
        self._order = None
        self._range = None
        self._limit = None
        self._maybe_single = False
        self._want_count = False

    def select(self, _columns="*", count=None):
        self._op = self._op or "select"
        self._want_count = count is not None
        return self

    def insert(self, row):
        self._op = "insert"
        self._insert_rows = row if isinstance(row, list) else [row]
        return self

    def delete(self):
        self._op = "delete"
        return self

    def update(self, changes):
        self._op = "update"
        self._changes = dict(changes)
        return self

    def eq(self, col, val):
        self._filters.append((col, str(val)))
        return self

    def in_(self, col, values):
        self._in_filters.append((col, [str(v) for v in values]))
        return self

    def order(self, col, desc=False):
        self._order = (col, desc)
        return self

    def range(self, start, end):
        self._range = (start, end)
        return self

    def limit(self, n):
        self._limit = n
        return self

    def maybe_single(self):
        self._maybe_single = True
        return self

    def _matches(self, row: dict) -> bool:
        if not all(row.get(col) == val for col, val in self._filters):
            return False
        return all(str(row.get(col)) in values for col, values in self._in_filters)

    def execute(self) -> FakeResponse:
        if self.client and self.table_name in self.client.missing:
            raise FakeApiError(f"Could not find the table 'public.{self.table_name}'", "PGRST205")
        table = self.store.setdefault(self.table_name, [])

        if self._op == "insert":
            created = []
            for row in self._insert_rows:
                new_row = dict(row)
                new_row.setdefault("id", str(uuid.uuid4()))
                new_row.setdefault("created_at", datetime.now(timezone.utc).isoformat())
                table.append(new_row)
                created.append(new_row)
            return FakeResponse(created)

        if self._op == "update":
            matches = [r for r in table if self._matches(r)]
            for r in matches:
                r.update(self._changes)
            return FakeResponse([dict(r) for r in matches])

        if self._op == "delete":
            if self.client and self.table_name in self.client.fail_next_table_delete:
                self.client.fail_next_table_delete.discard(self.table_name)
                raise RuntimeError(f"simulated delete failure on {self.table_name}")
            matches = [r for r in table if self._matches(r)]
            for r in matches:
                table.remove(r)
            return FakeResponse(matches)

        rows = [r for r in table if self._matches(r)]
        total = len(rows)

        if self._order:
            col, desc = self._order
            rows = sorted(rows, key=lambda r: r.get(col) or "", reverse=desc)
        if self._range:
            start, end = self._range
            rows = rows[start : end + 1]
        if self._limit is not None:
            rows = rows[: self._limit]

        count = total if self._want_count else None
        if self._maybe_single:
            return FakeResponse(rows[0] if rows else None, count=count)
        return FakeResponse(rows, count=count)


class FakeStorageApiError(Exception):
    def __init__(self, message: str, status: str = "", code: str = ""):
        super().__init__(message)
        self.message = message
        self.status = status
        self.code = code


class FakeBucketHandle:
    def __init__(self, storage: "FakeStorage", bucket_name: str):
        self.storage = storage
        self.bucket_name = bucket_name

    def _require_bucket(self):
        if self.bucket_name not in self.storage.buckets:
            raise FakeStorageApiError(f"Bucket not found: {self.bucket_name}")

    def list(self, path: str = "", options: dict | None = None):
        self._require_bucket()
        prefix = f"{self.bucket_name}/"
        return [
            {"name": key[len(prefix) :]}
            for key in self.storage.objects
            if key.startswith(prefix)
        ]

    def upload(self, path: str, content: bytes, file_options: dict | None = None):
        self._require_bucket()
        if self.storage.fail_next_upload_too_large:
            self.storage.fail_next_upload_too_large = False
            raise FakeStorageApiError(
                "The object exceeded the maximum allowed size", status="413", code="413"
            )
        if self.storage.fail_next_upload:
            self.storage.fail_next_upload = False
            raise FakeStorageApiError("simulated upload failure")
        self.storage.objects[f"{self.bucket_name}/{path}"] = content
        return {"path": path}

    def remove(self, paths: list[str]):
        self._require_bucket()
        if self.storage.fail_next_delete:
            self.storage.fail_next_delete = False
            raise FakeStorageApiError("simulated delete failure")
        for p in paths:
            self.storage.objects.pop(f"{self.bucket_name}/{p}", None)
        return [{"name": p} for p in paths]

    def get_public_url(self, path: str) -> str:
        return f"https://fake.supabase.co/storage/v1/object/public/{self.bucket_name}/{path}"

    def create_signed_url(self, path: str, expires_in: int) -> dict:
        # Real Supabase Storage refuses to sign a missing object ("Object not found").
        if f"{self.bucket_name}/{path}" not in self.storage.objects:
            raise FakeStorageApiError("Object not found", status="400", code="404")
        return {"signedURL": f"https://fake.supabase.co/storage/v1/object/sign/{self.bucket_name}/{path}?token=fake"}


class FakeBucketInfo:
    def __init__(self, name: str, public: bool):
        self.name = name
        self.public = public


class FakeStorage:
    def __init__(self):
        # bucket_name -> public bool. Only "Satquery" exists by default, mirroring the real project.
        self.buckets: dict[str, bool] = {"Satquery": False}
        self.objects: dict[str, bytes] = {}
        self.fail_next_upload = False
        self.fail_next_upload_too_large = False
        self.fail_next_delete = False

    def from_(self, bucket_name: str) -> FakeBucketHandle:
        return FakeBucketHandle(self, bucket_name)

    def get_bucket(self, bucket_name: str) -> FakeBucketInfo:
        if bucket_name not in self.buckets:
            raise FakeStorageApiError(f"Bucket not found: {bucket_name}")
        return FakeBucketInfo(bucket_name, self.buckets[bucket_name])


class FakeSupabaseClient:
    def __init__(self):
        self.store: dict[str, list[dict]] = {}
        self.storage = FakeStorage()
        # Table names for which the NEXT delete().execute() should raise,
        # simulating e.g. a foreign key violation. Self-clearing (one-shot).
        self.fail_next_table_delete: set[str] = set()
        # Tables / RPC functions that "don't exist" (an unapplied migration).
        self.missing: set[str] = set()
        self.today: date | None = None

    def table(self, name: str) -> FakeQuery:
        return FakeQuery(self.store, name, client=self)

    def rpc(self, name: str, params: dict | None = None) -> "FakeRpc":
        return FakeRpc(self, name, params or {})

    def profile_dashboard(self, p_timezone: str = "UTC", p_recent_limit: int = 10) -> dict:
        """Python mirror of the profile_dashboard() SQL function (migrations/0004).

        Days are bucketed in UTC regardless of p_timezone; set `self.today`
        to pin "today" for streak tests.
        """
        jobs = self.store.get("analysis_jobs", [])
        imagery = self.store.get("imagery", [])

        def day(ts: str) -> date:
            return datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(timezone.utc).date()

        per_day = Counter(day(j["created_at"]) for j in jobs)
        groups = Counter((j.get("analysis_type"), (j.get("query") or "").strip().lower()) for j in jobs)
        per_image = Counter(j.get("imagery_id") for j in jobs)
        recent = [
            {"kind": "upload", "id": i["id"], "label": i.get("original_filename") or i.get("name"),
             "status": "uploaded", "analysis_type": None, "created_at": i["created_at"]}
            for i in imagery
        ] + [
            {"kind": "query", "id": j["id"], "label": j.get("query"), "status": j.get("status"),
             "analysis_type": j.get("analysis_type"), "created_at": j["created_at"]}
            for j in jobs
        ]
        recent.sort(key=lambda r: r["created_at"], reverse=True)
        return {
            "today": (self.today or datetime.now(timezone.utc).date()).isoformat(),
            "totals": {
                "total_queries": len(jobs),
                "completed": sum(1 for j in jobs if j.get("status") == "completed"),
                "failed": sum(1 for j in jobs if j.get("status") == "failed"),
                "pending": sum(1 for j in jobs if j.get("status") in ("queued", "processing")),
                "scenes_analyzed": len({j["imagery_id"] for j in jobs if j.get("imagery_id")}),
            },
            "scenes_uploaded": len(imagery),
            "active_days": [
                {"date": d.isoformat(), "query_count": n} for d, n in sorted(per_day.items())
            ],
            "query_groups": [
                {"analysis_type": t, "query": q, "count": n} for (t, q), n in groups.items()
            ],
            "scenes": [
                {"name": i.get("name"), "original_filename": i.get("original_filename"),
                 "mime_type": i.get("mime_type"), "sensor": i.get("sensor"), "source": i.get("source"),
                 "query_count": per_image.get(i["id"], 0)}
                for i in imagery
            ],
            "recent": recent[: max(p_recent_limit, 0)],
        }


class FakeRpc:
    def __init__(self, client: FakeSupabaseClient, name: str, params: dict):
        self.client = client
        self.name = name
        self.params = params

    def execute(self) -> FakeResponse:
        if self.name in self.client.missing or self.name != "profile_dashboard":
            raise FakeApiError(f"Could not find the function public.{self.name}", "PGRST202")
        return FakeResponse(self.client.profile_dashboard(**self.params))
