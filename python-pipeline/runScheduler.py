"""
runScheduler.py

OTB 데이터 수집 스케줄러
APScheduler 기반 — 12시간마다 파이프라인 자동 실행

실행:
  python runScheduler.py

의존성:
  pip install apscheduler
"""

import os
import sys
import logging
from datetime import datetime
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.events import EVENT_JOB_EXECUTED, EVENT_JOB_ERROR

# Windows UTF-8
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

# 로그 설정
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(
            os.path.join(os.path.dirname(__file__), "scheduler.log"),
            encoding="utf-8"
        ),
    ],
)
log = logging.getLogger("OTB-Scheduler")


def run_pipeline():
    """파이프라인 실행 — runDaily.py의 run() 직접 호출"""
    log.info("=" * 50)
    log.info(f"파이프라인 시작: {datetime.utcnow().isoformat()}")
    log.info("=" * 50)

    try:
        from runDaily import run
        run()
        log.info("✅ 파이프라인 완료")
    except Exception as e:
        log.error(f"❌ 파이프라인 실패: {e}", exc_info=True)
        raise


def on_job_executed(event):
    log.info(f"[SCHEDULER] 작업 완료 — job_id: {event.job_id}")


def on_job_error(event):
    log.error(f"[SCHEDULER] 작업 실패 — job_id: {event.job_id} / {event.exception}")


if __name__ == "__main__":
    scheduler = BlockingScheduler(timezone="Asia/Seoul")

    # 12시간마다 실행 (오전 6시, 오후 6시)
    scheduler.add_job(
        run_pipeline,
        trigger="cron",
        hour="6,18",
        minute=0,
        id="otb_pipeline",
        name="OTB 데이터 수집 파이프라인",
        max_instances=1,          # 중복 실행 방지
        misfire_grace_time=300,   # 5분 이내 지연 허용
        coalesce=True,            # 밀린 실행 한 번만
    )

    scheduler.add_listener(on_job_executed, EVENT_JOB_EXECUTED)
    scheduler.add_listener(on_job_error, EVENT_JOB_ERROR)

    log.info("OTB 스케줄러 시작 — 매일 06:00 / 18:00 (KST) 실행")
    log.info("종료: Ctrl+C")

    # 시작하자마자 1회 즉시 실행
    log.info("초기 실행 시작...")
    try:
        run_pipeline()
    except Exception:
        log.warning("초기 실행 실패 — 스케줄은 계속 유지됩니다")

    try:
        scheduler.start()
    except KeyboardInterrupt:
        log.info("스케줄러 종료")
        scheduler.shutdown()
