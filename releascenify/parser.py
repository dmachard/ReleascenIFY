import re
import html
import unicodedata
from typing import Dict, Any, Optional, List

class ReleaseParser:
    def __init__(self):
        # Base patterns to extract common release info
        self.patterns = {
            'season': r'(?i)\b(?:s|saison)[\.\-\s]*(\d{1,2})\b',
            'episode': r'(?i)\b(?:e|ep|episode)[\.\-\s]*(\d{1,3})\b',
            'year': r'\b(19\d{2}|20[0-2]\d)\b',
            'resolution': r'(?i)(4KLIGHT|4K|2160[pP]|1080[pP]|720[pP]|UHD)',
            'quality': r'(?i)(WEB-DL|WEBRIP|WEBLIGHT|WEB|BLURAY|BDRIP|BRRIP|DVDRIP|HDTV)',
            'codec': r'(?i)(x265|x264|h265|h264|HEVC)',
            'audio': r'(?i)(AAC|AC3|E-AC3|DTS-HD|DTS|ATMOS|TRUEHD|DDP\d\.\d)',
            'channels': r'(7\.1|5\.1|2\.0)\b',
        }
        
    def clean_network_name(self, name: str) -> str:
        """Normalizes network names for better UI display."""
        if not name: return name
        mapping = {
            "Disney Plus": "Disney+", "Amazon Studios": "Amazon", "Amazon Prime": "Amazon",
            "HBO Max": "HBO", "Apple TV Plus": "Apple TV+", "Paramount Plus": "Paramount+"
        }
        return mapping.get(name, name)

    def extract_v_quality(self, filename: str) -> Optional[str]:
        """Detects HDR, DV, etc. from filename."""
        if not filename: return None
        fn = filename.upper()
        tags = []
        if any(x in fn for x in ["DV", "DOVI"]) or re.search(r'DOLBY[\.\-\s]VISION', fn): tags.append("DV")
        if any(x in fn for x in ["HDR", "HDR10", "HDR10PLUS", "HDR10+"]): tags.append("HDR")
        if "HLG" in fn: tags.append("HLG")
        if "10BIT" in fn or "10-BIT" in fn: tags.append("10BIT")
        if "12BIT" in fn or "12-BIT" in fn: tags.append("12BIT")
        return " ".join(sorted(list(set(tags)), reverse=True)) if tags else None

    def _extract_langs(self, fn_up: str) -> List[str]:
        langs = []
        if "TRUEFRENCH" in fn_up or "VFF" in fn_up or "FRENCH" in fn_up: langs.append("FRENCH")
        if "MULTI" in fn_up: langs.append("MULTI")
        if "VOSTFR" in fn_up or "VOST" in fn_up: langs.append("VOSTFR")
        if "VFI" in fn_up or "VFQ" in fn_up or "VF2" in fn_up or re.search(r'\bVF\b', fn_up.replace('.', ' ').replace('-', ' ').replace('_', ' ')): langs.append("VF")
        return list(dict.fromkeys(langs))

    def parse(self, filename: str) -> Dict[str, Any]:
        if not filename: return {}
        
        result = {
            "title": "", "category": "movie", "year": None, "season": None, "episode": None,
            "resolution": None, "quality": None, "codec": None, "audio": None, 
            "channels": None, "network": "", "v_quality": "", "languages": [], "group": None,
            "container": None, "extra": None
        }
        
        # Extract container/extension and strip it if valid
        fn_strip = filename.strip()
        media_exts = {'mkv', 'mp4', 'avi', 'flv', 'mov', 'wmv', 'mpg', 'mpeg', 'm4v', 'ts', 'm2ts', 'webm', 'mp3', 'flac', 'mka', 'm4a', 'aac'}
        ext_match = re.search(r'\.([a-z0-9]{3,4})$', fn_strip, flags=re.I)
        if ext_match:
            ext_val = ext_match.group(1).lower()
            if ext_val in media_exts:
                result['container'] = ext_val.upper()
                fn_strip = fn_strip[:-len(ext_match.group(0))]
                
        # Find hyphen-separated parts at the end of the filename
        group_match = re.search(r'-([A-Za-z0-9_@\.-]+)$', fn_strip)
        if group_match:
            parts = group_match.group(1).split('-')
            # Filter out any part containing a dot (meaning it's a domain/website tag like Wawacity.win)
            valid_parts = [p for p in parts if '.' not in p and p]
            if valid_parts:
                grp = valid_parts[-1]
                if grp.upper() not in ['DL', 'HDMA', 'FR', 'EN', 'HD']:
                    result['group'] = grp
                    extra_parts = [p for p in parts if p != grp]
                    if extra_parts:
                        result['extra'] = '-'.join(extra_parts)
            else:
                # No valid group, all parts are extra
                result['extra'] = '-'.join(parts)
        
        # Check for joint SxxExx
        se_match = re.search(r'(?i)\bs(\d{1,2})[\.\-\s]?[ex](\d{1,3})\b', filename)
        if se_match:
            result['season'] = str(int(se_match.group(1)))
            result['episode'] = str(int(se_match.group(2)))
        else:
            # Check individual fallbacks
            s_match = re.search(self.patterns['season'], filename)
            if s_match: result['season'] = str(int(s_match.group(1)))
            e_match = re.search(self.patterns['episode'], filename)
            if e_match: result['episode'] = str(int(e_match.group(1)))

        # Extract basic info using regex (except audio and year, handled below)
        for key, pattern in self.patterns.items():
            if key in ['season', 'episode', 'audio', 'year']: continue # Already handled
            match = re.search(pattern, filename)
            if match:
                result[key] = match.group(1).upper()

        # Extract year (prefer the last matching year if multiple are present, e.g., 1917 (2019))
        years = re.findall(self.patterns['year'], filename)
        if years:
            result['year'] = int(years[-1])

        # Extract audio with priority (Atmos/TrueHD > DTS > AC3/DDP/AAC)
        for pat in [r'(?i)(ATMOS|TRUEHD)', r'(?i)(DTS-HD|DTS)', r'(?i)(E-AC3|AC3|AAC|DDP\d\.\d|DDP)']:
            match = re.search(pat, filename)
            if match:
                result['audio'] = match.group(1).upper()
                break

        if result['season'] or result['episode']:
            result['category'] = 'series'
            
        # V_Quality
        result['v_quality'] = self.extract_v_quality(filename) or ""
        
        # Clean title
        fn_clean = html.unescape(filename)
        fn_clean = unicodedata.normalize('NFKD', fn_clean).encode('ASCII', 'ignore').decode('utf-8')
        
        # Remove Volume/Part markers
        fn_clean = re.sub(r'\b(Vol|Pt|Part|Partie)[\.\s]?\d+\b', ' ', fn_clean, flags=re.I)
        fn_clean = re.sub(r'\b\d+(?:e|ème|re|nd|rd|th)?\s+partie\b', ' ', fn_clean, flags=re.I)
        
        # Split point for title
        tags_to_split = [
            r'S\d+', r'E\d+', r'S\d+E\d+', r'SAISON[\.\-\s]?\d+', r'EPISODE[\.\-\s]?\d+', 'MULTI', 'FRENCH', 'TRUEFRENCH', 'VOSTFR', 'SUBFRENCH', 'VFF', 'VFI', 'VFQ', 'VOST', 'STFI',
            '1080P', '720P', '2160P', '4K', '4KLIGHT', 'UHD', 'BLURAY', 'BDRIP', 'DVDRIP', 'WEBRIP', 'WEB-DL', 'WEBLIGHT', 'WEB',
            'HDR', 'DV', 'HEVC', 'X264', 'X265', 'H264', 'H265', 'REPACK', 'PROPER', 'FINAL', 'INTERNAL', 'CUSTOM', 'AC3', 'DDP', 'DTS', 'ATMOS',
            r'19\d{2}', r'20[0-2]\d'
        ]
        pattern = r'[\.\[\(\s\-\_](?:' + '|'.join(tags_to_split) + r')\b'
        title = re.split(pattern, fn_clean, flags=re.I)[0]
        
        title = title.replace('.', ' ').replace('_', ' ').strip()
        title = re.sub(r'\s+', ' ', title).strip()
        
        result['title'] = title
        
        # Languages
        fn_up = filename.upper().replace('[', '.').replace(']', '.').replace('_', '.')
        result['languages'] = self._extract_langs(fn_up)
        
        # Fix resolution for 4KLIGHT
        if "4KLIGHT" in fn_up:
            result['resolution'] = "4KLIGHT"

        return result

def parse_filename(filename: str) -> Dict[str, Any]:
    parser = ReleaseParser()
    return parser.parse(filename)
