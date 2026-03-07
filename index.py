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
    api_key = os.environ.get("GEMINI_API_KEY")
    
    if not api_key:
        return {"error": "Vercel Key is MISSING from settings"}

    data = await request.json()
    mood = data.get("mood", "peaceful")
    
    # Using the most stable v1beta URL
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    
    payload = {
        "contents": [{
            "parts": [{"text": f"Give me one flower name and one quote for feeling {mood}. Format: FLOWER: [Name] | QUOTE: [Quote]"}]
        }]
    }
    
    try:
        response = requests.post(url, json=payload)
        r_json = response.json()
        
        # This checks if Google sent an error message instead of a flower
        if "error" in r_json:
            return {"error": f"Google says: {r_json['error']['message']}"}
            
        return r_json
    except Exception as e:
        return {"error": f"Connection Error: {str(e)}"}