let pyodideReady = false;
let pyodideInstance = null;
let currentMode = 'decode'; // 'decode' or 'compare'
let currentLang = navigator.language.startsWith('fr') ? 'fr' : 'en';

// DOM Elements
const input = document.getElementById('release-input');
const clearBtn = document.getElementById('clear-btn');
const loadingIndicator = document.getElementById('loading-indicator');
const resultsContainer = document.getElementById('results-container');

const decodeInputs = document.getElementById('decode-inputs');
const compareInputs = document.getElementById('compare-inputs');
const inputA = document.getElementById('release-a-input');
const inputB = document.getElementById('release-b-input');
const clearABtn = document.getElementById('clear-a-btn');
const clearBBtn = document.getElementById('clear-b-btn');
const compareResultsContainer = document.getElementById('compare-results-container');
const btnDecodeMode = document.getElementById('mode-decode');
const btnCompareMode = document.getElementById('mode-compare');

const btnFr = document.getElementById('btn-fr');
const btnEn = document.getElementById('btn-en');
const mainTitle = document.getElementById('main-title');
const docsTitle = document.getElementById('docs-title');

// Configuration
const PARSER_URL = '../releascenify/parser.py';
const COMPARATOR_URL = '../releascenify/comparator.py';

async function initPyodide() {
    try {
        // Load Pyodide WASM
        pyodideInstance = await loadPyodide();

        // Fetch the python parser code
        const parserResponse = await fetch(PARSER_URL, { cache: "no-store" });
        if (!parserResponse.ok) throw new Error("Could not fetch " + PARSER_URL);
        const parserCode = await parserResponse.text();

        // Fetch the python comparator code
        const comparatorResponse = await fetch(COMPARATOR_URL, { cache: "no-store" });
        if (!comparatorResponse.ok) throw new Error("Could not fetch " + COMPARATOR_URL);
        const comparatorCode = await comparatorResponse.text();

        // Setup the python wrapper
        const wrapperCode = `
import json
${parserCode}
${comparatorCode}

def js_parse(filename):
    try:
        if 'parse_filename' in globals():
            res = parse_filename(filename)
        else:
            res = ReleaseParser().parse(filename)
        return json.dumps(res)
    except Exception as e:
        return json.dumps({"error": str(e)})

def js_compare(filename_a, filename_b):
    try:
        if 'parse_filename' in globals():
            parsed_a = parse_filename(filename_a)
            parsed_b = parse_filename(filename_b)
        else:
            parsed_a = ReleaseParser().parse(filename_a)
            parsed_b = ReleaseParser().parse(filename_b)
            
        score_a = get_quality_score(parsed_a)
        score_b = get_quality_score(parsed_b)
        
        return json.dumps({
            "a": parsed_a,
            "b": parsed_b,
            "score_a": score_a,
            "score_b": score_b
        })
    except Exception as e:
        return json.dumps({"error": str(e)})
`;

        await pyodideInstance.runPythonAsync(wrapperCode);
        pyodideReady = true;

        loadingIndicator.style.display = 'none';

        // Trigger initial parse if inputs have value
        if (input.value) handleInput();
        if (inputA.value || inputB.value) handleCompareInput();

    } catch (err) {
        console.error("Pyodide failed to load", err);
        loadingIndicator.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> ' + i18n[currentLang].loadingError;
        loadingIndicator.style.color = 'var(--secondary)';
    }
}

function getIcon(key) {
    const icons = {
        title: 'fa-film',
        year: 'fa-calendar',
        category: 'fa-clapperboard',
        resolution: 'fa-tv',
        quality: 'fa-download',
        codec: 'fa-microchip',
        audio: 'fa-volume-high',
        channels: 'fa-compact-disc',
        v_quality: 'fa-wand-magic-sparkles',
        languages: 'fa-language',
        season: 'fa-layer-group',
        episode: 'fa-play',
        episode_name: 'fa-quote-left',
        group: 'fa-users',
        container: 'fa-file-video',
        network: 'fa-tower-broadcast',
        extra: 'fa-tags'
    };
    return icons[key] || 'fa-tag';
}

