# module_a/loaders/briefLoader.py

import json
import os
from typing import Dict


class BriefLoader:
    """
    BriefLoader (Strict + Optional competitors)
    - 핵심 설계 필드는 필수
    - competitors는 optional anchor
    """

    REQUIRED_FIELDS = {
        "brief_id": str,
        "project_name": str,
        "domain": str,
        "industry": str,
        "target": dict,
        "tone": list,
        "constraints": list,
        "created_at": str,
    }

    OPTIONAL_FIELDS = {
        "competitors": list
    }

    def __init__(self, brief_path: str):
        self.brief_path = brief_path

    def load(self) -> Dict:
        if not os.path.exists(self.brief_path):
            raise FileNotFoundError(
                f"[BriefLoader] Brief file not found: {self.brief_path}"
            )

        with open(self.brief_path, "r", encoding="utf-8") as f:
            brief = json.load(f)

        self._validate_required(brief)
        self._validate_optional(brief)

        # optional 없으면 기본값 주입
        brief.setdefault("competitors", [])

        return brief

    def _validate_required(self, brief: Dict):
        missing = []
        wrong_type = []

        for field, field_type in self.REQUIRED_FIELDS.items():
            if field not in brief:
                missing.append(field)
            elif not isinstance(brief[field], field_type):
                wrong_type.append(
                    f"{field} (expected {field_type.__name__})"
                )

        if missing or wrong_type:
            raise ValueError(
                "[BriefLoader] Invalid Brief (required fields)\n"
                f"- Missing fields: {missing}\n"
                f"- Wrong type fields: {wrong_type}"
            )

    def _validate_optional(self, brief: Dict):
        for field, field_type in self.OPTIONAL_FIELDS.items():
            if field in brief and not isinstance(brief[field], field_type):
                raise ValueError(
                    f"[BriefLoader] Optional field '{field}' "
                    f"should be {field_type.__name__}"
                )
