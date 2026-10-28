// Meme collection logic, run with `osascript -l JavaScript src/memes.js <command> [args]`.
//
//   grid [query]     items for the Grid View (all memes, optionally pre-filtered)
//   menu [query]     Script Filter for the management keyword (`memeadmin`)
//   form [query]     Script Filter for the add/edit form (reached via the "form" external trigger)
//   act <json|paths> performs a menu/form action and tells Alfred what to show next
//
// The collection is a folder of images plus `_index.yml`. The form session
// (which file is being edited and the values entered so far) lives in the
// workflow cache folder between Alfred invocations.

ObjC.import('Foundation');
ObjC.import('AppKit');
ObjC.import('Vision');
ObjC.import('CoreImage');

const fm = $.NSFileManager.defaultManager;
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic'];
// converted to an animated image on import (needs ffmpeg)
const VIDEO_EXT = ['webm', 'mp4', 'mov', 'm4v'];
const TOOL_DIRS = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin'];
// curated memes with notes, published with every release (bin/build)
const STARTER_URL = 'https://github.com/RomanBoegli/alfred-meme-workflow/releases/latest/download/memes-starter.zip';
const INDEX_FILE = '_index.yml';
const FIELDS = ['title', 'keywords', 'notes', 'source', 'added'];
const GUIDED_STEPS = ['title', 'keywords', 'notes', 'source'];
const SYSTEM_ICONS = '/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/';
const ICONS = {
	add: 'FinderIcon.icns',
	annotate: 'ToolbarLabels.icns',
	remove: 'TrashIcon.icns',
	cancel: 'ToolbarDeleteIcon.icns',
	tag: 'ToolbarLabels.icns',
	title: 'ClippingText.icns',
	keywords: 'ToolbarLabels.icns',
	notes: 'ToolbarInfo.icns',
	source: 'BookmarkIcon.icns',
	filename: 'ToolbarCustomizeIcon.icns',
	cutout: 'ToolbarAdvanced.icns',
	starter: 'DownloadsFolder.icns',
	folder: 'GenericFolderIcon.icns',
};

function icon(name) {
	return { path: SYSTEM_ICONS + ICONS[name] };
}

const INDEX_HEADER = `# Meme collection index. One entry per image file in this folder.
#
#   title:     name shown in Alfred
#   keywords:  words you'd search for: moods, reactions, characters
#   notes:     optional free text, e.g. when to use it
#   source:    optional origin (URL)
#   added:     date it joined the collection
#
# Edited by the workflow (\`memes\` keyword) or by hand. Extra fields are kept,
# comments other than this header are not.
`;

// ---------------------------------------------------------------- helpers

function env(name) {
	const v = $.NSProcessInfo.processInfo.environment.objectForKey(name);
	return v.isNil() ? '' : v.js;
}

function expandHome(p) {
	return p.replace(/^~(?=\/|$)/, env('HOME'));
}

function workflowDir() {
	return fm.currentDirectoryPath.js;
}

let memesDirCache;

// Where the collection lives: the folder chosen in Configure Workflow. 1.x
// kept it in the workflow data folder, which is used until a folder is chosen.
// '' when there is none yet.
function memesDir() {
	if (memesDirCache !== undefined) return memesDirCache;
	const legacy = env('alfred_workflow_data') && `${env('alfred_workflow_data')}/memes`;
	let dir = expandHome(env('memes_dir').trim()) || (legacy && exists(legacy) ? legacy : '');
	if (dir) fm.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(dir, true, $(), null);
	memesDirCache = dir.replace(/\/+$/, '');
	return memesDirCache;
}

function indexPath() {
	const dir = memesDir();
	// collections from before 2.2 used index.yaml
	if (!exists(`${dir}/${INDEX_FILE}`) && exists(`${dir}/index.yaml`)) {
		fm.moveItemAtPathToPathError(`${dir}/index.yaml`, `${dir}/${INDEX_FILE}`, null);
	}
	return `${dir}/${INDEX_FILE}`;
}

function sessionPath() {
	const cache = env('alfred_workflow_cache') || $.NSTemporaryDirectory().js + 'memes-workflow';
	fm.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(cache, true, $(), null);
	return cache + '/session.json';
}

function exists(p) {
	return fm.fileExistsAtPath(p);
}

function readText(p) {
	const s = $.NSString.stringWithContentsOfFileEncodingError(p, $.NSUTF8StringEncoding, null);
	return s.isNil() ? null : s.js;
}

function writeText(p, text) {
	$(text).writeToFileAtomicallyEncodingError(p, true, $.NSUTF8StringEncoding, null);
}

function realPath(p) {
	return $(p).stringByResolvingSymlinksInPath.js;
}

function basename(p) {
	return p.split('/').pop();
}

function extOf(name) {
	const m = name.match(/\.([^.]+)$/);
	return m ? m[1].toLowerCase() : '';
}

