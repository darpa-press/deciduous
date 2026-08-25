#!/usr/bin/env python3
"""Lay out every card in cards.json onto its own page of an IDML package.

The layout is not invented here: testlayout.idml is the template. Its resources,
styles, master spread and preferences are carried across untouched, and each card
spread is cloned from the sample's card spread, so the geometry lands byte for
byte where the sample put it. Only the ids, the page numbers, the spread's
vertical offset and the story text change.

Cards go on the recto of every spread, i.e. pages 3, 5, 7 ... — page 1 stands
alone, as in the sample.

A card whose text will not fit its frame continues onto a second (or third) card,
its body frames threaded so InDesign flows the copy itself. The bottom line —
imprint and shelf mark — repeats on every card of the run. Whether a card needs
continuing is measured against the real font, so it needs Louize NP; see --font.

    python3 build-idml.py                       # cards.idml, next to this file
    python3 build-idml.py --out ../out/deck.idml --trailing-blank
    python3 build-idml.py --split index --no-split passage   # override the measure
"""

import argparse
import json
import re
import sys
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent

# Pasteboard distance between one spread and the next, from the sample.
SPREAD_PITCH = 973.7007874015748

# Style names, as defined in the template's Resources/Styles.xml.
CS_SC = "CharacterStyle/SC"
CS_NONE = "CharacterStyle/$ID/[No character style]"
PS_NORMAL = "ParagraphStyle/$ID/NormalParagraphStyle"
PS_LINKS = "ParagraphStyle/Links"
PS_WORDS = "ParagraphStyle/Words"

# The template ids we swap out. Order matters only in that every one of these
# must be unique within its own file, which it is.
TPL_SPREAD = "ud7"
TPL_PAGE_VERSO = "ufa"
TPL_PAGE_RECTO = "ufb"
TPL_RECT = "u121"
TPL_FRAMES = [  # (TextFrame Self, ParentStory) in the order they appear
    ("u162", "u150"),  # card body
    ("u166", "u16a"),  # imprint
    ("u180", "u183"),  # shelf mark
]
TPL_BLANK_SPREAD = "u108"
TPL_BLANK_PAGE = "u10d"
TPL_FIRST_SPREAD = "ud1"

# InDesign's own ids in this document all sit well below 0x10000, so counting
# up from there cannot collide with anything we copy over.
_ID_SEED = 0x10000

# The sample encodes a forced line break inside a paragraph as U+2028.
LINE_SEPARATOR = " "

# Type spec, read off Resources/Styles.xml: 12pt Louize NP on fixed 15pt leading,
# 5.669pt after every paragraph, and a 28.346pt indent on Links and Words.
POINT_SIZE = 12.0
LEADING = 15.0
SPACE_AFTER = 5.669291338582678
INDENT = 28.34645669291339

# A card that runs long repeats down the page: the last block keeps the
# sample's position and the earlier ones stack above it, 1cm apart.
STACK_GAP = 28.346456692913385

# Where to look for Louize NP if --font is not given.
FONT_CANDIDATES = [
    Path.home() / "Library/Fonts/louize-reg.otf",
    Path("/Library/Fonts/louize-reg.otf"),
    HERE.parent / "public/fonts/louize-reg.otf",
]


