"""LG AI Research DataHub SDK.

data-platform-service thin client.

Usage:
    from datahub import DataClient

    client = DataClient()
    results = client.search("ner")
    client.download("nlp-lab", "training/ner-v4/", "./data/")
"""

from importlib.metadata import PackageNotFoundError, version
import warnings

warnings.filterwarnings("ignore")

# OS 네이티브 TLS 트러스트 저장소 주입 — 사내 TLS 검사 프록시 환경에서
# CERTIFICATE_VERIFY_FAILED 회귀 방지. Python<3.10 또는 truststore 미설치 시
# silently no-op. 자세한 정책은 datahub._trust 모듈 docstring 참고.
# httpx/requests/urllib3 보다 먼저 호출되어야 효과가 가장 확실하므로 최상단.
from datahub._trust import apply_os_trust as _apply_os_trust

_apply_os_trust()

_PACKAGE_NAME = "lgair-datahub"
_SOURCE_VERSION = "0.12.0"


def _resolve_version() -> str:
    try:
        return version(_PACKAGE_NAME)
    except PackageNotFoundError:
        return _SOURCE_VERSION


def get_version() -> str:
    return _resolve_version()


__version__ = _resolve_version()

from datahub.client import DataClient
from datahub.config import DataHubConfig
from datahub.types import CommitInfo, DatasetMetadata, ListResult, TableInfo, UserIdentity

__all__ = [
    "DataClient",
    "DataHubConfig",
    "CommitInfo",
    "DatasetMetadata",
    "ListResult",
    "TableInfo",
    "UserIdentity",
]