const i18n = {
    fr: {
        mainTitle: "Analysez et comparez vos releases.",
        labels: {
            title: "Titre",
            category: "Catégorie",
            year: "Année",
            season: "Saison",
            episode: "Épisode",
            episode_name: "Nom d'épisode",
            resolution: "Résolution",
            v_quality: "Qualité Vidéo",
            quality: "Source",
            codec: "Codec",
            audio: "Audio",
            channels: "Canaux Audio",
            languages: "Langues",
            group: "Groupe",
            container: "Conteneur",
            network: "Diffuseur",
            extra: "Extra"
        },
        inputPlaceholder: "ex: Gladiator.II.2024.MULTi.2160p...",
        inputAPlaceholder: "Release A (ex: Gladiator.2024.1080p.mkv)",
        inputBPlaceholder: "Release B (ex: Gladiator.2024.2160p.mkv)",
        defaultDesc: "Survolez une étiquette pour voir sa description.",
        loadingError: "Erreur lors du chargement de l'environnement Python.",
        docsTitle: "Conventions de Nommage",
        installTitle: "Utiliser dans votre projet",
        installDesc: "Ajoutez la bibliothèque releascenify à votre projet pour analyser et comparer les releases directement dans votre code.",
        docRes: "Résolution",
        docSrc: "Source",
        docCodec: "Codec",
        docLang: "Langue",
        docAudio: "Audio",
        docVQuality: "Qualité Vidéo",
        docContainer: "Conteneur",
        docSpecial: "Tags spéciaux",
        docMistakes: "Erreurs courantes",
        headers: {
            res: ["Tag", "Description", "Qualité"],
            src: ["Tag", "Description", "Qualité"],
            audio: ["Tag", "Description", "Qualité"],
            codec: ["Tag", "Description", "Qualité"],
            vquality: ["Tag", "Description", "Qualité"],
            meaning: ["Tag", "Signification"]
        },
        notes: {
            res480: "SD",
            res720: "HD",
            res1080: "Full HD",
            res2160: "UHD / 4K",
            res4klight: "4K hautement compressé",
            srcRemuxSrc: "UHD.BluRay / BluRay.REMUX",
            srcRemuxQual: "Référence (Remux 4K)",
            srcBluraySrc: "BluRay / BDRip",
            srcBlurayQual: "Excellente (ré-encodé)",
            srcWebdlSrc: "WEB-DL",
            srcWebdlQual: "Très bonne (téléchargement direct)",
            srcWebripSrc: "WEBRip",
            srcWebripQual: "Bonne (capture ré-encodée)",
            srcHdtvSrc: "HDTV",
            srcHdtvQual: "Variable (capture TV)",
            srcHdripQual: "Bonne (haute définition ré-encodée)",
            srcCamSrc: "HDCAM / CAM",
            srcCamQual: "À éviter (caméra en salle)",
            codec264: "H.264 standard de fait depuis 15 ans",
            codec265: "H.265 / HEVC (meilleure compression)",
            codecAv1: "AV1 (émergent, encodage lent)",
            langMulti: "Plusieurs langues (généralement FR + EN)",
            langVff: "Vraie Version Française (France / Doublage d'origine, souvent marqué TRUEFRENCH)",
            langVfq: "Vraie Version Québécoise (Québec)",
            langVfi: "Version Française Internationale (VFi)",
            langVf2: "Contient 2 versions françaises différentes (ex : VFF + VFQ, ou doublage d'origine + redoublage)",
            langVostfr: "Version Originale Sous-Titrée Français",
            langFastsub: "Sous-titres rapides (traduction communautaire précoce)",
            langVf: "Version Française (générique ou indéterminée)",
            langVo: "Version Originale (sans doublage français)",
            langFrEn: "Bilingue Français et Anglais",
            audioLossless: "Lossless (DTS-HD.MA / TrueHD / Atmos / FLAC)",
            audioDd: "Dolby Digital 5.1 (AC3 / DD5.1)",
            audioAac: "Audio standard compressé (AAC / MP3)",
            audioDdp: "Dolby Digital Plus (E-AC3 / DDP5.1)",
            audioDts: "DTS Surround (haute fidélité)",
            vQualityHdr: "Plage dynamique étendue (High Dynamic Range)",
            vQualityDv: "Dolby Vision (métadonnées dynamiques)",
            vQualityBits: "Profondeur de couleur (10 bits / 12 bits)",
            vQualityHlg: "Hybrid Log-Gamma (diffusion TV HDR)",
            vQualitySdr: "Standard Dynamic Range (plage dynamique standard, non-HDR)",
            containerMkv: "Matroska (MKV) - Idéal pour le multi-pistes, sous-titres et chapitres",
            containerMp4: "MPEG-4 (MP4) - Compatibilité universelle et diffusion web",
            containerAvi: "Audio Video Interleave (AVI) - Format obsolète (DivX/XviD)",
            specialRepack: "Correctif de release",
            specialCustom: "Release personnalisée (ex : ajout manuel de pistes audio/sous-titres externes ou ré-encodage spécifique)"
        },
        legendTitle: "Indice de Qualité :",
        legends: {
            elite: "Référence",
            excellent: "Excellente",
            veryGood: "Très bonne",
            good: "Bonne",
            medium: "Moyenne",
            low: "Basse",
            avoid: "À éviter"
        },
        modeDecode: "Décoder",
        modeCompare: "Comparer",
        winnerA: "Release A est la meilleure !",
        winnerB: "Release B est la meilleure !",
        drawCompare: "Égalité ! Les deux releases sont de qualité équivalente.",
        scoreLabel: "Score global",
        betterBadge: "Meilleur",
        worseBadge: "Moins bon",
        vsSeparator: "VS",
        tooltips: {
            title: "Le titre de l'œuvre",
            year: "L'année de sortie",
            category: "Film ou Série",
            resolution: "Définition de l'image (1080p, 4K...)",
            quality: "Source de la vidéo (WEB-DL, BluRay...)",
            codec: "Format de compression vidéo (x264, HEVC...)",
            audio: "Format audio (AC3, Atmos...)",
            channels: "Nombre de canaux audio (5.1, 2.0...)",
            v_quality: "Améliorations visuelles (HDR, DV...)",
            languages: "Langues disponibles (MULTI, VFF...)",
            season: "Numéro de la saison",
            episode: "Numéro de l'épisode",
            episode_name: "Nom de l'épisode de la série",
            group: "Release group responsable (-NOM)",
            container: "Format du conteneur média (ex: MKV, MP4)",
            network: "Diffuseur ou plateforme de streaming (NF, AMZN, ATV...)",
            extra: "Éléments additionnels non parsés"
        }
    },
    en: {
        mainTitle: "Decode any scene release.",
        labels: {
            title: "Title",
            category: "Category",
            year: "Year",
            season: "Season",
            episode: "Episode",
            episode_name: "Episode Name",
            resolution: "Resolution",
            v_quality: "Video Quality",
            quality: "Source",
            codec: "Codec",
            audio: "Audio",
            channels: "Audio Channels",
            languages: "Languages",
            group: "Group",
            container: "Container",
            network: "Platform",
            extra: "Extra"
        },
        inputPlaceholder: "e.g. Gladiator.II.2024.MULTi.2160p...",
        inputAPlaceholder: "Release A (e.g. Gladiator.2024.1080p.mkv)",
        inputBPlaceholder: "Release B (e.g. Gladiator.2024.2160p.mkv)",
        defaultDesc: "Hover over a tag to see its description.",
        loadingError: "Error loading WebAssembly Python engine.",
        docsTitle: "Naming Conventions",
        installTitle: "Use in your project",
        installDesc: "Add the releascenify library to your project to parse and compare releases directly in your code.",
        docRes: "Resolution",
        docSrc: "Source",
        docCodec: "Codec",
        docLang: "Language",
        docAudio: "Audio",
        docVQuality: "Video Quality",
        docContainer: "Container",
        docSpecial: "Special Tags",
        docMistakes: "Common Mistakes",
        headers: {
            res: ["Tag", "Description", "Quality"],
            src: ["Tag", "Description", "Quality"],
            audio: ["Tag", "Description", "Quality"],
            codec: ["Tag", "Description", "Quality"],
            vquality: ["Tag", "Description", "Quality"],
            meaning: ["Tag", "Meaning"]
        },
        notes: {
            res480: "SD",
            res720: "HD",
            res1080: "Full HD",
            res2160: "UHD / 4K",
            res4klight: "Highly compressed 4K",
            srcRemuxSrc: "UHD.BluRay / BluRay.REMUX",
            srcRemuxQual: "Reference (4K BluRay Remux)",
            srcBluraySrc: "BluRay / BDRip",
            srcBlurayQual: "Excellent (Re-encoded)",
            srcWebdlSrc: "WEB-DL",
            srcWebdlQual: "Very Good (Direct download)",
            srcWebripSrc: "WEBRip",
            srcWebripQual: "Good (Captured and re-encoded)",
            srcHdtvSrc: "HDTV",
            srcHdtvQual: "Variable (Broadcast capture)",
            srcHdripQual: "Good (High definition re-encoded)",
            srcCamSrc: "HDCAM / CAM",
            srcCamQual: "Avoid (Theater camera recording)",
            codec264: "Standard for the last 15 years",
            codec265: "Better compression",
            codecAv1: "Emerging, slow to encode",
            langMulti: "Multiple languages (usually FR + EN)",
            langVff: "True French (France / Original dubbing, often marked TRUEFRENCH)",
            langVfq: "True French (Quebec)",
            langVfi: "International French version (VFi)",
            langVf2: "Contains 2 different French versions (e.g. VFF + VFQ, or original dub + newer redub)",
            langVostfr: "Original version with French subtitles",
            langFastsub: "Fast subtitles (early community translation)",
            langVf: "French Version (generic or undetermined)",
            langVo: "Original Version (no French dub)",
            langFrEn: "Bilingual French and English",
            audioLossless: "Lossless audio (DTS-HD.MA / TrueHD / Atmos / FLAC)",
            audioDd: "Dolby Digital 5.1 (AC3 / DD5.1)",
            audioAac: "Standard Web Audio (AAC / MP3)",
            audioDdp: "Dolby Digital Plus (E-AC3 / DDP5.1)",
            audioDts: "DTS Surround (high-fidelity)",
            vQualityHdr: "High Dynamic Range (HDR, HDR10, HDR10+)",
            vQualityDv: "Dolby Vision dynamic metadata (DV)",
            vQualityBits: "10-bit / 12-bit color depth (prevents banding)",
            vQualityHlg: "Hybrid Log-Gamma (HDR broadcast)",
            vQualitySdr: "Standard Dynamic Range (non-HDR)",
            containerMkv: "Matroska (MKV) - Best for multiple audio tracks, subtitles and chapters",
            containerMp4: "MPEG-4 (MP4) - Universal compatibility and web streaming",
            containerAvi: "Audio Video Interleave (AVI) - Legacy format (DivX/XviD)",
            specialRepack: "Re-uploads fixing previous bad releases",
            specialCustom: "Custom-made release (e.g. manually synced audio/subtitle tracks, or specific custom encodes)"
        },
        legendTitle: "Quality Legend:",
        legends: {
            elite: "Reference",
            excellent: "Excellent",
            veryGood: "Very Good",
            good: "Good",
            medium: "Medium",
            low: "Low",
            avoid: "Avoid"
        },
        modeDecode: "Decode",
        modeCompare: "Compare",
        winnerA: "Release A is the best!",
        winnerB: "Release B is the best!",
        drawCompare: "It's a draw! Both releases have equal quality.",
        scoreLabel: "Overall Score",
        betterBadge: "Better",
        worseBadge: "Worse",
        vsSeparator: "VS",
        tooltips: {
            title: "The title of the release",
            year: "Release year",
            category: "Movie or Series",
            resolution: "Video resolution (1080p, 4K...)",
            quality: "Video source (WEB-DL, BluRay...)",
            codec: "Video compression format (x264, HEVC...)",
            audio: "Audio format (AC3, Atmos...)",
            channels: "Audio channels (5.1, 2.0...)",
            v_quality: "Visual enhancements (HDR, DV...)",
            languages: "Available languages (MULTI, VFF...)",
            season: "Season number",
            episode: "Episode number",
            episode_name: "Title/name of the specific episode",
            group: "Responsible release group (-NAME)",
            container: "Media container format (e.g. MKV, MP4)",
            network: "Broadcaster or streaming platform (NF, AMZN, ATV...)",
            extra: "Additional unparsed elements"
        }
    }
};

