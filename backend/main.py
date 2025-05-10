import json
import os
from datetime import datetime
from pprint import pprint

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from auth import router as auth_router
from auth import verify_admin, verify_token
from database import get_db_connection
from photo import router as photo_router
from share_rec import router as share_rec_router

app = FastAPI()

app.include_router(photo_router, tags=["photos"])
app.include_router(auth_router, tags=["auth"])
app.include_router(share_rec_router, tags=["share_rec"])


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "http://localhost:3000",
        "https://3e82-76-102-151-249.ngrok-free.app",
        "https://wik-split.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# python -c "import main; main.reset_db()"


def handleHacker(log_data):
    LOG_FILE = "admin_access.log"

    with open(LOG_FILE, "a") as log_file:
        log_file.write(json.dumps(log_data, indent=2) + "\n")

    raise HTTPException(status_code=403, detail="Unauthorized access")


# @app.post("/QQresetDBQZQ", dependencies=[Depends(verify_admin)])
@app.post("/QQresetDBQZQ")
def reset_db():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        print("Resetting database...")

        # Drop trigger first (PostgreSQL doesn't support IF NOT EXISTS in CREATE TRIGGER)
        # cursor.execute("DROP TRIGGER IF EXISTS delete_unused_temp_users ON splits;")
        cursor.execute("DROP FUNCTION IF EXISTS delete_unused_temp_users_fn;")

        # Drop tables (in correct dependency order)
        cursor.execute("DROP TABLE IF EXISTS splits CASCADE;")
        cursor.execute("DROP TABLE IF EXISTS items CASCADE;")
        cursor.execute("DROP TABLE IF EXISTS receipts CASCADE;")
        cursor.execute("DROP TABLE IF EXISTS users CASCADE;")

        # Create tables
        cursor.execute(
            """
            CREATE TABLE receipts (
                id SERIAL PRIMARY KEY,
                receipt_date TEXT NOT NULL, 
                total_amount REAL NOT NULL,
                creator_id INTEGER NOT NULL,
                user_order TEXT NOT NULL
            );
        """
        )

        cursor.execute(
            """
            CREATE TABLE items (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                price REAL NOT NULL,
                receipt_id INTEGER NOT NULL,
                FOREIGN KEY (receipt_id) REFERENCES receipts (id) ON DELETE CASCADE
            );
        """
        )

        cursor.execute(
            """
            CREATE TABLE users (
                id SERIAL PRIMARY KEY,
                google_id TEXT UNIQUE,
                name TEXT,
                email TEXT UNIQUE
            );
        """
        )

        cursor.execute(
            """
            CREATE TABLE splits (
                id SERIAL PRIMARY KEY,
                item_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                split_amount REAL NOT NULL,
                FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """
        )

        # Create trigger function (PostgreSQL style)
        cursor.execute(
            """
            CREATE OR REPLACE FUNCTION delete_unused_temp_users_fn()
            RETURNS TRIGGER AS $$
            BEGIN
                DELETE FROM users
                WHERE id = OLD.user_id
                  AND google_id IS NULL
                  AND NOT EXISTS (SELECT 1 FROM splits WHERE user_id = OLD.user_id)
                  AND NOT EXISTS (SELECT 1 FROM receipts WHERE creator_id = OLD.user_id);
                RETURN NULL;
            END;
            $$ LANGUAGE plpgsql;
        """
        )

        # Create the trigger
        cursor.execute(
            """
            CREATE TRIGGER delete_unused_temp_users
            AFTER DELETE ON splits
            FOR EACH ROW
            EXECUTE FUNCTION delete_unused_temp_users_fn();
        """
        )

        conn.commit()
    print("Database reset successfully")
    return {"message": "Database reset successfully"}


@app.get("/download/{file_path:path}", dependencies=[Depends(verify_admin)])
def download_file(file_path: str):
    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    filename = os.path.basename(file_path)
    print("file_path", file_path)

    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/octet-stream",
    )


@app.get("/users", dependencies=[Depends(verify_admin)])
def get_users():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM users")
        users = cursor.fetchall()
        return [row[0] for row in users]


