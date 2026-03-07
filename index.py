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
    # This looks for the key in your Vercel Settings
    api_key = os.environ.get("GEMINI_API_KEY")
    
    data = await request.json()
    mood = data.get("mood", "peaceful")
    
    # Using the stable v1 URL
    url = f"https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key={api_key}"
    
    # The Real AI Prompt
    prompt = f"The user feels {mood}. Provide a matching flower name and a short quote. Format: FLOWER: [Name] | QUOTE: [Quote]"
    
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    
    try:
        response = requests.post(url, json=payload)
        return response.json()
    except Exception as e:
        return {"error": str(e)}