"""datahub CLI — gsutil-style interface for DataHub SDK.

v0.9: rich UI with spinners, progress bars, tables, and colored messages.

Usage:
    datahub cp dh://nlp-lab/datasets/ ./local/ -b main
    datahub ls dh://nlp-lab/datasets/ -r
    datahub search "ner" -c nlp_lab
"""

from __future__ import annotations

import functools
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from fnmatch import fnmatch
import sys
import tempfile
from typing import Optional

import click

import datahub
from datahub.console import console, error, file_progress, format_size, info, make_table, spinner, step, success, warn


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────


def parse_dh_uri(uri: str) -> tuple[str, str, str]:
    """Parse ``dh://group/repo/path`` into (group, repo, path).

    Both group and repo are required.  Branch is *not* part of the URI
    — pass it via the ``-b`` / ``--branch`` option instead.
    """
    if not uri.startswith("dh://"):
        raise ValueError(f"Invalid dh URI (must start with dh://): {uri}")

    stripped = uri[len("dh://"):]
    parts = stripped.split("/", 2)
    if len(parts) < 2 or not parts[0]:
        raise ValueError(f"dh URI must include group and repo: {uri}")
    if not parts[1]:
        raise ValueError(f"dh URI must include repo: {uri}")

    group = parts[0]
    repo = parts[1]
    path = parts[2] if len(parts) == 3 else ""
    return group, repo, path


def _get_client(ctx: click.Context):
    if "client" not in ctx.obj:
        from datahub.client import DataClient
        ctx.obj["client"] = DataClient()
    return ctx.obj["client"]


def handle_errors(fn):
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except ValueError as exc:
            error(str(exc))
            raise SystemExit(1)
        except click.ClickException:
            raise
        except SystemExit:
            raise
        except Exception as exc:
            cls = type(exc).__name__
            if cls == "TimeoutException":
                error("Request timed out. The server may be busy.")
                info("Try again later or check your network connection.")
                raise SystemExit(1)
            if cls == "HTTPStatusError":
                resp = getattr(exc, "response", None)
                status = getattr(resp, "status_code", "?") if resp else "?"
                error(f"Server error (HTTP {status})")
                detail = None
                if resp is not None:
                    try:
                        payload = resp.json()
                        detail = payload.get("detail")
                    except Exception:
                        detail = None
                if isinstance(detail, dict):
                    message = detail.get("message")
                    if message:
                        info(str(message))
                    path = detail.get("path")
                    if path:
                        info(f"Logical path: {path}")
                    physical_address = detail.get("physical_address")
                    if physical_address:
                        info(f"Physical address: {physical_address}")
                    raise SystemExit(1)
                # Provide hints for common errors
                if status == 409:
                    info("Resource already exists.")
                elif status == 404:
                    info("Resource not found. Check the name and try again.")
                elif status == 403:
                    info("Permission denied. Use 'datahub login' to authenticate.")
                elif status == 401:
                    info("Authentication required. Run 'datahub login' first.")
                raise SystemExit(1)
            if cls == "ConnectError":
                error("Connection failed — cannot reach the server.")
                info("Check your network connection and try again.")
                raise SystemExit(1)
            error(f"{cls}: {exc}")
            raise SystemExit(1)
    return wrapper



# ──────────────────────────────────────────────
# Root group
# ──────────────────────────────────────────────


@click.group()
@click.version_option(version=datahub.get_version(), prog_name="datahub")
@click.pass_context
def cli(ctx):
    """datahub — CLI for LG AI Research DataHub."""
    ctx.ensure_object(dict)


# ──────────────────────────────────────────────
# Authentication
# ──────────────────────────────────────────────


@cli.command()
@click.option(
    "--no-browser",
    "--no-launch-browser",
    is_flag=True,
    help=(
        "Print URL and prompt for a verification code instead of opening a browser. "
        "Use this in remote SSH, container, or headless environments."
    ),
)
@click.option(
    "--device",
    is_flag=True,
    help=(
        "Use OAuth 2.0 Device Authorization Grant (polling, no local HTTP server). "
        "Alternative no-browser flow — requires server-side device flow support."
    ),
)
@click.option(
    "--callback-port",
    type=int,
    default=None,
    metavar="PORT",
    help=(
        "Pin the localhost callback server to a fixed port (default: random free port). "
        "Use this from a plain SSH session after pre-forwarding with "
        "`ssh -L <PORT>:localhost:<PORT> <host>` so the browser callback can reach the CLI. "
        "VSCode/Cursor Remote auto-forwards already, so this option is unnecessary there."
    ),
)
@handle_errors
def login(no_browser, device, callback_port):
    """Authenticate with DataHub via browser.

    \b
    Default:                 opens browser, receives token via localhost callback.
    --no-browser:            prints URL, user pastes verification code (no port-forwarding needed).
    --device:                device authorization grant (polling-based, no local server).
    --callback-port <PORT>:  pin callback to a fixed port for plain-SSH `-L` forwarding.
    """
    from datahub.config import DataHubConfig

    config = DataHubConfig.load()

    if device:
        from datahub.auth import login_flow_device
        info("Starting device authorization flow (no local server needed)...")
        creds = login_flow_device(
            config.auth.endpoint,
            open_browser=not no_browser,
        )
    elif no_browser:
        from datahub.auth import login_flow_paste
        info("Paste-mode login (no local server or port-forwarding required)...")
        creds = login_flow_paste(config.auth.endpoint)
    else:
        from datahub.auth import login_flow
        info("Opening browser for authentication...")
        creds = login_flow(
            config.auth.endpoint,
            open_browser=True,
            callback_port=callback_port,
        )

    email = creds.get("email", "unknown")
    success(f"Logged in as [bold]{email}[/bold]")


