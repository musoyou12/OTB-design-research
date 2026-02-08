from enum import Enum

class SignalStage(Enum):
    WHY = "WHY"        # 개념/문제 등장
    INTENT = "INTENT"  # 검색/관심
    HOW = "HOW"        # 구현/형태화


class DesignLayer(Enum):
    PRODUCT_UI = "PRODUCT_UI"
    BRAND_IDENTITY = "BRAND_IDENTITY"
    MARKETING = "MARKETING"