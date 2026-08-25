export async function generateEmbedding(text) {
    const response = await fetch("http://localhost:8000/embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
    });
 
    if (!response.ok) {
        throw new Error("Embedding service failed");
    }
 
    const { embedding } = await response.json();

    if (!embedding || !Array.isArray(embedding)) {
        throw new Error("Invalid embedding returned");
    }
    
    return embedding;
}