class Measurer:
    """Set text in the real font, to decide whether a card overflows its frame.

    This is a greedy line breaker, not InDesign's composer: it breaks at spaces
    and never hyphenates, where InDesign will hyphenate and so occasionally fit
    a line we think it cannot. That errs towards continuing a card, which is the
    recoverable direction — a short continuation reads fine, overset text does
    not. --split/--no-split override it per card.
    """

    def __init__(self, font_path):
        from fontTools.ttLib import TTFont

        font = TTFont(str(font_path), lazy=True)
        self.upem = font["head"].unitsPerEm
        self.cmap = font.getBestCmap()
        self.hmtx = font["hmtx"]
        self.ascent = font["hhea"].ascent / self.upem * POINT_SIZE
        self.smcp = self._smallcaps(font)
        self._cache = {}

    @staticmethod
    def _smallcaps(font):
        """The font's real small-cap substitutions, which InDesign prefers."""
        mapping = {}
        if "GSUB" not in font:
            return mapping
        gsub = font["GSUB"].table
        indices = set()
        for record in gsub.FeatureList.FeatureRecord:
            if record.FeatureTag == "smcp":
                indices.update(record.Feature.LookupListIndex)
        for i in indices:
            for sub in gsub.LookupList.Lookup[i].SubTable:
                mapping.update(getattr(sub, "mapping", {}))
        return mapping

    def char_width(self, ch, small_caps):
        key = (ch, small_caps)
        if key not in self._cache:
            name = self.cmap.get(ord(ch)) or self.cmap.get(ord("n"))
            if small_caps:
                name = self.smcp.get(name, name)
            self._cache[key] = self.hmtx[name][0] / self.upem * POINT_SIZE
        return self._cache[key]

    def lines(self, runs, first_width, rest_width):
        """Greedy line count for one paragraph of (text, small_caps) runs."""
        words = []  # (text, small_caps), split on spaces, keeping style
        for text, small_caps in runs:
            for i, chunk in enumerate(text.split(" ")):
                if i == 0 and words and chunk:
                    words[-1] = (words[-1][0] + chunk, words[-1][1])
                elif chunk or i:
                    words.append((chunk, small_caps))
        if not any(w[0] for w in words):
            return 1

        count, width, limit = 1, 0.0, first_width
        space = self.char_width(" ", False)
        for text, small_caps in words:
            w = sum(self.char_width(c, small_caps) for c in text)
            gap = space if width else 0.0
            if width and width + gap + w > limit:
                count += 1
                width, limit = w, rest_width
            else:
                width += gap + w
        return count

    def frames(self, paras, frame_width, frame_height):
        """How many threaded frames this story needs."""
        counts = []
        for para in paras:
            indent = INDENT if para["style"] in (PS_LINKS, PS_WORDS) else 0.0
            first = frame_width - indent
            rest = frame_width - (INDENT if para["style"] == PS_LINKS else 0.0)
            # A U+2028 forced break starts a new line but not a new paragraph,
            # so only the paragraph's very first line takes the first-line width.
            n, group = 0, []
            for style, text, _ in para["runs"]:
                for i, part in enumerate(text.split(LINE_SEPARATOR)):
                    if i:
                        n += self.lines(group, first if not n else rest, rest)
                        group = []
                    group.append((part, style == CS_SC))
            n += self.lines(group, first if not n else rest, rest)
            counts.append(n)

        frames, y = 1, self.ascent
        for i, n in enumerate(counts):
            for line in range(n):
                if i or line:
                    y += LEADING + (SPACE_AFTER if line == 0 else 0.0)
                if y > frame_height:
                    frames += 1
                    y = self.ascent
        return frames


def load_measurer(font_arg):
    """Best-effort: without the font we cannot measure, so we do not guess."""
    candidates = [Path(font_arg)] if font_arg else FONT_CANDIDATES
    for path in candidates:
        if path.exists():
            try:
                return Measurer(path), path
            except ImportError:
                print("note: fontTools not installed — cards will not be continued", file=sys.stderr)
                return None, None
    print(
        "note: Louize NP not found (looked in %s) — cards will not be continued;\n"
        "      pass --font, or list cards to continue with --split"
        % ", ".join(str(p) for p in candidates),
        file=sys.stderr,
    )
    return None, None


class Ids:
    """Hands out fresh, collision-free Self ids."""

    def __init__(self):
        self._n = _ID_SEED

    def next(self):
        self._n += 1
        return "u%x" % self._n


# --------------------------------------------------------------------------
# text -> IDML
# --------------------------------------------------------------------------


def esc(text):
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def run(style, text, attrs=""):
    """One CharacterStyleRange."""
    return (style, text, attrs)


