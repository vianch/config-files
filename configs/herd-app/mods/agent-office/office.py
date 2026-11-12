#!/usr/bin/env python3
import argparse
import calendar
import collections
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time

OUTPUT_VERSION = 1
STATE_VERSION = 4

TEXT_CAP = 200
COMM_CAP = 80
AGENT_CAP = 60
SKILL_CAP = 40
CONSULT_CAP = 60
RECENT_CONSULTS = 10
CODE_WRITE_CAP = 40
HEAD_PROBE_BYTES = 65536
TITLE_TAIL_BYTES = 262144
ONE_HOUR_WRITE_INPUT_MULTIPLE = 2

SUBAGENT_LIVE_WINDOW_S = 600
RESUMED_WINDOW_S = 300
TEAMMATE_LAG_S = 60

SKIPPED_PREFIXES = (b'{"type":"api-request-blob"', b'{"type":"api-request-shape"')

ROLE_OF = [
    (re.compile(r'advis'), 'advisor'),
    (re.compile(r'devops|infra|pipeline|deploy'), 'helper'),
    (re.compile(r'research|docs|guide'), 'scholar'),
    (re.compile(r'explore|analyst|scout|search'), 'scout'),
    (re.compile(r'senior|architect|design-runner'), 'wizard'),
    (re.compile(r'implement|builder|code-simplifier|engineer'), 'builder'),
    (re.compile(r'review|health|verif|qa|audit|security|critic'), 'critic'),
    (re.compile(r'plan|coordinat|groom|pr-author|unblock|orchestr'), 'captain'),
]

DEPARTMENTS = {
    'advisor': ('Advisor', 'Board advisor'),
    'builder': ('Engineering', 'Engineer'),
    'captain': ('Program', 'Program lead'),
    'critic': ('QA & Review', 'Reviewer'),
    'helper': ('Operations', 'Generalist'),
    'scholar': ('Library', 'Researcher'),
    'scout': ('Research', 'Analyst'),
    'wizard': ('Architecture', 'Principal engineer'),
}

DEPARTMENT_ORDER = ['scout', 'scholar', 'wizard', 'builder', 'critic', 'captain', 'helper']

NAMES = {
    'advisor': [
        'The Oracle', 'Sage', 'Athena', 'Wise Owl', 'Mentor', "Gandalf's Aunt", 'Magic 8-Ball', 'Obi-Wan Kenobi',
        'Fortune Cookie', "Yoda's Cousin", 'Ask Jeeves', 'The Dude', 'Zoltar', 'Hindsight', 'Crystal Ball', 'Delphi',
        'Counsel', 'Sentinel', 'Cipher', 'Axon', 'Quipster', 'Wit-Whiz', 'Pun-Master', 'The Answer Man', 'Sir Talks-a-Lot',
        'Chatterbox', 'Wisecracker', 'Jester', 'Banternaut', 'Bot-ilda', 'AI-Caramba', 'Clever-Clogs', 'Hunch',
        'Second Opinion', 'Fortune Teller', 'Tea Leaves', 'Tarot Terry', 'Palm Reader', 'Armchair Expert', 'Grey Beard',
        'Elder Bot', 'Hot Take', 'Cold Take', 'Think Tank', 'Brain Trust', 'Dear Abby', 'Sage Advice', 'Rubber Duck',
        'Wise Guy', 'Pep Talk', 'Voice of Reason', 'Gut Feeling', 'Mind Reader', 'Guru Gary', 'Napkin Math', 'Bot Marley',
        'Meme Lord', 'Glitches-a-Lot',
    ],
    'builder': [
        'Bob the Builder', 'Wrench', 'Hammerhead', 'Tinker', 'Sprocket', 'Duct Tape', 'Lego Larry', 'Rivet', 'Spanner',
        'Allen Key', 'Nailgun', 'Torque', 'Jigsaw', 'Mario', 'Wall-E', 'Scaffold',
        'Build Battle Bob', 'Hardhat Harry', 'Ctrl Alt Delight', 'Jest In Time', 'Works On My Box', 'Legacy Whisperer',
        'Keyboard Warrior', 'Cobot', 'git-revert-man', 'Vector', 'Pascal', 'Welder Wendy', 'Crowbar', 'Plumb Bob',
        'Level Lenny', 'Sawdust', 'Drill Bill', 'Pliers', 'Mortar Mike', 'Bricklayer', 'Blueprint', 'Forklift Fred',
        'Crane Operator', 'Cement Mixer', 'Jackhammer', 'Tape Measure', 'Hot Glue', 'Zip Tie', 'Bolt Cutter', 'Wood Chip',
        'Pipe Wrench', 'Sander Sam', 'Chisel', 'Gear Head', 'Turbo Turtle', 'Cobbler', 'Sledgehammer', 'Stud Finder',
        'Rebar Ray', 'Dovetail', 'Caulk Gun', 'Bulldozer Bill',
    ],
    'captain': [
        'Captain Hook', 'Maestro', 'Air Traffic', 'Tetris', 'Skipper', 'Captain Obvious', 'Picard', 'Kirk', 'Gantt Chart',
        'Jira Jim', 'Herding Cats', 'Scrum Lord', 'Drill Sergeant', 'Conductor', 'Jack Sparrow', 'Admiral Ackbar',
        "Cap'n Caps Lock", 'Buffering Betty', 'Deadline Dodger', 'Infinite Loop', 'Navigator', 'Sir Wobblesworth',
        'Sir Fumblefoot', 'Cupcake Commando', 'Clipboard Carl', 'Whistle Blower', 'Traffic Cone', 'Herd Mentality',
        'Sprint Sally', 'Standup Stan', 'Backlog Barry', 'Roadmap Rita', 'Kanban Kev', 'Gavel', 'Baton', 'Compass',
        'First Mate', 'Bosun', 'Quartermaster', "Ship's Cat", "Crow's Nest", 'Sea Legs', 'Anchor Man', 'Foghorn',
        'Pirate Pete', 'Flag Ship', 'Jolly Roger', 'Dock Master', 'Bridge Crew', 'Tugboat', 'Meeting Maven',
        'Calendar Carl', 'Agenda Annie', 'Milestone Mo', 'Ahoy Matey', 'Big Cheese', 'Head Honcho', 'Top Banana',
        'Bossy Boots',
    ],
    'critic': [
        'Grumpy Cat', 'Hawkeye', 'Nitpick', 'Judge Dredd', 'Red Pen', 'Statler', 'Waldorf', 'Lint Roller', 'Spellcheck',
        'Comic Book Guy', 'Karen', 'Fact Checker', 'Squidward', 'Eeyore', 'Sour Patch', 'Gargamel',
        'Error 404', 'SegFault', 'Motivation 404', 'Verity', 'Stack Trace', 'Null Pointer', 'Off By One', 'Race Condition',
        'Heisenbug', 'Flaky Test', 'Red Test', 'Green Light', 'Bug Squasher', 'Linter Lou', 'Type Checker', 'Pedant',
        'Sourpuss', 'Skeptic Sam', "Devil's Advocate", 'Doubting Thomas', 'Eagle Eye', 'Fine Comb', 'Magnifier', 'Gotcha',
        'Rubber Stamp', 'Stern Look', 'Raised Eyebrow', 'Tough Crowd', 'Heckler', 'Boo Bird', 'Hard Pass', 'Side Eye',
        'Plot Hole', 'Code Smell', 'Dead Code', 'Spaghetti Code', 'Quality Quinn', 'Test Pilot', 'Smoke Test',
        'Crash Dummy', 'Bug Bounty', 'Audit Trail', 'Red Flag', 'Potato Aim Pete',
    ],
    'helper': [
        'Gizmo', 'Noodle', 'Biscuit', 'Pixel', 'Pickles', 'Waffles', 'Clippy', 'Roomba', 'Swiss Army', 'WD-40', 'Jarvis',
        'Alfred', 'Rosie', 'Marvin', 'Baymax', 'Tamagotchi',
        'Buddy', 'Pip', 'Chip', 'Honey', 'Cheerio', 'Cozy', 'Shield', 'Vault', 'Steward', 'Pancake', 'Wobble',
        'Snickerdoodle', 'Fluffernutter', 'Banana Split', 'Grumpy Toast', 'Sock Puppet', 'Jellybean', 'Sneaky Pickle',
        'Chunky Monkey', 'Doodlebug', 'Toe Beans', 'Double Dip', 'Cheddar Chaos', 'Pretzel Panic', 'Stapler Ninja',
        'Printer Jammer', 'Copier Chaos', 'Inbox Invader', 'Waffle Whisperer', 'Nacho Ninja', 'Banana Bandit',
        'Bacon Bandit', 'Cupcake', 'Muffin', 'Peanut', 'Button', 'Dumpling', 'Pudding', 'Cuddles',
    ],
    'scholar': [
        'Prof. Hoot', 'Doc Brown', 'Bookworm', 'Encyclo', 'Footnote', 'Wikipedia Wayne', 'Dewey Decimal', 'Citation Needed',
        'Hermione', 'Card Catalog', 'Page Turner', 'Librarian Larry', 'RTFM', 'Appendix', 'Prof. Plum', 'Tl;dr',
        'Ada', 'Turing', 'Syntax', 'Ledger', 'Bibliophile', 'Dusty Tome', 'Index Card', 'Glossary Gus', 'Thesaurus Rex',
        'Dictionary Dan', 'Trivia Tina', 'Quiz Whiz', 'Know-It-All', 'Brainiac', 'Almanac', 'Atlas', 'Codex', 'Scroll',
        'Parchment', 'Bookmark', 'Dog-Ear', 'Margin Notes', 'Prof. Pickle', 'Lorem Ipsum', 'Fine Print', 'Reading Nook',
        'Study Buddy', 'Cheat Sheet', 'Flash Card', 'Pop Quiz', 'Textbook Ted', 'Wiki Wanda', 'Stack Survivor', 'Man Page',
        'Readme Ruth', 'Changelog Chad', 'Docstring', 'Answer Key', 'Quill', 'Inkwell', 'Lexicon',
    ],
    'scout': [
        'Sherlock', 'Dora', 'Magellan', 'Columbo', 'Radar', 'Waldo', 'Scooby', 'Bloodhound', 'Marco Polo', 'Periscope',
        'Inspector Gadget', 'Carmen', 'Truffle Pig', 'Ctrl-F', 'Nancy Drew', 'Indiana Jones',
        'Raccoon', 'Donut Detective', 'Disco Ferret', 'Bush Camper', 'Loot Goblin', 'License2Prompt', 'Quantum Syntax',
        'Azure with Love', 'Model Not Enough', 'Another Prompt', 'For Your AI Only', 'Nacho Avg Spy', 'Spy Who Trained',
        'Trench Coat', 'Fake Mustache', 'Spyglass', 'Pathfinder', 'Trailblazer', 'Pigeon Scout', 'Sniffer', 'Tracker',
        'Grep Reaper', 'Haystack', 'Stakeout', 'Gumshoe', 'Dust Bunny', 'Log Digger', 'Night Owl', 'Cloak and Dagger',
        'Nosy Parker', 'Snoop', 'Lurker', 'Ferret', 'Eagle Scout', 'Treasure Map', 'Bushwhacker', 'Lost Tourist',
        'Wrong Turn', 'Pinpoint', 'Drone Ranger', 'Rabbit Hole', 'Burrow',
    ],
    'wizard': [
        'Gandalf', 'Yoda', 'Merlin', 'Morpheus', 'Dumbledore', 'Rincewind', 'Doctor Strange', 'Zatanna', 'Harry Potter',
        'Radagast', 'Abracadabra', 'The Architect', 'Houdini', 'Mickey Mage', 'Sorcerer Mickey', 'Prospero',
        'Hex', 'Cygnus', 'Flux', 'Sir Bamboozle', 'Hocus Pocus', 'Presto', 'Alakazam', 'Wand Waver', 'Pointy Hat',
        'Long Beard', 'Spell Slinger', 'Rune Reader', 'Rune Master', 'Cauldron Kate', 'Potion Pete', 'Crystal Cave',
        'Tower Dweller', 'Mana Pool', 'Cantrip', 'Fireball', 'Arcane Al', 'Enchanter', 'Conjurer', 'Sorcerer Sam', 'Genie',
        'Magic Beans', 'Rabbit Hat', 'Top Hat Tom', 'Sleight of Hand', 'Black Box', 'Magic Wand', 'Stardust', 'Spellbinder',
        "Merlin's Cousin", 'Warlock Wally', 'Wizard of Odd', 'Wise Wizard', 'Staff of Fun', 'Sorcery Sue', 'Pixie Dust',
    ],
}

