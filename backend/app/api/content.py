from __future__ import annotations

from typing import Any

import requests
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config import settings
from app.core.cache import cache_get, cache_set
from app.core.logging import logger
from app.db.models import Room, User
from app.db.session import get_db

router = APIRouter(prefix="/content", tags=["content"])

YOUTUBE_CHANNEL_CACHE_TTL = 24 * 60 * 60
YOUTUBE_VIDEO_CACHE_TTL = 6 * 60 * 60
YOUTUBE_HANDLE_DEFAULT = "@EliMaor555"

ROOM_KEYWORDS: dict[str, list[str]] = {
    "living_room": ["סלון", "אירוח", "פינת ישיבה", "צעצועים", "מדפים"],
    "kitchen": ["מטבח", "מזווה", "מגירות", "מקרר", "תבלינים", "כלים"],
    "bedroom": ["חדר שינה", "שידות", "מינימליזם", "שגרה", "כביסה"],
    "closet": ["ארון", "בגדים", "קיפול", "קון מארי", "גיהוץ"],
    "bathroom": ["אמבטיה", "קוסמטיקה", "מגבות", "כיור", "ניקיון"],
    "entry": ["כניסה לבית", "מפתחות", "נעליים", "תיקים"],
}

ROOM_ALIAS_MAP: dict[str, str] = {
    "living-room": "living_room",
    "living": "living_room",
    "סלון": "living_room",
    "kitchen": "kitchen",
    "מטבח": "kitchen",
    "bed-room": "bedroom",
    "bedroom": "bedroom",
    "חדר שינה": "bedroom",
    "closet": "closet",
    "wardrobe": "closet",
    "ארון": "closet",
    "bathroom": "bathroom",
    "אמבטיה": "bathroom",
    "entry": "entry",
    "entrance": "entry",
    "entryway": "entry",
    "כניסה": "entry",
}

HUB_TAXONOMY: dict[str, dict[str, list[str]]] = {
    "kitchen": {
        "category": ["מגירות", "מקרר", "מזווה", "תבלינים", "משטחים"],
        "problem": ["עומס", "בלגן", "חוסר מקום", "אי סדר", "כפילויות"],
    },
    "living_room": {
        "category": ["מדפים", "צעצועים", "שולחן סלון", "ניירת"],
        "problem": ["עומס חזותי", "אי סדר יומי", "חוסר עקביות"],
    },
    "bedroom": {
        "category": ["שידות", "מיטה", "מגירות", "כביסה"],
        "problem": ["ערימות", "חוסר שגרה", "בגדים מפוזרים"],
    },
    "closet": {
        "category": ["בגדים", "קיפול", "מדפים", "נעליים"],
        "problem": ["עודף חפצים", "קושי להיפרד", "אין מקום"],
    },
    "bathroom": {
        "category": ["כיור", "מגירות", "קוסמטיקה", "מגבות"],
        "problem": ["כפילויות", "חוסר נגישות", "עומס"],
    },
}

