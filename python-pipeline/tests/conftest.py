"""
conftest.py — pytest 전역 fixture
테스트 실행 전 필수 환경변수 더미 주입 (실제 API 호출 없음)
"""

import os
os.environ.setdefault("OPENAI_API_KEY", "test-dummy-key")
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-dummy-key")