@cli.command()
@handle_errors
def logout():
    """Remove saved credentials."""
    from datahub.auth import CredentialStore

    CredentialStore.clear()
    success("Credentials removed. You are now logged out.")


# ──────────────────────────────────────────────
# Mount (client-side FUSE)
# ──────────────────────────────────────────────


@cli.command(hidden=True)
@click.argument("repo")
@click.argument("mountpoint")
@click.option("--branch", default="main", show_default=True, help="Branch to mount.")
@click.option(
    "--backend",
    type=click.Choice(["auto", "fuse", "nfs"]),
    default="auto",
    show_default=True,
)
@click.option("--foreground", "-f", is_flag=True)
@click.option("--debug", is_flag=True, hidden=True)
@click.pass_context
@handle_errors
def mount(ctx, repo, mountpoint, branch, backend, foreground, debug):
    """[미구현] Mount — Phase 2 개발 예정."""
    error("datahub mount: NFS/FUSE 마운트는 현재 개발 중입니다 (Phase 2 예정).")
    raise SystemExit(1)


@cli.command(hidden=True)
@click.argument("mountpoint")
@click.option(
    "--backend",
    type=click.Choice(["auto", "fuse", "nfs"]),
    default="auto",
    show_default=True,
)
@handle_errors
def umount(mountpoint, backend):
    """[미구현] Umount — Phase 2 개발 예정."""
    error("datahub umount: NFS/FUSE 마운트는 현재 개발 중입니다 (Phase 2 예정).")
    raise SystemExit(1)


# ──────────────────────────────────────────────
# Data I/O
# ──────────────────────────────────────────────


@cli.command()
@click.argument("file")
@click.option("--repo", "-r", required=True, help="Repository name.")
@click.option("--output", "-o", default=None, help="Local output path (default: current directory).")
@click.option("--branch", "-b", default="main", show_default=True, help="Branch name.")
@click.option("-w", "--workers", default=8, show_default=True, type=int, help="Parallel download workers.")
@click.pass_context
@handle_errors
def download(ctx, file, repo, output, branch, workers):
    """Download a file or directory from a DataHub repository.

    \b
    Example:
      datahub download training/ner-v4/ --repo ner-v4 --output ./data/
      datahub download train.csv --repo my-dataset -o ./local/train.csv -b develop
    """
    local_path = output or os.path.basename(file.rstrip("/")) or "."
    client = _get_client(ctx)

    with spinner(f"Downloading '{file}' from '{repo}' (branch: {branch})..."):
        downloaded = client.download(repo, file, local_path, branch=branch, max_workers=workers)

    if not downloaded:
        warn(f"No files found at '{file}' in '{repo}' on branch '{branch}'.")
        raise SystemExit(1)

    for path in downloaded:
        console.print(path)
    success(f"{len(downloaded)} file(s) downloaded to {local_path}")


@cli.command()
@click.argument("paths", nargs=-1, required=True)
@click.option("-m", "--multi", is_flag=True, default=False, help="Use SDK-backed parallel transfer mode.")
@click.option("-r", "--recursive", is_flag=True, default=False, help="Recursive copy for wildcard or multi-object downloads.")
@click.option("--message", default=None, help="Commit message (upload only).")
@click.option("-b", "--branch", default="main", show_default=True, help="Branch name.")
@click.option("-w", "--workers", default=None, type=int, help="Parallel workers when -m is enabled (defaults to CPU-based concurrency).")
@click.option("-p", "--parallel", is_flag=True, default=False, hidden=True,
              help="Deprecated alias for -m. Uses CPU-based bounded concurrency.")
