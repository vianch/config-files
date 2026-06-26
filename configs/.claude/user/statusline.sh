#!/usr/bin/env bash
# Claude Code statusline
#   line 1: folder · branch · model + reasoning effort
#   line 2: session $ · daily $ · wall-clock 5h bar
#   line 3: context bar · tokens
#   line 4: 5h subscription usage · reset countdown
#   line 5: 7d subscription usage · reset countdown
#   line 6: per-model token share for the current 5h window (computed)

set -u

input=$(cat)
get() { jq -r "$1 // empty" 2>/dev/null <<<"$input"; }

cwd=$(get '.cwd')
model_id=$(get '.model.id')
model_name=$(get '.model.display_name')
output_style=$(get '.output_style.name')
session_id=$(get '.session_id')
transcript_path=$(get '.transcript_path')
cost_usd=$(get '.cost.total_cost_usd'); cost_usd=${cost_usd:-0}

settings_file="$HOME/.claude/settings.json"

# AUD rate (override with CLAUDE_AUD_RATE)
aud_rate="${CLAUDE_AUD_RATE:-1.52}"

# ── 1. Folder ────────────────────────────────────────────────
folder=$(basename "${cwd:-$PWD}")

# ── 2. Branch ────────────────────────────────────────────────
branch=""
branch_icon="🌿"
if git -C "$cwd" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  current_branch=$(git -C "$cwd" branch --show-current 2>/dev/null)
  if [[ "$current_branch" == "gitbutler/workspace" ]]; then
    branch=$(but -C "$cwd" branch list --no-check --no-ahead --json 2>/dev/null \
      | jq -r '.appliedStacks[].heads[].name' 2>/dev/null \
      | paste -sd ',' - | sed 's/,/, /g')
    [[ -z "$branch" ]] && branch="$current_branch"
  else
    branch="$current_branch"
  fi
fi

# ── 3. Model + reasoning effort ──────────────────────────────
# Claude Code only sends the *active* effort (.effort.level), already reduced by
# any silent per-model downgrade. On Opus 4.8 both "max" and "ultracode" run at
# "xhigh", so the payload can't tell them apart on its own. We therefore read the
# *configured* selection from settings.json as a best-effort hint:
#   • ultracode is a session-only flag — usually absent from disk, so it may not show.
#   • effortLevel persists your pick; if it differs from the active level we render
#     the downgrade transparently, e.g. "Max→xHigh".
model_display="${model_name:-$model_id}"

active_effort=$(get '.effort.level' | tr '[:upper:]' '[:lower:]')
# Read raw (not via get): jq's `// empty` would collapse a literal `false` to "".
thinking_enabled=$(jq -r '.thinking.enabled' <<<"$input" 2>/dev/null)
cfg_effort=$(jq -r '.effortLevel // empty' "$settings_file" 2>/dev/null | tr '[:upper:]' '[:lower:]')
cfg_ultra=$(jq -r 'if .ultracode == true then "yes" else empty end' "$settings_file" 2>/dev/null)

effort_label() {
  case "$1" in
    low)       echo "Low" ;;
    medium)    echo "Medium" ;;
    high)      echo "High" ;;
    xhigh)     echo "xHigh" ;;
    max)       echo "Max" ;;
    ultracode) echo "Ultra" ;;
    "")        echo "" ;;
    *)         echo "$1" ;;
  esac
}

reasoning=""
if [[ "$thinking_enabled" != "false" ]]; then
  if [[ -n "$cfg_ultra" ]]; then
    reasoning="Ultra"
    [[ -n "$active_effort" && "$active_effort" != "xhigh" ]] && reasoning="Ultra→$(effort_label "$active_effort")"
  elif [[ -n "$cfg_effort" && -n "$active_effort" && "$cfg_effort" != "$active_effort" ]]; then
    reasoning="$(effort_label "$cfg_effort")→$(effort_label "$active_effort")"
  elif [[ -n "$active_effort" ]]; then
    reasoning="$(effort_label "$active_effort")"
  elif [[ -n "$cfg_effort" ]]; then
    reasoning="$(effort_label "$cfg_effort")"
  fi
fi
[[ -n "$reasoning" ]] && model_display="$model_display $reasoning"

if [[ -n "$output_style" && "$output_style" != "default" ]]; then
  model_display="$model_display [$output_style]"
fi

# ── 4. Session cost (USD → AUD) ──────────────────────────────
session_aud=$(awk -v u="$cost_usd" -v r="$aud_rate" 'BEGIN{printf "%.2f", u*r}')

# ── 5. Daily cost (tracked across sessions) ──────────────────
daily_file="$HOME/.claude/daily-cost.json"
session_dir="$HOME/.claude/.session-state"
mkdir -p "$session_dir"
prev_file="$session_dir/$session_id.cost"
today=$(date +%Y-%m-%d)

