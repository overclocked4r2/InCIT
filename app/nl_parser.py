"""Natural-language booking request parser.

Parses plain-text booking requests into structured booking data without
requiring an external LLM. Uses regex patterns and keyword matching to
extract: attendance, duration, day/time windows, room type preferences,
equipment needs, and room name requests.

When a Gemini key is configured, a small wrapper can improve the editable
draft. Its output is strictly validated and the deterministic parser remains
the fallback, so an unavailable API never prevents manual booking.
"""
from __future__ import annotations
import re
from datetime import datetime, timedelta
from typing import Any


# Day mapping
DAY_MAP = {
    "monday": "MON", "mon": "MON",
    "tuesday": "TUE", "tue": "TUE", "tues": "TUE",
    "wednesday": "WED", "wed": "WED",
    "thursday": "THU", "thu": "THU", "thur": "THU", "thurs": "THU",
    "friday": "FRI", "fri": "FRI",
    "saturday": "SAT", "sat": "SAT",
    # Hindi (romanised)
    "somvar": "MON", "somvaar": "MON", "somwar": "MON",
    "mangalvar": "TUE", "mangalvaar": "TUE", "mangalwar": "TUE",
    "budhvar": "WED", "budhvaar": "WED", "budhwar": "WED",
    "guruvar": "THU", "guruvaar": "THU", "guruwar": "THU",
    "shukravar": "FRI", "shukravaar": "FRI", "shukrawar": "FRI",
}

# Time to period mapping (18:00 = P10, etc.)
HOUR_TO_PERIOD = {
    8: 1, 9: 2, 10: 3, 11: 4, 12: 5,
    14: 6, 15: 7, 16: 8, 17: 9,
    18: 10, 19: 11, 20: 12, 21: 13,
}

# Room type keywords
ROOM_TYPE_KEYWORDS = {
    "auditorium": ["auditorium", "aud"],
    "seminar_hall": ["seminar", "seminar hall", "seminar room"],
    "lecture_hall": ["lecture hall", "lecture room", "lh"],
    "classroom": ["classroom", "class room", "small room"],
    "lab_cs": ["computer lab", "cs lab", "coding", "computers"],
    "lab_elec": ["electronics lab", "elec lab"],
    "lab_phy": ["physics lab", "phy lab"],
    "lab_civil": ["civil lab", "civil engineering lab"],
    "workshop": ["workshop", "mech workshop"],
    "outdoor": ["outdoor", "open air", "open-air", "oat"],
}

LAB_ROOM_TYPES = ["lab_cs", "lab_elec", "lab_phy", "lab_civil"]

# Equipment/needs keywords
NEEDS_KEYWORDS = {
    "projector": ["projector", "screen"],
    "pa_system": ["mic", "microphone", "pa system", "pa_system", "sound system", "speaker"],
    "stage": ["stage"],
    "whiteboard": ["whiteboard", "white board"],
    "accessible": ["wheelchair", "accessible", "wheelchair-accessible"],
    "computers": ["computers", "pc", "desktop"],
}

