"""Basic request-validation security helpers.

No authentication scheme is implemented at this stage (see CLAUDE.md milestone
scope) -- this module only holds shared validation utilities used across routes.
"""
from uuid import UUID


def parse_uuid(value: str, *, field_name: str = "id") -> UUID:
    """Validate that `value` is a well-formed UUID, raising ValueError otherwise."""
    try:
        return UUID(value)
    except (ValueError, AttributeError, TypeError) as exc:
        raise ValueError(f"'{value}' is not a valid UUID for field '{field_name}'") from exc
