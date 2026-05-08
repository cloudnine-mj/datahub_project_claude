from __future__ import annotations

from collections import defaultdict
from threading import Lock
from time import time


_START_TIME = time()
_LOCK = Lock()
_REQUEST_COUNT: dict[tuple[str, str, str], int] = defaultdict(int)
_REQUEST_DURATION_SUM: dict[tuple[str, str, str], float] = defaultdict(float)
_REQUEST_DURATION_MAX: dict[tuple[str, str, str], float] = defaultdict(float)


def observe_request(method: str, path: str, status_code: int, duration_seconds: float) -> None:
    key = (method, path, str(status_code))
    with _LOCK:
        _REQUEST_COUNT[key] += 1
        _REQUEST_DURATION_SUM[key] += duration_seconds
        _REQUEST_DURATION_MAX[key] = max(_REQUEST_DURATION_MAX[key], duration_seconds)


def render_metrics() -> str:
    with _LOCK:
        lines = [
            "# HELP datahub_process_uptime_seconds Process uptime in seconds.",
            "# TYPE datahub_process_uptime_seconds gauge",
            f"datahub_process_uptime_seconds {time() - _START_TIME}",
            "# HELP datahub_http_requests_total Total HTTP requests processed.",
            "# TYPE datahub_http_requests_total counter",
            "# HELP datahub_http_request_duration_seconds_sum Sum of HTTP request durations in seconds.",
            "# TYPE datahub_http_request_duration_seconds_sum counter",
            "# HELP datahub_http_request_duration_seconds_max Maximum observed HTTP request duration in seconds.",
            "# TYPE datahub_http_request_duration_seconds_max gauge",
        ]

        for key in sorted(_REQUEST_COUNT):
            method, path, status_code = key
            labels = f'method="{method}",path="{path}",status="{status_code}"'
            lines.append(f"datahub_http_requests_total{{{labels}}} {_REQUEST_COUNT[key]}")
            lines.append(f"datahub_http_request_duration_seconds_sum{{{labels}}} {_REQUEST_DURATION_SUM[key]}")
            lines.append(f"datahub_http_request_duration_seconds_max{{{labels}}} {_REQUEST_DURATION_MAX[key]}")

    return "\n".join(lines) + "\n"
