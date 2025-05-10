import os
from contextlib import contextmanager

import psycopg2
from dotenv import load_dotenv

load_dotenv()
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_URL = os.getenv("DB_URL", "localhost")

SECRET_KEY = os.getenv("SECRET_KEY", "")
DB_URL = os.getenv("DB_URL", "localhost")
ALGORITHM = "HS256"


def write_to_file(file_path, content):
    with open(file_path, "w") as file:
        file.write(content)


@contextmanager
def get_db_connection():
    conn = None
    try:
        # conn = psycopg2.connect(
        #     dbname="wikDB",
        #     user="wik_user",
        #     password=DB_PASSWORD,
        #     host="localhost",
        #     port="5432",
        # )

        conn = psycopg2.connect(DB_URL)
        yield conn
        conn.commit()
    except psycopg2.Error as e:
        if conn:
            conn.rollback()
        raise e
    finally:
        if conn:
            conn.close()