# Hindi mappings (romanised and Devanagari)
HINDI_MAP = {
    # romanised
    "kal": "tomorrow",
    "aaj": "today",
    "shaam": "evening",
    "sham": "evening",
    "subah": "morning",
    "dopahar": "afternoon",
    "dopehar": "afternoon",
    "log": "people",
    "logo": "people",
    "logon": "people",
    "ghante": "hours",
    "ghanta": "hour",
    "baje": "o'clock",
    "vajey": "o'clock",
    "vaje": "o'clock",
    "chahiye": "need",
    "chaahiye": "need",
    "chaiye": "need",
    "ke liye": "for",
    "ko": "",
    "se": "to",
    # Devanagari — days
    "सोमवार": "monday",
    "मंगलवार": "tuesday",
    "बुधवार": "wednesday",
    "गुरुवार": "thursday",
    "शुक्रवार": "friday",
    "शनिवार": "saturday",
    # Devanagari — rooms
    "क्लासरूम": "classroom",
    "कक्षा": "classroom",
    "सेमिनार": "seminar",
    "हॉल": "hall",
    "लेक्चर": "lecture",
    "ऑडिटोरियम": "auditorium",
    "सभागार": "auditorium",
    "लैब": "lab",
    "प्रयोगशाला": "lab",
    "कंप्यूटर": "computer",
    # Devanagari — equipment / needs
    "प्रोजेक्टर": "projector",
    "माइक्रोफोन": "microphone",
    "माइक": "mic",
    "व्हीलचेयर": "wheelchair",
    "सुगम्य": "accessible",
    "मंच": "stage",
    "व्हाइटबोर्ड": "whiteboard",
    "साउंड": "sound",
    # Devanagari — time / quantity
    "सुबह": "morning",
    "दोपहर": "afternoon",
    "शाम": "evening",
    "कल": "tomorrow",
    "आज": "today",
    "बजे": "o'clock",
    "घंटे": "hours",
    "घंटा": "hour",
    "चाहिए": "need",
    "छात्रों": "students",
    "लोगों": "people",
    "पीरियड्स": "periods",
    "पीरियड": "period",
}


def parse_booking_request(text: str, reference_date: datetime | None = None) -> dict[str, Any]:
    """Parse a natural-language booking request into structured data.
    
    Returns a dict with:
        attendance: int | None
        duration_periods: int | None
        windows: list[{day, from_period, to_period}]
        room_types: list[str]
        needs: list[str]
        requested_room: str | None
        mandatory_for_groups: list[str]
        title: str | None
        follow_up: str | None  (question to ask if info is missing)
        raw_text: str
        confidence: float  (0.0-1.0)
    """
    if reference_date is None:
        reference_date = datetime.now()
    
    text_lower = text.lower().strip()
    
    # Translate Hindi words (longest keys first so "पीरियड्स" is not clipped)
    translated = text_lower
    for hindi in sorted(HINDI_MAP, key=len, reverse=True):
        replacement = HINDI_MAP[hindi]
        if any("\u0900" <= char <= "\u097f" for char in hindi):
            translated = translated.replace(hindi, replacement)
        else:
            translated = re.sub(
                rf"(?<!\w){re.escape(hindi)}(?!\w)",
                replacement,
                translated,
                flags=re.IGNORECASE,
            )
    
    result: dict[str, Any] = {
        "attendance": None,
        "duration_periods": None,
        "windows": [],
        "room_types": [],
        "needs": [],
        "requested_room": None,
        "mandatory_for_groups": [],
        "title": None,
        "follow_up": None,
        "raw_text": text,
        "confidence": 0.0,
        "assumptions": [],
        "manual_form_message": None,
    }
    
    confidence_parts = 0
    
    # Extract attendance
    attendance = _extract_attendance(translated)
    if attendance:
        result["attendance"] = attendance
        confidence_parts += 1
    
    # Extract duration
    duration = _extract_duration(translated)
    if duration:
        result["duration_periods"] = duration
        confidence_parts += 1
    
    # Extract day and time windows
    windows = _extract_windows(translated, reference_date)
    if windows:
        result["windows"] = windows
        confidence_parts += 1
    
    # Extract room types
    room_types = _extract_room_types(translated)
    result["room_types"] = room_types if room_types else ["classroom", "lecture_hall", "seminar_hall"]
    if room_types:
        confidence_parts += 1
    
    # Extract needs/equipment
    needs = _extract_needs(translated)
    result["needs"] = needs
    if needs:
        confidence_parts += 0.5
    
    # Extract specific room request
    requested_room = _extract_room_name(text)
    if requested_room:
        result["requested_room"] = requested_room
        confidence_parts += 0.5
    
    # Extract mandatory groups
    groups = _extract_groups(translated)
    result["mandatory_for_groups"] = groups
    
    # Extract title/purpose
    title = _extract_title(text)
    if title:
        result["title"] = title

    result["assumptions"] = _extract_assumptions(translated, result, reference_date)

    # A configured LLM can fill a richer draft, but it is never trusted to
    # decide whether the booking is possible or to set request priority.
    from .llm import parse_booking_draft_with_llm
    llm_draft, fallback_message = parse_booking_draft_with_llm(text, reference_date)
    if llm_draft:
        for field in (
            "attendance", "duration_periods", "windows", "room_types", "needs",
            "requested_room", "mandatory_for_groups", "title",
        ):
            value = llm_draft[field]
            if value not in (None, []):
                result[field] = value
        result["assumptions"] = list(dict.fromkeys(result["assumptions"] + llm_draft["assumptions"]))
        result["llm_used"] = True
    else:
        result["manual_form_message"] = fallback_message
        result["llm_used"] = False
    
    # Calculate confidence
    result["confidence"] = min(1.0, confidence_parts / 4)
    
    # Determine if follow-up is needed
    follow_up = _determine_follow_up(result)
    result["follow_up"] = follow_up
    
    return result


