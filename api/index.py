from fastapi import FastAPI
from fastapi.responses import FileResponse
import os

app = FastAPI()

@app.get("/")
def read_root():
    # This tells the brain to grab your HTML file from the public folder
    return FileResponse(os.path.join('public', 'index.html'))

@app.get("/api/health")
def health():
    return {"status": "The Mental Spa is online."}
