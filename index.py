from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
import os
import requests

app = FastAPI()

# 1. THE LOBBY (Home Page)
@app.get("/")
async def home():
    # This physically hands the Lobby file to the browser
    return FileResponse('rooms/lobby/index.html')

# 2. THE MIRROR PAGE
@app.get("/mirror")
async def mirror_page():
    # This physically hands the Mirror file to the browser
    return FileResponse('rooms/mirror/index.html')

# 3. THE AI BRAIN
@app.post("/api/generate")
async def ai_logic(request: Request):
    # This reaches into your Vercel "Locker" for the key
    api_key = os.environ.get("GEMINI_API_KEY")
    
    if not api_key:
        return {"error": "API Key is missing from Vercel Settings"}

    data = await request.json()
    mood = data.get("mood", "peaceful")
    
    url = f"https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key={api_key}"
    
    prompt = f"The user feels {mood}. Provide a matching flower name and a short quote. Format exactly: FLOWER: [Name] | QUOTE: [Quote]"
    
    payload = {
        "contents": [{"parts": [{"text": prompt}]}]
    }
    
    try:
        response = requests.post(url, json=payload)
        return response.json()
    except Exception as e:
        return {"error": str(e)}