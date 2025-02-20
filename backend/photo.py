import json
import os
import re
import shutil
import typing
from uuid import uuid4

import google.generativeai as genai
import pytesseract
from auth import verify_token
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from PIL import Image

router = APIRouter()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)

UPLOAD_DIR = "./uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def parse_receipt_text(raw_text):
    # Regex pattern to match lines with items and prices
    pattern = r"^([\w\s]+?)\s+([\d,.]+)$"
    items = []

    for line in raw_text.split("\n"):
        match = re.match(pattern, line.strip())
        if match:
            item_name = match.group(1).strip()
            price = match.group(2).strip().replace(",", ".")
            items.append({"item": item_name, "price": float(price)})

    return items


class Recipe(typing.TypedDict):
    price: float
    item: str


def extract_items_and_prices(raw_text):
    model = genai.GenerativeModel("gemini-1.5-flash")
    prompt = "Extract the items and prices from the given receipt text. " f"{raw_text}"
    print("prompt:", prompt)

    result = model.generate_content(
        prompt,
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json", response_schema=list[Recipe]
        ),
    )
    return result.text


@router.post("/extract-items-prices", dependencies=[Depends(verify_token)])
async def extract_items_prices(file: UploadFile = File(...)):
    try:
        filename = file.filename or f"{uuid4()}.jpg"
        temp_file_path = os.path.join(UPLOAD_DIR, filename)

        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        if not os.path.exists(temp_file_path):
            raise HTTPException(status_code=500, detail="File not found after saving.")

        try:
            image = Image.open(temp_file_path)
            image.verify()
        except Exception as img_error:
            raise HTTPException(
                status_code=500, detail=f"Invalid image file: {img_error}"
            )

        image = Image.open(temp_file_path)
        raw_text = pytesseract.image_to_string(image)
        os.remove(temp_file_path)
        print("raw_text:", raw_text)
        items = {"price": 0, "item": "test"}

        items = extract_items_and_prices(raw_text)
        items = json.loads(items)

        return {"success": True, "items": items}

    except Exception as e:
        print("Error:", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/testPhoto")
def test():
    print("photo")
    print("came with modulue")
    return {"message": "Hello witnh module photo"}
