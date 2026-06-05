import re
import html
import unicodedata
import urllib.parse
from typing import Dict, Any, Optional, List

class ReleaseParser:
    def __init__(self):
        self.patterns = {
            'season': r'(?i)\b(?:s|saison)[\.\-\s]*(\d{1,2})\b',
            'episode': r'(?i)\b(?:e|ep|episode)[\.\-\s]*(\d{1,3})\b',
            'year': r'\b(19\d{2}|20[0-2]\d)\b',
            'resolution': r'(?i)(4KLIGHT|4K|2160[pP]|1080[pP]|720[pP]|UHD)',
            'codec': r'(?i)(x265|x264|h[\.\-]?265|h[\.\-]?264|HEVC)',
            'audio': r'(?i)(AAC|AC3|E-AC3|DTS-HD|DTS|ATMOS|TRUEHD|DDP\d\.\d|FLAC|MP3)',
            'channels': r'(7\.1|5\.1|2\.1|2\.0|1\.0)\b',
            'network': r'(?i)\b(NF|AMZN|DSNP|ATV|DSNY|HMAX|HBO|HULU)\b',
        }
        
    def normalize_network(self, name: str) -> str:
        """Normalizes network names for better UI display."""
        if not name: return name
        name_up = name.upper()
        mapping = {
            "AMZN": "Amazon Prime",
            "NF": "Netflix",
            "DSNP": "Disney+",
            "DSNY": "Disney+",
            "ATV": "Apple TV+",
            "HMAX": "HBO Max",
            "HBO": "HBO",
            "HULU": "Hulu",
            "DISNEY PLUS": "Disney+",
            "AMAZON STUDIOS": "Amazon Prime",
            "AMAZON PRIME": "Amazon Prime",
            "HBO MAX": "HBO Max",
            "APPLE TV PLUS": "Apple TV+",
            "PARAMOUNT PLUS": "Paramount+"
        }
        return mapping.get(name_up, name)

    def extract_v_quality(self, filename: str) -> Optional[str]:
        """Detects HDR, DV, etc. from filename."""
        if not filename: return None
        fn = filename.upper()
        tags = []
        if any(x in fn for x in ["DV", "DOVI"]) or re.search(r'DOLBY[\.\-\s]VISION', fn): tags.append("DV")
        
        if "HDR10+" in fn or "HDR10PLUS" in fn or "HDR10+PLUS" in fn:
            tags.append("HDR10+")
        elif "HDR10" in fn:
            tags.append("HDR10")
        elif "HDR" in fn:
            tags.append("HDR")
            
        if "HLG" in fn: tags.append("HLG")
        if "SDR" in fn: tags.append("SDR")
        if "10BIT" in fn or "10-BIT" in fn: tags.append("10BIT")
        if "12BIT" in fn or "12-BIT" in fn: tags.append("12BIT")
        return " ".join(sorted(list(set(tags)), reverse=True)) if tags else None

    def _extract_langs(self, fn_up: str) -> List[str]:
        langs = []
        if "TRUEFRENCH" in fn_up or "VFF" in fn_up:
            langs.append("VFF")
        elif "FRENCH" in fn_up:
            langs.append("FRENCH")
            
        if "MULTI" in fn_up: langs.append("MULTI")
        if "VOSTFR" in fn_up or "VOST" in fn_up: langs.append("VOSTFR")
        if "FASTSUB" in fn_up: langs.append("FASTSUB")
        
        if "VF2" in fn_up: langs.append("VF2")
        elif "VFI" in fn_up: langs.append("VFI")
        elif "VFQ" in fn_up: langs.append("VFQ")
        elif re.search(r'\bVF\b', fn_up.replace('.', ' ').replace('-', ' ').replace('_', ' ')): langs.append("VF")
        
        # Detect FR, EN and VO tags
        fn_space = fn_up.replace('.', ' ').replace('-', ' ').replace('_', ' ').replace('/', ' ')
        has_fr = re.search(r'\bFR\b', fn_space) is not None
        has_en = re.search(r'\bEN\b', fn_space) is not None
        has_vo = re.search(r'\bVO\b', fn_space) is not None
        
        if has_fr:
            # Only append generic VF if we didn't capture a more specific version
            if not any(x in langs for x in ["VF2", "VFI", "VFQ"]):
                langs.append("VF")
        if has_en:
            langs.append("EN")
        if has_vo:
            langs.append("VO")
            
        # If we have both a French language tag and English/VO, it is MULTI
        has_any_french = any(x in langs for x in ["FRENCH", "VFF", "VF", "VF2", "VFI", "VFQ"]) or has_fr
        has_any_original = has_en or has_vo or "VO" in langs or "EN" in langs
        if has_any_french and has_any_original:
            langs.append("MULTI")
            
        return list(dict.fromkeys(langs))

    def _unquote_filename(self, filename: str) -> str:
        """Decodes percent-encoded and plus-encoded characters in filename."""
        if not filename: return filename
        if '%' in filename or '+' in filename:
            cleaned = re.sub(r'(?i)(?<!HDR10)\+', ' ', filename)
            return urllib.parse.unquote(cleaned)
        return filename

    def _extract_container(self, filename: str, result: Dict[str, Any]) -> str:
        """Extracts media container from filename extension and returns stripped filename."""
        fn_strip = filename.strip()
        media_exts = {'mkv', 'mp4', 'avi', 'flv', 'mov', 'wmv', 'mpg', 'mpeg', 'm4v', 'ts', 'm2ts', 'webm', 'mp3', 'flac', 'mka', 'm4a', 'aac', 'zip', 'rar', '7z'}
        ext_match = re.search(r'\.([a-z0-9]{3,4})$', fn_strip, flags=re.I)
        if ext_match:
            ext_val = ext_match.group(1).lower()
            if ext_val in media_exts:
                result['container'] = ext_val.upper()
                return fn_strip[:-len(ext_match.group(0))]
        return fn_strip

    def _extract_group_and_extra(self, filename_stripped: str, result: Dict[str, Any]):
        """Extracts the release group and sets initial extra field from the end of stripped filename."""
        # Strip trailing bracketed/parenthesized distributor tag if it's not the whole group (e.g. -ASAP[ettv] -> -ASAP)
        filename_stripped = re.sub(r'((?:\-|[\.\s]\@)[^\[\(]+)(\[[^\]]+\]|\([^\]\)]+\))$', r'\1', filename_stripped)
        filename_stripped = filename_stripped.strip()
        
        invalid_tags = {
            # Codecs
            'X264', 'X265', 'H264', 'H265', 'HEVC', 'AV1',
            # Resolutions
            '1080P', '720P', '2160P', '4K', 'UHD', '4KLIGHT',
            # Languages
            'FRENCH', 'TRUEFRENCH', 'MULTI', 'VOSTFR', 'VOST', 'VFF', 'VFI', 'VFQ', 'VF2',
            # Source/Quality
            'BLURAY', 'BDRIP', 'BRRIP', 'WEBDL', 'WEB-DL', 'WEBRIP', 'DVDRIP', 'HDRIP', 'HDTV',
            # Audio
            'AC3', 'EAC3', 'DTS', 'AAC', 'MP3', 'FLAC', 'ATMOS', 'TRUEHD', 'DDP', 'HDMA',
            # Other common properties
            'REPACK', 'PROPER', 'FINAL', 'INTERNAL', 'CUSTOM', '10BIT', '10BITS', '12BIT', '12BITS', 'HDR', 'HDR10', 'HDR10+', 'DV', 'DOVI', 'HLG'
        }
        
        # Check for Anime style group at the beginning: [Group] Title...
        anime_match = re.match(r'^\[([^\]]+)\][\s\.]+', filename_stripped)
        if anime_match:
            candidate_grp = anime_match.group(1).strip()
            is_invalid = False
            for token in re.split(r'[\s\.\-\_]+', candidate_grp.upper()):
                if token in invalid_tags or re.match(r'^(19\d{2}|20\d{2})$', token):
                    is_invalid = True
                    break
            if not is_invalid and candidate_grp:
                result['group'] = candidate_grp
        
        is_valid_match = False
        raw_suffix = None
        
        # Find all possible starting positions of the group separator ('-' or '@')
        # We search from left to right to find the first candidate suffix that does not contain invalid tags.
        for i in range(len(filename_stripped)):
            char = filename_stripped[i]
            if char == '-':
                # Suffix starts after the hyphen
                suffix_candidate = filename_stripped[i+1:]
                match = re.match(r'^[\s\.]*(\[?[A-Za-z0-9_@\.-]+\]?)$', suffix_candidate)
                if match:
                    candidate_raw = match.group(1)
                    # Check for invalid tags in this candidate
                    if candidate_raw.startswith('[') and candidate_raw.endswith(']'):
                        candidate_clean = candidate_raw[1:-1]
                    else:
                        candidate_clean = candidate_raw
                    candidate_clean = candidate_clean.strip('[]()_-')
                    sub_parts = re.split(r'[\s\.\-]+', candidate_clean)
                    while len(sub_parts) > 1:
                        last_sub = sub_parts[-1].upper().strip('[]()_-')
                        if last_sub in invalid_tags or last_sub in {'REPACK', 'PROPER', 'FINAL', 'INTERNAL', 'CUSTOM'}:
                            sub_parts.pop()
                        else:
                            break
                    candidate_clean = '-'.join(sub_parts)
                    tokens = [t.upper().strip('[]()') for t in re.split(r'[\s\.\-\_]+', candidate_clean) if t]
                    has_invalid_tag = False
                    for token in tokens:
                        if token in invalid_tags or re.match(r'^(19\d{2}|20\d{2})$', token):
                            has_invalid_tag = True
                            break
                    if not has_invalid_tag:
                        raw_suffix = candidate_raw
                        is_valid_match = True
                        break
            elif char == '@':
                # Suffix starts with @ (must be preceded by a space, dot, or another @, or start of string)
                if i == 0 or filename_stripped[i-1] in (' ', '.', '@'):
                    suffix_candidate = filename_stripped[i:]
                    match = re.match(r'^(\[?@[A-Za-z0-9_@\.-]+\]?)$', suffix_candidate)
                    if match:
                        candidate_raw = match.group(1)
                        if candidate_raw.startswith('[') and candidate_raw.endswith(']'):
                            candidate_clean = candidate_raw[1:-1]
                        else:
                            candidate_clean = candidate_raw
                        candidate_clean = candidate_clean.strip('[]()_-')
                        sub_parts = re.split(r'[\s\.\-]+', candidate_clean)
                        while len(sub_parts) > 1:
                            last_sub = sub_parts[-1].upper().strip('[]()_-')
                            if last_sub in invalid_tags or last_sub in {'REPACK', 'PROPER', 'FINAL', 'INTERNAL', 'CUSTOM'}:
                                sub_parts.pop()
                            else:
                                break
                        candidate_clean = '-'.join(sub_parts)
                        tokens = [t.upper().strip('[]()') for t in re.split(r'[\s\.\-\_]+', candidate_clean) if t]
                        has_invalid_tag = False
                        for token in tokens:
                            if token in invalid_tags or re.match(r'^(19\d{2}|20\d{2})$', token):
                                has_invalid_tag = True
                                break
                        if not has_invalid_tag:
                            raw_suffix = candidate_raw
                            is_valid_match = True
                            break
                
        if is_valid_match and raw_suffix:
            if raw_suffix.startswith('[') and raw_suffix.endswith(']'):
                raw_suffix = raw_suffix[1:-1]
                
            parts = raw_suffix.split('-')
            
            # Clean each part of trailing known tags separated by dots
            cleaned_parts = []
            removed_tags = []
            for part in parts:
                if '.' in part:
                    sub_parts = part.split('.')
                    while len(sub_parts) > 1:
                        last_sub = sub_parts[-1].upper().strip('[]()_-')
                        if last_sub in invalid_tags or last_sub in {'REPACK', 'PROPER', 'FINAL', 'INTERNAL', 'CUSTOM'}:
                            removed_tags.append(sub_parts.pop())
                        else:
                            break
                    cleaned_parts.append('.'.join(sub_parts))
                else:
                    cleaned_parts.append(part)
            
            # Iterate backwards through cleaned_parts (excluding the last one) to find the last part containing a dot
            for i in range(len(cleaned_parts) - 2, -1, -1):
                if '.' in cleaned_parts[i]:
                    cleaned_parts = cleaned_parts[i+1:]
                    break
            
            valid_parts = [p for p in cleaned_parts if '.' not in p and p]
            if valid_parts:
                grp = valid_parts[-1].strip('[]()_-')
                if len(valid_parts) > 1 and (grp.isdigit() or len(grp) <= 2):
                    grp_prev = valid_parts[-2].strip('[]()_-')
                    grp = f"{grp_prev}-{grp}"
                    used_parts = [valid_parts[-2], valid_parts[-1]]
                else:
                    used_parts = [valid_parts[-1]]

                if grp.upper() not in ['DL', 'HDMA', 'FR', 'EN', 'HD'] and grp:
                    result['group'] = grp
                    # We create a new list preserving order but without the parts we used for the group
                    extra_parts = []
                    for p in cleaned_parts:
                        if p in used_parts:
                            used_parts.remove(p) # only remove one instance if duplicates exist
                        else:
                            extra_parts.append(p)
                            
                    if removed_tags:
                        extra_parts.extend(removed_tags)
                    if extra_parts:
                        result['extra'] = '-'.join(extra_parts)
            else:
                extra_parts = list(cleaned_parts)
                if removed_tags:
                    extra_parts.extend(removed_tags)
                if extra_parts:
                    result['extra'] = '-'.join(extra_parts)
        else:
            # Fallback for P2P/French releases where group is separated by a space/dot at the end without hyphen/at
            # Determine separator heuristic for underscores (e.g. Bender_37 is a single word if the rest uses dots/spaces)
            sep_chars = sum(filename_stripped.count(c) for c in [' ', '.'])
            underscore_count = filename_stripped.count('_')
            
            filename_for_fallback = filename_stripped.replace('][', '] [')
            if sep_chars > underscore_count:
                parts = re.split(r'[\s\.]+', filename_for_fallback)
            else:
                parts = re.split(r'[\s\.\_]+', filename_for_fallback)
                
            if parts:
                last_part = parts[-1].strip('[]()_-')
                if len(parts) >= 2:
                    prev_part = parts[-2].strip('[]()_-')
                    if last_part in ('0', '1') and prev_part.isdigit():
                        last_part = prev_part + '.' + last_part
                    elif last_part in ('264', '265') and prev_part.upper() == 'H':
                        last_part = prev_part + '.' + last_part
                
                
                # Check if last_part is a known tag
                known_tags_upper = {
                    # Codecs
                    'X264', 'X265', 'H264', 'H265', 'HEVC', 'AV1', 'DIVX', 'XVID',
                    # Resolutions
                    '1080P', '720P', '2160P', '4K', 'UHD', '4KLIGHT', '576P', '480P',
                    # Source/Quality
                    'REMUX', 'BLURAY', 'BDRIP', 'BRRIP', 'WEBDL', 'WEB-DL', 'WEBRIP', 'WEBLIGHT', 'WEB', 'DVDRIP', 'HDRIP', 'HDTV', 'HD', 'SDR',
                    # Audio
                    'AC3', 'EAC3', 'DTS', 'AAC', 'MP3', 'FLAC', 'ATMOS', 'TRUEHD', 'DDP', 'HDMA',
                    # Languages
                    'FRENCH', 'TRUEFRENCH', 'MULTI', 'VOSTFR', 'VOST', 'VFF', 'VFI', 'VFQ', 'VF2', 'VO', 'FR', 'EN', 'FASTSUB',
                    # Other common release properties
                    'REPACK', 'PROPER', 'FINAL', 'INTERNAL', 'CUSTOM', 'SUBBED', 'SUBS', 'MSUB', '10BIT', '10BITS', '12BIT', '12BITS', 'HDR', 'HDR10', 'HDR10+', 'DV', 'DOVI', 'HLG'
                }
                
                # Also handle glued bracket tags like [1080p][X265]
                last_part = last_part.replace('][', '-')
                last_part_up = last_part.upper()
                sub_parts = [sp for sp in last_part_up.split('-') if sp]
                is_known = False
                if not last_part_up:
                    is_known = True
                elif sub_parts:
                    is_known = all(
                        sp in known_tags_upper or
                        re.match(r'^(S\d+|E\d+|S\d+E\d+|SAISON\d+|EPISODE\d+)$', sp) or
                        re.match(r'^(19\d{2}|20\d{2})$', sp) or
                        re.match(r'^([1-7]\.[01])$', sp) or
                        sp in ('H.264', 'H.265')
                        for sp in sub_parts
                    )
                if not is_known and not result.get('group'):
                    result['group'] = last_part

    def _extract_season_episode(self, filename: str, result: Dict[str, Any]):
        """Extracts season and episode number, supporting joint and separate formats."""
        se_match = re.search(r'(?i)\bs(\d{1,2})[\.\-\s]?[ex](\d{1,3})\b', filename)
        if se_match:
            result['season'] = str(int(se_match.group(1)))
            result['episode'] = str(int(se_match.group(2)))
        else:
            s_match = re.search(self.patterns['season'], filename)
            if s_match: result['season'] = str(int(s_match.group(1)))
            e_match = re.search(self.patterns['episode'], filename)
            if e_match: result['episode'] = str(int(e_match.group(1)))

    def _extract_codec(self, filename: str, result: Dict[str, Any]):
        """Extracts codec tag (e.g. x265, x264, HEVC) and normalizes it."""
        match = re.search(self.patterns['codec'], filename)
        if match:
            codec_raw = match.group(1).upper().replace('.', '').replace('-', '')
            if codec_raw in ('X265', 'H265', 'HEVC'):
                result['codec'] = 'H265'
            elif codec_raw in ('X264', 'H264'):
                result['codec'] = 'H264'
            else:
                result['codec'] = codec_raw

    def _extract_resolution(self, filename: str, result: Dict[str, Any]):
        """Extracts resolution (e.g. 1080p, 2160p, 4K, UHD, 4KLIGHT) and normalizes it."""
        fn_up = filename.upper()
        if "4KLIGHT" in fn_up:
            result['resolution'] = "4KLIGHT"
            return
            
        match = re.search(self.patterns['resolution'], filename)
        if match:
            res_raw = match.group(1).upper()
            if res_raw in ('4K', 'UHD', '2160P'):
                result['resolution'] = '2160P'
            else:
                result['resolution'] = res_raw

    def _extract_network(self, filename: str, result: Dict[str, Any]):
        """Extracts network name (streaming platform) and normalizes it."""
        match = re.search(self.patterns['network'], filename)
        if match:
            result['network'] = self.normalize_network(match.group(1).upper())

    def _extract_channels(self, filename: str, result: Dict[str, Any]):
        """Extracts audio channels count (e.g. 5.1, 7.1, 2.0)."""
        match = re.search(self.patterns['channels'], filename)
        if match:
            result['channels'] = match.group(1)

    def _extract_year(self, filename: str, result: Dict[str, Any]):
        """Extracts the release year, preferring the last match."""
        years = re.findall(self.patterns['year'], filename)
        if years:
            result['year'] = int(years[-1])

    def _extract_audio(self, filename: str, result: Dict[str, Any]):
        """Extracts audio format with priority matching and normalization."""
        fn = filename.upper()
        
        # Check for Atmos
        has_atmos = "ATMOS" in fn
        
        # Find base codec
        codec = None
        for pat in [r'(TRUEHD)', r'(DTS-HD|DTS)', r'(E-AC3|EAC3|AC3|AAC|FLAC|MP3|DDP\d\.\d|DDP)']:
            match = re.search(pat, fn)
            if match:
                codec = match.group(1)
                break
                
        if codec:
            base_audio = codec
            if base_audio.startswith("DDP") or base_audio in ["E-AC3", "EAC3"]:
                base_audio = "EAC3"
                
            if has_atmos:
                result['audio'] = f"{base_audio} ATMOS"
            else:
                result['audio'] = base_audio
        elif has_atmos:
            result['audio'] = "ATMOS"

    def _extract_quality(self, filename: str, result: Dict[str, Any]):
        """Extracts source quality with priority matching."""
        for pat in [r'(?i)(REMUX)', r'(?i)(BLURAY|BDRIP|BRRIP)', r'(?i)(WEB-DL|WEBDL|WEBRIP|WEBLIGHT|WEB)', r'(?i)(DVDRIP)', r'(?i)(HDRIP)', r'(?i)(HDTV)']:
            match = re.search(pat, filename)
            if match:
                qual_raw = match.group(1).upper()
                if qual_raw in ('WEBDL', 'WEB-DL', 'WEB'):
                    result['quality'] = 'WEB-DL'
                else:
                    result['quality'] = qual_raw
                break

    def _extract_title(self, filename: str, result: Dict[str, Any]):
        """Cleans the filename and extracts the title using split tags."""
        fn_clean = html.unescape(filename)
        fn_clean = unicodedata.normalize('NFKD', fn_clean).encode('ASCII', 'ignore').decode('utf-8')

        tags_to_split = [
            r'S\d+', r'E\d+', r'S\d+E\d+', r'SAISON[\.\-\s]?\d+', r'EPISODE[\.\-\s]?\d+', 'MULTI', 'FRENCH', 'TRUEFRENCH', 'VOSTFR', 'SUBFRENCH', 'SUBBED', 'SUBS', 'MSUB', 'VFF', 'VFI', 'VFQ', 'VF2', 'VOST', 'STFI', 'FASTSUB',
            '1080P', '720P', '2160P', '4K', '4KLIGHT', 'UHD', 'BLURAY', 'BDRIP', 'DVDRIP', 'HDRIP', 'WEBRIP', 'WEB-DL', 'WEBDL', 'WEBLIGHT', 'WEB',
            'HDR', 'SDR', 'DV', 'HEVC', 'X264', 'X265', 'H264', 'H265', 'REPACK', 'PROPER', 'FINAL', 'INTERNAL', 'CUSTOM', 'AC3', 'DDP', 'DTS', 'ATMOS', 'FLAC', 'MP3', 'HDMA',
            'NF', 'AMZN', 'DSNP', 'ATV', 'DSNY', 'HMAX', 'HBO', 'HULU', 'REMUX',
            r'19\d{2}', r'20[0-2]\d'
        ]
        pattern = r'[\.\[\(\s\-\_](?:' + '|'.join(tags_to_split) + r')\b'
        title = re.split(pattern, fn_clean, flags=re.I)[0]
        
        title = title.replace('.', ' ').replace('_', ' ').strip()
        title = re.sub(r'\s+', ' ', title).strip(' -:_/\\')
        
        # Remove Anime group at the beginning if it matches the extracted group
        if result.get('group'):
            grp_pattern = re.escape(result['group'])
            title = re.sub(rf'^\[{grp_pattern}\]\s*', '', title, flags=re.I)
            
        result['title'] = title

    def _extract_episode_name(self, filename: str, result: Dict[str, Any]):
        """Extracts the episode name for series if present after the season/episode tag."""
        if result['category'] != 'series' or not result['episode']:
            return
            
        se_match = re.search(r'(?i)\bs(\d{1,2})[\.\-\s]?[ex](\d{1,3})\b', filename)
        if not se_match:
            e_match = re.search(self.patterns['episode'], filename)
            if e_match:
                se_match = e_match
                
        if not se_match:
            return
            
        post_se = filename[se_match.end():]
        tags_to_split = [
            'MULTI', 'FRENCH', 'TRUEFRENCH', 'VOSTFR', 'SUBFRENCH', 'SUBBED', 'SUBS', 'MSUB', 'VFF', 'VFI', 'VFQ', 'VF2', 'VOST', 'STFI', 'FASTSUB',
            '1080P', '720P', '2160P', '4K', '4KLIGHT', 'UHD', 'BLURAY', 'BDRIP', 'DVDRIP', 'HDRIP', 'WEBRIP', 'WEB-DL', 'WEBDL', 'WEBLIGHT', 'WEB',
            'HDR', 'SDR', 'DV', 'HEVC', 'X264', 'X265', 'H264', 'H265', 'REPACK', 'PROPER', 'FINAL', 'INTERNAL', 'CUSTOM', 'AC3', 'DDP', 'DTS', 'ATMOS', 'FLAC', 'MP3', 'HDMA',
            'NF', 'AMZN', 'DSNP', 'ATV', 'DSNY', 'HMAX', 'HBO', 'HULU', 'REMUX',
            r'19\d{2}', r'20[0-2]\d'
        ]
        pattern = r'[\.\[\(\s\-\_](?:' + '|'.join(tags_to_split) + r')\b'
        parts = re.split(pattern, post_se, flags=re.I)
        if parts:
            ep_name = parts[0]
            for ext in ['.mkv', '.mp4', '.avi', '.ts']:
                if ep_name.lower().endswith(ext):
                    ep_name = ep_name[:-len(ext)]
            
            ep_name = ep_name.replace('.', ' ').replace('_', ' ').strip()
            ep_name = re.sub(r'\s+', ' ', ep_name).strip(' -:_/\\')
            
            if result.get('group') and ep_name.upper() == result['group'].upper():
                ep_name = ""
                
            if ep_name:
                result['episode_name'] = ep_name

    def _cleanup_extra(self, result: Dict[str, Any]):
        """Removes already parsed elements from the extra field."""
        if not result['extra']: return
        
        extra_parts = []
        for p in result['extra'].split('-'):
            parts = re.split(r'\.(?![0-9])', p)
            extra_parts.extend(parts)
        
        cleaned_parts = []
        for part in extra_parts:
            part_up = part.upper()
            if not part_up: continue
            already_parsed = False
            part_clean = part_up.replace('.', '').replace('-', '')
            for k in ['resolution', 'quality', 'codec', 'audio', 'channels', 'network', 'v_quality']:
                val = result.get(k)
                if val:
                    if isinstance(val, list):
                        if any(part_clean == str(x).upper().replace('.', '').replace('-', '') for x in val):
                            already_parsed = True
                            break
                    else:
                        val_up = str(val).upper().replace('.', '').replace('-', '')
                        if part_clean == val_up or part_clean in val_up or val_up in part_clean:
                            already_parsed = True
                            break
            if not already_parsed:
                cleaned_parts.append(part)
        result['extra'] = '.'.join(cleaned_parts) if cleaned_parts else None

    def parse(self, filename: str) -> Dict[str, Any]:
        if not filename: return {}
        
        filename = self._unquote_filename(filename)
        
        result = {
            "title": "", "category": "movie", "year": None, "season": None, "episode": None,
            "episode_name": None,
            "resolution": None, "quality": None, "codec": None, "audio": None, 
            "channels": None, "network": "", "v_quality": "", "languages": [], "group": None,
            "container": None, "extra": None
        }
        
        # 1. Container & stripping
        fn_stripped = self._extract_container(filename, result)
        
        # 2. Release Group & Extra
        self._extract_group_and_extra(fn_stripped, result)
        
        # Replace underscores with spaces to support word boundaries during tag extraction
        filename = filename.replace('_', ' ')
        
        # 3. Season & Episode
        self._extract_season_episode(filename, result)
        if result['season'] or result['episode']:
            result['category'] = 'series'
            
        # 4. Specific Fields
        self._extract_codec(filename, result)
        self._extract_resolution(filename, result)
        self._extract_network(filename, result)
        self._extract_channels(filename, result)
        
        # 5. Release Year
        self._extract_year(filename, result)
        
        # 6. Audio
        self._extract_audio(filename, result)
        
        # 7. Quality
        self._extract_quality(filename, result)
        
        # 8. Video Quality Enhancements
        result['v_quality'] = self.extract_v_quality(filename) or ""
        
        # 9. Title Clean & Extraction
        self._extract_title(filename, result)
        
        # 9b. Episode Name
        self._extract_episode_name(filename, result)
        
        # 10. Languages
        fn_up = filename.upper().replace('[', '.').replace(']', '.').replace('_', '.')
        if result['title']:
            chars = [re.escape(c) for c in result['title'] if c != ' ']
            if chars:
                pattern = r'^[\.\s\-\_]*' + r'[\.\s\-\_]*'.join(chars)
                fn_up_no_title = re.sub(pattern, '', fn_up, flags=re.I)
            else:
                fn_up_no_title = fn_up
        else:
            fn_up_no_title = fn_up
            
        result['languages'] = self._extract_langs(fn_up_no_title)
            
        # 11. Cleanup Extra Field
        self._cleanup_extra(result)
        
        # Check if the title length equals the filename length (indicating no metadata was parsed to split the title)
        if len(result['title']) == len(filename):
            raise ValueError("Filename contains no valid metadata")
            
        # Reject audio-only/OST releases
        if re.search(r'\b(OST|Bande originale|Soundtrack|Album)\b', filename, flags=re.I):
            raise ValueError("Filename contains no valid metadata")
            
        return result

def parse_filename(filename: str) -> Dict[str, Any]:
    parser = ReleaseParser()
    return parser.parse(filename)