prev_cost=0
[[ -f "$prev_file" ]] && prev_cost=$(<"$prev_file")
delta=$(awk -v a="$cost_usd" -v b="$prev_cost" 'BEGIN{d=a-b; if(d<0)d=0; printf "%.8f", d}')

if [[ ! -f "$daily_file" ]]; then echo '{}' > "$daily_file"; fi
prev_daily=$(jq -r --arg d "$today" '.[$d] // 0' "$daily_file" 2>/dev/null || echo 0)
new_daily=$(awk -v p="$prev_daily" -v x="$delta" 'BEGIN{printf "%.8f", p+x}')
tmp=$(mktemp)
jq --arg d "$today" --argjson v "$new_daily" '.[$d] = $v' "$daily_file" > "$tmp" 2>/dev/null && mv "$tmp" "$daily_file"
echo "$cost_usd" > "$prev_file"

daily_aud=$(awk -v u="$new_daily" -v r="$aud_rate" 'BEGIN{printf "%.2f", u*r}')

# ── 6. Session time (5h wall-clock window) ───────────────────
start_file="$session_dir/$session_id.start"
[[ ! -f "$start_file" ]] && date +%s > "$start_file"
start=$(<"$start_file")
now=$(date +%s)
elapsed=$((now - start))
window=$((5 * 3600))
remaining=$((window - elapsed))
(( remaining < 0 )) && remaining=0
rem_h=$((remaining / 3600))
rem_m=$(((remaining % 3600) / 60))
used_pct=$(( elapsed * 100 / window ))
(( used_pct > 100 )) && used_pct=100

# ── 7. Context from transcript ───────────────────────────────
ctx_in=0
ctx_out=0
ctx_limit=200000
[[ "$model_id" == *"[1m]"* ]] && ctx_limit=1000000