@app.get("/receiptIDS", dependencies=[Depends(verify_admin)])
def get_all_recs():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, receipt_date FROM receipts")
        receipts = cursor.fetchall()
        print([{"id": row[0], "receipt_date": row[1]} for row in receipts])
        return [{"id": row[0], "receipt_date": row[1]} for row in receipts]


@app.get("/userReceipts")
def get_user_receipts(user_id: int, user_data: dict = Depends(verify_token)):
    real_id = user_data["user_id"]

    if str(user_id) != real_id:
        log_data = {
            "user_id": real_id,
            "timestamp": datetime.now().isoformat(),
            "path_attempted": f"/userReceipts/{user_id}",
        }
        handleHacker(log_data)

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, receipt_date, user_order FROM receipts WHERE creator_id = %s",
            (user_id,),
        )
        receipts = cursor.fetchall()

        result = []
        for row in receipts:
            try:
                names = json.loads(row[2]).keys()
            except (json.JSONDecodeError, TypeError):
                names = []

            date = row[1].split(" ")[0]  # Trims timestamp to just the date
            result.append({"id": row[0], "receipt_date": date, "names": list(names)})

        return result


@app.get("/receipts")
def reconstruct_grid(receipt_id: int, user_data: dict = Depends(verify_token)):
    real_id = user_data["user_id"]
    user_recs = get_user_receipts(real_id, user_data)
    user_rec_ids = [rec["id"] for rec in user_recs]

    if receipt_id not in user_rec_ids:
        log_data = {
            "user_id": real_id,
            "timestamp": datetime.now().isoformat(),
            "path_attempted": f"/receipts/{receipt_id}",
        }
        handleHacker(log_data)

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Fetch user_order JSON
        cursor.execute("SELECT user_order FROM receipts WHERE id = %s", (receipt_id,))
        row = cursor.fetchone()
        if not row:
            return {"error": "Receipt not found"}

        user_order = json.loads(row[0])

        # Fetch item/split data
        cursor.execute(
            """
            SELECT 
                items.id AS item_id,
                items.name AS item,
                items.price,
                users.name,
                users.id AS user_id,
                splits.split_amount
            FROM items
            LEFT JOIN splits ON splits.item_id = items.id
            LEFT JOIN users ON splits.user_id = users.id
            WHERE items.receipt_id = %s;
            """,
            (receipt_id,),
        )

        rows_data = cursor.fetchall()

    # Build item-wise split grid
    rows_dict = {}
    for item_id, item, price, username, user_id, split_amount in rows_data:
        if item_id not in rows_dict:
            rows_dict[item_id] = {"id": item_id, "item": item, "price": price}
        if username:
            rows_dict[item_id][user_id] = (
                split_amount if split_amount is not None else False
            )

    # Prepare column headers (user order)
    columns = [{"username": name, "id": uid} for name, uid in user_order.items()]
    rows = list(rows_dict.values())

    return {"rows": rows, "columns": columns}


@app.get("/loopa")
def loopa(receipt_id: int):
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Get user_order JSON for the receipt
        cursor.execute("SELECT user_order FROM receipts WHERE id = %s", (receipt_id,))
        result = cursor.fetchone()
        if not result:
            return {"error": "Receipt not found"}

        user_order = json.loads(result[0])

        # Fetch item and split details
        cursor.execute(
            """
            SELECT 
                items.id AS item_id,
                items.name AS item,
                items.price,
                users.name,
                users.id AS user_id,
                splits.split_amount
            FROM items
            LEFT JOIN splits ON splits.item_id = items.id
            LEFT JOIN users ON splits.user_id = users.id
            WHERE items.receipt_id = %s;
            """,
            (receipt_id,),
        )

        rows_data = cursor.fetchall()

    # Build row structure
    rows_dict = {}
    for item_id, item, price, username, user_id, split_amount in rows_data:
        if item_id not in rows_dict:
            rows_dict[item_id] = {"id": item_id, "item": item, "price": price}
        if username:
            rows_dict[item_id][user_id] = (
                split_amount if split_amount is not None else False
            )

    # Convert user_order dict to list of user info dicts
    columns = [
        {"username": username, "id": user_id}
        for username, user_id in user_order.items()
    ]
    rows = list(rows_dict.values())

    return {"rows": rows, "columns": columns}


