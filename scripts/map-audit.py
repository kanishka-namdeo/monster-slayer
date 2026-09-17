# Map integrity audit: verify warps/NPCs/pickups/doors + row widths (Task W)
import re, json, sys
src = open('src/game/maps.ts').read()

# crude row extraction per map block
maps = {}
for m in re.finditer(r"(\w+):\s*\{\s*name: '([^']+)'[^{]*rows: \[(.*?)\]", src, re.S):
    rows = re.findall(r"'([^']*)'", m.group(3))
    maps[m.group(1)] = rows

fails = []
for name, rows in maps.items():
    widths = sorted(set(len(r) for r in rows))
    print(f"{name}: {len(rows)} rows, widths={widths}")
    # tileAt: y bounds + x within row length
    def tile(x, y):
        if y < 0 or y >= len(rows): return 'v'
        if x < 0 or x >= len(rows[y]): return 'v'
        return rows[y][x]
    # warps: extract from the block
    blk = re.search(rf"{name}:\s*\{{(.*?)\n  \}}", src, re.S).group(1)
    for w in re.finditer(r"\{ x: (\d+), y: (\d+), to: '(\w+)'", blk):
        x, y, to = int(w.group(1)), int(w.group(2)), w.group(3)
        t = tile(x, y)
        if to in maps and t != 'D':
            fails.append(f"{name} warp ({x},{y}) -> {to}: tile is '{t}' not D")
        if to not in maps:
            fails.append(f"{name} warp target {to} MISSING")
    for n in re.finditer(r"\{ id: '(\w+)', x: (\d+), y: (\d+)", blk):
        t = tile(int(n.group(2)), int(n.group(3)))
        if t in 'TPfWwreuALKsctBbGgSzhHjJCXVZOUNqLo~v#MYA':
            fails.append(f"{name} NPC {n.group(1)} at ({n.group(2)},{n.group(3)}) on blocked '{t}'")
    for p in re.finditer(r"\{ id: '(\w+)', x: (\d+), y: (\d+), item", blk):
        t = tile(int(p.group(2)), int(p.group(3)))
        if t in 'TPfWwreuALKsctBbGgSzhHjJCXVZOUNqLo~v#MYA':
            fails.append(f"{name} pickup {p.group(1)} at ({p.group(2)},{p.group(3)}) on blocked '{t}'")

print()
if fails:
    print("FAILURES:")
    for f in fails: print(" -", f)
    sys.exit(1)
print("ALL MAP CHECKS PASS")