if [[ -f "$transcript_path" ]]; then
  read ctx_in ctx_out < <(awk -F'"usage":' '
    /"type":"assistant"/ && NF > 1 {
      u = $2
      it = cc = cr = ot = 0
      if (match(u, /"input_tokens":[0-9]+/))                { s=substr(u,RSTART,RLENGTH); sub(/.*:/,"",s); it=s+0 }
      if (match(u, /"cache_creation_input_tokens":[0-9]+/)) { s=substr(u,RSTART,RLENGTH); sub(/.*:/,"",s); cc=s+0 }
      if (match(u, /"cache_read_input_tokens":[0-9]+/))     { s=substr(u,RSTART,RLENGTH); sub(/.*:/,"",s); cr=s+0 }
      if (match(u, /"output_tokens":[0-9]+/))               { s=substr(u,RSTART,RLENGTH); sub(/.*:/,"",s); ot=s+0 }
      last_in = it + cc + cr
      out_sum += ot
    }
    END { printf "%d %d\n", (last_in+0), (out_sum+0) }
  ' "$transcript_path")
fi

ctx_pct=$(awk -v c="$ctx_in" -v l="$ctx_limit" 'BEGIN{if(l<=0){print 0; exit} p=c*100/l; if(p>100)p=100; printf "%d", p}')

# ── 8. Subscription usage limits (rate_limits) ───────────────
# Only present for Claude.ai subscribers after the first API response.
five_pct=$(get '.rate_limits.five_hour.used_percentage')
five_reset=$(get '.rate_limits.five_hour.resets_at')
week_pct=$(get '.rate_limits.seven_day.used_percentage')
week_reset=$(get '.rate_limits.seven_day.resets_at')

# ── 9. Per-model token share for the current 5h window ───────
# Not exposed by Claude Code, so computed from local transcripts. Cached for 60s
# and refreshed in the background so it never stalls a statusline render.
model_cache="$session_dir/model-usage.cache"
if [[ -n "$five_reset" ]]; then win_start=$(( five_reset - 18000 )); else win_start=$(( now - 18000 )); fi

cache_fresh=0
if [[ -f "$model_cache" ]]; then
  cage=$(( now - $(stat -f %m "$model_cache" 2>/dev/null || echo 0) ))
  (( cage >= 0 && cage < 60 )) && cache_fresh=1
fi

if (( ! cache_fresh )); then
  win_start_iso=$(date -u -r "$win_start" +%Y-%m-%dT%H:%M:%S 2>/dev/null)
  # Keep stale data visible / prevent a thundering herd: bump mtime (or seed) now.
  if [[ -f "$model_cache" ]]; then touch "$model_cache"; else echo "0 0 0 0 0" > "$model_cache"; fi
  (
    find "$HOME/.claude/projects" -name '*.jsonl' -mmin -360 -exec cat {} + 2>/dev/null \
      | jq -Rr --arg start "$win_start_iso" '
          (fromjson? // empty)
          | select(.type == "assistant" and (.timestamp != null) and (.timestamp >= $start))
          | [ (.message.model // .model // "?"),
              ( (.message.usage.input_tokens          // 0)
              + (.message.usage.output_tokens         // 0)
              + (.message.usage.cache_creation_input_tokens // 0)
              + (.message.usage.cache_read_input_tokens     // 0) ) ]
          | @tsv' 2>/dev/null \
      | awk -F'\t' '
          { if ($1 ~ /sonnet/) s+=$2; else if ($1 ~ /opus/) o+=$2; else x+=$2 }
          END { tot=s+o+x; printf "%d %d %d %d %d", s+0, o+0, x+0, tot+0, (tot>0?1:0) }' \
      > "$model_cache.tmp" 2>/dev/null && mv -f "$model_cache.tmp" "$model_cache"
  ) </dev/null >/dev/null 2>&1 &
  disown 2>/dev/null || true
fi

sonnet_tok=0; opus_tok=0; other_tok=0; tot_tok=0
[[ -f "$model_cache" ]] && read -r sonnet_tok opus_tok other_tok tot_tok _ < "$model_cache" 2>/dev/null
sonnet_tok=${sonnet_tok:-0}; opus_tok=${opus_tok:-0}; tot_tok=${tot_tok:-0}
if (( tot_tok > 0 )); then
  sonnet_pct=$(( sonnet_tok * 100 / tot_tok ))
  opus_pct=$(( opus_tok * 100 / tot_tok ))
fi

# ── Helpers ─────────────────────────────────────────────────
bar() {
  local pct=$1 filled empty out=""
  filled=$(( pct / 10 ))
  (( filled > 10 )) && filled=10
  (( filled < 0 )) && filled=0
  empty=$(( 10 - filled ))
  printf -v out '%*s' "$filled" ''; out=${out// /█}
  printf -v pad '%*s' "$empty" '';  pad=${pad// /░}
  printf '%s%s' "$out" "$pad"
}

fmt_tok() {
  local n=$1
  if   (( n >= 1000000 )); then awk -v n="$n" 'BEGIN{printf "%.1fM", n/1000000}'
  elif (( n >= 1000 ));    then awk -v n="$n" 'BEGIN{printf "%.0fk", n/1000}'
  else echo "$n"
  fi
}

fmt_countdown() {
  local d=$(( $1 - now ))
  (( d < 0 )) && d=0
  local days=$(( d / 86400 )) hrs=$(( (d % 86400) / 3600 )) mins=$(( (d % 3600) / 60 ))
  if   (( days > 0 )); then printf '%dd %dh' "$days" "$hrs"
  elif (( hrs  > 0 )); then printf '%dh%dm' "$hrs" "$mins"
  else                      printf '%dm' "$mins"
  fi
}

time_bar=$(bar "$used_pct")
ctx_bar=$(bar "$ctx_pct")
in_fmt=$(fmt_tok "$ctx_in")
out_fmt=$(fmt_tok "$ctx_out")

# ── Output ───────────────────────────────────────────────────
printf '📂 %s · %s %s · 🤖 %s\n'                       "$folder" "$branch_icon" "${branch:-no-branch}" "$model_display"
printf '💸 $%s session · 💰 $%s today · ⏱️ %s %d%% %dh%dm left\n' "$session_aud" "$daily_aud" "$time_bar" "$used_pct" "$rem_h" "$rem_m"
printf '💭 %s %d%% ctx · 🧠 %s in / %s out\n'          "$ctx_bar" "$ctx_pct" "$in_fmt" "$out_fmt"

# 5h / 7d subscription usage (only when the subscription rate-limit data is present)
if [[ -n "$five_pct" ]]; then
  five_i=${five_pct%.*}; five_i=${five_i:-0}
  printf '⏳ %s %d%% session · resets %s\n' "$(bar "$five_i")" "$five_i" "$(fmt_countdown "${five_reset:-$now}")"
fi
if [[ -n "$week_pct" ]]; then
  week_i=${week_pct%.*}; week_i=${week_i:-0}
  printf '📅 %s %d%% weekly · resets %s\n' "$(bar "$week_i")" "$week_i" "$(fmt_countdown "${week_reset:-$now}")"
fi

# Per-model token share for the 5h window
if (( tot_tok > 0 )); then
  printf '🧩 Sonnet %d%% · Opus %d%% (5h tokens)\n' "$sonnet_pct" "$opus_pct"
else
  printf '🧩 Sonnet · Opus — gathering 5h usage…\n'
fi
