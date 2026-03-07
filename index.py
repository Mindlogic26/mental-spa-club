from fastapi.responses import FileResponse
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
import os
import requests

app = FastAPI()

# This is the AI part - it stays here so all rooms can use it
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

# This makes the homepage work
@app.get("/")
async def home():
    # This tells the brain to hand the user the Lobby file immediately
    return FileResponse('rooms/lobby/index.html')

@app.get("/mirror")
async def mirror_page():
    # This does the same for the Mirror
    return FileResponse('rooms/mirror/index.html')