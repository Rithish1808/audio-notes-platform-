import os
from importlib import import_module
from dotenv import load_dotenv

try:
    create_client = import_module("supabase").create_client
except ModuleNotFoundError as exc:
    if exc.name != "supabase":
        raise
    raise RuntimeError(
        "The Supabase Python package is missing. Install it with: pip install supabase"
    ) from exc

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")

if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
    raise RuntimeError("Supabase environment variables are missing")

supabase = create_client(
    SUPABASE_URL,
    SUPABASE_SECRET_KEY
)