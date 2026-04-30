"""CAS utilities: fastcdc variable-length chunking + BLAKE3 hash per chunk.

Chunk size defaults (configurable via env vars):
  DATAHUB_CHUNK_MIN  — minimum chunk size  (default: 256 KB)
  DATAHUB_CHUNK_AVG  — average chunk size  (default: 1 MB)
  DATAHUB_CHUNK_MAX  — maximum chunk size  (default: 4 MB)
"""

from __future__ import annotations

import mmap
import os
from typing import NamedTuple

MIN_CHUNK = int(os.environ.get("DATAHUB_CHUNK_MIN", str(256 * 1024)))   # 256 KB
AVG_CHUNK = int(os.environ.get("DATAHUB_CHUNK_AVG", str(1024 * 1024)))  # 1 MB
MAX_CHUNK = int(os.environ.get("DATAHUB_CHUNK_MAX", str(4096 * 1024)))  # 4 MB


class ChunkInfo(NamedTuple):
    hash: str    # BLAKE3 hex digest (64 hex chars)
    offset: int  # byte offset from start of file
    length: int  # chunk size in bytes
    data: bytes  # raw chunk bytes


def chunk_file(
    path: str,
    min_size: int = MIN_CHUNK,
    avg_size: int = AVG_CHUNK,
    max_size: int = MAX_CHUNK,
) -> list[ChunkInfo]:
    """Split a file into variable-length chunks using fastcdc and hash each with BLAKE3.

    Uses mmap so the OS pages in only the portions actually read — large files
    (multiple GB) do not need to be fully loaded into Python heap.

    Empty files produce a single zero-length chunk so callers always get at least one
    entry to register in the CAS manifest.
    """
    import blake3 as _blake3
    from fastcdc import fastcdc

    file_size = os.path.getsize(path)
    if file_size == 0:
        h = _blake3.blake3(b"").hexdigest()
        return [ChunkInfo(hash=h, offset=0, length=0, data=b"")]

    result: list[ChunkInfo] = []
    with open(path, "rb") as fh:
        with mmap.mmap(fh.fileno(), 0, access=mmap.ACCESS_READ) as mm:
            for chunk in fastcdc(mm, min_size=min_size, avg_size=avg_size, max_size=max_size):
                # Slice from mmap — only the required bytes are read from disk.
                # chunk.data is always empty in the fastcdc Cython extension.
                data = bytes(mm[chunk.offset : chunk.offset + chunk.length])
                h = _blake3.blake3(data).hexdigest()
                result.append(ChunkInfo(hash=h, offset=chunk.offset, length=chunk.length, data=data))
    return result