Rate = collections.namedtuple('Rate', 'input output cache_read cache_write_5m')

RATES = [
    (re.compile(r'fable-5-2|mythos-5-2'), Rate(8.0, 40.0, 0.2, 10.0)),
    (re.compile(r'fable-5-1|mythos-5-1'), Rate(10.0, 50.0, 0.25, 12.5)),
    (re.compile(r'fable-5|mythos-5'), Rate(10.0, 50.0, 1.0, 12.5)),
    (re.compile(r'opus-5-5'), Rate(4.0, 20.0, 0.2, 5.0)),
    (re.compile(r'opus-5|opus-4-[5-8]'), Rate(5.0, 25.0, 0.5, 6.25)),
    (re.compile(r'sonnet-5'), Rate(2.0, 10.0, 0.2, 2.5)),
    (re.compile(r'sonnet-4'), Rate(3.0, 15.0, 0.3, 3.75)),
    (re.compile(r'haiku-4'), Rate(1.0, 5.0, 0.1, 1.25)),
]

MODEL_ALIASES = {
    'fable': 'claude-fable-5-2',
    'haiku': 'claude-haiku-4-5',
    'opus': 'claude-opus-5-5',
    'sonnet': 'claude-sonnet-5-5',
}

ASKING_TOOLS = ('AskUserQuestion', 'ExitPlanMode')
AGENT_TOOLS = ('Agent', 'Task')
CODE_TOOLS = ('Edit', 'MultiEdit', 'Write', 'NotebookEdit')
RECORD_PATH = re.compile(r'(^|/)\.(claude|codex)/')
TURN_END_REASONS = ('end_turn', 'refusal', 'stop_sequence')
WAKE_ORIGINS = ('coordinator', 'task-notification')
NOTE_STATUS = {'completed': 'completed', 'succeeded': 'completed', 'failed': 'failed',
               'killed': 'killed', 'stopped': 'killed'}
LIVE_STATUSES = ('running', 'pending', 'waiting')

TEAMMATE_MESSAGE = re.compile(r'<teammate-message\s+teammate_id="([^"]*)"[^>]*>\n?(.*?)(?:</teammate-message>|\Z)', re.S)
COMMAND_NAME = re.compile(r'<command-name>(.*?)</command-name>', re.S)
COMMAND_ARGS = re.compile(r'<command-args>(.*?)</command-args>', re.S)
NOTE_FIELD = re.compile(r'<(task-id|status|summary|result)>(.*?)</\1>', re.S)
SYSTEM_REMINDER = re.compile(r'<system-reminder>.*?</system-reminder>', re.S)
PASTED_CONTENT_TAG = re.compile(r'</?pasted_content[^>]*>')
PROC_START = re.compile(r'([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2})\s+(\d{4})|(\d{1,2})\s+([A-Z][a-z]{2})\s+(\d{2}:\d{2}:\d{2})\s+(\d{4})')


