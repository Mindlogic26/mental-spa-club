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
    return {"message": "The Spa is Online"}