@click.option("--src-branch", default=None, help="Source branch for dh://→dh:// copy (defaults to -b value).")
@click.option("--dst-branch", default=None, help="Destination branch for dh://→dh:// copy (defaults to -b value).")
@click.pass_context
@handle_errors
def cp(ctx, paths, multi, recursive, message, branch, workers, parallel, src_branch, dst_branch):
    """Copy data between local and dh:// paths.

    \b
      dh:// → local        download
      local → dh://        upload + commit
      dh:// → dh://        repo-to-repo copy (via local tmp)

    Use -m for SDK-backed parallel transfers. --message is upload-only.
    """
    import os as _os

    cpu_based_workers = min((_os.cpu_count() or 4), 32)

    if parallel:
        multi = True
    if workers is None:
        workers = cpu_based_workers if multi else 8

    if len(paths) < 2:
        error("cp requires at least one source and one destination")
        raise SystemExit(1)

    *sources, dest = paths
    source = sources[0]

    client = _get_client(ctx)

    def _run_transfer(operation: str, transfer_fn):
        seen_uris: set[str] = set()
        with file_progress() as progress:
            task_id = progress.add_task(
                operation,
                total=1,
                completed=0,
                label=f"0 files",
                summary="0/0 files",
                extra="",
            )
            current_stage = ""
            stage_started_at = time.monotonic()

            def _on_progress(event: dict) -> None:
                nonlocal current_stage, stage_started_at

                stage = str(event.get("stage") or "")
                if stage != current_stage:
                    current_stage = stage
                    stage_started_at = time.monotonic()

                files_done = int(event.get("files_done") or 0)
                files_total = int(event.get("files_total") or 0)
                bytes_total = int(event.get("bytes_total") or 0)
                bytes_done = int(event.get("bytes_done") or 0)
                total = max(files_total, 1)
                completed = min(files_done, total) if files_total else 0
                summary = str(event.get("summary") or (f"{files_done}/{files_total} files" if files_total else ""))
                extra = ""
                if stage == "transferring" and bytes_done > 0:
                    elapsed = max(time.monotonic() - stage_started_at, 0.001)
                    extra = f"{format_size(bytes_done / elapsed)}/s"

                progress.update(
                    task_id,
                    total=total,
                    completed=completed,
                    label=str(event.get("label") or operation),
                    summary=summary,
                    extra=extra,
                )

                uri = event.get("uri")
                if event.get("type") == "file_complete" and isinstance(uri, str) and uri not in seen_uris:
                    console.print(uri)
                    seen_uris.add(uri)

            return transfer_fn(_on_progress)

    if len(sources) > 1 and any(src.startswith("dh://") for src in sources):
        if not all(src.startswith("dh://") for src in sources) or dest.startswith("dh://"):
            error("Multiple dh:// sources are only supported for dh:// → local downloads")
            raise SystemExit(1)

    src_is_dh = source.startswith("dh://")
    dst_is_dh = dest.startswith("dh://")

    def _remote_glob_prefix(pattern: str) -> str:
        wildcard_positions = [idx for idx in (pattern.find("*"), pattern.find("?"), pattern.find("[")) if idx != -1]
        if not wildcard_positions:
            return pattern
        prefix = pattern[:min(wildcard_positions)]
        return prefix.rsplit("/", 1)[0] + "/" if "/" in prefix else prefix

    def _expand_remote_sources() -> list[tuple[str, str, str]]:
        expanded: list[tuple[str, str, str]] = []
        for remote_source in sources:
            group, repo, path = parse_dh_uri(remote_source)
            repo_name = f"{group}/{repo}"
            if any(ch in path for ch in "*?["):
                after = None
                while True:
                    prefix = _remote_glob_prefix(path)
                    result = client.ls(repo_name, prefix, branch=branch, recursive=True, max_items=1000, after=after)
                    matches: list[str] = []
                    for item in result.items:
                        item_path = item.get("path") if isinstance(item, dict) else item
                        if not isinstance(item_path, str):
                            continue
                        if fnmatch(item_path, path):
                            matches.append(item_path)
                    expanded.extend((group, repo, item_path) for item_path in matches)
                    if not result.has_more:
                        break
                    after = result.next_offset
            else:
                expanded.append((group, repo, path))
        return expanded

    if src_is_dh and not dst_is_dh:
        # dh:// → local (download)
        remote_sources = _expand_remote_sources()
        if not remote_sources:
            error("No matching remote files found")
            raise SystemExit(1)

        requires_recursive = len(remote_sources) > 1 or len(sources) > 1 or any(ch in parse_dh_uri(src)[2] for src in sources for ch in "*?[")
        if requires_recursive and not recursive:
            error("Recursive or wildcard dh:// downloads require -r (gsutil-compatible behavior)")
            raise SystemExit(1)

        if len(remote_sources) == 1 and len(sources) == 1 and not any(ch in parse_dh_uri(source)[2] for ch in "*?["):
            group, repo, path = remote_sources[0]
            repo_name = f"{group}/{repo}"
            info(f"Downloading from [bold]dh://{group}/{repo}/{path}[/bold] (branch: {branch})...")
            files = _run_transfer(
                "Downloading",
                lambda on_progress: client.download(
                    repo_name,
                    path,
                    dest,
                    branch=branch,
                    max_workers=workers,
                    multi=multi,
                    on_progress=on_progress,
                ),
            )
        else:
            os.makedirs(dest, exist_ok=True)
            info(f"Downloading {len(remote_sources)} file(s) to [bold]{dest}[/bold] (branch: {branch})...")

            def _download_many(on_progress):
                downloaded: list[str] = []

                def _download_one(remote_spec: tuple[str, str, str]) -> list[str]:
                    grp, rpo, pth = remote_spec
                    return client.download(
                        f"{grp}/{rpo}",
                        pth,
                        dest,
                        branch=branch,
                        max_workers=workers,
                        multi=False,
                        on_progress=None,
                    )

                if multi and len(remote_sources) > 1:
                    with ThreadPoolExecutor(max_workers=min(workers, len(remote_sources))) as pool:
                        futures = {pool.submit(_download_one, remote_spec): remote_spec for remote_spec in remote_sources}
                        for index, future in enumerate(as_completed(futures), start=1):
                            grp, rpo, pth = futures[future]
                            result_files = future.result()
                            downloaded.extend(result_files)
                            if on_progress:
                                on_progress({
                                    "type": "file_complete",
                                    "operation": "download",
                                    "stage": "transferring",
                                    "uri": f"dh://{grp}/{rpo}/{pth}",
                                    "label": "Downloading selected files",
                                    "summary": f"{index}/{len(remote_sources)} files",
                                    "files_done": index,
                                    "files_total": len(remote_sources),
                                })
                else:
                    for index, remote_spec in enumerate(remote_sources, start=1):
                        grp, rpo, pth = remote_spec
                        result_files = _download_one(remote_spec)
                        downloaded.extend(result_files)
                        if on_progress:
                            on_progress({
                                "type": "file_complete",
                                "operation": "download",
                                "stage": "transferring",
                                "uri": f"dh://{grp}/{rpo}/{pth}",
                                "label": "Downloading selected files",
                                "summary": f"{index}/{len(remote_sources)} files",
                                "files_done": index,
                                "files_total": len(remote_sources),
                            })

                return downloaded

            files = _run_transfer("Downloading", _download_many)

        success(f"Download complete. {len(files)} file(s) → [bold]{dest}[/bold]")

    elif dst_is_dh and not src_is_dh:
        # local → dh:// (upload)
        group, repo, remote_path = parse_dh_uri(dest)
        repo_name = f"{group}/{repo}"
        info(f"Uploading to [bold]dh://{group}/{repo}/{remote_path}[/bold] (branch: {branch})...")

        commit = _run_transfer(
            "Uploading",
            lambda on_progress: client.upload_many(
                repo_name,
                list(sources),
                branch=branch,
                message=message,
                remote_prefix=remote_path,
                max_workers=workers,
                multi=multi,
                on_progress=on_progress,
            ) if len(sources) > 1 else client.upload(
                repo_name,
                source,
                branch=branch,
                message=message,
                remote_prefix=remote_path,
                max_workers=workers,
                multi=multi,
                on_progress=on_progress,
            ),
        )

        success("Upload complete.")
        if commit:
            info(f"Commit: [bold]{commit.id}[/bold]")

    elif src_is_dh and dst_is_dh:
        # dh:// → dh:// (repo-to-repo copy)
        effective_src = src_branch or branch
        effective_dst = dst_branch or branch
        info(f"Copying [bold]{source}[/bold] → [bold]{dest}[/bold]...")

        commit = _run_transfer(
            "Copying",
            lambda on_progress: client.copy(
                source,
                dest,
                src_branch=effective_src,
                dst_branch=effective_dst,
                message=message,
                max_workers=workers,
                multi=multi,
                on_progress=on_progress,
            ),
        )

        success("Copy complete.")
        if commit:
            info(f"Commit: [bold]{commit.id}[/bold]")
    else:
        error("Unsupported URI combination. SOURCE or DEST must be a dh:// URI.")
        raise SystemExit(1)


