from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

app = FastAPI(title="BleMap embeddings", version="1.0.0")
model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")


class EmbedRequest(BaseModel):
    text: str


class EmbedResponse(BaseModel):
    embedding: list[float]
    dims: int
    model: str


@app.get("/health")
def health():
    return {"ok": True, "model": "all-MiniLM-L6-v2", "dims": 384}


@app.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest):
    text = (req.text or "").strip()
    if not text:
        return EmbedResponse(embedding=[0.0] * 384, dims=384, model="all-MiniLM-L6-v2")
    vector = model.encode(text, normalize_embeddings=True).tolist()
    return EmbedResponse(
        embedding=vector,
        dims=len(vector),
        model="all-MiniLM-L6-v2",
    )
