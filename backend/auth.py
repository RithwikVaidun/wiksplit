import datetime
import json
import os
from datetime import datetime, timedelta

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.security import OAuth2PasswordBearer
from google.auth.transport import requests
from google.oauth2 import id_token
from jose import JWTError, jwt
from pydantic import BaseModel

load_dotenv()
router = APIRouter()
from database import get_db_connection

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
ALGORITHM = "HS256"
SECRET_KEY = os.getenv("SECRET_KEY", "")
GOOGLE_CLIENT_ID = os.getenv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "")
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # Token valid for 7 days


def get_or_create_user(user_data):
    email = user_data.get("email")
    google_id = user_data.get("google_id")
    name = user_data.get("name")

    if not email or not google_id or not name:
        raise HTTPException(status_code=400, detail="Invalid user data")

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # PostgreSQL uses %s as placeholders
        cursor.execute(
            "SELECT id, email, name FROM users WHERE google_id = %s", (google_id,)
        )
        existing_user = cursor.fetchone()

        if not existing_user:
            # Create new user if not exists
            cursor.execute(
                """
                INSERT INTO users (google_id, name, email)
                VALUES (%s, %s, %s)
                RETURNING id
                """,
                (google_id, name, email),
            )
            user_id = cursor.fetchone()[0]
            user_email = email
            user_name = name
        else:
            user_id, user_email, user_name = existing_user

        return {
            "id": user_id,
            "email": user_email,
            "name": user_name,
        }


class GoogleAuthRequest(BaseModel):
    credential: str


@router.post("/auth/google")
async def google_auth(request: GoogleAuthRequest):

    id_info = id_token.verify_oauth2_token(
        request.credential, requests.Request(), GOOGLE_CLIENT_ID
    )
    if not id_info:
        raise HTTPException(status_code=400, detail="Invalid Google credentials")

    user_data = {
        "email": id_info["email"],
        "name": id_info["name"],
        "google_id": id_info["sub"],
    }

    user = get_or_create_user(user_data)

    role = "admin" if id_info["email"] == "rithwik.vaidun@gmail.com" else "user"

    token_payload = {
        "sub": str(user["id"]),
        "exp": datetime.now() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        "email": user["email"],
        "name": user["name"],
        "role": role,
    }

    auth_token = jwt.encode(token_payload, SECRET_KEY, algorithm=ALGORITHM)

    return {"token": auth_token, "user": user}


@router.get("/auth/verify")
async def verify_user(request: Request):
    auth_header = request.headers.get("Authorization")
    print("auth_header", auth_header)

    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized: No token provided")

    token = auth_header.split(" ")[1]

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        return {
            "user": {
                "id": payload.get("sub"),
                "email": payload.get("email"),
                "name": payload.get("name"),
            }
        }
    except JWTError:
        raise HTTPException(
            status_code=401, detail="Unauthorized: Invalid or expired token"
        )


async def verify_admin(request: Request):
    user_data = await verify_token(request)
    LOG_FILE = "admin_access.log"

    if user_data["role"] != "admin":
        try:
            # Get request body and handle bytes conversion
            request_body = await request.body()
            if isinstance(request_body, bytes):
                request_body = request_body.decode("utf-8", errors="replace")

            # Define headers to exclude
            excluded_headers = {
                "sec-fetch-site",
                "sec-fetch-mode",
                "sec-fetch-dest",
                "sec-ch-ua",
                "sec-ch-ua-platform",
                "sec-ch-ua-mobile",
                "dnt",
                "accept-encoding",
                "accept-language",
                "connection",
            }

            filtered_headers = {
                k: v
                for k, v in request.headers.items()
                if k.lower() not in excluded_headers
            }
            log_data = {
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "ip_address": request.client.host if request.client else "Unknown",
                "user_agent": request.headers.get("User-Agent", "Unknown"),
                "path_attempted": str(request.url.path),
                "method": request.method,
                "query_params": str(dict(request.query_params)),
                "user_data": user_data,
                "request_body": request_body,
                "headers": filtered_headers,
                "cookies": str(request.cookies),
            }

            with open(LOG_FILE, "a") as log_file:
                log_file.write(json.dumps(log_data, indent=2) + "\n")

        except Exception as e:
            print(f"Logging error: {e}")  # Just print any errors instead of failing

        raise HTTPException(status_code=403, detail="Forbidden: Admins only")

    return user_data


async def verify_token(request: Request):
    auth_header = request.headers.get("Authorization")

    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized: No token provided")

    # Extract token (remove "Bearer ")
    token = auth_header.split(" ")[1]

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")  # Extract user ID
        role = payload.get("role", "user")

        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized: Invalid token")

    except JWTError:
        raise HTTPException(
            status_code=401, detail="Unauthorized: Invalid or expired token"
        )

    print(f"Verified user {user_id} with role {role}")
    return {"user_id": user_id, "role": role}


@router.get("/test", dependencies=[Depends(verify_token)])
def test():
    return {"message": "i got ur nose"}


@router.post("/logout")
async def logout(response: Response):
    # print("response", response)
    # response = JSONResponse(content={"message": "Logged out"})
    # response.set_cookie(key="authToken", expires=0, max_age=-1)
    response.delete_cookie(
        key="authToken",
        secure=True,
        # path="/",
        samesite="none",
        # domain="ede3-76-235-133-200.ngrok-free.app",
    )
    return {"message": "Logged out"}


# @router.get("/setCookie")
# async def set_cookie(response: Response):
#     response = JSONResponse(content={"user": "hello"})
#     response.set_cookie(
#         key="bad_cookie", value="allah", httponly=True, secure=True, samesite="strict"
#     )
#     return response