def paragraph(style, runs, attrs=""):
    return {"style": style, "runs": runs, "attrs": attrs}


def render_paragraphs(paras):
    """Serialise paragraphs, terminating every one but the last with <Br />.

    IDML marks a paragraph break with <Br /> at the end of the range; the final
    paragraph of a story carries none.
    """
    out = []
    for i, para in enumerate(paras):
        last_para = i == len(paras) - 1
        out.append(
            '\t\t<ParagraphStyleRange AppliedParagraphStyle="%s"%s>'
            % (para["style"], para["attrs"])
        )
        runs = [r for r in para["runs"] if r[1] != ""] or [run(CS_NONE, "")]
        for j, (cstyle, text, rattrs) in enumerate(runs):
            out.append(
                '\t\t\t<CharacterStyleRange AppliedCharacterStyle="%s"%s>' % (cstyle, rattrs)
            )
            out.append("\t\t\t\t<Content>%s</Content>" % esc(text))
            if not last_para and j == len(runs) - 1:
                out.append("\t\t\t\t<Br />")
            out.append("\t\t\t</CharacterStyleRange>")
        out.append("\t\t</ParagraphStyleRange>")
    return "\n".join(out)


def life(person):
    """(1950–), (1890–1974), (1499) — or nothing at all."""
    birth, death = person.get("birth"), person.get("death")
    if birth is None and death is None:
        return ""
    if birth is not None and birth == death:
        return " (%d)" % birth
    return " (%s–%s)" % (birth if birth is not None else "", death if death is not None else "")


def card_paragraphs(card):
    """The card's body story: title + summary, then links, then words."""
    paras = []

    # A blank line in the summary starts a new paragraph; a single newline is a
    # forced break inside one, which is how the sample sets it.
    summary = (card.get("summary") or "").strip()
    blocks = [b.replace("\n", LINE_SEPARATOR) for b in summary.split("\n\n") if b.strip()]

    head_runs = [run(CS_SC, card["title"])]
    if blocks:
        head_runs.append(run(CS_NONE, ".   " + blocks[0]))
    paras.append(paragraph(PS_NORMAL, head_runs))
    for block in blocks[1:]:
        paras.append(paragraph(PS_NORMAL, [run(CS_NONE, block)]))

    # Page links on one line, people on the next, each comma separated.
    parent = card.get("parent")
    pages = ["@" + parent["title"]] if parent and parent.get("title") else []
    people = [
        "@" + p["name"] + life(p)
        for p in sorted(card.get("people") or [], key=lambda p: p.get("position", 0))
    ]
    for line in (pages, people):
        if line:
            paras.append(paragraph(PS_LINKS, [run(CS_NONE, ", ".join(line))]))

    labels = [w["label"] for w in card.get("words") or [] if w.get("label")]
    if labels:
        paras.append(
            paragraph(
                PS_WORDS,
                [run(CS_SC, "words"), run(CS_NONE, "—" + "; ".join(labels))],
            )
        )
    return paras


def imprint_paragraphs(codex):
    return [
        paragraph(
            PS_NORMAL,
            [
                run(CS_SC, (codex.get("name") or "").lower()),
                run(CS_NONE, "/" + (codex.get("imprint") or "")),
            ],
        )
    ]


def shelfmark_paragraphs(card):
    return [
        paragraph(
            PS_NORMAL,
            [run(CS_NONE, card["shelfMark"], ' Capitalization="SmallCaps"')],
            attrs=' Justification="RightAlign"',
        )
    ]


# --------------------------------------------------------------------------
# template surgery
# --------------------------------------------------------------------------


def story_shell(template_text):
    """Strip a template story down to its wrapper, leaving a slot for content."""
    head, _, rest = template_text.partition("\t\t<ParagraphStyleRange")
    _, _, tail = rest.rpartition("</ParagraphStyleRange>")
    return head + "@@BODY@@" + tail


