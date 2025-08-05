import requests

def generate_plant_name(chat: str) -> str:
    prompt = f"Respond with a sophisticated answer about plants and what they need and how they're doing in response to: {chat} and say that you cant ask that if it's not about plants. And make it as short a response as possible. I don't want long responses."

    try:
        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "llama3",
                "prompt": prompt,
                "stream": False
            },
            timeout=10
        )
        response.raise_for_status()
        result = response.json()
        return result.get("response", "").strip()

    except Exception as e:
        return f"Error generating response: {e}"
