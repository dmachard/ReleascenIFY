# Releascenify

<p align="center">
  <img src="imgs/logo_releascenify.png" alt="Releascenify Logo" width="400">
</p>

Parse Scene and P2P release names into structured metadata and compare release quality automatically. Built with a rule/regex engine.

**Live Demo:** [https://dmachard.github.io/releascenify/docs/](https://dmachard.github.io/releascenify/docs/)

## Why?
Release names follow a strict grammar inherited from the Scene and P2P groups. Once decoded, you can predict the quality, source, language, and release group just from the filename. This library is an alternative to PTN (Parse Torrent Name).

## Installation

```bash
pip install releascenify
```

## Usage

```python
from releascenify import parse_filename
from releascenify.comparator import get_quality_score, is_better_release

filename = "Gladiator.II.2024.MULTi.2160p.WEB-DL.DV.HDR.H265-GROUP"
parsed = parse_filename(filename)

print(parsed)
# {
#   "title": "Gladiator II",
#   "year": 2024,
#   "resolution": "2160P",
#   "quality": "WEB-DL",
#   "v_quality": "HDR DV",
#   "codec": "H265",
#   "languages": ["MULTI"]
#   ...
# }

# Calculate quality score
score = get_quality_score(parsed)
print(f"Quality Score: {score}")

# Compare two releases
rel_a = parse_filename("Gladiator.II.2024.1080p.BluRay.x264-GROUP")
rel_b = parse_filename("Gladiator.II.2024.2160p.WEB-DL.x265-GROUP")

if is_better_release(rel_b, rel_a):
    print("Release B is better than Release A")
```

## Quality Scoring

For details on how files are rated, scoring weights, and priority factors, see [SCORING.md](SCORING.md).

## Expected Tags & Normalization

Here are the metadata fields extracted by `releascenify` and how their values are normalized:

### Video Codecs (`codec`)
To make release metadata processing and quality comparison consistent, the parser normalizes various representations of codecs:
- **`H265`**: Normalized from inputs containing `H265`, `x265`, `HEVC` (including variants with dots or hyphens like `H.265` or `H-265`).
- **`H264`**: Normalized from inputs containing `H264`, `x264` (including variants with dots or hyphens like `H.264` or `H-264`).

> [!NOTE]
> **HEVC** (High Efficiency Video Coding) and **H.265** are terms for the same ITU-T video compression standard, while **x265** is the open-source encoder library that encodes video into HEVC/H.265 format.
> Similarly, **AVC** and **H.264** refer to the same standard, and **x264** is the encoder library. `releascenify` normalizes these into the standard tags `H265` and `H264` for simplicity.

### Resolutions (`resolution`)
- Normalized to standard resolution keys: **`2160P`** / **`1080P`** / **`720P`** / **`4K`** / **`UHD`** / **`4KLIGHT`**

### Source Quality (`quality`)
- Normalized to standard quality keys: **`REMUX`** / **`BLURAY`** / **`BDRIP`** / **`BRRIP`** / **`WEB-DL`** / **`WEBDL`** / **`WEBRIP`** / **`WEBLIGHT`** / **`WEB`** / **`DVDRIP`** / **`HDTV`**

### Audio Quality (`audio`)
- Standard audio codecs: **`ATMOS`** / **`TRUEHD`** / **`DTS-HD`** / **`DTS`** / **`EAC3`** / **`AC3`** / **`AAC`** / **`DDP`** (Atmos can be appended, e.g., `EAC3 ATMOS`).

### Video Enhancements (`v_quality`)
- **`HDR`** / **`HDR10`** / **`HDR10+`** / **`DV`** (Dolby Vision) / **`HLG`** / **`SDR`** / **`10BIT`** / **`12BIT`**

### Languages (`languages`)
- Lists of extracted language tags: **`VFF`** (TrueFrench) / **`FRENCH`** / **`VF`** / **`VF2`** / **`VFI`** / **`VFQ`** / **`VOSTFR`** / **`EN`** / **`VO`** / **`MULTI`**

### Network/Platform (`network`)
- Stream/broadcast platform names normalized:
  - `Netflix` (from `NF`)
  - `Amazon Prime` (from `AMZN`, `AMAZON STUDIOS`, `AMAZON PRIME`)
  - `Disney+` (from `DSNP`, `DSNY`, `DISNEY PLUS`)
  - `Apple TV+` (from `ATV`, `APPLE TV PLUS`)
  - `HBO Max` / `HBO` (from `HMAX`, `HBO MAX`, `HBO`)
  - `Hulu` (from `HULU`)
  - `Paramount+` (from `PARAMOUNT PLUS`)

## Development & Tests

### Setup Local Virtual Environment

To set up the development environment, create a virtual environment and install the package in editable mode with development dependencies:

```bash
virtualenv .venv
source .venv/bin/activate
pip install -e .[dev]
```

### Run Tests

Run the test suite using `pytest`:

```bash
pytest tests/ -v
```

### Run Website Locally

You need to run a local web server from the repository root:

```bash
# Start a local HTTP server
python3 -m http.server 8000
```

Then navigate to: [http://localhost:8000/](http://localhost:8000/) (which redirects to `/docs/`) or directly to [http://localhost:8000/docs/](http://localhost:8000/docs/).