"""
schemaValidator.py

Module A - Preprocess responsibility:
- 수집된 데이터가 정의된 schema를 만족하는지 검증
- 데이터 의미 해석, 보정, 추론 금지
- validation 실패 시 명확한 에러 반환

Used before:
- deduplicate
- preprocess
"""

import json
import os
from typing import Dict, List

from jsonschema import validate, ValidationError


# =========================
# Config
# =========================

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCHEMA_DIR = os.path.join(BASE_DIR, "schema")


# =========================
# Core
# =========================

def load_schema(schema_name: str) -> Dict:
    schema_path = os.path.join(SCHEMA_DIR, schema_name)

    if not os.path.exists(schema_path):
        raise FileNotFoundError(f"Schema not found: {schema_name}")

    with open(schema_path, "r", encoding="utf-8") as f:
        return json.load(f)


def validate_item(item: Dict, schema: Dict) -> None:
    """
    단일 item validation
    실패 시 ValidationError 발생
    """
    validate(instance=item, schema=schema)


def validate_items(
    items: List[Dict],
    schema_name: str
) -> List[Dict]:
    """
    리스트 단위 validation
    - 통과한 item만 반환
    - 실패 item은 명시적으로 제외
    """
    schema = load_schema(schema_name)

    valid_items: List[Dict] = []
    errors: List[Dict] = []

    for idx, item in enumerate(items):
        try:
            validate_item(item, schema)
            valid_items.append(item)
        except ValidationError as e:
            errors.append({
                "index": idx,
                "error": e.message
            })

    if errors:
        print(f"[SCHEMA] {len(errors)} items failed validation")

    return valid_items
