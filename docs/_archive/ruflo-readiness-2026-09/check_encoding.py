# -*- coding: utf-8 -*-
import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
p = r"D:\AI-for-Enterprise\North_Start_Commercial_Support_Platform\docs\project\ruflo-readiness\01a-repository-forensics.md"
with open(p, "rb") as f:
    raw = f.read()
# Find the em dash in "7.2 Naming chaos" section
idx = raw.find(b"7.2 Naming chaos")
chunk = raw[idx:idx+200]
print("chunk repr:", repr(chunk))
# Find the 8.1 section line
idx2 = raw.find(b"8.1 Ruflo/Claude Flow")
chunk2 = raw[idx2:idx2+500]
print("8.1 repr:", repr(chunk2))
# Find 12. Human Gate section
idx3 = raw.find(b"12. Human Gate")
chunk3 = raw[idx3:idx3+600]
print("12. repr:", repr(chunk3))
# Find NE-10 line
idx4 = raw.find(b"NE-10")
chunk4 = raw[idx4:idx4+120]
print("NE-10 repr:", repr(chunk4))