CONTENT_ENGINE_LIBRARY: dict[str, list[dict[str, Any]]] = {
    "kitchen": [
        {
            "title": "סדרי את מגירת הסכו\"ם",
            "category": "מגירות",
            "difficulty": "easy",
            "time_minutes": 3,
            "tip": "הוציאי הכול החוצה, החזירי רק מה שבשימוש יומיומי.",
            "example": "זרקי 3 פריטים שלא השתמשת בהם שנה.",
            "video": "https://www.youtube.com/watch?v=VITw5mQSl_A",
        },
        {
            "title": "בדקי תוקף במקרר",
            "category": "מקרר",
            "difficulty": "medium",
            "time_minutes": 5,
            "tip": "התחילי מהמדף העליון ורק אחר כך המשיכי למגירות.",
            "example": "פני 4 מוצרים שפג תוקפם.",
            "video": "https://www.youtube.com/watch?v=4R4g1kWm7Q4",
        },
        {
            "title": "ארגני את המזווה לפי קטגוריות",
            "category": "מזווה",
            "difficulty": "medium",
            "time_minutes": 8,
            "tip": "שימורים יחד, דגנים יחד, נשנושים יחד.",
            "example": "צרי שורה נפרדת למוצרים פתוחים.",
            "video": "https://www.youtube.com/watch?v=K2nq9K7kP0A",
        },
    ],
    "bedroom": [
        {
            "title": "קפלי 10 חולצות",
            "category": "בגדים",
            "difficulty": "easy",
            "time_minutes": 4,
            "tip": "קיפול אחיד חוסך זמן ומפחית עומס בעין.",
            "example": "בחרי רק ערימה אחת וסיימי אותה.",
            "video": "https://www.youtube.com/watch?v=tGdks2fM0YQ",
        },
        {
            "title": "סדרי את שידת הלילה",
            "category": "שידה",
            "difficulty": "easy",
            "time_minutes": 3,
            "tip": "השאירי רק מה שמשרת אותך לפני שינה.",
            "example": "פני 5 פריטים לא נחוצים מהמגירה.",
            "video": "https://www.youtube.com/watch?v=wbA5sKXQ50Q",
        },
    ],
    "living_room": [
        {
            "title": "פני את שולחן הסלון",
            "category": "משטחים",
            "difficulty": "easy",
            "time_minutes": 3,
            "tip": "כל דבר חוזר לבית הקבוע שלו.",
            "example": "פני 7 פריטים מפוזרים לסלים/מגירות.",
            "video": "https://www.youtube.com/watch?v=nJzB6z9fQ9U",
        },
        {
            "title": "סדרי מדף אחד",
            "category": "מדפים",
            "difficulty": "medium",
            "time_minutes": 6,
            "tip": "התמקדי במדף אחד בלבד כדי לסיים מהר.",
            "example": "הוציאי 3 פריטי נוי שלא מתאימים יותר.",
            "video": "https://www.youtube.com/watch?v=brTjQ9x8YwY",
        },
    ],
    "closet": [
        {
            "title": "סינון בגדים מהיר",
            "category": "בגדים",
            "difficulty": "hard",
            "time_minutes": 10,
            "tip": "שאלי: לבשתי את זה בשנה האחרונה?",
            "example": "העבירי 5 פריטים לשק תרומה.",
            "video": "https://www.youtube.com/watch?v=p5rXf3Wj7v4",
        },
    ],
    "bathroom": [
        {
            "title": "סדרי מגירת תמרוקים",
            "category": "מגירות",
            "difficulty": "easy",
            "time_minutes": 4,
            "tip": "הפרידי בין יומיומי לגיבוי.",
            "example": "זרקי 3 מוצרים שפג תוקפם.",
            "video": "https://www.youtube.com/watch?v=8gP7J6Qb4fI",
        }
    ],
}


def normalize_room_key(raw_room_id: str) -> str:
    candidate = (raw_room_id or "").strip().lower().replace(" ", "_")
    if candidate in ROOM_KEYWORDS:
        return candidate
    return ROOM_ALIAS_MAP.get(candidate, candidate)


def resolve_room_key(raw_room_id: str, db: Session, user: User) -> str:
    normalized = normalize_room_key(raw_room_id)
    if normalized in ROOM_KEYWORDS:
        return normalized

    if raw_room_id.isdigit():
        room = (
            db.query(Room)
            .filter(Room.id == int(raw_room_id), Room.owner_id == user.id)
            .first()
        )
        if room:
            room_from_name = normalize_room_key(room.name)
            if room_from_name in ROOM_KEYWORDS:
                return room_from_name

    return normalized


def get_channel_id_for_handle(handle: str, api_key: str) -> str:
    url = "https://www.googleapis.com/youtube/v3/channels"
    params = {"part": "id", "forHandle": handle, "key": api_key}
    response = requests.get(url, params=params, timeout=10)
    response.raise_for_status()
    items = response.json().get("items", [])
    if not items:
        raise HTTPException(status_code=404, detail="YouTube channel not found for handle")
    return items[0]["id"]


def parse_video_item(item: dict[str, Any]) -> dict[str, Any] | None:
    video_id = item.get("id", {}).get("videoId")
    snippet = item.get("snippet", {})
    if not video_id:
        return None
    thumbnail = (
        snippet.get("thumbnails", {}).get("medium", {}).get("url")
        or snippet.get("thumbnails", {}).get("high", {}).get("url")
        or snippet.get("thumbnails", {}).get("default", {}).get("url")
    )
    return {
        "videoId": video_id,
        "title": snippet.get("title"),
        "url": f"https://www.youtube.com/watch?v={video_id}",
        "thumbnail": thumbnail,
    }


