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
        const parserResponse = await fetch(PARSER_URL);
        if (!parserResponse.ok) throw new Error("Could not fetch " + PARSER_URL);
        const parserCode = await parserResponse.text();

        // Fetch the python comparator code
        const comparatorResponse = await fetch(COMPARATOR_URL);
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
        group: 'fa-users'
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
            resolution: "Résolution",
            v_quality: "Qualité Vidéo",
            quality: "Source",
            codec: "Codec",
            audio: "Audio",
            channels: "Canaux Audio",
            languages: "Langues",
            group: "Groupe"
        },
        inputPlaceholder: "ex: Gladiator.II.2024.MULTi.2160p...",
        inputAPlaceholder: "Release A (ex: Gladiator.2024.1080p.mkv)",
        inputBPlaceholder: "Release B (ex: Gladiator.2024.2160p.mkv)",
        defaultDesc: "Survolez une étiquette pour voir sa description.",
        loadingError: "Erreur lors du chargement de l'environnement Python.",
        docsTitle: "Conventions de Nommage",
        docRes: "Résolution",
        docSrc: "Source",
        docCodec: "Codec",
        docLang: "Langue",
        docAudio: "Audio",
        docSpecial: "Tags spéciaux",
        docMistakes: "Erreurs courantes",
        headers: {
            res: ["Tag", "Note"],
            src: ["Tag", "Note / Qualité"],
            codec: ["Tag", "Note"],
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
            srcCamSrc: "HDCAM / CAM",
            srcCamQual: "À éviter (caméra en salle)",
            codec264: "H.264 standard de fait depuis 15 ans",
            codec265: "H.265 / HEVC (meilleure compression)",
            codecAv1: "AV1 (émergent, encodage lent)",
            langMulti: "Plusieurs langues (généralement FR + EN)",
            langVff: "Vraie Version Française (France)",
            langVfq: "Vraie Version Québécoise (Québec)",
            langVostfr: "Version Originale Sous-Titrée Français",
            audioLossless: "Lossless (DTS-HD.MA / TrueHD)",
            audioDd: "Dolby Digital 5.1 (AC3 / DD5.1)",
            audioAac: "AAC (audio web standard)",
            specialRepack: "Correctif de release",
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
            group: "Release group responsable (-NOM)"
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
            resolution: "Resolution",
            v_quality: "Video Quality",
            quality: "Source",
            codec: "Codec",
            audio: "Audio",
            channels: "Audio Channels",
            languages: "Languages",
            group: "Group"
        },
        inputPlaceholder: "e.g. Gladiator.II.2024.MULTi.2160p...",
        inputAPlaceholder: "Release A (e.g. Gladiator.2024.1080p.mkv)",
        inputBPlaceholder: "Release B (e.g. Gladiator.2024.2160p.mkv)",
        defaultDesc: "Hover over a tag to see its description.",
        loadingError: "Error loading WebAssembly Python engine.",
        docsTitle: "Naming Conventions",
        docRes: "Resolution",
        docSrc: "Source",
        docCodec: "Codec",
        docLang: "Language",
        docAudio: "Audio",
        docSpecial: "Special Tags",
        docMistakes: "Common Mistakes",
        headers: {
            res: ["Tag", "Note"],
            src: ["Tag", "Note / Quality"],
            codec: ["Tag", "Note"],
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
            srcCamSrc: "HDCAM / CAM",
            srcCamQual: "Avoid (Theater camera recording)",
            codec264: "Standard for the last 15 years",
            codec265: "Better compression",
            codecAv1: "Emerging, slow to encode",
            langMulti: "Multiple languages (usually FR + EN)",
            langVff: "True French (France)",
            langVfq: "True French (Quebec)",
            langVostfr: "Original version with French subtitles",
            audioLossless: "Lossless audio (DTS-HD.MA / TrueHD)",
            audioDd: "Dolby Digital 5.1 (AC3 / DD5.1)",
            audioAac: "Standard Web Audio (AAC)",
            specialRepack: "Re-uploads fixing previous bad releases",
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
            group: "Responsible release group (-NAME)"
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
    const order = ['category', 'year', 'season', 'episode', 'resolution', 'v_quality', 'quality', 'codec', 'audio', 'channels', 'languages', 'group'];

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
        'title', 'category', 'year', 'resolution', 'v_quality', 'quality',
        'codec', 'audio', 'channels', 'languages', 'group'
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
                ["480p", `854x480 - ${i18n[currentLang].notes.res480}`],
                ["720p", `1280x720 - ${i18n[currentLang].notes.res720}`],
                ["1080p", `1920x1080 - ${i18n[currentLang].notes.res1080}`],
                ["2160p / 4K", `3840x2160 - ${i18n[currentLang].notes.res2160}`],
                ["4KLight", `3840x2160 - ${i18n[currentLang].notes.res4klight}`]
            ]
        },
        {
            id: 'src',
            icon: 'fa-download',
            title: i18n[currentLang].docSrc,
            headers: i18n[currentLang].headers.src,
            rows: [
                ["UHD.BluRay / BluRay.REMUX", i18n[currentLang].notes.srcRemuxQual],
                ["BluRay / BDRip", i18n[currentLang].notes.srcBlurayQual],
                ["WEB-DL", i18n[currentLang].notes.srcWebdlQual],
                ["WEBRip", i18n[currentLang].notes.srcWebripQual],
                ["HDTV", i18n[currentLang].notes.srcHdtvQual],
                ["HDCAM / CAM", i18n[currentLang].notes.srcCamQual]
            ]
        },
        {
            id: 'codec',
            icon: 'fa-microchip',
            title: i18n[currentLang].docCodec,
            headers: i18n[currentLang].headers.codec,
            rows: [
                ["x264", `H.264 - ${i18n[currentLang].notes.codec264}`],
                ["x265 / HEVC", `H.265 - ${i18n[currentLang].notes.codec265}`],
                ["AV1", `AV1 - ${i18n[currentLang].notes.codecAv1}`]
            ]
        },
        {
            id: 'lang',
            icon: 'fa-language',
            title: i18n[currentLang].docLang,
            headers: i18n[currentLang].headers.meaning,
            rows: [
                ["MULTi", i18n[currentLang].notes.langMulti],
                ["VFF", i18n[currentLang].notes.langVff],
                ["VFQ", i18n[currentLang].notes.langVfq],
                ["VOSTFR", i18n[currentLang].notes.langVostfr]
            ]
        },
        {
            id: 'audio',
            icon: 'fa-volume-high',
            title: i18n[currentLang].docAudio,
            headers: i18n[currentLang].headers.meaning,
            rows: [
                ["DTS-HD.MA / TrueHD", i18n[currentLang].notes.audioLossless],
                ["AC3 / DD5.1", i18n[currentLang].notes.audioDd],
                ["AAC", i18n[currentLang].notes.audioAac]
            ]
        },
        {
            id: 'special',
            icon: 'fa-tags',
            title: i18n[currentLang].docSpecial,
            headers: i18n[currentLang].headers.meaning,
            rows: [
                ["REPACK / PROPER / REAL", i18n[currentLang].notes.specialRepack]
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