@cli.command()
@click.argument("remote", required=False, default=None)
@click.option("-r", "--recursive", is_flag=True, help="Recursive listing.")
@click.option("--max-items", default=100, type=int, help="Items per page (default 100).")
@click.option("-a", "--all", "fetch_all", is_flag=True, help="Fetch all pages.")
@click.option("-b", "--branch", default="main", show_default=True, help="Branch name.")
@click.option("-l", "--long", "long_mode", is_flag=True, default=False, help="Detailed output with size, date, role.")
@click.pass_context
@handle_errors
def ls(ctx, remote, recursive, max_items, fetch_all, branch, long_mode):
    """List repositories or objects.

    Without arguments: list all repositories (like gsutil ls).
    With dh:// URI: list objects in that path (like gsutil ls gs://bucket/).
    """
    client = _get_client(ctx)

    # dh ls (no args) → repo list
    if remote is None:
        repos = client.list_repos()
        if not repos:
            warn("No repositories found.")
            return
        if long_mode:
            for r in repos:
                group = r.get("group", "")
                repo_n = r.get("repo_name", "")
                name = f"dh://{group}/{repo_n}/" if group else f"dh://{repo_n}/"
                role = r.get('role', '')
                vis = r.get('visibility', '')
                click.echo(f"{name:<30s} {role:<12s} {vis}")
        else:
            for r in repos:
                group = r.get("group", "")
                repo_n = r.get("repo_name", "")
                uri = f"dh://{group}/{repo_n}/" if group else f"dh://{repo_n}/"
                click.echo(uri)
        return

    # dh ls dh://group/repo/path → object list
    group, repo, path = parse_dh_uri(remote)
    repo_name = f"{group}/{repo}"

    all_items: list = []
    after: Optional[str] = None

    with spinner(f"Listing [bold]dh://{group}/{repo}/{path}[/bold] (branch: {branch})..."):
        while True:
            result = client.ls(
                repo_name, path, branch=branch, recursive=recursive,
                max_items=max_items, after=after,
            )
            all_items.extend(result.items)
            if not fetch_all or not result.has_more:
                break
            after = result.next_offset

    if not all_items:
        warn("No objects found.")
        return

    if long_mode:
        from datahub.console import format_size
        import datetime
        total_size = 0
        for item in all_items:
            if isinstance(item, dict):
                name = f"dh://{group}/{repo}/{item.get('path', '')}"
                size = item.get('size_bytes') or 0
                mtime = item.get('mtime') or 0
                total_size += size
                size_str = format_size(size) if size else '-'
                mtime_str = datetime.datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M') if mtime else ''
                click.echo(f"{name:<40s} {size_str:>8s}  {mtime_str}")
            else:
                click.echo(f"dh://{group}/{repo}/{item}")
        click.echo(f"{len(all_items)} object(s), {format_size(total_size)} total")
    else:
        for item in all_items:
            name = item.get('path', str(item)) if isinstance(item, dict) else str(item)
            click.echo(f"dh://{group}/{repo}/{name}")


