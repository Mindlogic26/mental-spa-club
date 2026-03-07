from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
import os
import requests

app = FastAPI()

@app.get("/")
async def home():
    return FileResponse('rooms/lobby/index.html')

@app.get("/mirror")
async def mirror_page():
    return FileResponse('rooms/mirror/index.html')

@app.post("/api/generate")
async def ai_logic(request: Request):
    # TEMPORARY DIRECT KEY TEST
    api_key = os.environ.get("GEMINI_API_KEY")
    
    data = await request.json()
    mood = data.get("mood", "peaceful")
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    
    payload = {
        "contents": [{
            "parts": [{"text": f"FLOWER: Rose | QUOTE: Love blooms everywhere."}]
        }]
    }
    
    response = requests.post(url, json=payload)
    return response.json()