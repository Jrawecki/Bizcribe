import json
import os
import urllib.parse
import urllib.request
from typing import Optional, Tuple


def _build_query(address1: str | None, city: str | None, state: str | None, zip_code: str | None) -> str:
    parts = [address1, city, state, zip_code]
    return ", ".join([p.strip() for p in parts if p and str(p).strip()])


def geocode_address(
    address1: str | None,
    city: str | None,
    state: str | None,
    zip_code: str | None,
    *,
    timeout_seconds: int = 8,
) -> Optional[Tuple[float, float]]:
    query = _build_query(address1, city, state, zip_code)
    if not query:
        return None

    mapbox_token = os.getenv("MAPBOX_TOKEN")
    if mapbox_token:
        url = (
            "https://api.mapbox.com/geocoding/v5/mapbox.places/"
            + urllib.parse.quote(query)
            + ".json?"
            + urllib.parse.urlencode(
                {
                    "access_token": mapbox_token,
                    "limit": 1,
                    "country": "US",
                }
            )
        )
        try:
            with urllib.request.urlopen(url, timeout=timeout_seconds) as resp:
                data = json.load(resp)
            features = data.get("features") or []
            if features:
                center = features[0].get("center") or []
                if len(center) == 2:
                    lng, lat = center
                    return float(lat), float(lng)
        except Exception:
            pass

    nominatim_email = os.getenv("NOMINATIM_EMAIL")
    params = {
        "q": query,
        "format": "json",
        "limit": 1,
        "addressdetails": 0,
        "countrycodes": "us",
    }
    if nominatim_email:
        params["email"] = nominatim_email
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(params)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "bizscribe-import/1.0"})
        with urllib.request.urlopen(req, timeout=timeout_seconds) as resp:
            data = json.load(resp)
        if data:
            lat = float(data[0].get("lat"))
            lng = float(data[0].get("lon"))
            return lat, lng
    except Exception:
        return None

    return None
