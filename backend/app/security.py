# backend/app/security.py
from datetime import datetime, timedelta, timezone
from typing import Any, Dict
import os
from uuid import uuid4

import jwt  # PyJWT
from passlib.context import CryptContext


try:
    import bcrypt
    if not hasattr(bcrypt, "__about__"):
        class _About:
            __version__ = getattr(bcrypt, "__version__", "4.x")
        bcrypt.__about__ = _About()
except Exception:
    pass

# === Password hashing ===
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)

# === JWT config ===
SECRET_KEY = os.getenv("SECRET_KEY", "CHANGE_ME_DEV_ONLY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
REFRESH_TOKEN_EXPIRE_MINUTES = int(os.getenv("REFRESH_TOKEN_EXPIRE_MINUTES", "43200"))  # 30 days

def _create_token(subject: str, role: str, token_type: str, expires_minutes: int) -> str:
    now = datetime.now(timezone.utc)
    payload: Dict[str, Any] = {
        "sub": subject,
        "role": role,
        "type": token_type,
        "iat": int(now.timestamp()),
        "jti": str(uuid4()),
        "exp": int((now + timedelta(minutes=expires_minutes)).timestamp()),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def create_access_token(user_id: int, role: str) -> str:
    return _create_token(str(user_id), role, "access", ACCESS_TOKEN_EXPIRE_MINUTES)

def create_refresh_token(user_id: int, role: str) -> str:
    return _create_token(str(user_id), role, "refresh", REFRESH_TOKEN_EXPIRE_MINUTES)

def decode_token(token: str) -> Dict[str, Any]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError as e:
        raise ValueError("Invalid token") from e
