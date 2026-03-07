from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
import os
import requests

app = FastAPI()

def open_room(room_folder):
    current_dir = os.path.dirname(os.path.realpath(__file__))
    file_path = os.path.join(current_dir, room_folder, "index.html")
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except Exception as e:
        return HTMLResponse(content=f"Error: {str(e)}", status_code=404)

@app.post("/api/generate-flower")
async def generate_flower(request: Request):
    api_key = os.environ.get("GEMINI_API_KEY")
    data = await request.json()
    mood = data.get("mood", "peaceful")
    
    url = f"https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key={api_key}"
    
    # We ask for a very specific format so the HTML can easily "read" it
    prompt = f"The user feels {mood}. Provide a matching flower name and a short quote. Format exactly like this: FLOWER: [Name] | QUOTE: [Quote]"
    
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    response = requests.post(url, json=payload)
    return response.json()

@app.get("/")
def read_root(): return open_room("lobby")

@app.get("/mirror")
def read_mirror(): return open_room("mirror")