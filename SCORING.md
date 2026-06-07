# How Scoring Works

Releascenify includes a **quality scoring system** to estimate the relative quality of a release from its filename metadata. The goal is not to determine the *absolute* visual quality of a file, because actual quality depends on factors that are often unavailable in release names (bitrate, encoding settings, source quality, etc.).

> [!NOTE]
> A higher score does **not always mean a better viewing experience**.

## Scoring Factors

The final score combines several weighted attributes extracted from the filename.

### Source Quality

Higher quality sources receive more points.

| Source | Relative Weight |
|----------|----------------|
| REMUX | Highest |
| UHD BluRay | Very High |
| BluRay | High |
| WEB-DL | Medium |
| WEBRip | Medium-Low |
| HDTV | Low |
| CAM / TS | Very Low |

---

### Resolution

Higher resolutions generally receive more points.

| Resolution | Relative Weight |
|-------------|----------------|
| 2160p | Highest |
| 1080p | High |
| 720p | Medium |
| SD | Low |

---

### Video Codec

Modern codecs generally improve efficiency and quality.

| Codec | Relative Weight |
|---------|----------------|
| AV1 | Highest |
| H265 / HEVC | High |
| H264 / x264 | Medium |
| VC-1 | Medium-Low |
| XviD / older codecs | Low |

---

### Video Enhancements

Additional technologies can increase the score.

Examples:

- HDR
- Dolby Vision (DV)
- HDR10+
- IMAX Enhanced

---

### Audio Quality

Audio formats also contribute.

Typical ranking:

| Audio | Relative Weight |
|---------|----------------|
| TrueHD Atmos | Highest |
| DTS-HD MA | High |
| DTS | Medium |
| DDP / DD+ | Medium |
| AAC | Lower |