function setLanguage(lang) {
    currentLang = lang;
    btnFr.classList.toggle('active', lang === 'fr');
    btnEn.classList.toggle('active', lang === 'en');
    mainTitle.textContent = i18n[currentLang].mainTitle;

    input.placeholder = i18n[currentLang].inputPlaceholder;
    inputA.placeholder = i18n[currentLang].inputAPlaceholder;
    inputB.placeholder = i18n[currentLang].inputBPlaceholder;

    document.querySelector('.mode-text-decode').textContent = i18n[currentLang].modeDecode;
    document.querySelector('.mode-text-compare').textContent = i18n[currentLang].modeCompare;

    // Update docs
    docsTitle.innerHTML = `<i class="fa-solid fa-book-open"></i> ${i18n[currentLang].docsTitle}`;
    document.getElementById('install-title').innerHTML = `<i class="fa-solid fa-terminal"></i> ${i18n[currentLang].installTitle}`;
    document.getElementById('install-desc').textContent = i18n[currentLang].installDesc;
    renderDocs();

    // Refresh display
    if (currentMode === 'decode') {
        handleInput();
    } else {
        handleCompareInput();
    }
}

btnFr.addEventListener('click', () => setLanguage('fr'));
btnEn.addEventListener('click', () => setLanguage('en'));

