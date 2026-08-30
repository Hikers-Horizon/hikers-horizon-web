from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def ensure_db_schema():
    """Runs idempotent ALTER TABLE checks on startup so new columns are always present."""
    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE customers ADD COLUMN IF NOT EXISTS ai_disabled BOOLEAN DEFAULT FALSE;"))
            conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_disabled BOOLEAN DEFAULT FALSE;"))
    except Exception:
        pass


try:
    ensure_db_schema()
except Exception:
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