@cli.command()
@click.argument("remote")
@click.option("-b", "--branch", default="main", show_default=True, help="Branch name.")
@click.pass_context
@handle_errors
def cat(ctx, remote, branch):
    """Print contents of a remote file to stdout."""
    from datahub.console import format_size

    client = _get_client(ctx)
    group, repo, path = parse_dh_uri(remote)

    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        tmp_path = tmp.name

    try:
        with spinner(f"Fetching [bold]{path}[/bold]..."):
            client.download(f"{group}/{repo}", path, tmp_path, branch=branch)

        # Raw output to stdout (파이프 친화적, cat은 cat)
        with open(tmp_path, "rb") as f:
            sys.stdout.buffer.write(f.read())
    finally:
        os.unlink(tmp_path)


# ──────────────────────────────────────────────
# Search (catalog)
# ──────────────────────────────────────────────


@cli.command()
@click.argument("keyword", default="")
@click.option("-c", "--catalog", default=None, help="Limit to specific catalog.")
@click.option("--modality", default=None)
@click.option("--language", default=None)
@click.option("--format", "fmt", default=None)
@click.option("--task", default=None)
@click.option("--domain", default=None)
@click.option("--owner", default=None)
@click.option("-l", "--long", "long_mode", is_flag=True, default=False, help="Detailed output with catalog and description.")
@click.pass_context
@handle_errors
def search(ctx, keyword, catalog, modality, language, fmt, task, domain,
           owner, long_mode):
    """Search datasets by keyword and/or filters."""
    filters: dict[str, str] = {}
    if modality:
        filters["modality"] = modality
    if language:
        filters["language"] = language
    if fmt:
        filters["format"] = fmt
    if task:
        filters["task"] = task
    if domain:
        filters["domain"] = domain
    if owner:
        filters["owner"] = owner

    client = _get_client(ctx)

    with spinner(f"Searching for [bold]{keyword or '*'}[/bold]..."):
        results = client.search(keyword, catalog_name=catalog, filters=filters or None)

    if not results:
        warn("No results found.")
        return

    if long_mode:
        for t in results:
            name = f"dh://{t.table_name}/"
            cat = t.catalog_name or ''
            desc = t.comment or ''
            click.echo(f"{name:<30s} {cat:<12s} {desc}")
    else:
        for t in results:
            click.echo(f"dh://{t.table_name}/")