// Initialize UI with correct language
setLanguage(currentLang);

function renderResults(data) {
    resultsContainer.innerHTML = '';

    if (!data || Object.keys(data).length === 0 || (data.title === "" && !data.year)) {
        resultsContainer.classList.add('hidden');
        return;
    }

    resultsContainer.classList.remove('hidden');

    // Always render title first
    if (data.title) {
        const tooltip = i18n[currentLang].tooltips.title || '';
        const titleLabel = i18n[currentLang].labels.title || 'Title';
        const titleHtml = `
            <div class="tag-card title-card" data-key="title" title="${tooltip}">
                <i class="fa-solid ${getIcon('title')} tag-icon"></i>
                <span class="tag-label">${titleLabel}</span>
                <span class="tag-value">${data.title}</span>
            </div>
        `;
        resultsContainer.insertAdjacentHTML('beforeend', titleHtml);
    }

    // Render other valid keys
    const order = ['category', 'year', 'season', 'episode', 'episode_name', 'resolution', 'v_quality', 'quality', 'network', 'codec', 'container', 'audio', 'channels', 'languages', 'group', 'extra'];

    order.forEach(key => {
        if (data[key] && data[key] !== "") {
            let valueHtml = '';

            if (Array.isArray(data[key])) {
                if (data[key].length === 0) return;
                valueHtml = `<div class="pill-container">` +
                    data[key].map(v => `<span class="pill">${v}</span>`).join('') +
                    `</div>`;
            } else {
                valueHtml = `<span class="tag-value">${data[key]}</span>`;
            }

            const tooltip = i18n[currentLang].tooltips[key] || '';
            const displayLabel = i18n[currentLang].labels[key] || key;
            const card = `
                <div class="tag-card" data-key="${key}" title="${tooltip}">
                    <i class="fa-solid ${getIcon(key)} tag-icon"></i>
                    <span class="tag-label">${displayLabel}</span>
                    ${valueHtml}
                </div>
            `;
            resultsContainer.insertAdjacentHTML('beforeend', card);
        }
    });
}

