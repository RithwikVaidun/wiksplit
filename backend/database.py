import os
import sqlite3
from contextlib import contextmanager

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(BASE_DIR, "database.db")

SECRET_KEY = os.getenv("SECRET_KEY", "")
ALGORITHM = "HS256"


def another_function():
    print("Another function")
    return 20


@contextmanager
def get_db_connection():
    conn = None
    try:
        print("db file", DB_FILE)
        conn = sqlite3.connect(DB_FILE)
        yield conn
        conn.commit()
    except sqlite3.Error as e:
        if conn:
            conn.rollback()
        raise e
    finally:
        if conn:
            conn.close()
