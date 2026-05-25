from typing import Dict, Any

def get_quality_score(parsed_release: Dict[str, Any]) -> int:
    """
    Returns a numeric score for quality comparison.
    Higher score means better quality.
    Scoring priority: Resolution > Language > Video Quality > Audio > Source > Codec
    """
    score = 0
    
    # 1. Resolution
    res = (parsed_release.get("resolution") or "").lower()
    # Assuming 4K is best, then 4KLIGHT, 1080p, 720p, 480p
    # Note: DDLtower logic penalizes 4KLight vs True 4K. 
    # True 4K: 450, 4KLight: 400 (or vice versa depending on preference, here we stick to generic)
    if "4klight" in res: score += 400
    elif "2160" in res or "4k" in res: score += 450
    elif "1080" in res: score += 300
    elif "720" in res: score += 200
    elif "480" in res: score += 100
    
    # 2. Language (Multi > VF > VOSTFR)
    langs = [l.lower() for l in parsed_release.get("languages", [])]
    if "multi" in langs: score += 50
    elif "french" in langs or "vf" in langs: score += 30
    elif "vostfr" in langs: score += 10
    
    # 3. Video Quality (DV / HDR / 10bit)
    vq = (parsed_release.get("v_quality") or "").lower()
    if "dv" in vq or "dovi" in vq: score += 25
    if "hdr" in vq: score += 20
    if "10bit" in vq: score += 10
    
    # 4. Audio Quality (Atmos / TrueHD > DTS > AC3)
    aud = (parsed_release.get("audio") or "").lower()
    if "atmos" in aud or "truehd" in aud: score += 15
    elif "dts" in aud: score += 10
    elif "ac3" in aud or "ddp" in aud: score += 5

    # 5. Source Quality (BluRay > WEB-DL > HDTV)
    q = (parsed_release.get("quality") or "").lower()
    if "bluray" in q or "bdrip" in q: score += 10
    elif "web" in q: score += 7
    elif "hdtv" in q: score += 3
    
    # 6. Codec (HEVC / x265 > x264)
    c = (parsed_release.get("codec") or "").lower()
    if "265" in c or "hevc" in c: score += 5
    
    return score

def is_better_release(release_a: Dict[str, Any], release_b: Dict[str, Any]) -> bool:
    """
    Returns True if release_a is considered better than release_b.
    """
    return get_quality_score(release_a) > get_quality_score(release_b)
