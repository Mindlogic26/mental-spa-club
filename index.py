from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, FileResponse
import os
import requests

app = FastAPI()

# 1. The Home Page (Lobby)
@app.get("/")
async def home():
    # This sends the actual Lobby file to your browser
    return FileResponse('rooms/lobby/index.html')

# 2. The Mirror Page
@app.get("/mirror")
async def mirror_page():
    # This sends the actual Mirror file to your browser
    return FileResponse('rooms/mirror/index.html')

# 3. The AI Logic (For the Mirror to work)
@app.post("/api/generate")
async def ai_logic(request: Request):
    api_key = os.environ.get("GEMINI_API_KEY")
    data = await request.json()
    mood = data.get("mood", "peaceful")
    
    url = f"https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key={api_key}"
    prompt = f"The user feels {mood}. Provide a matching flower name and a short quote. Format: FLOWER: [Name] | QUOTE: [Quote]"
    
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    response = requests.post(url, json=payload)
    return response.json()