# ──────────────────────────────────────────────
# Version control
# ──────────────────────────────────────────────


@cli.command()
@click.argument("repo")
@click.argument("branch_name")
@click.argument("message")
@click.pass_context
@handle_errors
def commit(ctx, repo, branch_name, message):
    """Create a commit."""
    client = _get_client(ctx)

    with spinner(f"Committing changes on branch '{branch_name}'..."):
        result = client.commit(repo, branch_name, message)

    success(f'Commit [bold]{result.id}[/bold]: "{message}"')


@cli.command()
@click.argument("repo")
@click.argument("source_branch")
@click.option("--into", default="main", help="Target branch (default main).")
@click.pass_context
@handle_errors
def merge(ctx, repo, source_branch, into):
    """Merge a branch."""
    client = _get_client(ctx)

    with spinner(f"Merging '{source_branch}' into '{into}'..."):
        client.merge(repo, source_branch, into=into)

    success(f"Merged [bold]{source_branch}[/bold] into [bold]{into}[/bold]")


@cli.group()
def branch():
    """Manage branches."""


@branch.command("create")
@click.argument("repo")
@click.argument("name")
@click.option("-s", "--source", default="main")
@click.pass_context
@handle_errors
def branch_create(ctx, repo, name, source):
    """Create a new branch."""
    client = _get_client(ctx)

    with spinner(f"Creating branch '{name}' from '{source}'..."):
        client.create_branch(repo, name, source=source)

    success(f"Branch [bold]{name}[/bold] created from [bold]{source}[/bold]")


@branch.command("delete")
@click.argument("repo")
@click.argument("name")
@click.pass_context
@handle_errors
def branch_delete(ctx, repo, name):
    """Delete a branch."""
    client = _get_client(ctx)

    with spinner(f"Deleting branch '{name}'..."):
        client.delete_branch(repo, name)

    success(f"Branch [bold]{name}[/bold] deleted")


@branch.command("list")
@click.argument("repo")
@click.option("-l", "--long", "long_mode", is_flag=True, default=False, help="Detailed output with commit info.")
@click.pass_context
@handle_errors
def branch_list(ctx, repo, long_mode):
    """List branches."""
    client = _get_client(ctx)

    with spinner(f"Fetching branches for '{repo}'..."):
        branches = client.list_branches(repo)

    if not branches:
        warn("No branches found.")
        return

    if long_mode:
        import datetime
        for b in branches:
            if isinstance(b, dict):
                name = b.get('name', '')
                cid = b.get('commit_id', '')[:12]
                msg = b.get('commit_message', '')
                cdate = b.get('commit_date') or 0
                date_str = datetime.datetime.fromtimestamp(cdate).strftime('%Y-%m-%d %H:%M') if cdate else ''
                click.echo(f"{name:<16s} {cid:<14s} {msg:<24s} {date_str}")
            else:
                click.echo(str(b))
    else:
        for b in branches:
            name = b.get('name', str(b)) if isinstance(b, dict) else str(b)
            click.echo(name)

# ──────────────────────────────────────────────
# Administration
# ──────────────────────────────────────────────


@cli.group()
def repo():
    """Manage repositories."""


@repo.command("create")
@click.argument("name")
@click.pass_context
@handle_errors
def repo_create(ctx, name):
    """Create a new repository."""
    client = _get_client(ctx)

    with spinner(f"Creating repository '{name}'..."):
        result = client.create_repo(name)

    success(f"Repository [bold]{name}[/bold] created")


@repo.command("delete")
@click.argument("name")
@click.option("-y", "--yes", is_flag=True, help="Skip confirmation.")
@click.pass_context
@handle_errors
def repo_delete(ctx, name, yes):
    """Delete a repository."""
    if not yes:
        warn(f"This will permanently delete repository [bold]{name}[/bold] and its GCS bucket.")
        click.confirm("  Are you sure?", abort=True)

    client = _get_client(ctx)

    with spinner(f"Deleting repository '{name}'..."):
        client.delete_repo(name)

    success(f"Repository [bold]{name}[/bold] deleted")


