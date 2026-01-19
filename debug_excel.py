import pandas as pd
import shutil
import os

src = "c:/Users/iftahe/Greece Project/Progreece21 - Sheet2.csv"
dst = "c:/Users/iftahe/Greece Project/temp_debug.xlsx"

print(f"Copying {src} to {dst}...")
shutil.copyfile(src, dst)
print("Copy done.")

print("Attempting to read with pandas...")
try:
    df = pd.read_excel(dst, engine='openpyxl')
    print("Success!")
    print(df.columns)
    print(df.head())
except Exception as e:
    print(f"Error: {e}")

# Cleanup
if os.path.exists(dst):
    os.remove(dst)