function getFieldComparison(key, valA, valB) {
    if (!valA && !valB) return { better: null };
    if (valA && !valB) return { better: 'a' };
    if (!valA && valB) return { better: 'b' };

    // Normalize values
    const aStr = String(valA).toLowerCase();
    const bStr = String(valB).toLowerCase();
    if (aStr === bStr) return { better: null };

    if (key === 'resolution') {
        const getResRank = (r) => {
            if (r.includes('2160') || r.includes('4k')) return r.includes('light') ? 4 : 5;
            if (r.includes('1080')) return 3;
            if (r.includes('720')) return 2;
            return 1;
        };
        const rankA = getResRank(aStr);
        const rankB = getResRank(bStr);
        if (rankA !== rankB) return { better: rankA > rankB ? 'a' : 'b' };
    }

    if (key === 'quality') {
        const getSrcRank = (q) => {
            if (q.includes('bluray') || q.includes('bdrip')) return 3;
            if (q.includes('web')) return 2;
            if (q.includes('hdtv')) return 1;
            return 0;
        };
        const rankA = getSrcRank(aStr);
        const rankB = getSrcRank(bStr);
        if (rankA !== rankB) return { better: rankA > rankB ? 'a' : 'b' };
    }

    if (key === 'languages') {
        const getLangRank = (l) => {
            if (l.includes('multi')) return 3;
            if (l.includes('french') || l.includes('vf')) return 2;
            if (l.includes('vostfr')) return 1;
            return 0;
        };
        const rankA = getLangRank(aStr);
        const rankB = getLangRank(bStr);
        if (rankA !== rankB) return { better: rankA > rankB ? 'a' : 'b' };
    }

    if (key === 'v_quality') {
        const getVqRank = (vq) => {
            let rank = 0;
            if (vq.includes('dv') || vq.includes('dovi')) rank += 2;
            if (vq.includes('hdr')) rank += 1;
            return rank;
        };
        const rankA = getVqRank(aStr);
        const rankB = getVqRank(bStr);
        if (rankA !== rankB) return { better: rankA > rankB ? 'a' : 'b' };
    }

    if (key === 'codec') {
        const getCodecRank = (c) => {
            if (c.includes('265') || c.includes('hevc')) return 2;
            if (c.includes('264')) return 1;
            return 0;
        };
        const rankA = getCodecRank(aStr);
        const rankB = getCodecRank(bStr);
        if (rankA !== rankB) return { better: rankA > rankB ? 'a' : 'b' };
    }

    if (key === 'audio') {
        const getAudioRank = (aud) => {
            if (aud.includes('atmos') || aud.includes('truehd')) return 3;
            if (aud.includes('dts')) return 2;
            if (aud.includes('ac3') || aud.includes('ddp')) return 1;
            return 0;
        };
        const rankA = getAudioRank(aStr);
        const rankB = getAudioRank(bStr);
        if (rankA !== rankB) return { better: rankA > rankB ? 'a' : 'b' };
    }

    return { better: null };
}

