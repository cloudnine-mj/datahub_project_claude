"""Rich console helpers for datahub CLI.

All UI output goes to stderr so stdout remains clean for data piping.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Generator

from rich.console import Console
from rich.progress import BarColumn, Progress, SpinnerColumn, TextColumn
from rich.table import Table

# stderr for UI output — stdout is reserved for data (pipe-friendly)
console = Console(stderr=True)


def success(msg: str) -> None:
    console.print(f"[green]✓[/green] {msg}")


def error(msg: str) -> None:
    console.print(f"[red]✗[/red] {msg}")


def info(msg: str) -> None:
    console.print(f"[blue]ℹ[/blue] {msg}")


def warn(msg: str) -> None:
    console.print(f"[yellow]⚠[/yellow] {msg}")


def step(msg: str) -> None:
    """Indented step message (for sub-steps)."""
    console.print(f"  [green]✓[/green] {msg}")


@contextmanager
def spinner(msg: str) -> Generator[None, None, None]:
    """Context manager that shows a spinner while work is in progress."""
    with console.status(f"[bold]{msg}[/bold]", spinner="dots"):
        yield


def make_table(*columns: str, title: str | None = None) -> Table:
    """Create a styled table with the given column names."""
    table = Table(title=title, show_lines=False, pad_edge=True)
    for col in columns:
        table.add_column(col, style="cyan" if col == columns[0] else None)
    return table


def file_progress() -> Progress:
    """Progress bar for file transfers (upload/download)."""
    return Progress(
        SpinnerColumn(),
        TextColumn("[bold blue]{task.fields[label]}"),
        BarColumn(),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        TextColumn("{task.fields[summary]}"),
        TextColumn("{task.fields[extra]}"),
        console=console,
    )


def count_progress(description: str = "Processing") -> Progress:
    """Simple progress bar for counted items."""
    return Progress(
        SpinnerColumn(),
        TextColumn(f"[bold blue]{description}"),
        BarColumn(),
        TextColumn("{task.completed}/{task.total}"),
        console=console,
    )


def format_size(size_bytes: int | float) -> str:
    """Format byte count into human-readable string."""
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if abs(size_bytes) < 1024:
            return f"{size_bytes:.1f} {unit}" if unit != "B" else f"{int(size_bytes)} B"
        size_bytes /= 1024
    return f"{size_bytes:.1f} PB"