def make_story(shell, story_id, paras):
    text = shell.replace("@@BODY@@", render_paragraphs(paras))
    return re.sub(r'(<Story Self=")[^"]*(")', lambda m: m.group(1) + story_id + m.group(2), text, count=1)


def spread_template(text):
    """Turn the sample's card spread into a template with placeholder tokens.

    Everything else — ItemTransform, PathGeometry, TextFramePreference, the
    layer and colour references — is left exactly as InDesign wrote it.
    """
    text = text.replace('<Spread Self="%s"' % TPL_SPREAD, '<Spread Self="@@SPREAD@@"')
    text = re.sub(
        r'(<Spread Self="@@SPREAD@@"[^>]*?ItemTransform=")[^"]*(")',
        lambda m: m.group(1) + "1 0 0 1 0 @@SPREAD_Y@@" + m.group(2),
        text,
        count=1,
    )
    text = page_template(text, TPL_PAGE_VERSO, "@@PAGE_L@@", "@@PAGE_L_NO@@")
    text = page_template(text, TPL_PAGE_RECTO, "@@PAGE_R@@", "@@PAGE_R_NO@@")
    text = text.replace('Self="%s"' % TPL_RECT, 'Self="@@RECT@@"')
    for i, (frame_id, story_id) in enumerate(TPL_FRAMES):
        text = text.replace('Self="%s"' % frame_id, 'Self="@@FRAME%d@@"' % i)
        text = text.replace('ParentStory="%s"' % story_id, 'ParentStory="@@STORY%d@@"' % i)
    return frame_prefs(text)


def frame_prefs(text):
    """Make the frames behave as ordinary, resizable text frames.

    The sample bakes a TextColumnFixedWidth equal to the frame's own width. It
    is inert while UseFixedColumnWidth is false (the document default), but it
    goes stale the moment anyone resizes the frame, so we state the flag and
    drop the stale number.

    The body frame keeps its drawn height rather than auto-sizing: an
    auto-sizing frame never overflows, so it would never push a long card onto
    its continuation. Overflow is what drives the threading instead.
    """
    for i in range(len(TPL_FRAMES)):
        start = text.index('<TextFrame Self="@@FRAME%d@@"' % i)
        end = text.index("</TextFrame>", start)
        block = text[start:end]

        pref = re.search(r"<TextFramePreference[^>]*>", block).group(0)
        updated = re.sub(r'\sTextColumnFixedWidth="[^"]*"', "", pref)
        updated = updated.replace(
            "<TextFramePreference", '<TextFramePreference UseFixedColumnWidth="false"', 1
        )
        block = block.replace(pref, updated, 1)
        if i == 0:  # the card body carries the thread
            block = block.replace('PreviousTextFrame="n"', 'PreviousTextFrame="@@PREV@@"', 1)
            block = block.replace('NextTextFrame="n"', 'NextTextFrame="@@NEXT@@"', 1)
        text = text[:start] + block + text[end:]
    return text


def split_template(text):
    """Cut the spread into (head, one card block, tail).

    The block is the tint rectangle plus its three text frames — the unit that
    repeats down the page when a card runs over.
    """
    start = text.index('<Rectangle Self="@@RECT@@"')
    start = text.rfind("\n", 0, start) + 1
    end = text.rindex("</TextFrame>") + len("</TextFrame>")
    return text[:start], text[start:end], text[end:]


def offset_block(block, dy):
    """Move a whole card block up or down the spread."""

    def shift(m):
        parts = m.group(1).split()
        parts[5] = repr(float(parts[5]) + dy)
        return 'ItemTransform="%s"' % " ".join(parts)

    return re.sub(r'ItemTransform="([^"]*)"', shift, block)


def block_metrics(block):
    """(top, height) of the card's tint block, in spread coordinates."""
    ty = float(re.search(r'<Rectangle[^>]*ItemTransform="([^"]*)"', block).group(1).split()[5])
    rect = block[: block.index("</Rectangle>")]
    ys = [float(a.split()[1]) for a in re.findall(r'Anchor="([^"]*)"', rect)]
    return ty + min(ys), max(ys) - min(ys)


