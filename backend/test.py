# test.py
from openai import OpenAI
from dotenv import load_dotenv
import os

load_dotenv()  # 👈 This loads your .env

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

print("✅ OpenAI API key loaded and client initialized.")
