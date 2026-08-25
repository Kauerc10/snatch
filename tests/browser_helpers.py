from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def memory_storage(entries=None):
    entries = entries or []
    return f"""Object.defineProperty(window, 'localStorage', {{ value: (() => {{ const m = new Map({entries!r}); return {{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),clear:()=>m.clear()}}; }})(), configurable: true }});"""


def mount(page, onboarded=False):
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    html = re.sub(r'<script[^>]+src="[^"]+"[^>]*></script>', '', html)
    html = re.sub(r'<link[^>]+href="\.\/styles\.css"[^>]*>', '', html)
    page.set_content(html)
    page.add_style_tag(content=(ROOT / 'styles.css').read_text(encoding='utf-8'))
    for script in [ROOT / 'src/core.js', ROOT / 'src/risk.js', ROOT / 'src/input.js', ROOT / 'src/claw.js']:
        page.add_script_tag(content=script.read_text(encoding='utf-8'))
    entries = [['snatch.onboarded', '1']] if onboarded else []
    page.add_script_tag(content=memory_storage(entries))
    page.add_script_tag(content=(ROOT / 'app.js').read_text(encoding='utf-8'))


def money(page, selector):
    return int(page.locator(selector).inner_text().replace('$', '').replace(',', ''))


def candidate_shot(page, elapsed_ms, want_hit=True):
    return page.evaluate(
        """({elapsed, wantHit}) => {
          const base = {x:.5,y:.79};
          const challenge = SnatchCore.buildChallenge('training', 'onboarding-v1');
          const radiusFor = (item) => item.rarity === 'wtf' ? .044 : item.rarity === 'mythic' ? .048 : item.rarity === 'epic' ? .052 : .056;
          const targets = challenge.spawns.map((spawn) => ({id:spawn.id, spawn, item:SnatchCore.itemById(spawn.itemId), radius:radiusFor(SnatchCore.itemById(spawn.itemId))}));
          const targetAt = (target, ms) => ms < target.spawn.atMs
            ? {x:target.spawn.direction > 0 ? -1 : 2, y:.5}
            : SnatchCore.targetPosition(target.spawn, ms);
          const candidates = [];
          for (let i=0;i<48;i++) {
            const a = Math.PI * 2 * i / 48;
            const drag = {x:Math.max(.02, Math.min(.98, base.x + Math.cos(a)*.11)), y:Math.max(.02, Math.min(.98, base.y + Math.sin(a)*.11))};
            const shot = SnatchInput.flickToShot(base, drag);
            const probes = [-120, 0, 120].map(delta => SnatchClaw.resolveShot({
              base, shot, targets, startElapsedMs:Math.max(0, elapsed + delta), targetAt,
              outboundSpeed:1.55, returnSpeed:2.05, stepMs:1000/120,
            }));
            const stableHit = probes.every(r => Boolean(r.hit) === wantHit) && (!wantHit || probes.every(r => r.hit?.id === probes[0].hit?.id));
            if (stableHit) candidates.push({drag, settleAtMs:Math.max(...probes.map(r => r.settleAtMs)), hitId:probes[0].hit?.id || null});
          }
          candidates.sort((a,b) => a.settleAtMs - b.settleAtMs);
          return candidates[0] || null;
        }""",
        {"elapsed": elapsed_ms, "wantHit": want_hit},
    )


def fire_drag(page, drag):
    box = page.locator('#game-canvas').bounding_box()
    page.mouse.move(box['x'] + box['width'] * .18, box['y'] + box['height'] * .70)
    page.mouse.down()
    page.mouse.move(box['x'] + box['width'] * drag['x'], box['y'] + box['height'] * drag['y'], steps=5)
    page.mouse.up()