def _extract_attendance(text: str) -> int | None:
    """Extract number of attendees."""
    patterns = [
        r"(\d+)\s*(?:people|persons|attendees|participants|students|log|members|ppl)",
        r"(?:around|about|approximately|~)\s*(\d+)",
        r"(?:for|of|seats?|capacity)\s*(\d+)",
        r"(\d+)\s*(?:people|log)",
    ]
    for pattern in patterns:
        m = re.search(pattern, text)
        if m:
            return int(m.group(1))
    
    # Standalone large numbers might be attendance
    numbers = re.findall(r"\b(\d+)\b", text)
    for n in numbers:
        val = int(n)
        if 20 <= val <= 2000:
            return val
    return None


def _extract_duration(text: str) -> int | None:
    """Extract duration in periods (hours)."""
    # Explicit period range: "periods 3-4" or "P3-P4" -> 2 periods
    m = re.search(r"(?:periods?|p)\s*(\d{1,2})\s*(?:-|–|to)\s*(?:p)?\s*(\d{1,2})\b", text)
    if m:
        start, end = int(m.group(1)), int(m.group(2))
        if end >= start:
            return end - start + 1

    # Single period: "period 5" / "P5" -> 1 period
    if re.search(r"(?:period|p)\s*\d{1,2}\b", text):
        return 1

    patterns = [
        r"(\d+)\s*(?:hour|hr|hours|hrs|ghante|ghanta|period)",
        r"(\d+)\s*(?:-|to)\s*(?:hour|hr)",
    ]
    for pattern in patterns:
        m = re.search(pattern, text)
        if m:
            return int(m.group(1))
    
    # Time range (e.g., "6 to 8 pm" = 2 hours)
    m = re.search(r"(\d{1,2})\s*(?:to|-)\s*(\d{1,2})\s*(am|pm|AM|PM)?", text)
    if m:
        start = int(m.group(1))
        end = int(m.group(2))
        ampm = m.group(3)
        if ampm and ampm.lower() == "pm" and start < 12:
            start += 12
        if ampm and ampm.lower() == "pm" and end < 12:
            end += 12
        if end > start:
            return end - start
    
    return None


