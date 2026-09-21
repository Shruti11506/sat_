"""A minimal in-memory stand-in for the Supabase client, used only in tests.

Supports exactly the query-builder calls this backend's services use
(select/insert/delete/eq/order/range/limit/maybe_single/execute) so tests
don't require a live Supabase project.
"""
import uuid
from datetime import datetime, timezone


class FakeResponse:
    def __init__(self, data, count=None):
        self.data = data
        self.count = count


class FakeQuery:
    def __init__(self, store: dict, table_name: str):
        self.store = store
        self.table_name = table_name
        self._op = None
        self._insert_rows = None
        self._filters: list[tuple[str, str]] = []
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

    def eq(self, col, val):
        self._filters.append((col, str(val)))
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
        return all(row.get(col) == val for col, val in self._filters)

    def execute(self) -> FakeResponse:
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

        if self._op == "delete":
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


class FakeBucket:
    def __init__(self, name: str):
        self.name = name

    def list(self, path: str = "", options: dict | None = None):
        return []


class FakeStorage:
    def from_(self, bucket_name: str) -> FakeBucket:
        return FakeBucket(bucket_name)


class FakeSupabaseClient:
    def __init__(self):
        self.store: dict[str, list[dict]] = {}
        self.storage = FakeStorage()

    def table(self, name: str) -> FakeQuery:
        return FakeQuery(self.store, name)
