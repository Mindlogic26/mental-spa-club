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
    
    # 1. Check if Vercel even sees your key
    if not api_key:
        return {"error": "Key missing from Vercel settings"}

    data = await request.json()
    mood = data.get("mood", "peaceful")
    
    # 2. Use the exact V1 URL for stability
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    
    prompt = f"Give me one flower name and one short quote for someone feeling {mood}. Format: FLOWER: [Name] | QUOTE: [Quote]"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    
    # 3. Ask Google and catch any errors
    try:
        response = requests.post(url, json=payload)
        response_data = response.json()
        
        # If Google sends an error (like 'Invalid API Key'), we pass it to the Mirror
        if "error" in response_data:
            return {"error": response_data["error"]["message"]}
            
        return response_data
    except Exception as e:
        return {"error": str(e)}