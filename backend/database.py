from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import MetaData
from config import settings

# Naming convention for constraints (useful for alembic)
convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

metadata = MetaData(naming_convention=convention)

# Engine arguments (pool parameters are not supported by SQLite)
engine_args = {
    "echo": settings.DEBUG,
}

if not settings.DATABASE_URL.startswith("sqlite"):
    engine_args["pool_pre_ping"] = True
    engine_args["pool_size"] = 10
    engine_args["max_overflow"] = 20

engine = create_async_engine(
    settings.DATABASE_URL,
    **engine_args
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    metadata = metadata


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    # Import models locally to register schemas on Base.metadata
    import models
    async with engine.begin() as conn:
        if engine.dialect.name == "postgresql":
            # Enable pgvector extension only on PostgreSQL
            try:
                await conn.execute(
                    __import__("sqlalchemy").text("CREATE EXTENSION IF NOT EXISTS vector;")
                )
            except Exception as e:
                print(f"Warning: Could not create pgvector extension: {e}")
        await conn.run_sync(Base.metadata.create_all)


async def run_migrations():
    """Add any new columns that may not exist in older DB files (safe/idempotent)."""
    from sqlalchemy import text, inspect

    new_columns = [
        ("users", "years_of_experience", "INTEGER"),
        ("users", "ai_provider", "VARCHAR(50)"),
        ("users", "ai_api_key", "VARCHAR(500)"),
        ("resumes", "parse_percent", "INTEGER"),
        ("companies", "scrape_error", "TEXT"),
    ]

    try:
        async with engine.begin() as conn:
            for table, col, dtype in new_columns:
                try:
                    cols = await conn.run_sync(
                        lambda sc, t=table: [c["name"] for c in inspect(sc).get_columns(t)]
                    )
                    if col not in cols:
                        await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {dtype}"))
                        print(f"[DB Migration] Added column: {table}.{col}")
                except Exception as col_err:
                    print(f"[DB Migration] Warning for {table}.{col}: {col_err}")
    except Exception as e:
        print(f"[DB Migration] Migration error: {e}")