def claude_home():
    return os.environ.get('CLAUDE_CONFIG_DIR') or os.path.join(os.path.expanduser('~'), '.claude')


def cache_dir():
    tmp = os.environ.get('TMPDIR')
    path = os.path.join(tmp, 'herdr-office') if tmp else '/tmp/herdr-office-%d' % os.getuid()
    os.makedirs(path, mode=0o700, exist_ok=True)
    return path


def clip(text, cap=TEXT_CAP):
    if not isinstance(text, str):
        return ''
    flat = ' '.join(text.split())
    return flat if len(flat) <= cap else flat[:cap - 1] + '…'


def iso_to_ms(stamp):
    if not isinstance(stamp, str) or len(stamp) < 19:
        return None
    try:
        seconds = calendar.timegm((int(stamp[0:4]), int(stamp[5:7]), int(stamp[8:10]),
                                   int(stamp[11:13]), int(stamp[14:16]), int(stamp[17:19])))
    except ValueError:
        return None
    millis = 0
    if len(stamp) > 20 and stamp[19] == '.':
        digits = re.match(r'\d+', stamp[20:])
        if digits:
            millis = int(digits.group(0)[:3].ljust(3, '0'))
    return seconds * 1000 + millis


def slug_of(cwd):
    return re.sub(r'[^A-Za-z0-9]', '-', cwd)


def resolve_model(model):
    if not isinstance(model, str):
        return ''
    return MODEL_ALIASES.get(model.lower(), model)


def rate_for(model):
    lower = resolve_model(model).lower()
    for pattern, rate in RATES:
        if pattern.search(lower):
            return rate
    return None


def model_label(model):
    match = re.search(r'(fable|mythos|opus|sonnet|haiku)-(\d+)(?:-(\d+))?', resolve_model(model).lower())
    if not match:
        return model or ''
    version = match.group(2) if match.group(3) is None else '%s.%s' % (match.group(2), match.group(3))
    return '%s %s' % (match.group(1).capitalize(), version)


def cost_of(model, counts):
    rate = rate_for(model)
    if rate is None:
        return None
    tokens_in, tokens_out, cache_read, write_5m, write_1h = counts
    micro = (tokens_in * rate.input + tokens_out * rate.output + cache_read * rate.cache_read
             + write_5m * rate.cache_write_5m + write_1h * rate.input * ONE_HOUR_WRITE_INPUT_MULTIPLE)
    return micro / 1e6


def role_of(agent_type):
    lower = (agent_type or '').lower()
    for pattern, role in ROLE_OF:
        if pattern.search(lower):
            return role
    return 'helper'


def deck_hash(text):
    value = 0
    for char in text:
        code = ord(char)
        if code > 0xFFFF:
            code = 0xD800 + ((code - 0x10000) >> 10)
        value = (value * 31 + code) & 0xFFFFFFFF
    return value


def nickname(agent_type, agent_id, taken):
    pool = NAMES[role_of(agent_type)]
    start = deck_hash(agent_id) % len(pool)
    for offset in range(len(pool)):
        name = pool[(start + offset) % len(pool)]
        if name not in taken:
            return name
    base = pool[start]
    return '%s %d' % (base, sum(1 for name in taken if name.startswith(base)) + 1)


def tool_detail(name, tool_input):
    if not isinstance(tool_input, dict):
        return ''
    key = {
        'Bash': 'command', 'Read': 'file_path', 'Edit': 'file_path', 'MultiEdit': 'file_path',
        'Write': 'file_path', 'NotebookEdit': 'notebook_path', 'Grep': 'pattern', 'Glob': 'pattern',
        'Agent': 'description', 'Task': 'description', 'Skill': 'skill', 'WebFetch': 'url',
        'WebSearch': 'query', 'SendMessage': 'to',
    }.get(name)
    if name == 'AskUserQuestion':
        questions = tool_input.get('questions')
        if isinstance(questions, list) and questions and isinstance(questions[0], dict):
            return clip(questions[0].get('question', ''), 120)
        return ''
    value = tool_input.get(key) if key else ''
    return clip(value, 120) if isinstance(value, str) else ''