function isImage(p) {
	return IMAGE_EXT.includes(extOf(p));
}

function isVideo(p) {
	return VIDEO_EXT.includes(extOf(p));
}

function hasTool(name) {
	return TOOL_DIRS.some(d => exists(`${d}/${name}`));
}

// Format videos are converted to, see src/animate.zsh.
// GIF by default: animated WebP doesn't play in PowerPoint and other Office apps.
function animatedExt() {
	return env('animated_format') === 'webp' && hasTool('img2webp') ? 'webp' : 'gif';
}

function shell(command) {
	const app = Application.currentApplication();
	app.includeStandardAdditions = true;
	return app.doShellScript(command, { alteringLineEndings: false });
}

function shellQuote(s) {
	return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

function dirname(p) {
	return p.replace(/\/[^/]+$/, '');
}

function isAnimated(p) {
	// WebP: "RIFF....WEBPVP8X" header with the animation flag set
	if (extOf(p) === 'webp') {
		const head = $.NSFileHandle.fileHandleForReadingAtPath(p);
		if (head.isNil()) return false;
		const raw = $.NSString.alloc.initWithDataEncoding(head.readDataOfLength(21), $.NSISOLatin1StringEncoding).js;
		head.closeFile;
		return raw.slice(12, 16) === 'VP8X' && (raw.charCodeAt(20) & 0x02) !== 0;
	}
	if (extOf(p) !== 'gif') return false;
	const rep = $.NSBitmapImageRep.imageRepWithContentsOfFile(p);
	if (rep.isNil()) return false;
	const frames = rep.valueForProperty($.NSImageFrameCount);
	return !frames.isNil() && frames.js > 1;
}

// Cuts out the foreground subject (Vision, macOS 14+) and writes it as a
// transparent PNG. Returns an error message or ''.
function cutOut(input, output) {
	const handler = $.VNImageRequestHandler.alloc.initWithURLOptions($.NSURL.fileURLWithPath(input), $({}));
	const request = $.VNGenerateForegroundInstanceMaskRequest.alloc.init;
	if (!handler.performRequestsError($([request]), null)) return 'Could not analyse the image';
	const observation = request.results.firstObject;
	if (observation.isNil()) return 'No subject found to cut out';
	const buffer = observation.generateMaskedImageOfInstancesFromRequestHandlerCroppedToInstancesExtentError(
		observation.allInstances, handler, true, null);
	if (!buffer) return 'Could not cut out the subject';
	const rep = $.NSBitmapImageRep.alloc.initWithCIImage($.CIImage.imageWithCVPixelBuffer(buffer));
	const png = rep.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $({}));
	return png.writeToFileAtomically(output, true) ? '' : 'Could not write the cut-out';
}

function titleFromFilename(name) {
	return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
}

function slug(text) {
	return text.normalize('NFKD').replace(/[̀-ͯ]/g, '')
		.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'meme';
}

