from enum import Enum

class SourceType(str, Enum):
    NEWS = "NEWS"
    GOOGLE_TRENDS = "GOOGLE_TRENDS"
    PINTEREST = "PINTEREST"