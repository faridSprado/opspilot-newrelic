from __future__ import annotations

import logging
import sys

from app.security import SecretRedactionFilter


def configure_logging(level: str = "INFO") -> None:
    root = logging.getLogger()
    root.setLevel(level.upper())
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    handler.addFilter(SecretRedactionFilter())
    root.handlers = [handler]
