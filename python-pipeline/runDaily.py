#파이프라인 상태관리
import os
import uuid
import traceback
from datetime import datetime

from supabase import create_client

# 파이프라인 모듈들
from collectors.runCollectors import run_collectors
from parsers.runParsers import run_parsers
from analyzers.runAnalyzers import run_analyzers


class DailyPipelineRunner:
    def __init__(self):
        # 환경 변수 로드
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_KEY")

        if not supabase_url or not supabase_key:
            raise RuntimeError("SUPABASE_URL or SUPABASE_KEY is not set")

        self.supabase = create_client(supabase_url, supabase_key)

        # 실행 컨텍스트
        self.run_id = str(uuid.uuid4())
        self.run_date = datetime.utcnow().date().isoformat()
        self.pipeline_version = "v1.0.0"

    def run(self):
        """
        일일 파이프라인 엔트리 포인트
        """
        try:
            self._create_run_record()

            # 1. 데이터 수집
            run_collectors(self.run_id)

            # 2. 파싱 / 정규화
            run_parsers(self.run_id)

            # 3. 분석 (Topic Modeling, RAG, LLM)
            run_analyzers(self.run_id)

            # 4. 성공 처리
            self._mark_success()

        except Exception as e:
            self._mark_failed(e)
            raise

    # -----------------------------
    # Run 상태 관리
    # -----------------------------

    def _create_run_record(self):
        self.supabase.table("pipeline_runs").insert({
            "run_id": self.run_id,
            "run_date": self.run_date,
            "pipeline_version": self.pipeline_version,
            "status": "running",
            "started_at": "now()"
        }).execute()

    def _mark_success(self):
        self.supabase.table("pipeline_runs").update({
            "status": "success",
            "finished_at": "now()"
        }).eq("run_id", self.run_id).execute()

    def _mark_failed(self, error):
        self.supabase.table("pipeline_runs").update({
            "status": "failed",
            "error_message": str(error),
            "stack_trace": traceback.format_exc(),
            "finished_at": "now()"
        }).eq("run_id", self.run_id).execute()


if __name__ == "__main__":
    runner = DailyPipelineRunner()
    runner.run()