function renderCompareResults(data) {
    compareResultsContainer.innerHTML = '';
    compareResultsContainer.classList.remove('hidden');

    // Winner Banner
    let winnerHtml = '';
    if (data.score_a > data.score_b) {
        winnerHtml = `
            <div class="winner-banner winner-a">
                <i class="fa-solid fa-trophy winner-icon"></i>
                <span>${i18n[currentLang].winnerA}</span>
            </div>
        `;
    } else if (data.score_b > data.score_a) {
        winnerHtml = `
            <div class="winner-banner winner-b">
                <i class="fa-solid fa-trophy winner-icon"></i>
                <span>${i18n[currentLang].winnerB}</span>
            </div>
        `;
    } else {
        winnerHtml = `
            <div class="winner-banner draw">
                <i class="fa-solid fa-code-compare winner-icon"></i>
                <span>${i18n[currentLang].drawCompare}</span>
            </div>
        `;
    }
    compareResultsContainer.insertAdjacentHTML('beforeend', winnerHtml);

    // Comparison Table
    const compareKeys = [
        'title', 'category', 'year', 'resolution', 'v_quality', 'quality', 'network',
        'codec', 'container', 'audio', 'channels', 'languages', 'group', 'extra'
    ];

    let rowsHtml = '';

    const formatVal = (val) => {
        if (!val) return '-';
        if (Array.isArray(val)) {
            if (val.length === 0) return '-';
            return val.join(', ');
        }
        return val;
    };

    compareKeys.forEach(key => {
        const valA = data.a[key];
        const valB = data.b[key];
        const formattedA = formatVal(valA);
        const formattedB = formatVal(valB);

        let comp = getFieldComparison(key, valA, valB);

        let classA = 'draw-val';
        let classB = 'draw-val';
        let badgeA = '';
        let badgeB = '';

        if (comp.better === 'a') {
            classA = 'better-val';
            classB = 'worse-val';
            badgeA = `<span class="better-badge-ui">${i18n[currentLang].betterBadge}</span>`;
        } else if (comp.better === 'b') {
            classA = 'worse-val';
            classB = 'better-val';
            badgeB = `<span class="better-badge-ui">${i18n[currentLang].betterBadge}</span>`;
        }

        const displayLabel = i18n[currentLang].labels[key] || key;
        rowsHtml += `
            <tr>
                <td class="property-name">${displayLabel}</td>
                <td class="value-col ${classA}">${formattedA} ${badgeA}</td>
                <td class="value-col ${classB}">${formattedB} ${badgeB}</td>
            </tr>
        `;
    });

    // Score Row
    let scoreClassA = 'draw-val';
    let scoreClassB = 'draw-val';
    let scoreBadgeA = '';
    let scoreBadgeB = '';
    if (data.score_a > data.score_b) {
        scoreClassA = 'better-val';
        scoreClassB = 'worse-val';
        scoreBadgeA = `<span class="better-badge-ui">${i18n[currentLang].betterBadge}</span>`;
    } else if (data.score_b > data.score_a) {
        scoreClassA = 'worse-val';
        scoreClassB = 'better-val';
        scoreBadgeB = `<span class="better-badge-ui">${i18n[currentLang].betterBadge}</span>`;
    }

    rowsHtml += `
        <tr class="score-row">
            <td class="property-name">${i18n[currentLang].scoreLabel}</td>
            <td class="value-col ${scoreClassA}"><strong>${data.score_a}</strong> pts ${scoreBadgeA}</td>
            <td class="value-col ${scoreClassB}"><strong>${data.score_b}</strong> pts ${scoreBadgeB}</td>
        </tr>
    `;

    const tableHtml = `
        <div class="compare-table-card">
            <table class="compare-table">
                <thead>
                    <tr>
                        <th>Property</th>
                        <th>Release A</th>
                        <th>Release B</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </div>
    `;
    compareResultsContainer.insertAdjacentHTML('beforeend', tableHtml);
}

function handleInput() {
    const val = input.value.trim();
    clearBtn.style.display = val.length > 0 ? 'block' : 'none';

    if (!pyodideReady) return;

    if (val.length === 0) {
        resultsContainer.classList.add('hidden');
        descBox.classList.add('hidden');
        return;
    }

    try {
        const parseFunc = pyodideInstance.globals.get('js_parse');
        const jsonStr = parseFunc(val);
        const data = JSON.parse(jsonStr);
        renderResults(data);
    } catch (e) {
        console.error("Parsing error:", e);
    }
}

function handleCompareInput() {
    const valA = inputA.value.trim();
    const valB = inputB.value.trim();

    clearABtn.style.display = valA.length > 0 ? 'block' : 'none';
    clearBBtn.style.display = valB.length > 0 ? 'block' : 'none';

    if (!pyodideReady) return;

    if (valA.length === 0 || valB.length === 0) {
        compareResultsContainer.classList.add('hidden');
        return;
    }

    try {
        const compareFunc = pyodideInstance.globals.get('js_compare');
        const jsonStr = compareFunc(valA, valB);
        const data = JSON.parse(jsonStr);
        if (data.error) {
            console.error("Comparison error:", data.error);
            return;
        }
        renderCompareResults(data);
    } catch (e) {
        console.error("Comparison execution error:", e);
    }
}