def page_top(text):
    """The top edge of the card's page, in spread coordinates."""
    page = re.search(r'<Page Self="@@PAGE_R@@"[^>]*>', text).group(0)
    bounds = re.search(r'GeometricBounds="([^"]*)"', page).group(1).split()
    ty = re.search(r'ItemTransform="([^"]*)"', page).group(1).split()
    return float(bounds[0]) + float(ty[5])


def body_frame_box(text):
    """The card body frame's drawn width and height, from its PathPointArray."""
    start = text.index('<TextFrame Self="@@FRAME0@@"')
    block = text[start : text.index("</TextFrame>", start)]
    pts = [a.split() for a in re.findall(r'Anchor="([^"]*)"', block)]
    xs = [float(p[0]) for p in pts]
    ys = [float(p[1]) for p in pts]
    return max(xs) - min(xs), max(ys) - min(ys)


def page_template(text, page_id, id_token, no_token):
    """Placeholder a single <Page>: its Self, its Name, and its Descriptor."""
    start = text.index('<Page Self="%s"' % page_id)
    end = text.index("</Page>", start) + len("</Page>")
    block = text[start:end]

    name = re.search(r'<Page Self="[^"]*"[^>]*\sName="([^"]*)"', block).group(1)
    block = block.replace('<Page Self="%s"' % page_id, '<Page Self="%s"' % id_token, 1)
    block = block.replace(' Name="%s"' % name, ' Name="%s"' % no_token, 1)
    # The Descriptor repeats the page number twice as <ListItem type="long">.
    block = block.replace(
        "<ListItem type=\"long\">%s</ListItem>" % name,
        "<ListItem type=\"long\">%s</ListItem>" % no_token,
    )
    return text[:start] + block + text[end:]


def blank_spread(text, spread_id, page_id, page_no, spread_y):
    """The sample's lone trailing verso, renumbered."""
    text = text.replace('<Spread Self="%s"' % TPL_BLANK_SPREAD, '<Spread Self="%s"' % spread_id)
    text = re.sub(
        r'(<Spread Self="%s"[^>]*?ItemTransform=")[^"]*(")' % spread_id,
        lambda m: m.group(1) + "1 0 0 1 0 %r" % spread_y + m.group(2),
        text,
        count=1,
    )
    old_name = re.search(r'<Page Self="%s"[^>]*\sName="([^"]*)"' % TPL_BLANK_PAGE, text).group(1)
    text = text.replace('<Page Self="%s"' % TPL_BLANK_PAGE, '<Page Self="%s"' % page_id)
    text = text.replace(' Name="%s"' % old_name, ' Name="%d"' % page_no, 1)
    text = text.replace(
        "<ListItem type=\"long\">%s</ListItem>" % old_name,
        "<ListItem type=\"long\">%d</ListItem>" % page_no,
    )
    return text


def rewrite_designmap(text, spread_files, story_files, story_ids, page_count, first_page_id):
    """Point the designmap at the spreads and stories we just generated."""
    text = re.sub(
        r'(\sStoryList=")[^"]*(")',
        lambda m: m.group(1) + " ".join(story_ids + ["ub3"]) + m.group(2),
        text,
        count=1,
    )
    text = replace_run(
        text,
        r'\t<idPkg:Spread src="[^"]*" />\n',
        "".join('\t<idPkg:Spread src="%s" />\n' % f for f in spread_files),
    )
    text = replace_run(
        text,
        r'\t<idPkg:Story src="[^"]*" />\n',
        "".join('\t<idPkg:Story src="%s" />\n' % f for f in story_files),
    )
    section = re.search(r"<Section Self=\"[^\"]*\"[^>]*>", text).group(0)
    updated = re.sub(r'(\sLength=")[^"]*(")', r"\g<1>%d\g<2>" % page_count, section)
    updated = re.sub(r'(\sAlternateLayoutLength=")[^"]*(")', r"\g<1>%d\g<2>" % page_count, updated)
    updated = re.sub(r'(\sPageStart=")[^"]*(")', r"\g<1>%s\g<2>" % first_page_id, updated)
    return text.replace(section, updated, 1)


