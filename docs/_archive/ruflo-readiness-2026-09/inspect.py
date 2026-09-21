# -*- coding: utf-8 -*-
import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
p = r"D:\AI-for-Enterprise\North_Start_Commercial_Support_Platform\docs\project\ruflo-readiness\01a-repository-forensics.md"
with open(p, "r", encoding="utf-8") as f:
    c = f.read()
lines = c.split("\n")
# find candidate lines
for i, line in enumerate(lines):
    if any(x in line for x in ["7.2", "8.1", "12. Human", "NE-10", "Naming"]):
        print(f"L{i+1}: {line}")
