from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def ensure_db_schema():
    """Runs idempotent ALTER TABLE checks on startup compatible with both SQLite and Postgres."""
    try:
        with engine.begin() as conn:
            try:
                conn.execute(text("ALTER TABLE customers ADD COLUMN ai_disabled BOOLEAN DEFAULT 0;"))
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE leads ADD COLUMN ai_disabled BOOLEAN DEFAULT 0;"))
            except Exception:
                pass
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

