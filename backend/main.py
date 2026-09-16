from fastapi import FastAPI

app = FastAPI(title="MetaMorph")


@app.get("/health")
def health_check():
    return {"status": "ok", "app": "MetaMorph"}
