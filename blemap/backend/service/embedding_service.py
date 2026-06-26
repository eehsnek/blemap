from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

app = FastAPI()
model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

class Request(BaseModel):
    text: str

@app.post("/embed")
def embed(req: Request):
    vector = model.encode(req.text).tolist()
    return { "embedding": vector }