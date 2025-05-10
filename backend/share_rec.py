import asyncio
import os
import time
from typing import Dict, Set

from cryptography.fernet import Fernet
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from auth import verify_token

router = APIRouter()


load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY", "")

from database import get_db_connection


class ConnectionManager:

    def __init__(self):
        # Store active connections per receipt
        self.active_connections: Dict[int, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, receipt_id: int):
        await websocket.accept()
        if receipt_id not in self.active_connections:
            self.active_connections[receipt_id] = set()
        self.active_connections[receipt_id].add(websocket)

    def disconnect(self, websocket: WebSocket, receipt_id: int):
        if receipt_id in self.active_connections:
            self.active_connections[receipt_id].discard(websocket)
            if not self.active_connections[receipt_id]:
                del self.active_connections[receipt_id]

    async def broadcast_update(self, receipt_id: int, data: dict):
        if receipt_id in self.active_connections:
            for connection in self.active_connections[receipt_id]:
                try:
                    await connection.send_json(data)
                except:
                    # Handle disconnected clients
                    continue


manager = ConnectionManager()

cipher_suite = Fernet(SECRET_KEY.encode())


class ShareRequest(BaseModel):
    receipt_id: int


@router.post("/generate-share-link", dependencies=[Depends(verify_token)])
async def generate_share_link(request: ShareRequest):
    try:
        # Create the data string
        data = f"{request.receipt_id}-{int(time.time())}"

        # Encrypt the data
        encrypted_data = cipher_suite.encrypt(data.encode()).decode()

        return {"success": True, "encrypted_url": encrypted_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class VerifyRequest(BaseModel):
    encrypted_data: str


@router.post("/verify-share-link")
async def verify_share_link(request: VerifyRequest):
    try:
        # Decrypt the data
        decrypted_data = cipher_suite.decrypt(request.encrypted_data.encode()).decode()
        receipt_id, timestamp = decrypted_data.split("-")
        print("decrypted_data", decrypted_data)

        # Check if link has expired (24 hours)
        if int(timestamp) < time.time() - (24 * 60 * 60):
            raise HTTPException(status_code=400, detail="Link has expired")

        return {"success": True, "receipt_id": int(receipt_id)}
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid or expired link")


@router.websocket("/ws/{receipt_id}")
async def update(websocket: WebSocket, receipt_id: int):
    await manager.connect(websocket, receipt_id)
    try:
        while True:
            data = await websocket.receive_json()

            # 1) broadcast immediately
            await manager.broadcast_update(receipt_id, data)

            # 2) schedule the blocking DB work and loop back
            if data.get("type") == "cell_update":
                row = data["row"]
                asyncio.create_task(_background_write_splits(row))

    except WebSocketDisconnect:
        manager.disconnect(websocket, receipt_id)


async def _background_write_splits(row: dict):
    def _sync_write():
        with get_db_connection() as conn:
            cursor = conn.cursor()
            for key, value in row.items():
                if key in ("id", "item", "price"):
                    continue
                try:
                    user_id = int(key)
                    if not value:
                        cursor.execute(
                            "DELETE FROM splits WHERE item_id=%s AND user_id=%s",
                            (row["id"], user_id),
                        )
                    else:
                        amount = float(value)
                        cursor.execute(
                            "SELECT id FROM splits WHERE item_id=%s AND user_id=%s",
                            (row["id"], user_id),
                        )
                        if cursor.fetchone():
                            cursor.execute(
                                "UPDATE splits SET split_amount=%s WHERE item_id=%s AND user_id=%s",
                                (amount, row["id"], user_id),
                            )
                        else:
                            cursor.execute(
                                "INSERT INTO splits (item_id, user_id, split_amount) VALUES (%s, %s, %s)",
                                (row["id"], user_id, amount),
                            )
                except ValueError:
                    continue
            conn.commit()

    # off-load the sync work into a separate thread
    await asyncio.to_thread(_sync_write)


# @router.websocket("/wttts/{receipt_id}")
# async def updateOLD(websocket: WebSocket, receipt_id: int):
#     await manager.connect(websocket, receipt_id)
#     try:
#         while True:
#             data = await websocket.receive_json()
#
#             await manager.broadcast_update(receipt_id, data)
#
#             if data["type"] == "cell_update":
#                 item_id = data["item_id"]
#                 row = data["row"]  # Contains item details and user splits
#                 print("row", row)
#
#                 with get_db_connection() as conn:
#                     cursor = conn.cursor()
#
#                     for key, value in row.items():
#                         if key in ["id", "item", "price"]:
#                             continue
#
#                         try:
#                             user_id = int(key)
#
#                             if value in [False, None, ""]:
#                                 # ❌ Delete the split if value is empty
#                                 cursor.execute(
#                                     """
#                                     DELETE FROM splits
#                                     WHERE item_id = %s AND user_id = %s
#                                     """,
#                                     (item_id, user_id),
#                                 )
#                                 print(f"Deleted split: Item {item_id}, User {user_id}")
#
#                             else:
#                                 split_amount = float(value)
#
#                                 # ✅ Check for existing split
#                                 cursor.execute(
#                                     """
#                                     SELECT id FROM splits
#                                     WHERE item_id = %s AND user_id = %s
#                                     """,
#                                     (item_id, user_id),
#                                 )
#                                 existing_split = cursor.fetchone()
#
#                                 if existing_split:
#                                     # 🔄 Update existing split
#                                     cursor.execute(
#                                         """
#                                         UPDATE splits
#                                         SET split_amount = %s
#                                         WHERE item_id = %s AND user_id = %s
#                                         """,
#                                         (split_amount, item_id, user_id),
#                                     )
#                                     print(
#                                         f"Updated split: Item {item_id}, User {user_id}, Amount {split_amount}"
#                                     )
#                                 else:
#                                     # ➕ Insert new split
#                                     cursor.execute(
#                                         """
#                                         INSERT INTO splits (item_id, user_id, split_amount)
#                                         VALUES (%s, %s, %s)
#                                         """,
#                                         (item_id, user_id, split_amount),
#                                     )
#                                     print(
#                                         f"Inserted split: Item {item_id}, User {user_id}, Amount {split_amount}"
#                                     )
#
#                         except ValueError:
#                             print(f"Invalid user ID key: {key}, value: {value}")
#
#                     # conn.commit()
#
#             # await manager.broadcast_update(receipt_id, data)
#
#     except WebSocketDisconnect:
#         manager.disconnect(websocket, receipt_id)
#         print(f"WebSocket disconnected for receipt {receipt_id}")
