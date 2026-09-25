"""Report -- and optionally delete -- empty conversations.

The old New Chat button inserted a "New Chat" conversation on every click,
which left rows with no uploads and no queries behind. They're already
hidden from the sidebar (GET /conversations skips empty ones); this removes
them from the database.

Dry run by default: nothing is deleted without --apply. Only conversations
older than --older-than-minutes (default 60) with zero imagery rows AND zero
analysis_jobs rows qualify.

    cd backend
    python scripts/purge_empty_conversations.py              # list only
    python scripts/purge_empty_conversations.py --apply      # delete them
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.conversation_service import purge_empty_conversations  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--apply", action="store_true", help="actually delete (default: dry run)")
    parser.add_argument("--older-than-minutes", type=int, default=60)
    args = parser.parse_args()

    rows = purge_empty_conversations(args.older_than_minutes, apply=args.apply)
    verb = "Deleted" if args.apply else "Would delete"
    print(f"{verb} {len(rows)} empty conversation(s):")
    for row in rows:
        print(f"  {row['id']}  created {row['created_at']}  title={row['title']!r}")
    if not args.apply and rows:
        print("Re-run with --apply to delete them.")


if __name__ == "__main__":
    main()
