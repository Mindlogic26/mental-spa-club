from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
import os

app = FastAPI()

@app.get("/")
async def home():
    return FileResponse('rooms/lobby/index.html')

@app.get("/mirror")
async def mirror_page():
    return FileResponse('rooms/mirror/index.html')

@app.post("/api/generate")
async def ai_logic(request: Request):
    # This is a fake response to test if your Mirror can see "The Brain"
    return {
        "candidates": [{
            "content": {
                "parts": [{"text": "FLOWER: Diagnostic Daisy | QUOTE: The connection is alive!"}]
            }
        }]
    }