@repo.command("list")
@click.option("-l", "--long", "long_mode", is_flag=True, default=False, help="Detailed output with role and visibility.")
@click.pass_context
@handle_errors
def repo_list(ctx, long_mode):
    """List accessible repositories."""
    client = _get_client(ctx)

    with spinner("Fetching repositories..."):
        repos = client.list_repos()

    if not repos:
        warn("No repositories found.")
        return

    if long_mode:
        for r in repos:
            group = r.get("group", "")
            repo_n = r.get("repo_name", "")
            name = f"dh://{group}/{repo_n}/" if group else f"dh://{repo_n}/"
            role = r.get('role', '')
            vis = r.get('visibility', '')
            click.echo(f"{name:<30s} {role:<12s} {vis}")
    else:
        for r in repos:
            group = r.get("group", "")
            repo_n = r.get("repo_name", "")
            uri = f"dh://{group}/{repo_n}/" if group else f"dh://{repo_n}/"
            click.echo(uri)

@cli.group()
def access():
    """Manage repository access."""


@access.command("grant")
@click.argument("repo")
@click.argument("email")
@click.option("-r", "--role", default="developer")
@click.pass_context
@handle_errors
def access_grant(ctx, repo, email, role):
    """Grant access."""
    client = _get_client(ctx)

    with spinner(f"Granting {role} access to {email}..."):
        client.grant_access(repo, email, role=role)

    success(f"Granted [bold]{role}[/bold] access to [bold]{email}[/bold] on [bold]{repo}[/bold]")


@access.command("revoke")
@click.argument("repo")
@click.argument("email")
@click.pass_context
@handle_errors
def access_revoke(ctx, repo, email):
    """Revoke access."""
    client = _get_client(ctx)

    with spinner(f"Revoking access for {email}..."):
        client.revoke_access(repo, email)

    success(f"Revoked access for [bold]{email}[/bold] on [bold]{repo}[/bold]")


# ── catalog subgroup ──

@cli.group()
def catalog():
    """Browse catalog."""


@catalog.command("list")
@click.pass_context
@handle_errors
def catalog_list(ctx):
    """List catalogs."""
    client = _get_client(ctx)

    with spinner("Fetching catalogs..."):
        catalogs = client.list_catalogs()

    if not catalogs:
        warn("No catalogs found.")
        return

    table = make_table("Catalog")
    for c in catalogs:
        table.add_row(c)
    console.print(table)


@catalog.command("tables")
@click.argument("catalog_name")
@click.argument("schema")
@click.pass_context
@handle_errors
def catalog_tables(ctx, catalog_name, schema):
    """List tables in a catalog schema."""
    client = _get_client(ctx)

    with spinner(f"Fetching tables in {catalog_name}.{schema}..."):
        tables = client.list_tables(catalog_name, schema)

    if not tables:
        warn("No tables found.")
        return

    table = make_table("Table Name", "Type", "Format")
    for t in tables:
        table.add_row(
            t.full_name,
            t.table_type or "—",
            t.data_source_format or "—",
        )
    console.print(table)


@catalog.command("get")
@click.argument("full_name")
@click.pass_context
@handle_errors
def catalog_get(ctx, full_name):
    """Get table metadata."""
    from rich.panel import Panel

    client = _get_client(ctx)

    with spinner(f"Fetching metadata for '{full_name}'..."):
        table = client.get_table(full_name)

    lines = [
        f"[bold]Name:[/bold]     {table.full_name}",
        f"[bold]Location:[/bold] {table.storage_location}",
    ]
    if table.comment:
        lines.append(f"[bold]Comment:[/bold]  {table.comment}")
    if table.properties:
        lines.append("[bold]Properties:[/bold]")
        for k in sorted(table.properties):
            lines.append(f"  {k}: {table.properties[k]}")

    console.print(Panel("\n".join(lines), title="Table Metadata", border_style="blue"))


@catalog.command("update")
@click.argument("full_name")
@click.option("--description", "dataset_description", default=None)
@click.option("--modality", default=None)
@click.option("--language", default=None)
@click.option("--format", "fmt", default=None)
@click.option("--task", default=None)
@click.option("--domain", default=None)
@click.option("--license", "license_", default=None)
@click.option("--source", default=None)
@click.option("--version", "version_", default=None)
@click.option("--owner", default=None)
@click.option("--size-info", default=None)
@click.option("--scan-tier", default=None)
@click.option("--tags", default=None)
@click.pass_context
@handle_errors
def catalog_update(ctx, full_name, dataset_description, modality, language, fmt,
                   task, domain, license_, source, version_, owner, size_info,
                   scan_tier, tags):
    """Update dataset metadata."""
    from datahub.types import DatasetMetadata

    metadata = DatasetMetadata(
        dataset_description=dataset_description,
        modality=modality,
        language=language,
        format=fmt,
        task=task,
        domain=domain,
        license=license_,
        source=source,
        version=version_,
        owner=owner,
        size_info=size_info,
        scan_tier=scan_tier,
        tags=tags,
    )

    if all(v is None for v in (dataset_description, modality, language, fmt,
                                task, domain, license_, source, version_,
                                owner, size_info, scan_tier, tags)):
        error("At least one metadata field must be specified.")
        raise SystemExit(1)

    client = _get_client(ctx)

    with spinner(f"Updating metadata for '{full_name}'..."):
        client.update_metadata(full_name, metadata)

    success(f"Updated metadata for [bold]{full_name}[/bold]")


