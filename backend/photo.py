import json
import os
import shutil
import typing
from uuid import uuid4

import google.generativeai as genai
import pytesseract
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from PIL import Image

from auth import verify_token

router = APIRouter()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)

UPLOAD_DIR = "./uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


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
    print("result:", result.text)
    return result.text


@router.post("/extract-items-prices", dependencies=[Depends(verify_token)])
async def extract_items_prices(file: UploadFile = File(...)):
    print("extracting items and prices")
    print(file)
    try:
        # Validate filename
        filename = file.filename or f"{uuid4()}.jpg"
        temp_file_path = os.path.join(UPLOAD_DIR, filename)

        # Save uploaded image temporarily
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Verify if the file exists
        if not os.path.exists(temp_file_path):
            raise HTTPException(status_code=500, detail="File not found after saving.")

        # Verify image readability
        try:
            image = Image.open(temp_file_path)
            image.verify()  # Verifies if the image is not corrupt
        except Exception as img_error:
            raise HTTPException(
                status_code=500, detail=f"Invalid image file: {img_error}"
            )

        # Extract text using OCR
        image = Image.open(temp_file_path)  # Reopen image after verify
        raw_text = pytesseract.image_to_string(image)
        os.remove(temp_file_path)
        print("raw_text:", raw_text)
        items = extract_items_and_prices(raw_text)
        items = json.loads(items)
        for item in items:
            print(item)

        return {"success": True, "items": items}

    except Exception as e:
        print("Error:", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/testPhoto")
def test():
    print("photo")
    print("came with modulue")
    return {"message": "Hello witnh module photo"}