// Mode Selector Listeners
btnDecodeMode.addEventListener('click', () => {
    currentMode = 'decode';
    btnDecodeMode.classList.add('active');
    btnCompareMode.classList.remove('active');
    decodeInputs.classList.remove('hidden');
    compareInputs.classList.add('hidden');
    resultsContainer.classList.add('hidden');
    compareResultsContainer.classList.add('hidden');
    handleInput();
});

btnCompareMode.addEventListener('click', () => {
    currentMode = 'compare';
    btnCompareMode.classList.add('active');
    btnDecodeMode.classList.remove('active');
    decodeInputs.classList.add('hidden');
    compareInputs.classList.remove('hidden');
    resultsContainer.classList.add('hidden');
    compareResultsContainer.classList.add('hidden');
    handleCompareInput();
});

// Event Listeners
input.addEventListener('input', handleInput);
inputA.addEventListener('input', handleCompareInput);
inputB.addEventListener('input', handleCompareInput);

clearBtn.addEventListener('click', () => {
    input.value = '';
    handleInput();
    input.focus();
});

clearABtn.addEventListener('click', () => {
    inputA.value = '';
    handleCompareInput();
    inputA.focus();
});

clearBBtn.addEventListener('click', () => {
    inputB.value = '';
    handleCompareInput();
    inputB.focus();
});

