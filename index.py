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
    # This grabs the key from your Vercel Environment Variables
    api_key = os.environ.get("GEMINI_API_KEY")
    
    if not api_key:
        return {"error": "Key is missing in Vercel settings"}

    data = await request.json()
    mood = data.get("mood", "peaceful")
    
    # We are using the most stable 'v1' endpoint
    url = f"https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent"
    
    # Handing the key as a 'parameter' instead of inside the URL string
    params = {'key': api_key}
    
    payload = {
        "contents": [{
            "parts": [{"text": f"Give me one flower name and a short quote for the mood: {mood}. Format: FLOWER: [Name] | QUOTE: [Quote]"}]
        }]
    }
    
    try:
        # We send the request with the key separated for better security
        response = requests.post(url, json=payload, params=params)
        return response.json()
    except Exception as e:
        return {"error": str(e)}
    