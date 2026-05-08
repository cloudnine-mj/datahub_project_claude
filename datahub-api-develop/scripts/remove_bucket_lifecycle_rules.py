from __future__ import annotations

import argparse
import os
from typing import Sequence

from google.cloud import storage


def remove_bucket_lifecycle_rules(
    *,
    project: str,
    buckets: Sequence[str],
    prefix: str,
    apply_changes: bool,
) -> None:
    client = storage.Client(project=project or None)
    selected_buckets = list(buckets)

    if not selected_buckets:
        effective_prefix = prefix or os.environ.get("GCP_BUCKET_PREFIX") or os.environ.get("DATAHUB_GCP_BUCKET_PREFIX") or "lgair-data-hub"
        selected_buckets = [bucket.name for bucket in client.list_buckets(prefix=effective_prefix)]

    for bucket_name in selected_buckets:
        bucket = client.bucket(bucket_name)
        bucket.reload()
        rules = list(bucket.lifecycle_rules)
        print(f"{bucket_name}\tbefore={rules}")
        if not apply_changes:
            continue
        bucket.clear_lifecycle_rules()
        bucket.patch()
        bucket.reload()
        print(f"{bucket_name}\tafter={list(bucket.lifecycle_rules)}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", default=os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("GCP_PROJECT") or "")
    parser.add_argument("--prefix", default="")
    parser.add_argument("--bucket", action="append", default=[])
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    remove_bucket_lifecycle_rules(
        project=args.project,
        buckets=args.bucket,
        prefix=args.prefix,
        apply_changes=args.apply,
    )


if __name__ == "__main__":
    main()