function renderDocs() {
    const docsLegend = document.getElementById('docs-legend');
    if (docsLegend) {
        docsLegend.innerHTML = `
            <span class="legend-title">${i18n[currentLang].legendTitle}</span>
            <div class="legend-items">
                <div class="legend-item"><span class="stars">★★★★★</span> <span>${i18n[currentLang].legends.elite}</span></div>
                <div class="legend-item"><span class="stars">★★★★☆</span> <span>${i18n[currentLang].legends.excellent}</span></div>
                <div class="legend-item"><span class="stars">★★★☆☆</span> <span>${i18n[currentLang].legends.good}</span></div>
                <div class="legend-item"><span class="stars">★★☆☆☆</span> <span>${i18n[currentLang].legends.medium}</span></div>
                <div class="legend-item"><span class="stars">★☆☆☆☆</span> <span>${i18n[currentLang].legends.low}</span></div>
                <div class="legend-item"><span class="stars">☆☆☆☆☆</span> <span>${i18n[currentLang].legends.avoid}</span></div>
            </div>
        `;
    }

    const docsGrid = document.getElementById('docs-grid');
    if (!docsGrid) return;

    docsGrid.innerHTML = '';

    const cards = [
        {
            id: 'res',
            icon: 'fa-tv',
            title: i18n[currentLang].docRes,
            headers: i18n[currentLang].headers.res,
            rows: [
                ["2160p / 4K / UHD", i18n[currentLang].notes.res2160, `<span class="stars">★★★★★</span>`],
                ["4KLight", i18n[currentLang].notes.res4klight, `<span class="stars">★★★★☆</span>`],
                ["1080p", i18n[currentLang].notes.res1080, `<span class="stars">★★★☆☆</span>`],
                ["720p", i18n[currentLang].notes.res720, `<span class="stars">★★☆☆☆</span>`],
                ["480p", i18n[currentLang].notes.res480, `<span class="stars">★☆☆☆☆</span>`]
            ]
        },
        {
            id: 'src',
            icon: 'fa-download',
            title: i18n[currentLang].docSrc,
            headers: i18n[currentLang].headers.src,
            rows: [
                ["UHD.BluRay / REMUX", i18n[currentLang].notes.srcRemuxQual, `<span class="stars">★★★★★</span>`],
                ["BluRay / BDRip / BRRip", i18n[currentLang].notes.srcBlurayQual, `<span class="stars">★★★★☆</span>`],
                ["WEB-DL", i18n[currentLang].notes.srcWebdlQual, `<span class="stars">★★★★☆</span>`],
                ["WEBRip", i18n[currentLang].notes.srcWebripQual, `<span class="stars">★★★☆☆</span>`],
                ["HDRip", i18n[currentLang].notes.srcHdripQual, `<span class="stars">★★★☆☆</span>`],
                ["HDTV", i18n[currentLang].notes.srcHdtvQual, `<span class="stars">★★☆☆☆</span>`],
                ["HDCAM / CAM", i18n[currentLang].notes.srcCamQual, `<span class="stars">☆☆☆☆☆</span>`]
            ]
        },
        {
            id: 'vquality',
            icon: 'fa-wand-magic-sparkles',
            title: i18n[currentLang].docVQuality,
            headers: i18n[currentLang].headers.vquality,
            rows: [
                ["DV / Dolby Vision", i18n[currentLang].notes.vQualityDv, `<span class="stars">★★★★★</span>`],
                ["HDR / HDR10 / HDR10+", i18n[currentLang].notes.vQualityHdr, `<span class="stars">★★★★☆</span>`],
                ["10bit / 12bit", i18n[currentLang].notes.vQualityBits, `<span class="stars">★★★★☆</span>`],
                ["HLG", i18n[currentLang].notes.vQualityHlg, `<span class="stars">★★★☆☆</span>`],
                ["SDR", i18n[currentLang].notes.vQualitySdr, `<span class="stars">★★☆☆☆</span>`]
            ]
        },
        {
            id: 'codec',
            icon: 'fa-microchip',
            title: i18n[currentLang].docCodec,
            headers: i18n[currentLang].headers.codec,
            rows: [
                ["AV1", `AV1 - ${i18n[currentLang].notes.codecAv1}`, `<span class="stars">★★★★★</span>`],
                ["x265 / HEVC", `H.265 - ${i18n[currentLang].notes.codec265}`, `<span class="stars">★★★★☆</span>`],
                ["x264", `H.264 - ${i18n[currentLang].notes.codec264}`, `<span class="stars">★★★☆☆</span>`]
            ]
        },
        {
            id: 'lang',
            icon: 'fa-language',
            title: i18n[currentLang].docLang,
            headers: i18n[currentLang].headers.meaning,
            rows: [
                ["MULTi", i18n[currentLang].notes.langMulti],
                ["TRUEFRENCH / VFF", i18n[currentLang].notes.langVff],
                ["VFQ", i18n[currentLang].notes.langVfq],
                ["VFi", i18n[currentLang].notes.langVfi],
                ["VF2", i18n[currentLang].notes.langVf2],
                ["VF", i18n[currentLang].notes.langVf],
                ["VOSTFR", i18n[currentLang].notes.langVostfr],
                ["FASTSUB", i18n[currentLang].notes.langFastsub],
                ["VO", i18n[currentLang].notes.langVo],
                ["FR EN / FR-EN", i18n[currentLang].notes.langFrEn]
            ]
        },
        {
            id: 'audio',
            icon: 'fa-volume-high',
            title: i18n[currentLang].docAudio,
            headers: i18n[currentLang].headers.audio,
            rows: [
                ["ATMOS / TRUEHD / FLAC", i18n[currentLang].notes.audioLossless, `<span class="stars">★★★★★</span>`],
                ["DTS-HD.MA / DTS", i18n[currentLang].notes.audioDts, `<span class="stars">★★★★☆</span>`],
                ["DDP5.1 / DDP / E-AC3", i18n[currentLang].notes.audioDdp, `<span class="stars">★★★☆☆</span>`],
                ["AAC / MP3", i18n[currentLang].notes.audioAac, `<span class="stars">★★☆☆☆</span>`]
            ]
        },
        {
            id: 'container',
            icon: 'fa-file-video',
            title: i18n[currentLang].docContainer,
            headers: i18n[currentLang].headers.meaning,
            rows: [
                [".mkv", i18n[currentLang].notes.containerMkv],
                [".mp4", i18n[currentLang].notes.containerMp4],
                [".avi", i18n[currentLang].notes.containerAvi]
            ]
        },
        {
            id: 'special',
            icon: 'fa-tags',
            title: i18n[currentLang].docSpecial,
            headers: i18n[currentLang].headers.meaning,
            rows: [
                ["REPACK / PROPER / REAL", i18n[currentLang].notes.specialRepack],
                ["CUSTOM", i18n[currentLang].notes.specialCustom]
            ]
        }
    ];

    cards.forEach(card => {
        let cardHtml = `
            <div class="doc-card">
                <h3><i class="fa-solid ${card.icon}"></i> ${card.title}</h3>
                <table class="doc-table">
                    <thead>
                        <tr>
                            ${card.headers.map(h => `<th>${h}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${card.rows.map(row => `
                            <tr>
                                ${row.map(cell => `<td>${cell}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        docsGrid.insertAdjacentHTML('beforeend', cardHtml);
    });
}

// Start initialization
initPyodide();

function copyInstallCommand() {
    navigator.clipboard.writeText('pip install releascenify');
    const btn = document.querySelector('.copy-btn i');
    btn.className = 'fa-solid fa-check';
    setTimeout(() => {
        btn.className = 'fa-regular fa-copy';
    }, 2000);
}
