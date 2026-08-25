from pathlib import Path

p = Path('backend/index.js')
s = p.read_text()
marker = 'const TELEGRAM_INITDATA_TTL = 24 * 60 * 60;\n'
if 'const ADMIN_STATUSES = [' not in s:
    s = s.replace(marker, marker + 'const ADMIN_STATUSES = ["Qabul qilindi", "Tayyorlanmoqda", "Yo‘lda", "Yetkazildi", "Bekor qilindi"];\n')
s = s.replace('statuses.includes(String(req.body?.status))', 'ADMIN_STATUSES.includes(String(req.body?.status))')
p.write_text(s)