@app.post("/createRec", dependencies=[Depends(verify_token)])
async def create_receipt(request: Request):
    data = await request.json()
    items = data.get("rows", [])
    users = data.get("columns", [])
    creator_id = data.get("creator_id")

    print("what backend received")
    pprint(data)

    total = sum(item["price"] for item in items)
    usernames = [col for col in users if col not in ("item", "price")]

    with get_db_connection() as conn:
        cursor = conn.cursor()
        user_ids = {}

        # Step 1: Ensure all usernames have user entries
        for username in usernames:
            cursor.execute("SELECT id FROM users WHERE name = %s", (username,))
            user = cursor.fetchone()

            if user:
                user_ids[username] = user[0]
            else:
                cursor.execute(
                    """
                    INSERT INTO users (google_id, name, email)
                    VALUES (NULL, %s, NULL)
                    RETURNING id;
                    """,
                    (username,),
                )
                user_ids[username] = cursor.fetchone()[0]

        # Step 2: Insert the receipt
        cursor.execute(
            """
            INSERT INTO receipts (receipt_date, total_amount, user_order, creator_id)
            VALUES (CURRENT_TIMESTAMP, %s, %s, %s)
            RETURNING id;
            """,
            (total, json.dumps(user_ids), creator_id),
        )
        receipt_id = cursor.fetchone()[0]

        # Step 3: Insert items and track their IDs
        item_ids = []
        for item in items:
            cursor.execute(
                """
                INSERT INTO items (name, price, receipt_id)
                VALUES (%s, %s, %s)
                RETURNING id;
                """,
                (item["item"], item["price"], receipt_id),
            )
            item_ids.append(cursor.fetchone()[0])

        # Step 4: Prepare items with fixed user ID keys
        items = fix_items(items, user_ids)
        print("Changed items:")
        pprint(items)

        # Step 5: Insert splits
        for i, item in enumerate(items):
            item_id = item_ids[i]
            for username in usernames:
                user_id = user_ids.get(username)
                split_amount = item.get(user_id, False)

                if split_amount is not False and split_amount is not None:
                    cursor.execute(
                        """
                        INSERT INTO splits (item_id, user_id, split_amount)
                        VALUES (%s, %s, %s)
                        """,
                        (item_id, user_id, float(split_amount)),
                    )

    return {"message": "Receipt created successfully", "id": receipt_id}


@app.post("/deleteRec")
async def delete_receipt(request: Request, user_data: dict = Depends(verify_token)):
    data = await request.json()
    reqID = data.get("recID", [])
    real_id = user_data["user_id"]

    userRecs = get_user_receipts(real_id, user_data)
    userRecsIDs = [rec["id"] for rec in userRecs]

    if reqID not in userRecsIDs:
        print("hacker alert")
        log_data = {
            "user_id": real_id,
            "timestamp": datetime.now().isoformat(),
            "path_attempted": f"/deleteRec/{reqID}",
        }
        handleHacker(log_data)
        raise HTTPException(status_code=403, detail="Unauthorized delete attempt")

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM receipts WHERE id = %s", (reqID,))

        return {"message": "Receipt deleted successfully"}

    except Exception as e:
        return {"error": f"Failed to delete receipt: {str(e)}"}, 500


@app.get("/")
async def root():
    return {"message": "Welcome to the API"}


@app.get("/testDB")
def test_db():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT NOW();")
        return {"time": cursor.fetchone()[0]}


@app.get("/mainTest")
def mainTest():
    print("main test")
    return {"message": "no database, no params"}


def fix_items(items, user_ids):
    """
    Normalize keys in items to integers when possible,
    and replace specific keys based on user_ids mapping.
    """
    normalized_items = []

    for item in items:
        normalized_item = {}
        for key, value in item.items():
            try:
                int_key = int(key)
                normalized_item[int_key] = value
            except (ValueError, TypeError):
                if key in user_ids:
                    normalized_item[user_ids[key]] = value
                else:
                    normalized_item[key] = value

        normalized_items.append(normalized_item)

    return normalized_items
