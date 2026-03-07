from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
import os
import requests

app = FastAPI()

# --- 1. The Home Page (Lobby) ---
@app.get("/")
async def home():
    # This physically hands the Lobby file to the visitor
    return FileResponse('rooms/lobby/index.html')

# --- 2. The Mirror Page ---
@app.get("/mirror")
async def mirror_page():
    # This physically hands the Mirror file to the visitor
    return FileResponse('rooms/mirror/index.html')

# --- 3. The AI Logic ---
@app.post("/api/generate")
async def ai_logic(request: Request):
    # We pull the key from your Vercel Environment Variables
    api_key = os.environ.get("GEMINI_API_KEY")
    
    data = await request.json()
    mood = data.get("mood", "peaceful")
    
    # This is the exact URL for the Gemini 1.5 Flash model
    url = f"https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key={api_key}"
    
    # We ask for a very specific format so the HTML can easily "read" it
    prompt = f"The user feels {mood}. Provide a matching flower name and a short quote. Format exactly like this: FLOWER: [Name] | QUOTE: [Quote]"
    
    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }]
    }
    
    # We send the request to Google
    response = requests.post(url, json=payload)
    return response.json()