def _extract_windows(text: str, ref_date: datetime) -> list[dict]:
    """Extract day/time windows."""
    windows = []
    
    # Find days
    found_days_with_positions = []
    for word, day_code in DAY_MAP.items():
        for match in re.finditer(rf"\b{re.escape(word)}\b", text):
            found_days_with_positions.append((match.start(), day_code))
    found_days = [day for _, day in sorted(found_days_with_positions)]
    
    # Handle "tomorrow"
    if "tomorrow" in text:
        tomorrow = ref_date + timedelta(days=1)
        day_names = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
        tomorrow_day = day_names[tomorrow.weekday()]
        if tomorrow_day in ["MON", "TUE", "WED", "THU", "FRI"]:
            found_days.append(tomorrow_day)
    
    # Handle "today"
    if "today" in text:
        day_names = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
        today_day = day_names[ref_date.weekday()]
        if today_day in ["MON", "TUE", "WED", "THU", "FRI"]:
            found_days.append(today_day)
    
    # Deduplicate
    found_days = list(dict.fromkeys(found_days))

    # "any day" means every teaching day
    if not found_days and re.search(r"\bany\s*day\b", text):
        found_days = ["MON", "TUE", "WED", "THU", "FRI"]

    # Find time ranges
    from_period = None
    to_period = None
    duration = _extract_duration(text)

    # Pattern: explicit period range "periods 3-4" / "P3-P4"
    m = re.search(r"(?:periods?|p)\s*(\d{1,2})\s*(?:-|–|to)\s*(?:p)?\s*(\d{1,2})\b", text)
    if m:
        from_period = int(m.group(1))
        to_period = int(m.group(2))

    # Pattern: single period "period 5" / "P5"
    if from_period is None:
        m = re.search(r"(?:period|p)\s*(\d{1,2})\b", text)
        if m:
            from_period = int(m.group(1))
            to_period = from_period

    # Pattern: "X to Y pm" or "X-Y pm"
    m = re.search(r"(\d{1,2})\s*(?:to|-)\s*(\d{1,2})\s*(am|pm|AM|PM)", text)
    if m:
        start_h = int(m.group(1))
        end_h = int(m.group(2))
        ampm = m.group(3).lower()
        if ampm == "pm":
            if start_h < 12:
                start_h += 12
            if end_h < 12:
                end_h += 12
        elif ampm == "am":
            if start_h == 12:
                start_h = 0
            if end_h == 12:
                end_h = 0
        from_period = HOUR_TO_PERIOD.get(start_h)
        to_period = HOUR_TO_PERIOD.get(end_h)
        if to_period:
            to_period -= 1  # end is inclusive, so 8pm = P12 means to_period = 11

    # Romanised Hinglish commonly writes a range as "6 se 8 baje". The
    # translator turns "se" into "to" and "baje" into "o'clock". Keep the
    # range inclusive in the same way as the English time-range parser.
    if from_period is None:
        m = re.search(r"(\d{1,2})\s*(?:to|-)\s*(\d{1,2})\s*(?:o'clock)?", text)
        if m:
            start_h, end_h = int(m.group(1)), int(m.group(2))
            if "evening" in text or "afternoon" in text:
                if start_h < 12:
                    start_h += 12
                if end_h < 12:
                    end_h += 12
            from_period = HOUR_TO_PERIOD.get(start_h)
            to_period = HOUR_TO_PERIOD.get(end_h)
            if to_period:
                to_period -= 1
    
    # Pattern: "at X pm" (single time)
    if from_period is None:
        m = re.search(r"(?:at|@)\s*(\d{1,2})\s*(am|pm|AM|PM)", text)
        if m:
            h = int(m.group(1))
            if m.group(2).lower() == "pm" and h < 12:
                h += 12
            from_period = HOUR_TO_PERIOD.get(h)
    
    # Pattern: "X baje" (Hindi)
    if from_period is None:
        m = re.search(r"(\d{1,2})\s*o'clock", text)  # "baje" was translated to "o'clock"
        if m:
            h = int(m.group(1))
            # Evening context
            if "evening" in text or "shaam" in text.lower():
                if h < 12:
                    h += 12
            from_period = HOUR_TO_PERIOD.get(h)
    
    # Handle "evening", "afternoon", "morning"
    if from_period is None:
        if "evening" in text:
            from_period = 10  # 6 PM
            if to_period is None:
                to_period = from_period + duration - 1 if duration else 13
        elif "afternoon" in text or "after lunch" in text:
            from_period = 6  # 2 PM
            if to_period is None:
                to_period = from_period + duration - 1 if duration else 13
        elif "morning" in text:
            from_period = 1  # 8 AM
            if to_period is None:
                to_period = from_period + duration - 1 if duration else 5
    
    # Calculate to_period from duration if we have from_period but not to_period
    if from_period and to_period is None and duration:
        to_period = from_period + duration - 1
    
    if found_days and from_period:
        for day in found_days:
            windows.append({
                "day": day,
                "from_period": from_period,
                "to_period": to_period or (from_period + (duration or 2) - 1),
            })
    elif found_days:
        # Day without specific time — use all day
        for day in found_days:
            windows.append({
                "day": day,
                "from_period": 1,
                "to_period": 13,
            })
    
    return windows