# ── Utilities ──

@cli.command()
@click.pass_context
@handle_errors
def whoami(ctx):
    """Show current user identity."""
    from rich.panel import Panel

    client = _get_client(ctx)
    ident = client.identity

    endpoint = "—"
    try:
        from datahub.config import DataHubConfig
        cfg = DataHubConfig.load()
        endpoint = cfg.auth.endpoint
    except Exception:
        pass

    lines = [
        f"[bold]User:[/bold]  {ident.email}",
        f"[bold]API:[/bold]   {endpoint}",
        f"[bold]Auth:[/bold]  Bearer token (valid)",
    ]
    console.print(Panel("\n".join(lines), title="DataHub Session", border_style="green"))


# ──────────────────────────────────────────────
# API Key 관리 (`datahub key ...`)
# ──────────────────────────────────────────────


@cli.group()
def key():
    """Manage API keys (머신/CI 인증용)."""


def _print_created_key(k):
    """발급 응답을 안전 안내와 함께 출력 — raw key 는 다시 못 보므로 강조."""
    from rich.panel import Panel
    msg = (
        f"[bold red]⚠️  This key is shown only once. Copy it now.[/bold red]\n\n"
        f"[bold]{k.api_key}[/bold]\n\n"
        f"id:          {k.id}\n"
        f"prefix:      {k.prefix}\n"
        f"name:        {k.name}\n"
        f"scope:       {k.scope}\n"
        f"created_at:  {k.created_at}\n"
        f"expires_at:  {k.expires_at or 'never'}"
    )
    console.print(Panel(msg, title="New API Key", border_style="red"))


@key.command("create")
@click.option("-n", "--name", required=True, help="Label (e.g. 'CI', 'laptop').")
@click.option("-s", "--scope", default="full", show_default=True)
@click.option("--expires-days", type=int, default=None,
              help="Expiration in days. Omit for a non-expiring key.")
@click.option("--json", "as_json", is_flag=True, default=False, help="Emit JSON (CI pipe-friendly).")
@click.pass_context
@handle_errors
def key_create(ctx, name, scope, expires_days, as_json):
    """Create a new API key. The raw key is shown ONLY at creation time."""
    client = _get_client(ctx)
    with spinner("Creating API key..."):
        created = client.create_api_key(name, scope=scope, expires_in_days=expires_days)

    if as_json:
        import json as _json
        click.echo(_json.dumps(created.__dict__, default=str))
        return

    _print_created_key(created)


@key.command("list")
@click.option("--include-revoked", is_flag=True, default=False, help="Show revoked keys too.")
@click.option("--json", "as_json", is_flag=True, default=False)
@click.pass_context
@handle_errors
def key_list(ctx, include_revoked, as_json):
    """List API keys (raw key is never included)."""
    client = _get_client(ctx)
    with spinner("Fetching API keys..."):
        keys = client.list_api_keys(include_revoked=include_revoked)

    if as_json:
        import json as _json
        click.echo(_json.dumps([k.__dict__ for k in keys], default=str))
        return

    if not keys:
        warn("No API keys.")
        return

    table = make_table("id", "prefix", "name", "scope", "expires_at", "last_used", "status",
                       title="API Keys")
    for k in keys:
        status = "active" if k.is_active else "revoked"
        table.add_row(
            str(k.id), k.prefix, k.name or "-", k.scope,
            str(k.expires_at or "never"), str(k.last_used or "-"), status,
        )
    console.print(table)


@key.command("revoke")
@click.argument("key_ref")
@click.pass_context
@handle_errors
def key_revoke(ctx, key_ref):
    """Revoke a key by id or prefix (idempotent)."""
    client = _get_client(ctx)
    with spinner(f"Revoking '{key_ref}'..."):
        client.revoke_api_key(key_ref)
    success(f"Revoked [bold]{key_ref}[/bold]")


@key.command("rotate")
@click.argument("key_ref")
@click.option("--json", "as_json", is_flag=True, default=False)
@click.pass_context
@handle_errors
def key_rotate(ctx, key_ref, as_json):
    """Rotate: revoke `key_ref` and issue a new key with same name/scope/expires."""
    client = _get_client(ctx)
    with spinner(f"Rotating '{key_ref}'..."):
        created = client.rotate_api_key(key_ref)

    if as_json:
        import json as _json
        click.echo(_json.dumps(created.__dict__, default=str))
        return

    _print_created_key(created)