def text_of(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return '\n'.join(block.get('text', '') for block in content
                         if isinstance(block, dict) and block.get('type') == 'text')
    return ''


def command_prompt(text):
    name = COMMAND_NAME.search(text)
    if not name:
        return text
    args = COMMAND_ARGS.search(text)
    shown = name.group(1).strip()
    if not shown.startswith('/'):
        shown = '/' + shown
    return (shown + ' ' + args.group(1).strip()).strip() if args else shown


def human_prompt(row):
    if row.get('isMeta'):
        return None
    message = row.get('message') or {}
    content = message.get('content')
    if 'origin' in row:
        origin = row.get('origin')
        if not isinstance(origin, dict) or origin.get('kind') != 'human':
            return None
    else:
        if row.get('toolUseResult') is not None or not isinstance(content, str):
            return None
        stripped = content.lstrip()
        if stripped.startswith('Another Claude session'):
            return None
        if stripped.startswith('<') and '<command-name>' not in stripped:
            return None
    text = PASTED_CONTENT_TAG.sub('', SYSTEM_REMINDER.sub('', text_of(content)))
    if not text.strip():
        return None
    return command_prompt(text)


def new_file_state():
    return {
        'ino': None, 'size': 0, 'offset': 0, 'mtime': 0,
        'first': None, 'last': None, 'model': None, 'version': None,
        'msgs': {}, 'usage': {}, 'tools': 0, 'pending': {},
        'inflight': False, 'turnOpen': False, 'reqAt': None, 'idleAt': None,
        'asks': 0, 'prompt': None, 'promptAt': None, 'interrupted': False,
        'lastPrompt': None, 'aiTitle': None, 'customTitle': None,
        'advAvail': None, 'advModel': None,
        'consults': {}, 'advCalls': {}, 'advIters': {},
        'spawns': {}, 'spawned': {}, 'notes': {}, 'handbacks': {},
        'comms': [], 'skills': [], 'codeWrites': [], 'codeEdits': 0,
        'userRows': 0, 'firstPrompt': None, 'wakes': [],
    }


def push_capped(items, item, cap):
    items.append(item)
    if len(items) > cap:
        del items[:len(items) - cap]


def add_comm(state, comm_id, at, sender, receiver, kind, text):
    comms = state['comms']
    if comms and comms[-1]['id'] == comm_id:
        comms[-1].update(text=clip(text))
        return
    push_capped(comms, {'id': comm_id, 'at': at, 'from': sender, 'to': receiver, 'kind': kind,
                        'text': clip(text)}, COMM_CAP * 2)


def scan_assistant(state, row, at, is_main):
    message = row.get('message') or {}
    model = message.get('model')
    if isinstance(model, str) and model and not model.startswith('<'):
        state['model'] = model
    if row.get('advisorModel'):
        state['advModel'] = state['advModel'] or row.get('advisorModel')
    message_id = message.get('id') or row.get('uuid') or ''
    usage = message.get('usage') or {}
    if message_id not in state['msgs']:
        state['msgs'][message_id] = 1
        creation = usage.get('cache_creation') or {}
        write_total = usage.get('cache_creation_input_tokens') or 0
        write_1h = creation.get('ephemeral_1h_input_tokens') or 0 if isinstance(creation, dict) else 0
        bucket = state['usage'].setdefault(model if isinstance(model, str) and model else '?', [0, 0, 0, 0, 0])
        bucket[0] += usage.get('input_tokens') or 0
        bucket[1] += usage.get('output_tokens') or 0
        bucket[2] += usage.get('cache_read_input_tokens') or 0
        bucket[3] += max(0, write_total - write_1h)
        bucket[4] += write_1h
    iterations = usage.get('iterations')
    if isinstance(iterations, list):
        advice = [[it.get('model'), it.get('input_tokens') or 0, it.get('output_tokens') or 0,
                   it.get('cache_read_input_tokens') or 0, it.get('cache_creation_input_tokens') or 0]
                  for it in iterations if isinstance(it, dict) and it.get('type') == 'advisor_message']
        if advice:
            state['advIters'][message_id] = advice
    state['inflight'] = False
    stop = message.get('stop_reason')
    for block in message.get('content') or []:
        if not isinstance(block, dict):
            continue
        kind = block.get('type')
        if kind == 'tool_use':
            scan_tool_use(state, block, at, is_main)
        elif kind == 'server_tool_use' and str(block.get('name', '')).lower() == 'advisor':
            consult = state['consults'].setdefault(block.get('id'), {})
            consult['at'] = at
            consult['msg'] = message_id
            calls = state['advCalls'].setdefault(message_id, [])
            if block.get('id') not in calls:
                calls.append(block.get('id'))
        elif kind == 'advisor_tool_result':
            consult = state['consults'].setdefault(block.get('tool_use_id'), {})
            consult['endedAt'] = at
            content = block.get('content') or {}
            result_type = content.get('type') if isinstance(content, dict) else None
            if result_type == 'advisor_redacted_result':
                consult['redacted'] = True
            elif result_type == 'advisor_result':
                advice = (content.get('text') or '').strip()
                consult['redacted'] = False
                consult['head'] = clip(next((line.strip() for line in advice.split('\n') if line.strip()), ''))
            elif result_type == 'advisor_tool_result_error':
                consult['error'] = content.get('error_code') or 'unknown'
        elif kind == 'text' and is_main and stop in TURN_END_REASONS and block.get('text', '').strip():
            add_comm(state, 'ans-' + message_id, at, 'coordinator', 'user', 'answer', block.get('text'))
    if stop in TURN_END_REASONS:
        state['turnOpen'] = False
        state['pending'] = {}
        state['idleAt'] = at
    elif stop:
        state['turnOpen'] = True


def scan_tool_use(state, block, at, is_main):
    name = block.get('name') or ''
    tool_input = block.get('input') if isinstance(block.get('input'), dict) else {}
    use_id = block.get('id') or ''
    state['tools'] += 1
    state['pending'][use_id] = [name, tool_detail(name, tool_input), at]
    if name in AGENT_TOOLS:
        state['spawns'][use_id] = {
            'desc': clip(tool_input.get('description', '')), 'type': tool_input.get('subagent_type') or '',
            'name': tool_input.get('name') or None, 'at': at, 'model': tool_input.get('model') or None,
            'prompt': clip(tool_input.get('prompt', '')),
        }
        if is_main:
            add_comm(state, 'disp-' + use_id, at, 'coordinator', 'tool:' + use_id, 'dispatch',
                     tool_input.get('description', ''))
    elif name == 'Skill':
        push_capped(state['skills'], {'skill': tool_input.get('skill') or '', 'at': at}, SKILL_CAP)
    elif not is_main:
        return
    elif name == 'SendMessage':
        body = tool_input.get('message')
        text = body if isinstance(body, str) else tool_input.get('summary') or tool_input.get('content') or ''
        add_comm(state, 'send-' + use_id, at, 'coordinator', 'to:' + str(tool_input.get('to') or tool_input.get('recipient') or ''),
                 'message', text)
    elif name == 'AskUserQuestion':
        add_comm(state, 'ask-' + use_id, at, 'coordinator', 'user', 'question', tool_detail(name, tool_input))
    elif name in CODE_TOOLS:
        path = tool_input.get('file_path') or tool_input.get('notebook_path') or ''
        if path and not RECORD_PATH.search(path):
            state['codeEdits'] += 1
            if path in state['codeWrites']:
                state['codeWrites'].remove(path)
            push_capped(state['codeWrites'], path, CODE_WRITE_CAP)


def scan_user(state, row, at, is_main):
    state['userRows'] += 1
    message = row.get('message') or {}
    content = message.get('content')
    origin = row.get('origin') if isinstance(row.get('origin'), dict) else {}
    origin_kind = origin.get('kind')
    if state['userRows'] == 1 and not is_main:
        state['firstPrompt'] = clip(text_of(content))
    elif not is_main and origin_kind in WAKE_ORIGINS:
        state['wakes'].append(at)
    results = [block for block in content if isinstance(block, dict) and block.get('type') == 'tool_result'] \
        if isinstance(content, list) else []
    for block in results:
        state['pending'].pop(block.get('tool_use_id'), None)
    if results:
        state['turnOpen'] = True
        launched = row.get('toolUseResult')
        use_id = results[0].get('tool_use_id')
        if isinstance(launched, dict) and launched.get('agentId') and use_id in state['spawns']:
            state['spawned'][use_id] = launched.get('agentId')
        return
    text = text_of(content)
    if text.startswith('[Request interrupted by user'):
        state['interrupted'] = True
        state['turnOpen'] = False
        state['pending'] = {}
        state['idleAt'] = at
        return
    if not is_main:
        return
    prompt = human_prompt(row)
    if prompt is not None:
        record_prompt(state, prompt, at)
        return
    if origin_kind == 'peer':
        sender = origin.get('from') or origin.get('senderTaskId') or 'agent'
        state['handbacks'][sender] = at
        add_comm(state, 'peer-' + str(row.get('uuid')), at, sender, 'coordinator', 'report',
                 origin.get('handbackReportText') or origin.get('body') or text)
        state['turnOpen'] = True
        return
    if origin_kind == 'task-notification' or text.lstrip().startswith('<task-notification>'):
        fields = dict((key, value.strip()) for key, value in NOTE_FIELD.findall(text))
        task_id = fields.get('task-id')
        if task_id:
            state['notes'][task_id] = [fields.get('status') or '', clip(fields.get('result') or fields.get('summary') or ''), at,
                                       clip(fields.get('summary') or '')]
        state['turnOpen'] = True
        return
    if '<teammate-message' in text:
        for index, (sender, body) in enumerate(TEAMMATE_MESSAGE.findall(text)):
            scan_teammate_message(state, '%s-%d' % (row.get('uuid'), index), at, sender, body.strip())
        state['turnOpen'] = True


def scan_teammate_message(state, comm_id, at, sender, body):
    parsed = None
    if body.startswith('{'):
        try:
            parsed = json.loads(body)
        except ValueError:
            parsed = None
    if isinstance(parsed, dict):
        if parsed.get('type') == 'idle_notification':
            if parsed.get('result'):
                add_comm(state, 'tm-' + comm_id, at, 'name:' + sender, 'coordinator', 'report', parsed.get('result'))
            return
        add_comm(state, 'tm-' + comm_id, at, 'name:' + sender, 'coordinator', 'message',
                 parsed.get('message') or parsed.get('content') or parsed.get('type') or body)
        return
    add_comm(state, 'tm-' + comm_id, at, 'name:' + sender, 'coordinator', 'message', body)


def record_prompt(state, prompt, at):
    state['asks'] += 1
    state['prompt'] = clip(prompt)
    state['promptAt'] = at
    state['interrupted'] = False
    state['turnOpen'] = True
    add_comm(state, 'prompt-%d' % state['asks'], at, 'user', 'coordinator', 'prompt', prompt)


def scan_attachment(state, row, at, is_main):
    attachment = row.get('attachment') or {}
    kind = attachment.get('type')
    if kind == 'advisor_tool':
        state['advAvail'] = bool(attachment.get('available'))
        if attachment.get('model'):
            state['advModel'] = attachment.get('model')
    elif kind == 'queued_command' and is_main:
        origin = attachment.get('origin') if isinstance(attachment.get('origin'), dict) else {}
        if origin.get('kind') == 'human':
            text = PASTED_CONTENT_TAG.sub('', SYSTEM_REMINDER.sub('', text_of(attachment.get('prompt'))))
            if text.strip():
                record_prompt(state, command_prompt(text), at)


def scan_line(state, line, is_main):
    if line.startswith(SKIPPED_PREFIXES):
        return
    try:
        row = json.loads(line)
    except ValueError:
        return
    if not isinstance(row, dict):
        return
    kind = row.get('type')
    at = iso_to_ms(row.get('timestamp'))
    if at is not None:
        if state['first'] is None:
            state['first'] = at
        state['last'] = at
    if row.get('version') and not state['version']:
        state['version'] = row.get('version')
    if kind == 'assistant':
        scan_assistant(state, row, at, is_main)
    elif kind == 'user':
        scan_user(state, row, at, is_main)
    elif kind == 'api-request':
        state['inflight'] = True
        state['turnOpen'] = True
        state['reqAt'] = at
    elif kind == 'attachment':
        scan_attachment(state, row, at, is_main)
    elif kind == 'system' and row.get('subtype') == 'stop_hook_summary':
        state['turnOpen'] = False
        state['idleAt'] = at
    elif kind == 'ai-title':
        state['aiTitle'] = row.get('aiTitle') or state['aiTitle']
    elif kind == 'custom-title':
        state['customTitle'] = row.get('customTitle') or state['customTitle']
    elif kind == 'last-prompt':
        text = row.get('lastPrompt')
        if isinstance(text, str) and not text.lstrip().startswith(('<', 'Another Claude session', '[')):
            state['lastPrompt'] = clip(text)


def refresh_file(state, path, is_main):
    try:
        info = os.stat(path)
    except OSError:
        return False
    if state is None or state.get('ino') != info.st_ino or info.st_size < state.get('offset', 0):
        state.clear()
        state.update(new_file_state())
        state['ino'] = info.st_ino
    state['mtime'] = info.st_mtime
    if info.st_size == state['offset']:
        state['size'] = info.st_size
        return False
    with open(path, 'rb') as handle:
        handle.seek(state['offset'])
        chunk = handle.read(info.st_size - state['offset'])
    end = chunk.rfind(b'\n')
    if end < 0:
        state['size'] = info.st_size
        return False
    for line in chunk[:end].split(b'\n'):
        if line:
            scan_line(state, line, is_main)
    state['offset'] += end + 1
    state['size'] = info.st_size
    return True


def file_cost(state):
    usd = 0.0
    partial = False
    totals = [0, 0, 0, 0]
    for model, counts in state['usage'].items():
        totals[0] += counts[0]
        totals[1] += counts[1]
        totals[2] += counts[2]
        totals[3] += counts[3] + counts[4]
        price = cost_of(model, counts)
        if price is None:
            partial = partial or any(counts)
        else:
            usd += price
    return {'in': totals[0], 'out': totals[1], 'cr': totals[2], 'cw': totals[3]}, round(usd, 4), partial


def consults_of(state, owner):
    found = []
    tokens = {}
    for message_id, ids in state['advCalls'].items():
        iterations = state['advIters'].get(message_id, [])
        answered = [one for one in ids if not state['consults'].get(one, {}).get('error')]
        if len(answered) != len(iterations):
            continue
        for one, iteration in zip(answered, iterations):
            tokens[one] = iteration
    for consult_id, consult in state['consults'].items():
        iteration = tokens.get(consult_id)
        model = iteration[0] if iteration else state['advModel']
        usd = cost_of(model, [iteration[1], iteration[2], iteration[3], iteration[4], 0]) if iteration and model else None
        at = consult.get('at') or consult.get('endedAt')
        ended = consult.get('endedAt')
        found.append({
            'id': consult_id, 'at': at, 'endedAt': ended,
            'ms': ended - consult['at'] if ended and consult.get('at') else None,
            'model': model, 'in': iteration[1] if iteration else None, 'out': iteration[2] if iteration else None,
            'usd': round(usd, 4) if usd is not None else None,
            'redacted': bool(consult.get('redacted')), 'error': consult.get('error'),
            'advice': consult.get('head'), 'by': owner,
        })
    return found


def activity_of(state):
    pending = state['pending']
    if pending:
        name, detail, at = max(pending.values(), key=lambda item: item[2] or 0)
        return {'kind': 'tool', 'tool': name, 'detail': ('%s %s' % (name, detail)).strip(), 'at': at}
    if state['inflight'] or state['turnOpen']:
        return {'kind': 'thinking', 'detail': 'thinking', 'at': state['reqAt'] or state['last']}
    return {'kind': 'idle', 'detail': '', 'at': state['idleAt'] or state['last']}


def coordinator_state(state, agents, live):
    if not live:
        return 'idle', 'idle', state['idleAt'] or state['last']
    running = sorted(state['pending'].values(), key=lambda item: item[2] or 0)
    asking = [item for item in running if item[0] in ASKING_TOOLS]
    if asking:
        label = 'waiting on you: a plan to approve' if asking[0][0] == 'ExitPlanMode' else 'waiting on you: a question'
        return 'waiting-you', label, asking[0][2]
    delegating = [item for item in running if item[0] in AGENT_TOOLS]
    if delegating:
        return 'delegating', ('delegating %s' % delegating[0][1]).strip(), delegating[0][2]
    if running:
        name, detail, at = running[-1]
        return 'tool', ('%s %s' % (name, detail)).strip(), at
    if state['inflight'] or state['turnOpen']:
        return 'thinking', 'thinking', state['reqAt'] or state['promptAt'] or state['last']
    working = [agent for agent in agents if agent['status'] in LIVE_STATUSES]
    if working:
        return ('waiting-agents', 'waiting on %d agent%s' % (len(working), '' if len(working) == 1 else 's'),
                min(agent['startedAt'] or 0 for agent in working))
    return 'idle', 'idle', state['idleAt'] or state['last']


def read_json(path):
    try:
        with open(path, 'rb') as handle:
            return json.loads(handle.read())
    except (OSError, ValueError):
        return None


def proc_start_key(text):
    match = PROC_START.search(text or '')
    if not match:
        return None
    if match.group(1):
        return (match.group(1), int(match.group(2)), match.group(3), match.group(4))
    return (match.group(6), int(match.group(5)), match.group(7), match.group(8))


def process_starts(pids):
    wanted = [str(pid) for pid in pids if isinstance(pid, int) and pid > 0]
    if not wanted:
        return {}
    ps = '/bin/ps' if os.path.exists('/bin/ps') else (shutil.which('ps') or 'ps')
    env = dict(os.environ, LC_ALL='C', LANG='C')
    try:
        output = subprocess.run([ps, '-o', 'pid=,lstart=', '-p', ','.join(wanted)], capture_output=True,
                                text=True, timeout=5, env=env).stdout
    except (OSError, subprocess.SubprocessError):
        return {}
    starts = {}
    for line in output.splitlines():
        parts = line.strip().split(None, 1)
        if len(parts) == 2 and parts[0].isdigit():
            starts[int(parts[0])] = proc_start_key(parts[1])
    return starts


def session_files():
    records = []
    for path in glob.glob(os.path.join(claude_home(), 'sessions', '*.json')):
        if not os.path.basename(path)[:-5].isdigit():
            continue
        record = read_json(path)
        if isinstance(record, dict) and record.get('sessionId'):
            record['_path'] = path
            records.append(record)
    return records


def live_records(records):
    starts = process_starts([record.get('pid') for record in records])
    return [record for record in records
            if record.get('pid') in starts and starts[record['pid']] == proc_start_key(record.get('procStart'))]


def transcript_path(session_id, cwd):
    if cwd:
        candidate = os.path.join(claude_home(), 'projects', slug_of(cwd), session_id + '.jsonl')
        if os.path.exists(candidate):
            return candidate
    found = glob.glob(os.path.join(claude_home(), 'projects', '*', session_id + '.jsonl'))
    return found[0] if found else None


def tail_title(path):
    try:
        size = os.path.getsize(path)
        with open(path, 'rb') as handle:
            handle.seek(max(0, size - TITLE_TAIL_BYTES))
            chunk = handle.read()
    except OSError:
        return None
    title = None
    for line in chunk.split(b'\n'):
        if b'"custom-title"' in line or b'"ai-title"' in line:
            try:
                row = json.loads(line)
            except ValueError:
                continue
            title = row.get('customTitle') or row.get('aiTitle') or title
    return title


def list_sessions():
    sessions = []
    for record in live_records(session_files()):
        path = transcript_path(record['sessionId'], record.get('cwd'))
        mtime = os.path.getmtime(path) if path else os.path.getmtime(record['_path'])
        sessions.append({
            'pid': record.get('pid'), 'sessionId': record['sessionId'], 'cwd': record.get('cwd'),
            'title': (tail_title(path) if path else None) or record.get('name'),
            'mtime': int(mtime * 1000), 'version': record.get('version'),
        })
    sessions.sort(key=lambda one: one['mtime'], reverse=True)
    return sessions


def hc_binary():
    found = shutil.which('hc')
    if found:
        return found
    for candidate in ('~/.local/bin/hc', '/opt/homebrew/bin/hc', '/usr/local/bin/hc'):
        path = os.path.expanduser(candidate)
        if os.path.exists(path):
            return path
    return None


def terminal_info(address):
    binary = hc_binary()
    if binary is None:
        raise LookupError('hc not found')
    result = subprocess.run([binary, 'get', address, '--json'], capture_output=True, text=True, timeout=5)
    if result.returncode != 0:
        raise LookupError('hc get %s failed: %s' % (address, clip(result.stderr or result.stdout, 120)))
    return json.loads(result.stdout)


def load_cache(path, code_stamp):
    cache = read_json(path) if path else None
    if not isinstance(cache, dict) or cache.get('sv') != STATE_VERSION or cache.get('code') != code_stamp:
        return {'sv': STATE_VERSION, 'code': code_stamp, 'files': {}, 'probes': {}}
    return cache


def writable_cache_dir(cache_root):
    try:
        if cache_root:
            os.makedirs(cache_root, mode=0o700, exist_ok=True)
            return cache_root
        return cache_dir()
    except OSError:
        return None


def save_cache(path, cache):
    temp = None
    try:
        handle, temp = tempfile.mkstemp(dir=os.path.dirname(path), prefix='.office-', suffix='.tmp')
        with os.fdopen(handle, 'w') as out:
            json.dump(cache, out, separators=(',', ':'))
        os.replace(temp, path)
    except OSError:
        if temp is None:
            return
        try:
            os.unlink(temp)
        except OSError:
            pass


def code_stamp():
    try:
        info = os.stat(os.path.abspath(__file__))
        return '%d-%d' % (info.st_size, int(info.st_mtime))
    except OSError:
        return 'unknown'


class Reader(object):

    def __init__(self, cache):
        self.cache = cache
        self.changed = False

    def state(self, path, is_main=False):
        files = self.cache['files']
        state = files.get(path)
        if state is None:
            state = new_file_state()
            files[path] = state
            self.changed = True
        if refresh_file(state, path, is_main):
            self.changed = True
        return state

    def probe(self, path):
        try:
            info = os.stat(path)
        except OSError:
            return None, None
        known = self.cache['probes'].get(path)
        if known and known[0] == info.st_ino and (known[1] or info.st_size > HEAD_PROBE_BYTES or known[3] == info.st_size):
            return known[1], known[2]
        name = team = None
        try:
            with open(path, 'rb') as handle:
                head = handle.read(HEAD_PROBE_BYTES)
        except OSError:
            head = b''
        if head.startswith(b'{"type":"agent-setting"'):
            name_match = re.search(rb'"agentName":"([^"]+)"', head)
            team_match = re.search(rb'"teamName":"([^"]+)"', head)
            name = name_match.group(1).decode('utf-8', 'replace') if name_match else None
            team = team_match.group(1).decode('utf-8', 'replace') if team_match else None
        self.cache['probes'][path] = [info.st_ino, name, team, info.st_size]
        self.changed = True
        return name, team


def teammate_file(reader, member, team_name):
    directory = os.path.join(claude_home(), 'projects', slug_of(member.get('cwd') or ''))
    joined = (member.get('joinedAt') or 0) / 1000.0
    matches = []
    for path in glob.glob(os.path.join(directory, '*.jsonl')):
        name, team = reader.probe(path)
        if name == member.get('name') and team == team_name:
            matches.append(path)
    if not matches:
        return None

    def born(path):
        info = os.stat(path)
        return getattr(info, 'st_birthtime', info.st_mtime)

    after = [path for path in matches if born(path) >= joined - 120]
    return max(after or matches, key=os.path.getmtime)


def subagent_status(meta, meta_mtime, state, note, parent_live, now):
    activity = activity_of(state)
    busy = activity['kind'] != 'idle'
    age = now - state['mtime'] if state['mtime'] else float('inf')
    if meta.get('stoppedByUser'):
        return 'killed', 'stopped by user'
    resumed = (meta.get('finished') and state['mtime'] > meta_mtime + 5 and busy and age < RESUMED_WINDOW_S
               and parent_live)
    if meta.get('finished') and not resumed:
        status = NOTE_STATUS.get(note[0], 'completed') if note else 'completed'
        return status, None
    if not parent_live:
        return 'killed', 'lost'
    if not busy:
        return 'waiting', 'turn ended, not finished'
    if age < SUBAGENT_LIVE_WINDOW_S or activity['kind'] == 'tool':
        return 'running', 'resumed' if resumed else None
    return 'idle', 'stale'


def agent_record(agent_id, kind, agent_type, state, now):
    role = role_of(agent_type)
    label, title = DEPARTMENTS[role]
    tokens, usd, partial = file_cost(state) if state else ({'in': 0, 'out': 0, 'cr': 0, 'cw': 0}, 0.0, False)
    return {
        'id': agent_id, 'kind': kind, 'type': agent_type, 'name': None, 'nickname': None,
        'role': role, 'department': label, 'title': title, 'description': '', 'prompt': None,
        'model': state['model'] if state else None, 'modelLabel': '', 'status': 'pending', 'statusReason': None,
        'startedAt': None, 'endedAt': None,
        'lastActivity': activity_of(state) if state else {'kind': 'idle', 'detail': '', 'at': None},
        'tokens': tokens, 'usd': usd, 'usdPartial': partial, 'toolUses': state['tools'] if state else 0,
        'advisorConsults': len(state['consults']) if state else 0, 'advisorUsd': 0.0,
        'parentId': None, 'color': None, 'file': None, 'sessionId': None, 'usdEngine': None,
        'wakes': len(state['wakes']) if state else 0, 'toolUseId': None,
    }


def subagents_of(reader, session_dir, parent_state, parent_live, parent_id, now):
    agents = []
    directory = os.path.join(session_dir, 'subagents')
    for path in sorted(glob.glob(os.path.join(directory, 'agent-*.jsonl'))):
        agent_id = os.path.basename(path)[len('agent-'):-len('.jsonl')]
        meta_path = path[:-len('.jsonl')] + '.meta.json'
        meta = read_json(meta_path) or {}
        try:
            meta_mtime = os.path.getmtime(meta_path)
        except OSError:
            meta_mtime = 0
        state = reader.state(path)
        spawn = None
        for use_id, launched in parent_state['spawned'].items():
            if launched == agent_id:
                spawn = parent_state['spawns'].get(use_id)
                break
        agent_type = meta.get('agentType') or (spawn or {}).get('type') or 'general-purpose'
        record = agent_record(agent_id, 'subagent', agent_type, state, now)
        status, reason = subagent_status(meta, meta_mtime, state, parent_state['notes'].get(agent_id), parent_live, now)
        record.update(
            description=clip(meta.get('description') or (spawn or {}).get('desc') or ''),
            prompt=state['firstPrompt'] or (spawn or {}).get('prompt'),
            model=state['model'] or resolve_model(meta.get('model') or '') or None,
            status=status, statusReason=reason,
            startedAt=state['first'], endedAt=state['last'] if status not in LIVE_STATUSES else None,
            parentId=parent_id, file=path, toolUseId=meta.get('toolUseId'),
        )
        if status not in LIVE_STATUSES:
            record['lastActivity'] = {'kind': 'idle', 'detail': '', 'at': state['last']}
        agents.append((record, state))
    return agents


def engine_cost(session_id):
    try:
        with open(os.path.join(claude_home(), '.session-state', session_id + '.cost')) as handle:
            return float(handle.read().strip())
    except (OSError, ValueError):
        return None


def teammates_of(reader, session_id, lead_state, lead_live, now):
    team_dir = os.path.join(claude_home(), 'teams', 'session-' + session_id[:8])
    config = read_json(os.path.join(team_dir, 'config.json'))
    if not isinstance(config, dict) or config.get('leadSessionId') not in (None, session_id):
        return [], None
    team_name = config.get('name') or 'session-' + session_id[:8]
    spawns_by_name = {}
    for use_id, spawn in lead_state['spawns'].items():
        if spawn.get('name'):
            spawns_by_name[spawn['name']] = (use_id, spawn)
    agents = []
    for member in config.get('members') or []:
        if not isinstance(member, dict) or member.get('agentType') == 'team-lead' or member.get('name') == 'team-lead':
            continue
        path = teammate_file(reader, member, team_name)
        state = reader.state(path) if path else None
        use_id, spawn = spawns_by_name.get(member.get('name'), (None, {}))
        agent_type = member.get('agentType') or spawn.get('type') or 'general-purpose'
        agent_id = member.get('agentId') or '%s@%s' % (member.get('name'), team_name)
        record = agent_record(agent_id, 'teammate', agent_type, state, now)
        busy = state is not None and activity_of(state)['kind'] != 'idle'
        recent = state is not None and now - state['mtime'] < TEAMMATE_LAG_S
        if not lead_live:
            status, reason = 'idle', 'lead ended'
        elif member.get('isActive'):
            status, reason = 'running', None
        elif busy and recent:
            status, reason = 'running', 'transcript busy'
        else:
            status, reason = 'idle', None
        teammate_session = os.path.basename(path)[:-len('.jsonl')] if path else None
        record.update(
            name=member.get('name'), description=spawn.get('desc') or '',
            prompt=clip(member.get('prompt') or spawn.get('prompt') or ''),
            model=(state or {}).get('model') or resolve_model(member.get('model') or '') or None,
            status=status, statusReason=reason,
            startedAt=member.get('joinedAt') or (state or {}).get('first'), endedAt=None,
            color=member.get('color'), file=path, sessionId=teammate_session,
            usdEngine=engine_cost(teammate_session) if teammate_session else None, toolUseId=use_id,
        )
        if status == 'idle' and record['lastActivity']['kind'] != 'idle':
            record['lastActivity'] = {'kind': 'idle', 'detail': '', 'at': (state or {}).get('last')}
        agents.append((record, state))
        if teammate_session and state is not None:
            nested_dir = os.path.join(os.path.dirname(path), teammate_session)
            agents.extend(subagents_of(reader, nested_dir, state, lead_live, agent_id, now))
    return agents, team_name


def replay_deck_nicknames(records):
    events = []
    for order, record in enumerate(records):
        events.append((record['startedAt'] or 0, 0, order, record))
        for at in record.get('_wakes') or []:
            events.append((at or 0, 1, order, record))
    events.sort(key=lambda event: event[:3])
    roster = []
    for _, _, _, record in events:
        name = nickname(record['type'], record['id'], [one[1] for one in roster])
        roster = [one for one in roster if one[0] != record['id']] + [(record['id'], name)]
        roster = roster[-AGENT_CAP:]
        record['nickname'] = name


def resolve_party(party, by_name, by_id, spawned):
    if party.startswith('tool:'):
        return spawned.get(party[5:], party[5:])
    if party.startswith('name:') or party.startswith('to:'):
        wanted = party.split(':', 1)[1].strip()
        if wanted.lower() in ('team-lead', 'coordinator', 'lead'):
            return 'coordinator'
        return by_name.get(wanted.lower()) or by_id.get(wanted.lower()) or wanted
    return party


def build_snapshot(session_id, pid=None, cwd=None, record=None, terminal=None, status_msg=None, cache_root=None):
    started = time.time()
    now = started
    live = False
    if record is None:
        candidates = [one for one in session_files() if one.get('sessionId') == session_id]
        running = live_records(candidates)
        record = (running or candidates or [None])[0]
        if running:
            pid = record.get('pid')
            live = True
    elif pid is not None:
        starts = process_starts([pid])
        live = pid in starts and starts[pid] == proc_start_key(record.get('procStart'))
    if record is not None:
        cwd = cwd or record.get('cwd')
    path = transcript_path(session_id, cwd)
    if path is None:
        return {'v': OUTPUT_VERSION, 'error': 'no transcript for session %s' % session_id}
    root = writable_cache_dir(cache_root)
    cache_path = os.path.join(root, session_id + '.json') if root else None
    cache = load_cache(cache_path, code_stamp())
    cold = not cache['files']
    reader = Reader(cache)
    lead = reader.state(path, is_main=True)

    session_dir = os.path.join(os.path.dirname(path), session_id)
    pairs = subagents_of(reader, session_dir, lead, live, None, now)
    team_pairs, team_name = teammates_of(reader, session_id, lead, live, now)
    pairs = team_pairs + pairs
    nested = [pair for pair in pairs if pair[0]['parentId']]
    top = [pair for pair in pairs if not pair[0]['parentId']]
    for record_, state in pairs:
        record_['_wakes'] = state['wakes'] if state and record_['kind'] == 'subagent' else []
    replay_deck_nicknames([pair[0] for pair in top] + [pair[0] for pair in nested])

    consults = consults_of(lead, 'coordinator')
    for agent, state in pairs:
        if state is None:
            continue
        mine = consults_of(state, agent['id'])
        agent['advisorUsd'] = round(sum(one['usd'] or 0 for one in mine), 4)
        consults.extend(mine)
    consults.sort(key=lambda one: one['at'] or 0)

    agents = [pair[0] for pair in pairs]
    for agent in agents:
        agent.pop('_wakes', None)
        agent['modelLabel'] = model_label(agent['model'] or '')
    agents.sort(key=lambda one: one['startedAt'] or 0)

    tokens, usd, partial = file_cost(lead)
    state_name, label, since = coordinator_state(lead, agents, live)
    by_name = {}
    by_id = {}
    for agent in agents:
        by_id[agent['id'].lower()] = agent['id']
        if agent['name']:
            by_name[agent['name'].lower()] = agent['id']
        if agent['nickname']:
            by_name.setdefault(agent['nickname'].lower(), agent['id'])
    spawned = dict(lead['spawned'])
    for agent in agents:
        if agent['toolUseId']:
            spawned.setdefault(agent['toolUseId'], agent['id'])

    comms = []
    for comm in lead['comms']:
        shown = dict(comm)
        shown['from'] = resolve_party(comm['from'], by_name, by_id, spawned)
        shown['to'] = resolve_party(comm['to'], by_name, by_id, spawned)
        comms.append(shown)
    known_agents = set(by_id.values())
    for task_id, note in lead['notes'].items():
        if task_id in known_agents and task_id not in lead['handbacks'] and note[1]:
            comms.append({'id': 'note-' + task_id, 'at': note[2], 'from': task_id, 'to': 'coordinator',
                          'kind': 'report', 'text': note[1]})
    for consult in consults:
        if consult['endedAt']:
            text = ('advisor unavailable (%s)' % consult['error'] if consult['error']
                    else consult['advice'] or ('advice redacted' if consult['redacted'] else 'advice'))
            comms.append({'id': 'adv-' + str(consult['id']), 'at': consult['endedAt'], 'from': 'advisor',
                          'to': consult['by'], 'kind': 'advice', 'text': text})
    comms.sort(key=lambda one: one['at'] or 0)

    skills = [dict(one, agentId=None) for one in lead['skills']]
    for agent, state in pairs:
        if state is not None:
            skills.extend(dict(one, agentId=agent['id']) for one in state['skills'])
    skills.sort(key=lambda one: one['at'] or 0)

    advisor_usd = round(sum(one['usd'] or 0 for one in consults), 4)
    advisor_model = lead['advModel'] or next((state['advModel'] for _, state in pairs if state and state['advModel']), None)
    last_consult = consults[-1] if consults else None
    live_agents = [agent for agent in agents if agent['status'] in LIVE_STATUSES]
    departments = []
    for role in DEPARTMENT_ORDER:
        members = [agent for agent in agents if agent['role'] == role]
        if members:
            departments.append({'id': role, 'label': DEPARTMENTS[role][0], 'count': len(members),
                                'live': sum(1 for agent in members if agent['status'] in LIVE_STATUSES)})
    agents_usd = sum(agent['usd'] for agent in agents)
    usd_engine = engine_cost(session_id)
    team_engine = [agent['usdEngine'] for agent in agents if agent['usdEngine'] is not None]

    if reader.changed and cache_path:
        save_cache(cache_path, cache)

    title = lead['customTitle'] or lead['aiTitle'] or (record or {}).get('name')
    return {
        'v': OUTPUT_VERSION,
        'at': int(now * 1000),
        'ms': int((time.time() - started) * 1000),
        'cold': cold,
        'session': {
            'id': session_id, 'pid': pid, 'cwd': cwd or (record or {}).get('cwd'), 'file': path,
            'title': title, 'version': (record or {}).get('version') or lead['version'], 'live': live,
            'name': (record or {}).get('name'), 'startedAt': (record or {}).get('startedAt') or lead['first'],
            'terminal': terminal, 'team': team_name,
        },
        'owner': {
            'prompt': lead['prompt'] or lead['lastPrompt'], 'at': lead['promptAt'], 'asks': lead['asks'],
            'interrupted': lead['interrupted'],
        },
        'coordinator': {
            'model': lead['model'], 'modelLabel': model_label(lead['model'] or ''),
            'state': state_name, 'label': label, 'since': since, 'turnStartedAt': lead['promptAt'],
            'tokens': tokens, 'usd': usd, 'usdPartial': partial, 'tools': lead['tools'],
            'codeWrites': lead['codeWrites'], 'codeEdits': lead['codeEdits'],
            'activity': activity_of(lead), 'statusMsg': status_msg,
        },
        'advisor': {
            'model': advisor_model, 'modelLabel': model_label(advisor_model or ''),
            'available': lead['advAvail'] if lead['advAvail'] is not None else bool(advisor_model),
            'consults': len(consults), 'usd': advisor_usd,
            'last': last_consult, 'recent': consults[-RECENT_CONSULTS:][::-1],
        },
        'agents': agents[-AGENT_CAP:],
        'org': {'live': len(live_agents), 'onStaff': len(agents), 'departments': departments},
        'comms': comms[-COMM_CAP:],
        'skills': skills[-SKILL_CAP:],
        'totals': {
            'usdEstimate': round(usd + agents_usd + advisor_usd, 4),
            'usdEngine': usd_engine,
            'usdEngineTeam': round(usd_engine + sum(team_engine), 4) if usd_engine is not None else None,
            'tokens': {key: tokens[key] + sum(agent['tokens'][key] for agent in agents) for key in tokens},
        },
    }


def newest_live_session_in(cwd):
    same = [one for one in live_records(session_files()) if cwd and one.get('cwd') == cwd]
    return max(same, key=lambda one: one.get('updatedAt') or one.get('startedAt') or 0) if same else None


def snapshot_for_pid(pid, terminal=None, status_msg=None, fallback_cwd=None, cache_root=None):
    record = read_json(os.path.join(claude_home(), 'sessions', '%d.json' % pid)) if isinstance(pid, int) else None
    if not isinstance(record, dict) or not record.get('sessionId'):
        record = newest_live_session_in(fallback_cwd)
        if record is None:
            return {'v': OUTPUT_VERSION, 'error': 'no Claude session for pid %s' % pid}
        pid = record.get('pid')
    return build_snapshot(record['sessionId'], pid=pid, record=record, terminal=terminal, status_msg=status_msg,
                          cache_root=cache_root)


def snapshot_for_terminal(address, cache_root=None):
    info = terminal_info(address)
    foreground = info.get('foreground') or {}
    status = info.get('status') or {}
    cwd = foreground.get('cwd') or info.get('cwd')
    return snapshot_for_pid(foreground.get('pid'), terminal=address, status_msg=status.get('msg'), fallback_cwd=cwd,
                            cache_root=cache_root)


class ArgumentError(Exception):
    pass


class Arguments(argparse.ArgumentParser):
    def error(self, message):
        raise ArgumentError(message)


def main(argv=None):
    parser = Arguments(description='Claude Code session snapshot for the Herdr office panel.')
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--pid', type=int)
    group.add_argument('--terminal')
    group.add_argument('--session')
    group.add_argument('--list', action='store_true')
    parser.add_argument('--cache-dir')
    try:
        args = parser.parse_args(argv)
        if args.list:
            result = list_sessions()
        elif args.pid is not None:
            result = snapshot_for_pid(args.pid, cache_root=args.cache_dir)
        elif args.terminal:
            result = snapshot_for_terminal(args.terminal, cache_root=args.cache_dir)
        else:
            result = build_snapshot(args.session, cache_root=args.cache_dir)
    except Exception as error:  # the panel must always get one JSON line
        result = {'v': OUTPUT_VERSION, 'error': '%s: %s' % (type(error).__name__, clip(str(error), 160))}
    sys.stdout.write(json.dumps(result, separators=(',', ':')) + '\n')
    return 0


if __name__ == '__main__':
    sys.exit(main())