def _extract_assumptions(text: str, result: dict[str, Any], ref_date: datetime) -> list[str]:
    """Make every useful inferred phrase visible in the draft."""
    assumptions = []
    if "tomorrow" in text:
        tomorrow = ref_date + timedelta(days=1)
        assumptions.append(f"‘kal’ was interpreted as {tomorrow.strftime('%A')} (tomorrow).")
    if "evening" in text:
        assumptions.append("‘shaam’/evening was interpreted as the P10–P13 evening window.")
    if "after lunch" in text:
        assumptions.append("‘after lunch’ was interpreted as P6 onward.")
    if "only if free" in text and "otherwise" in text:
        assumptions.append("The first time option is preferred; the option after ‘otherwise’ is the fallback.")
    if result.get("requested_room") == "SH-2" and "accessible" in result.get("needs", []):
        assumptions.append("SH-2 is not wheelchair accessible; SH-1 is offered as an alternative for the final validity check.")
    return assumptions


def _extract_room_types(text: str) -> list[str]:
    """Extract requested room types."""
    found = []
    for rtype, keywords in ROOM_TYPE_KEYWORDS.items():
        for kw in keywords:
            if kw in text:
                if rtype not in found:
                    found.append(rtype)
                break

    # A generic "lab" request is satisfied by any lab, not just CS labs.
    if re.search(r"\blabs?\b", text):
        for rtype in LAB_ROOM_TYPES:
            if rtype not in found:
                found.append(rtype)

    return found


def _extract_needs(text: str) -> list[str]:
    """Extract equipment needs."""
    found = []
    for need, keywords in NEEDS_KEYWORDS.items():
        for kw in keywords:
            if kw in text:
                if need not in found:
                    found.append(need)
                break
    return found


def _extract_room_name(text: str) -> str | None:
    """Extract a specific room name (e.g., SH-1, AUD, CR-101)."""
    m = re.search(r"\b(SH-\d+|AUD|OAT|LH-\d+|CR-\d+|PHY-LAB|CS-LAB\d*|ELEC-LAB\d*|MECH-WS)\b", text, re.IGNORECASE)
    if m:
        return m.group(1).upper()
    return None


def _extract_groups(text: str) -> list[str]:
    """Extract student group references."""
    groups = []
    # Pattern: "Y1-A", "CSE-2", etc.
    matches = re.findall(r"\b(Y\d-[A-D]|(?:CSE|ECE|ME|CE|EEE)-\d)\b", text, re.IGNORECASE)
    for m in matches:
        groups.append(m.upper())
    
    # Pattern: "third year mechanical" etc.
    year_map = {"first": 1, "second": 2, "third": 3, "1st": 1, "2nd": 2, "3rd": 3}
    dept_map = {"mechanical": "ME", "cse": "CSE", "computer": "CSE", "ece": "ECE", "electrical": "EEE", "civil": "CE"}
    
    for year_word, year_num in year_map.items():
        if year_word in text:
            for dept_word, dept_code in dept_map.items():
                if dept_word in text:
                    groups.append(f"{dept_code}-{year_num}")
    
    return groups


def _extract_title(text: str) -> str | None:
    """Try to extract a title/event name."""
    patterns = [
        r"(?:for\s+(?:the\s+)?)([\w\s]+?)(?:\s+on|\s+at|\s+from|\s*,|\s*\.)",
        r"(?:book\s+(?:the\s+)?[\w\s]+?\s+for\s+)([\w\s]+?)(?:\s+on|\s+at|\s*,)",
    ]
    for pattern in patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            title = m.group(1).strip()
            if len(title) > 5 and len(title) < 100:
                return title
    return None


def _determine_follow_up(result: dict) -> str | None:
    """Determine if a follow-up question is needed."""
    missing = []
    
    if result["attendance"] is None:
        missing.append("expected number of attendees")
    if result["duration_periods"] is None:
        missing.append("duration (in hours)")
    if not result["windows"]:
        missing.append("preferred day and time")
    
    if missing:
        return f"Could you please specify: {', '.join(missing)}?"
    return None