def replace_run(text, line_pattern, replacement):
    """Swap out a contiguous run of identical-shaped lines."""
    match = re.search(r"(?:%s)+" % line_pattern, text)
    if not match:
        raise SystemExit("designmap.xml: could not find a run matching %s" % line_pattern)
    return text[: match.start()] + replacement + text[match.end() :]


# --------------------------------------------------------------------------
# build
# --------------------------------------------------------------------------

# Copied from the template verbatim: styles, colours, fonts, prefs, master.
PASSTHROUGH = (
    "META-INF/",
    "Resources/",
    "MasterSpreads/",
    "XML/",
)


def build(cards_path, template_path, out_path, opts):
    data = json.loads(cards_path.read_text(encoding="utf-8"))
    cards = data["cards"]
    codex = data.get("codex") or {}

    with zipfile.ZipFile(template_path) as tpl:
        src = {name: tpl.read(name).decode("utf-8") for name in tpl.namelist() if name != "mimetype"}

    spread_tpl = spread_template(src["Spreads/Spread_%s.xml" % TPL_SPREAD])
    head, block_tpl, tail = split_template(spread_tpl)
    body_shell = story_shell(src["Stories/Story_%s.xml" % TPL_FRAMES[0][1]])
    imprint_shell = story_shell(src["Stories/Story_%s.xml" % TPL_FRAMES[1][1]])
    mark_shell = story_shell(src["Stories/Story_%s.xml" % TPL_FRAMES[2][1]])

    box_w, box_h = body_frame_box(block_tpl)
    block_top, block_h = block_metrics(block_tpl)
    pitch = block_h + STACK_GAP
    # How many blocks can stack above the anchored one before running off the page.
    room = int((block_top - page_top(spread_tpl)) // pitch) + 1

    # How many blocks each card runs over, measured then overridden by hand.
    measurer, font_path = load_measurer(opts.font)
    runs = []
    for card in cards:
        paras = card_paragraphs(card)
        n = measurer.frames(paras, box_w, box_h) if measurer else 1
        if card["slug"] in opts.no_split:
            n = 1
        elif card["slug"] in opts.split:
            n = max(n, 2)
        if n > room:
            print(
                "warning: %s needs %d blocks but only %d fit the page — "
                "the last block will overset" % (card["slug"], n, room),
                file=sys.stderr,
            )
            n = room
        runs.append((card, paras, n))

    ids = Ids()
    out, spread_files, story_files, story_ids = {}, [], [], []

    # Spread 0: page 1, alone, straight from the template.
    first_spread = "Spreads/Spread_%s.xml" % TPL_FIRST_SPREAD
    out[first_spread] = src[first_spread]
    spread_files.append(first_spread)
    first_page_id = re.search(r'<Page Self="([^"]*)"', src[first_spread]).group(1)
    page_no = 1
    spread_no = 0

    def add_story(story_id, shell, paras):
        name = "Stories/Story_%s.xml" % story_id
        out[name] = make_story(shell, story_id, paras)
        story_files.append(name)
        story_ids.append(story_id)

    for card, paras, run_length in runs:
        spread_no += 1
        spread_id = ids.next()
        page_l, page_r = ids.next(), ids.next()

        # One story, threaded down the stack; InDesign does the flowing, so we
        # never have to decide where the copy breaks.
        body_story = ids.next()
        body_frames = [ids.next() for _ in range(run_length)]
        add_story(body_story, body_shell, paras)

        blocks = []
        for k in range(run_length):
            # The last block keeps the sample's position; earlier ones stack up.
            block = offset_block(block_tpl, -(run_length - 1 - k) * pitch)
            # The bottom line repeats on every block of the run.
            imprint_story, mark_story = ids.next(), ids.next()
            add_story(imprint_story, imprint_shell, imprint_paragraphs(codex))
            add_story(mark_story, mark_shell, shelfmark_paragraphs(card))

            block = block.replace("@@RECT@@", ids.next())
            block = block.replace("@@FRAME0@@", body_frames[k])
            block = block.replace("@@STORY0@@", body_story)
            block = block.replace("@@PREV@@", body_frames[k - 1] if k else "n")
            block = block.replace(
                "@@NEXT@@", body_frames[k + 1] if k + 1 < run_length else "n"
            )
            block = block.replace("@@FRAME1@@", ids.next()).replace("@@STORY1@@", imprint_story)
            block = block.replace("@@FRAME2@@", ids.next()).replace("@@STORY2@@", mark_story)
            blocks.append(block)

        text = head + "\n".join(blocks) + tail
        text = text.replace("@@SPREAD@@", spread_id)
        text = text.replace("@@SPREAD_Y@@", repr(SPREAD_PITCH * spread_no))
        text = text.replace("@@PAGE_L@@", page_l).replace("@@PAGE_L_NO@@", str(page_no + 1))
        text = text.replace("@@PAGE_R@@", page_r).replace("@@PAGE_R_NO@@", str(page_no + 2))
        page_no += 2

        name = "Spreads/Spread_%s.xml" % spread_id
        out[name] = text
        spread_files.append(name)

    if opts.trailing_blank:
        spread_no += 1
        spread_id, page_id = ids.next(), ids.next()
        page_no += 1
        name = "Spreads/Spread_%s.xml" % spread_id
        out[name] = blank_spread(
            src["Spreads/Spread_%s.xml" % TPL_BLANK_SPREAD],
            spread_id,
            page_id,
            page_no,
            SPREAD_PITCH * spread_no,
        )
        spread_files.append(name)

    for name, text in src.items():
        if name.startswith(PASSTHROUGH):
            out[name] = text

    out["designmap.xml"] = rewrite_designmap(
        src["designmap.xml"], spread_files, story_files, story_ids, page_no, first_page_id
    )

    write_package(out_path, out)
    return page_no, runs, font_path


def write_package(out_path, entries):
    """mimetype must come first and be stored uncompressed, or InDesign balks."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            zipfile.ZipInfo("mimetype"),
            "application/vnd.adobe.indesign-idml-package",
            compress_type=zipfile.ZIP_STORED,
        )
        for name in ["designmap.xml"] + sorted(n for n in entries if n != "designmap.xml"):
            zf.writestr(name, entries[name])


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--cards", type=Path, default=HERE / "cards.json")
    ap.add_argument("--template", type=Path, default=HERE / "testlayout.idml")
    ap.add_argument("--out", type=Path, default=HERE / "cards.idml")
    ap.add_argument(
        "--trailing-blank",
        action="store_true",
        help="append one blank verso so the document ends on an even page",
    )
    ap.add_argument("--font", help="Louize NP file to measure against")
    ap.add_argument(
        "--split", default="", help="comma-separated slugs to continue regardless"
    )
    ap.add_argument(
        "--no-split", default="", help="comma-separated slugs to keep on one card"
    )
    args = ap.parse_args(argv)
    args.split = {s for s in args.split.split(",") if s}
    args.no_split = {s for s in args.no_split.split(",") if s}

    pages, runs, font_path = build(args.cards, args.template, args.out, args)
    continued = [(c, n) for c, _, n in runs if n > 1]
    print(
        "%s — %d cards on pages 3–%d, %d pages total%s"
        % (
            args.out,
            len(runs),
            1 + 2 * len(runs),
            pages,
            "" if not font_path else "\nmeasured against %s" % font_path,
        )
    )
    if continued:
        print("stacked over more than one block:")
        for card, n in sorted(continued, key=lambda x: -x[1]):
            print("  %d blocks  %-28s %s" % (n, card["title"], card["slug"]))


if __name__ == "__main__":
    sys.exit(main())