def parse_video_items(
    items: list[dict[str, Any]],
    excluded_video_ids: set[str] | None = None,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    parsed: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    excluded = excluded_video_ids or set()
    for item in items:
        parsed_item = parse_video_item(item)
        if not parsed_item:
            continue
        video_id = str(parsed_item["videoId"])
        if video_id in excluded:
            continue
        if video_id in seen_ids:
            continue
        seen_ids.add(video_id)
        parsed.append(parsed_item)
        if limit is not None and len(parsed) >= limit:
            break
    return parsed


def search_channel_videos(
    api_key: str,
    channel_id: str,
    query: str,
    lang: str,
    excluded_video_ids: set[str] | None = None,
    preferred_count: int = 4,
    max_results: int = 4,
    order: str = "relevance",
) -> list[dict[str, Any]]:
    url = "https://www.googleapis.com/youtube/v3/search"
    params = {
        "part": "snippet",
        "channelId": channel_id,
        "q": query,
        "type": "video",
        "maxResults": max_results,
        "order": order,
        "relevanceLanguage": lang,
        "safeSearch": "moderate",
        "key": api_key,
    }
    response = requests.get(url, params=params, timeout=10)
    response.raise_for_status()
    items = response.json().get("items", [])
    parsed = parse_video_items(items, excluded_video_ids=excluded_video_ids, limit=preferred_count)
    if parsed:
        return parsed
    # If excluding watched videos removed everything, fallback to original list to avoid empty UX.
    return parse_video_items(items, excluded_video_ids=None, limit=preferred_count)


def all_hub_rooms() -> list[str]:
    return sorted(HUB_TAXONOMY.keys())


@router.get("/engine")
def get_content_engine(
    room: str | None = None,
    category: str | None = None,
    difficulty: str | None = None,
    max_minutes: int | None = None,
    lang: str = "he",
    limit: int = 12,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Smart Content Engine:
    room / category / difficulty / time / video
    """
    del lang  # reserved for future multilingual playbooks

    safe_limit = max(1, min(limit, 50))
    selected_room = resolve_room_key(room or "", db, user) if room else None
    category_filter = (category or "").strip().lower()
    difficulty_filter = (difficulty or "").strip().lower()
    max_minutes_filter = max_minutes if (max_minutes and max_minutes > 0) else None

    if selected_room and selected_room in CONTENT_ENGINE_LIBRARY:
        source_items = CONTENT_ENGINE_LIBRARY[selected_room]
    elif selected_room:
        source_items = []
    else:
        source_items = [item for items in CONTENT_ENGINE_LIBRARY.values() for item in items]

    filtered: list[dict[str, Any]] = []
    for item in source_items:
        item_category = str(item.get("category", "")).lower()
        item_difficulty = str(item.get("difficulty", "")).lower()
        item_time = int(item.get("time_minutes") or 0)
        if category_filter and category_filter not in item_category:
            continue
        if difficulty_filter and difficulty_filter != item_difficulty:
            continue
        if max_minutes_filter is not None and item_time > max_minutes_filter:
            continue
        filtered.append(item)
        if len(filtered) >= safe_limit:
            break

    taxonomy_source = source_items if source_items else [item for items in CONTENT_ENGINE_LIBRARY.values() for item in items]
    taxonomy = {
        "rooms": sorted(CONTENT_ENGINE_LIBRARY.keys()),
        "categories": sorted({str(item.get("category", "")) for item in taxonomy_source if item.get("category")}),
        "difficulty": sorted({str(item.get("difficulty", "")) for item in taxonomy_source if item.get("difficulty")}),
        "time": sorted({int(item.get("time_minutes", 0)) for item in taxonomy_source if item.get("time_minutes")}),
    }

    return {
        "room": selected_room,
        "category": category or None,
        "difficulty": difficulty or None,
        "max_minutes": max_minutes_filter,
        "items": filtered,
        "taxonomy": taxonomy,
        "source": "room_playbook_engine",
    }


@router.get("/hub")
def get_content_hub(
    room: str | None = None,
    problem: str | None = None,
    category: str | None = None,
    lang: str = "he",
    limit: int = 8,
    exclude_video_ids: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Content Hub:
    filter videos by room/problem/category (KonMari style learning library).
    """
    safe_limit = max(1, min(limit, 20))
    api_key = settings.YOUTUBE_API_KEY
    room_key = resolve_room_key(room or "", db, user) if room else "kitchen"
    if room_key not in HUB_TAXONOMY:
        room_key = "kitchen"

    taxonomy = HUB_TAXONOMY[room_key]
    selected_problem = (problem or "").strip()
    selected_category = (category or "").strip()
    excluded_ids = {token.strip() for token in (exclude_video_ids or "").split(",") if token.strip()}

    cache_key = f"eli-maor:content:hub:{room_key}:{selected_problem}:{selected_category}:{lang}:{','.join(sorted(excluded_ids))}:{safe_limit}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    # Graceful fallback when API key is missing.
    if not api_key:
        fallback = {
            "room": room_key,
            "problem": selected_problem or None,
            "category": selected_category or None,
            "items": [],
            "taxonomy": taxonomy,
            "source": "fallback_no_api_key",
            "channel_url": "https://www.youtube.com/@EliMaor555",
        }
        cache_set(cache_key, fallback, 300)
        return fallback

    handle = settings.YOUTUBE_HANDLE or YOUTUBE_HANDLE_DEFAULT
    channel_cache_key = f"eli-maor:content:channel:{handle}"
    channel_id = cache_get(channel_cache_key)
    if not channel_id:
        channel_id = get_channel_id_for_handle(handle, api_key)
        cache_set(channel_cache_key, channel_id, YOUTUBE_CHANNEL_CACHE_TTL)

    room_terms = ROOM_KEYWORDS.get(room_key, [])
    problem_term = selected_problem or ""
    category_term = selected_category or ""
    query = " ".join(
        token
        for token in ["אלי מאור", "סידור", "קון מארי", *room_terms, problem_term, category_term]
        if token
    ).strip()

    try:
        items = search_channel_videos(
            api_key=api_key,
            channel_id=channel_id,
            query=query,
            lang=lang,
            excluded_video_ids=excluded_ids,
            preferred_count=safe_limit,
            max_results=max(10, safe_limit),
            order="relevance",
        )
        if not items:
            items = search_channel_videos(
                api_key=api_key,
                channel_id=channel_id,
                query="אלי מאור סידור וארגון הבית",
                lang=lang,
                excluded_video_ids=excluded_ids,
                preferred_count=safe_limit,
                max_results=max(10, safe_limit),
                order="date",
            )
    except requests.HTTPError as exc:
        logger.warning(
            "Content hub YouTube API request failed",
            extra={"status_code": getattr(exc.response, "status_code", None), "room": room_key},
        )
        raise HTTPException(status_code=502, detail="YouTube API error") from exc
    except requests.RequestException as exc:
        logger.warning("Content hub YouTube API network error", extra={"error": str(exc), "room": room_key})
        raise HTTPException(status_code=502, detail="YouTube API network error") from exc

    payload = {
        "room": room_key,
        "problem": selected_problem or None,
        "category": selected_category or None,
        "items": items,
        "taxonomy": taxonomy,
        "source": "eli_channel_only",
        "channel_url": "https://www.youtube.com/@EliMaor555",
    }
    cache_set(cache_key, payload, YOUTUBE_VIDEO_CACHE_TTL)
    return payload


@router.get("/recommended-video")
def get_recommended_video(
    room_id: str,
    lang: str = "he",
    exclude_video_ids: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    api_key = settings.YOUTUBE_API_KEY
    if not api_key:
        raise HTTPException(status_code=500, detail="Missing YOUTUBE_API_KEY")

    excluded_ids = {
        token.strip() for token in (exclude_video_ids or "").split(",") if token.strip()
    }

    room_key = resolve_room_key(room_id, db, user)
    excluded_hash = ",".join(sorted(excluded_ids))
    cache_key = f"eli-maor:content:recommended:{room_key}:{lang}:{excluded_hash}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    handle = settings.YOUTUBE_HANDLE or YOUTUBE_HANDLE_DEFAULT
    channel_cache_key = f"eli-maor:content:channel:{handle}"
    channel_id = cache_get(channel_cache_key)
    if not channel_id:
        channel_id = get_channel_id_for_handle(handle, api_key)
        cache_set(channel_cache_key, channel_id, YOUTUBE_CHANNEL_CACHE_TTL)

    keywords = ROOM_KEYWORDS.get(room_key, [])
    query = " ".join(["אלי מאור", "סידור", "קון מארי", *keywords]).strip()

    try:
        videos = search_channel_videos(
            api_key=api_key,
            channel_id=channel_id,
            query=query,
            lang=lang,
            excluded_video_ids=excluded_ids,
            preferred_count=4,
            max_results=4,
            order="relevance",
        )
        if not videos:
            videos = search_channel_videos(
                api_key=api_key,
                channel_id=channel_id,
                query="אלי מאור סידור וארגון הבית",
                lang=lang,
                excluded_video_ids=excluded_ids,
                preferred_count=4,
                max_results=4,
                order="date",
            )
    except requests.HTTPError as exc:
        logger.warning(
            "YouTube API request failed",
            extra={
                "status_code": getattr(exc.response, "status_code", None),
                "room_id": room_id,
                "room_key": room_key,
                "lang": lang,
            },
        )
        raise HTTPException(status_code=502, detail="YouTube API error") from exc
    except requests.RequestException as exc:
        logger.warning("YouTube API network error", extra={"error": str(exc), "room_id": room_id})
        raise HTTPException(status_code=502, detail="YouTube API network error") from exc

    if videos:
        primary = videos[0]
        related_videos = videos[1:4]
    else:
        primary = {"videoId": None, "title": None, "url": None, "thumbnail": None}
        related_videos = []

    payload = {
        **primary,
        "related_videos": related_videos,
        "roomKey": room_key,
        "source": "eli_channel_only",
    }
    cache_set(cache_key, payload, YOUTUBE_VIDEO_CACHE_TTL)
    return payload