function today() {
	const d = new Date();
	const pad = n => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function byName(a, b) {
	a = a.toLowerCase();
	b = b.toLowerCase();
	return a < b ? -1 : a > b ? 1 : 0;
}

function listImages() {
	const dir = memesDir();
	const names = fm.contentsOfDirectoryAtPathError(dir, null);
	if (names.isNil()) return [];
	return names.js.map(n => n.js).filter(n => !n.startsWith('.') && isImage(n))
		.sort(byName);
}

function parseKeywords(text) {
	const seen = [];
	text.split(',').map(k => k.trim().replace(/\s+/g, ' ')).filter(Boolean)
		.forEach(k => { if (!seen.includes(k)) seen.push(k); });
	return seen;
}

function words(...parts) {
	return parts.flat().join(' ').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

// Edit distance where swapping two neighbouring letters counts as one edit.
function editDistance(a, b) {
	const d = [];
	for (let i = 0; i <= a.length; i++) d[i] = [i];
	for (let j = 0; j <= b.length; j++) d[0][j] = j;
	for (let i = 1; i <= a.length; i++) {
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
		}
	}
	return d[a.length][b.length];
}

// How well a query word matches a word of the meme, from 1 (same word) to 0.
// Tolerates one typo in words of 4+ letters and two in words of 7+, also
// while the word is still being typed ("shokc" finds "shocked").
function wordScore(q, w) {
	if (w === q) return 1;
	if (w.startsWith(q)) return 0.9;
	if (q.length >= 3 && w.includes(q)) return 0.6;
	const allowed = q.length >= 7 ? 2 : q.length >= 4 ? 1 : 0;
	if (!allowed) return 0;
	const whole = editDistance(q, w);
	if (whole <= allowed) return 0.7 - 0.15 * whole;
	let start = Infinity;
	for (let n = q.length - 1; n <= q.length + 1; n++) {
		if (n < w.length) start = Math.min(start, editDistance(q, w.slice(0, n)));
	}
	return start <= allowed ? 0.5 - 0.15 * start : 0;
}

const FIELD_WEIGHTS = { title: 1, keywords: 0.9, notes: 0.6, other: 0.5 };

// Relevance of a meme for a query, 0 if some query word matches nothing.
function score(query, m) {
	const fields = {
		title: words(m.title),
		keywords: words(m.keywords),
		notes: words(m.notes),
		other: words(m.extra, m.name, m.animated ? 'animated' : ''),
	};
	let total = 0;
	for (const q of words(query)) {
		let best = 0;
		for (const [field, list] of Object.entries(fields)) {
			for (const w of list) best = Math.max(best, FIELD_WEIGHTS[field] * wordScore(q, w));
		}
		if (!best) return 0;
		total += best;
	}
	// whole phrase in the title or a keyword ranks first
	const phrase = query.toLowerCase().trim();
	if ([m.title, ...m.keywords].some(t => t.toLowerCase().includes(phrase))) total += 1;
	return total;
}

// Memes matching the query, best first; all memes for an empty query.
function search(query, all) {
	if (!query.trim()) return all;
	return all.map(m => ({ m, s: score(query, m) }))
		.filter(r => r.s > 0)
		.sort((a, b) => b.s - a.s || byName(a.m.title, b.m.title))
		.map(r => r.m);
}

// ---------------------------------------------------------------- YAML subset
// Reads and writes the shape of _index.yml: a top-level map of filename ->
// map of fields, where values are plain/quoted scalars, flow lists [a, b],
// block lists (- a) or literal blocks (|).

function yamlUnquote(s) {
	s = s.trim();
	if (s.startsWith('"')) return JSON.parse(s);
	if (s.startsWith("'")) return s.slice(1, -1).replace(/''/g, "'");
	if (s === '~' || s === 'null') return '';
	return s;
}

function stripComment(s) {
	if (/^\s*["']/.test(s)) return s;
	return s.replace(/(^|\s)#.*$/, '');
}

function splitFlowList(s) {
	const items = [];
	let cur = '', quote = null;
	for (let i = 0; i < s.length; i++) {
		const c = s[i];
		if (quote) {
			cur += c;
			if (c === '\\' && quote === '"') cur += s[++i];
			else if (c === quote) quote = null;
		} else if (c === '"' || c === "'") {
			quote = c;
			cur += c;
		} else if (c === ',') {
			items.push(cur);
			cur = '';
		} else cur += c;
	}
	items.push(cur);
	return items.map(i => i.trim()).filter(Boolean).map(yamlUnquote);
}

function yamlValue(raw) {
	const s = stripComment(raw).trim();
	if (s.startsWith('[')) return splitFlowList(s.replace(/^\[/, '').replace(/\]\s*$/, ''));
	return yamlUnquote(s);
}

// Splits `key: rest` where key may be quoted.
function yamlKey(line) {
	let key, rest;
	if (line[0] === '"' || line[0] === "'") {
		const q = line[0];
		let i = 1;
		while (i < line.length && !(line[i] === q && line[i - 1] !== '\\')) i++;
		key = yamlUnquote(line.slice(0, i + 1));
		rest = line.slice(i + 1).replace(/^\s*:/, '');
	} else {
		const m = line.match(/^(.*?):(\s|$)(.*)$/);
		if (!m) throw new Error(`_index.yml: cannot parse "${line}"`);
		key = m[1].trim();
		rest = m[3];
	}
	return [key, rest.trim()];
}

function parseYaml(text) {
	const out = {};
	let entry = null, field = null, block = null;
	const finishBlock = () => {
		const lines = block.lines.join('\n').replace(/\n+$/, '');
		entry[block.field] = block.folded ? lines.replace(/([^\n])\n(?!\n)/g, '$1 ') : lines;
		block = null;
	};
	for (const raw of text.split(/\r?\n/)) {
		const indent = raw.match(/^ */)[0].length;
		if (block) {
			if (raw.trim() === '') { block.lines.push(''); continue; }
			if (block.indent === null && indent > block.parentIndent) block.indent = indent;
			if (block.indent !== null && indent >= block.indent) { block.lines.push(raw.slice(block.indent)); continue; }
			finishBlock();
		}
		if (/^\s*(#.*)?$/.test(raw)) continue;
		const line = raw.trim();
		if (indent === 0) {
			entry = out[yamlKey(line)[0]] = {};
			field = null;
		} else if (!entry) {
			throw new Error(`_index.yml: unexpected indentation in "${line}"`);
		} else if (line.startsWith('- ') || line === '-') {
			if (!Array.isArray(entry[field])) entry[field] = [];
			entry[field].push(yamlUnquote(stripComment(line.slice(1))));
		} else {
			const [k, rest] = yamlKey(line);
			field = k;
			if (/^[|>][-+]?$/.test(rest)) block = { field: k, folded: rest[0] === '>', lines: [], indent: null, parentIndent: indent };
			else entry[k] = rest === '' ? '' : yamlValue(rest);
		}
	}
	if (block) finishBlock();
	return out;
}

function yamlQuote(s, inList) {
	s = String(s);
	const special = inList ? /[:#\[\]{},&*!|>'"%@`]/ : /(: |\s#|^[#&*!|>'"%@`\[\]{},?-]|:$)/;
	if (s === '' || s !== s.trim() || special.test(s) || /^(true|false|yes|no|null|~|on|off)$/i.test(s)) {
		return JSON.stringify(s);
	}
	return s;
}

function stringifyYaml(index) {
	const out = [INDEX_HEADER];
	for (const name of Object.keys(index).sort(byName)) {
		const entry = index[name];
		out.push(`${yamlQuote(name)}:`);
		const keys = FIELDS.filter(k => k in entry).concat(Object.keys(entry).filter(k => !FIELDS.includes(k)));
		for (const k of keys) {
			const v = entry[k];
			if (Array.isArray(v)) {
				if (v.length) out.push(`  ${k}: [${v.map(i => yamlQuote(i, true)).join(', ')}]`);
			} else if (v === undefined || v === null || v === '') {
				continue;
			} else if (String(v).includes('\n')) {
				out.push(`  ${k}: |`);
				String(v).split('\n').forEach(l => out.push(l ? `    ${l}` : ''));
			} else {
				out.push(`  ${k}: ${yamlQuote(v)}`);
			}
		}
		out.push('');
	}
	return out.join('\n');
}

// ---------------------------------------------------------------- collection

function loadIndex() {
	const text = readText(indexPath());
	return text ? parseYaml(text) : {};
}

function saveIndex(index) {
	writeText(indexPath(), stringifyYaml(index));
}

// Every image on disk, merged with its index entry (if any).
function collection(index = loadIndex()) {
	return listImages().map(name => {
		const e = index[name] || {};
		return {
			name,
			path: `${memesDir()}/${name}`,
			indexed: name in index,
			title: e.title || titleFromFilename(name),
			keywords: Array.isArray(e.keywords) ? e.keywords : parseKeywords(e.keywords || ''),
			notes: e.notes || '',
			animated: isAnimated(`${memesDir()}/${name}`),
			extra: Object.keys(e).filter(k => !FIELDS.includes(k)).map(k => [].concat(e[k]).join(' ')),
		};
	});
}

function haystack(m) {
	return [m.title, m.keywords, m.notes, m.extra, m.name, m.animated ? 'animated' : ''];
}

// Grid thumbnails don't move, so animated memes get a marker.
function displayTitle(m) {
	return m.animated ? `▶︎ ${m.title}` : m.title;
}

function allKeywords(index) {
	const counts = {};
	Object.values(index).forEach(e => [].concat(e.keywords || []).forEach(k => { counts[k] = (counts[k] || 0) + 1; }));
	return Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
}

function uniqueName(base, ext, taken) {
	let name = `${base}.${ext}`;
	for (let i = 2; taken(name); i++) name = `${base}_${i}.${ext}`;
	return name;
}

// ---------------------------------------------------------------- session

function loadSession() {
	const text = readText(sessionPath());
	return text ? JSON.parse(text) : null;
}

function saveSession(s) {
	writeText(sessionPath(), JSON.stringify(s));
}

function clearSession() {
	fm.removeItemAtPathError(sessionPath(), null);
}

// The image as it is now: before any rename, after a cut-out.
function sessionImage(s) {
	return s.cutout || originalImage(s);
}

function originalImage(s) {
	return s.mode === 'add' ? s.source : `${memesDir()}/${s.original}`;
}

function canCutOut(s) {
	const p = originalImage(s);
	return ['png', 'jpg', 'jpeg', 'heic', 'webp'].includes(extOf(p)) && !isAnimated(p);
}

// Filename the meme will have after saving.
function finalName(s) {
	if (s.mode === 'add') return targetName(s);
	return s.cutout ? s.file.replace(/\.[^.]+$/, '.png') : s.file;
}

function startSession(paths) {
	const [first, ...queue] = paths;
	const dir = realPath(memesDir());
	const inCollection = realPath(dirname(first)) === dir;
	const name = basename(first);
	const entry = inCollection ? loadIndex()[name] : null;
	const s = {
		mode: inCollection ? 'edit' : 'add',
		guided: !entry,
		step: entry ? 'overview' : 'title',
		source: first,
		file: name,
		original: name,
		values: {
			title: entry && entry.title || titleFromFilename(name),
			keywords: entry ? [].concat(entry.keywords || []) : [],
			notes: entry && entry.notes || '',
			source: entry && entry.source || '',
		},
		queue,
	};
	saveSession(s);
	return s;
}

function targetExt(s) {
	if (s.cutout) return 'png';
	return s.mode === 'add' && isVideo(s.source) ? animatedExt() : extOf(s.file);
}

function prefill(s) {
	const v = s.values;
	switch (s.step) {
		case 'title': return v.title;
		case 'keywords': return v.keywords.length ? v.keywords.join(', ') + ', ' : '';
		case 'notes': return v.notes.replace(/\n/g, ' ');
		case 'source': return v.source;
		case 'filename': return finalName(s).replace(/\.[^.]+$/, '');
		default: return '';
	}
}

// ---------------------------------------------------------------- output

function scriptFilter(items, extra = {}) {
	return JSON.stringify(Object.assign({ items }, extra));
}

function next(what, arg = '') {
	return JSON.stringify({ alfredworkflow: { arg, variables: { next: what } } });
}

function showForm(s) {
	saveSession(s);
	return next('form', prefill(s));
}

// ---------------------------------------------------------------- grid

function grid(query) {
	const items = search(query, collection())
		.map(m => ({
			uid: m.name,
			type: 'file:skipcheck',
			title: displayTitle(m),
			subtitle: (m.animated ? 'Animated · ' : '') + (m.indexed ? m.notes || m.keywords.join(', ') : 'not annotated · ⌃↩ to add details'),
			match: words(haystack(m)).join(' '),
			arg: m.path,
			icon: { path: m.path },
			quicklookurl: m.path,
			text: { copy: m.path, largetype: m.notes || m.title },
			mods: {
				cmd: { arg: m.path, subtitle: 'Reveal in Finder' },
				alt: { arg: m.path, subtitle: 'Copy file path' },
				ctrl: { arg: JSON.stringify({ cmd: 'edit', file: m.name }), subtitle: 'Edit details' },
			},
		}));
	if (!items.length) {
		items.push(query
			? { title: `No meme matches "${query}"`, valid: false }
			: { title: 'No memes yet', subtitle: `Use "${manageKeyword()}" to add your own or the starter collection`, valid: false });
	}
	return gridOutput(items);
}

// The Grid View takes its items as the argument; columns come from the user configuration.
function gridOutput(items) {
	const columns = parseInt(env('grid_columns'), 10) || 5;
	return JSON.stringify({ alfredworkflow: { arg: scriptFilter(items), config: { columncount: columns } } });
}

function manageKeyword() {
	return env('manage_keyword') || 'memeadmin';
}

// Shown instead of everything else until a meme folder is chosen.
function noFolder(command) {
	const item = {
		title: 'Choose your meme folder',
		subtitle: 'Where your memes live; an empty folder is fine · ↩ open Configure Workflow',
		arg: JSON.stringify({ cmd: 'configure' }),
		icon: icon('folder'),
	};
	switch (command) {
		case 'grid': return gridOutput([Object.assign(item, { valid: false, subtitle: `Set it in Configure Workflow, or ↩ on it in "${manageKeyword()}"` })]);
		case 'menu': return scriptFilter([item]);
		case 'form': return scriptFilter([Object.assign(item, { valid: false })]);
		default: return next('notify', 'Choose your meme folder in Configure Workflow first');
	}
}

// ---------------------------------------------------------------- menu

function menu(query) {
	const index = loadIndex();
	const all = collection(index);
	const items = [];
	const act = (cmd, extra = {}) => JSON.stringify(Object.assign({ cmd }, extra));

	const starter = {
		title: 'Add the starter collection',
		subtitle: '160 curated memes with notes, downloaded from GitHub · memes you already have are kept',
		arg: act('starter'),
		icon: icon('starter'),
	};

	if (!query) {
		if (!all.length) items.push(starter);
		const s = loadSession();
		if (s) {
			items.push({
				title: `Continue ${s.mode === 'add' ? 'adding' : 'editing'} "${s.values.title}"`,
				subtitle: 'Pick up where you left off · ⌘↩ discard',
				arg: act('resume'),
				icon: { path: sessionImage(s) },
				mods: { cmd: { arg: act('cancel'), subtitle: 'Discard the unsaved changes' } },
			});
		}
		items.push({
			title: 'Add the files selected in Finder',
			subtitle: 'Or select images and use the "Add to Memes" Universal Action',
			arg: act('add-finder'),
			icon: icon('add'),
		});
		const unannotated = all.filter(m => !m.indexed);
		if (unannotated.length) {
			items.push({
				title: `Annotate ${unannotated.length} meme${unannotated.length > 1 ? 's' : ''} without details`,
				subtitle: unannotated.slice(0, 5).map(m => m.name).join(', ') + (unannotated.length > 5 ? ', …' : ''),
				arg: act('annotate'),
				icon: icon('annotate'),
			});
		}
		const orphans = Object.keys(index).filter(n => !all.some(m => m.name === n));
		if (orphans.length) {
			items.push({
				title: `Remove ${orphans.length} index entr${orphans.length > 1 ? 'ies' : 'y'} without a file`,
				subtitle: orphans.slice(0, 5).join(', ') + (orphans.length > 5 ? ', …' : ''),
				arg: act('prune'),
				icon: icon('remove'),
			});
		}
		if (all.length) items.push(starter);
	}

	search(query, all).forEach(m => items.push({
		uid: m.name,
		title: displayTitle(m),
		subtitle: `Edit · ${m.indexed ? m.keywords.join(', ') : 'not annotated'}`,
		arg: act('edit', { file: m.name }),
		icon: { path: m.path },
		quicklookurl: m.path,
		mods: { cmd: { arg: act('ask-remove', { file: m.name }), subtitle: 'Remove from the collection…' } },
	}));

	if (!items.length) items.push({ title: `No meme matches "${query}"`, valid: false });
	return scriptFilter(items, { skipknowledge: true });
}

// ---------------------------------------------------------------- form

function form(query) {
	const s = loadSession();
	if (!s) return scriptFilter([{ title: 'Nothing to edit', subtitle: `Start from the "${manageKeyword()}" keyword`, valid: false }]);

	const v = s.values;
	const image = sessionImage(s);
	const base = { icon: { path: image }, quicklookurl: image };
	const act = (cmd, extra = {}) => JSON.stringify(Object.assign({ cmd }, extra));
	const progress = s.guided ? `Step ${GUIDED_STEPS.indexOf(s.step) + 1}/${GUIDED_STEPS.length} · ` : '';
	const queued = s.queue.length ? ` · ${s.queue.length} more queued` : '';
	const item = o => Object.assign({}, base, o);
	const items = [];

	switch (s.step) {
		case 'title':
			items.push(item({
				title: query.trim() ? `Title: ${query.trim()}` : 'Type a title',
				subtitle: `${progress}↩ save · shown in Alfred and used for the filename${queued}`,
				arg: act('set', { field: 'title', value: query.trim() }),
				valid: !!query.trim(),
			}));
			break;

		case 'keywords': {
			const chosen = parseKeywords(query);
			const last = query.includes(',') ? query.slice(query.lastIndexOf(',') + 1).trim() : query.trim();
			items.push(item({
				title: chosen.length ? `Keywords: ${chosen.join(', ')}` : 'Type keywords, separated by commas',
				subtitle: `${progress}↩ save · moods, reactions, characters, situations${queued}`,
				arg: act('set', { field: 'keywords', value: chosen }),
			}));
			const head = query.includes(',') ? query.slice(0, query.lastIndexOf(',') + 1) + ' ' : '';
			const existing = parseKeywords(head);
			allKeywords(loadIndex())
				.filter(k => !existing.includes(k) && (!last || k.toLowerCase().startsWith(last.toLowerCase())) && k !== last)
				.slice(0, 12)
				.forEach(k => items.push(item({
					title: k,
					subtitle: '⇥ add this keyword',
					autocomplete: `${head}${k}, `.replace(/^\s+/, ''),
					valid: false,
					icon: icon('tag'),
				})));
			break;
		}

		case 'notes':
		case 'source': {
			const label = s.step === 'notes' ? 'Notes' : 'Source';
			const hint = s.step === 'notes' ? 'when to use it, backstory, anything' : 'where it came from, e.g. a URL';
			items.push(item({
				title: query.trim() ? `${label}: ${query.trim()}` : `No ${label.toLowerCase()} (optional)`,
				subtitle: `${progress}↩ ${query.trim() ? 'save' : 'skip'} · ${hint}${queued}`,
				arg: act('set', { field: s.step, value: query.trim() }),
			}));
			break;
		}

		case 'filename': {
			const name = query.trim() ? `${slug(query)}.${targetExt(s)}` : finalName(s);
			items.push(item({
				title: `Filename: ${name}`,
				subtitle: '↩ save · letters, digits and underscores',
				arg: act('set', { field: 'filename', value: name }),
			}));
			break;
		}

		case 'remove':
			items.push(item({
				title: `Remove "${v.title}"`,
				subtitle: `Moves ${s.file} to the Trash and deletes its index entry`,
				arg: act('remove'),
				icon: icon('remove'),
			}));
			items.push(item({ title: 'Keep it', subtitle: 'Back to the details', arg: act('step', { step: 'overview' }) }));
			break;

		default: {
			const fileName = finalName(s);
			const field = (label, value, step, placeholder) => item({
				title: `${label}: ${value || placeholder}`,
				subtitle: `↩ edit ${label.toLowerCase()}`,
				arg: act('step', { step }),
				icon: icon(step),
			});
			items.push(item({
				title: s.mode === 'add' ? `Add "${v.title}" to the collection` : `Save "${v.title}"`,
				subtitle: `${s.mode === 'edit' ? 'Writes the changes to _index.yml'
					: isVideo(s.source) ? `Converts it to an animated ${targetExt(s).toUpperCase()} as ${fileName}`
					: `Copies the file as ${fileName}`}${queued} · ⇧ preview`,
				arg: act('save'),
			}));
			items.push(field('Title', v.title, 'title', '—'));
			items.push(field('Keywords', v.keywords.join(', '), 'keywords', 'none yet'));
			items.push(field('Notes', v.notes.replace(/\n/g, ' '), 'notes', '—'));
			items.push(field('Source', v.source, 'source', '—'));
			items.push(field('Filename', fileName, 'filename', ''));
			if (s.cutout) {
				items.push(item({ title: 'Undo cut-out', subtitle: 'Keep the original background', arg: act('uncut'), icon: icon('cancel') }));
			} else if (canCutOut(s)) {
				items.push(item({ title: 'Cut out the subject', subtitle: 'Removes the background, saves a transparent PNG', arg: act('cutout'), icon: icon('cutout') }));
			}
			if (s.mode === 'edit' && exists(`${memesDir()}/${s.original}`)) {
				items.push(item({ title: 'Remove from collection…', subtitle: 'Asks for confirmation', arg: act('step', { step: 'remove' }), icon: icon('remove') }));
			}
			items.push(item({ title: 'Cancel', subtitle: s.queue.length ? 'Discards this one and the queued files' : 'Discards the changes', arg: act('cancel'), icon: icon('cancel') }));
		}
	}
	return scriptFilter(items, { skipknowledge: true });
}

// Filename for a new meme: the chosen one, or derived from the title.
function targetName(s) {
	if (s.renamed) return s.file;
	const index = loadIndex();
	return uniqueName(slug(s.values.title), targetExt(s), n => exists(`${memesDir()}/${n}`) || n in index);
}

// ---------------------------------------------------------------- actions

function finderSelection() {
	const finder = Application('Finder');
	return finder.selection().map(i => $.NSURL.URLWithString(i.url()).path.js);
}

function act(args) {
	const raw = args.join('\t').trim();
	const c = raw.startsWith('{') ? JSON.parse(raw) : null;
	if (c && c.cmd === 'configure') return configure();
	if (!memesDir()) return noFolder('act');
	if (!c) return add(raw.split('\t'));

	const s = loadSession();

	switch (c.cmd) {
		case 'add-finder':
			return add(finderSelection());

		case 'starter':
			return addStarter();

		case 'annotate':
			return add(collection().filter(m => !m.indexed).map(m => m.path));

		case 'edit':
			return showForm(startSession([`${memesDir()}/${c.file}`]));

		case 'ask-remove': {
			const ns = startSession([`${memesDir()}/${c.file}`]);
			ns.guided = false;
			ns.step = 'remove';
			return showForm(ns);
		}

		case 'resume':
			return s ? showForm(s) : next('none');

		case 'step':
			s.step = c.step;
			return showForm(s);

		case 'set': {
			if (c.field === 'filename') {
				s.file = c.value;
				s.renamed = true;
			} else {
				s.values[c.field] = c.value;
			}
			const i = GUIDED_STEPS.indexOf(c.field);
			s.step = s.guided && i >= 0 && i < GUIDED_STEPS.length - 1 ? GUIDED_STEPS[i + 1] : 'overview';
			if (s.step === 'overview') s.guided = false;
			return showForm(s);
		}

		case 'cutout': {
			const out = `${dirname(sessionPath())}/cutout-${Date.now()}.png`;
			const error = cutOut(originalImage(s), out);
			if (error) return next('notify', error);
			s.cutout = out;
			if (s.renamed) s.file = s.file.replace(/\.[^.]+$/, '.png');
			return showForm(s);
		}

		case 'uncut':
			fm.removeItemAtPathError(s.cutout, null);
			delete s.cutout;
			if (s.renamed) s.file = s.file.replace(/\.[^.]+$/, `.${extOf(originalImage(s))}`);
			return showForm(s);

		case 'save':
			return save(s);

		case 'remove':
			return remove(s);

		case 'prune': {
			const index = loadIndex();
			const onDisk = listImages();
			const orphans = Object.keys(index).filter(n => !onDisk.includes(n));
			orphans.forEach(n => delete index[n]);
			saveIndex(index);
			return next('notify', `Removed ${orphans.length} index entr${orphans.length === 1 ? 'y' : 'ies'} without a file`);
		}

		case 'cancel':
			if (s && s.cutout) fm.removeItemAtPathError(s.cutout, null);
			clearSession();
			return next('none');
	}
	throw new Error(`Unknown command ${c.cmd}`);
}

function add(paths) {
	paths = paths.filter(p => p && exists(p));
	const videos = paths.filter(isVideo);
	const usable = paths.filter(p => isImage(p) || (isVideo(p) && hasTool('ffmpeg')));
	if (!usable.length) {
		if (videos.length) return next('notify', 'Videos are converted to animated images with ffmpeg: brew install ffmpeg');
		return next('notify', paths.length ? 'No supported files selected (PNG, JPG, GIF, WebP, HEIC, WebM, MP4, MOV)' : 'Nothing selected');
	}
	return showForm(startSession(usable));
}

function save(s) {
	const index = loadIndex();
	const dir = memesDir();
	let name;

	if (s.mode === 'add') {
		name = targetName(s);
		if (exists(`${dir}/${name}`)) return next('notify', `${name} already exists, pick another filename`);
		if (isVideo(s.source)) {
			const target = `${dir}/${name.replace(/\.[^.]+$/, '')}`;
			name = basename(shell(`animated_format=${animatedExt()} ${shellQuote(workflowDir() + '/src/animate.zsh')} ${shellQuote(s.source)} ${shellQuote(target)}`).trim());
		} else if (s.cutout) {
			if (!fm.moveItemAtPathToPathError(s.cutout, `${dir}/${name}`, null)) return next('notify', `Could not move the cut-out into the collection`);
		} else if (!fm.copyItemAtPathToPathError(s.source, `${dir}/${name}`, null)) {
			return next('notify', `Could not copy ${basename(s.source)} into the collection`);
		}
	} else {
		name = finalName(s);
		if (name !== s.original && exists(`${dir}/${name}`)) return next('notify', `${name} already exists, pick another filename`);
		if (s.cutout) {
			// the original goes to the Trash, so a bad cut-out can be undone
			fm.trashItemAtURLResultingItemURLError($.NSURL.fileURLWithPath(`${dir}/${s.original}`), null, null);
			fm.moveItemAtPathToPathError(s.cutout, `${dir}/${name}`, null);
		} else if (name !== s.original) {
			fm.moveItemAtPathToPathError(`${dir}/${s.original}`, `${dir}/${name}`, null);
		}
	}

	const previous = index[s.original] || {};
	delete index[s.original];
	index[name] = Object.assign({}, previous, {
		title: s.values.title,
		keywords: s.values.keywords,
		notes: s.values.notes,
		source: s.values.source,
		added: previous.added || today(),
	});
	saveIndex(index);

	const message = `${s.mode === 'add' ? 'Added' : 'Saved'} "${s.values.title}"`;
	const queue = s.queue.filter(exists);
	if (queue.length) return showForm(startSession(queue));
	clearSession();
	return next('notify', message);
}

// Opens this workflow's Configure Workflow sheet at the meme folder setting.
function configure() {
	shell(`open ${shellQuote(`alfredpreferences://navigateto/workflows>workflow>${env('alfred_workflow_uid')}>userconfig>memes_dir`)}`);
	return next('none');
}

// Merges the starter collection into the meme folder: files that are already
// there and existing index entries are left alone.
function addStarter() {
	const dir = memesDir();
	const tmp = `${dirname(sessionPath())}/starter`;
	fm.removeItemAtPathError(tmp, null);
	try {
		shell(`mkdir -p ${shellQuote(tmp)} && curl -fsSL --max-time 300 -o ${shellQuote(tmp + '/starter.zip')} ${shellQuote(env('starter_url') || STARTER_URL)}`
			+ ` && ditto -x -k ${shellQuote(tmp + '/starter.zip')} ${shellQuote(tmp + '/memes')}`);
	} catch (e) {
		fm.removeItemAtPathError(tmp, null);
		return next('notify', 'Could not download the starter collection, check your connection');
	}
	const starterIndex = parseYaml(readText(`${tmp}/memes/${INDEX_FILE}`) || '');
	const index = loadIndex();
	const names = fm.contentsOfDirectoryAtPathError(`${tmp}/memes`, null).js.map(n => n.js).filter(isImage);
	let added = 0;
	for (const name of names) {
		if (exists(`${dir}/${name}`)) continue;
		fm.copyItemAtPathToPathError(`${tmp}/memes/${name}`, `${dir}/${name}`, null);
		if (!(name in index) && starterIndex[name]) index[name] = starterIndex[name];
		added++;
	}
	saveIndex(index);
	fm.removeItemAtPathError(tmp, null);
	return next('notify', added ? `Added ${added} meme${added === 1 ? '' : 's'} from the starter collection` : 'You already have every starter meme');
}

function remove(s) {
	const index = loadIndex();
	const path = `${memesDir()}/${s.original}`;
	if (exists(path)) fm.trashItemAtURLResultingItemURLError($.NSURL.fileURLWithPath(path), null, null);
	delete index[s.original];
	saveIndex(index);
	clearSession();
	return next('notify', `Removed "${s.values.title}" (moved to the Trash)`);
}

// ---------------------------------------------------------------- main

function run(argv) {
	const [command, ...args] = argv;
	const query = (args[0] || '').normalize('NFC');
	try {
		if (!memesDir() && command !== 'act') return noFolder(command);
		switch (command) {
			case 'grid': return grid(query.trim());
			case 'menu': return menu(query.trim());
			case 'form': return form(query);
			case 'act': return act(args);
		}
		throw new Error(`Unknown command ${command}`);
	} catch (e) {
		if (command === 'act') return next('notify', `Error: ${e.message}`);
		return scriptFilter([{ title: 'Error', subtitle: e.message, valid: false }]);
	}
}
