#!/usr/bin/env python3
"""
Send Cubby outreach emails via Gmail SMTP using an app password.

Setup:
  1. Enable 2FA on info@oktd.ca if not already.
  2. Generate an app password at https://myaccount.google.com/apppasswords
     (select "Mail" / "Other (Custom name)" → name it "OKTD outreach")
  3. Create a file named `.env` next to this script with one line:
       OKTD_GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx
     (16 chars, no spaces. Don't share it.)
  4. Run: python3 send_cubby_emails.py
"""

import os
import smtplib
import ssl
import time
from email.message import EmailMessage
from pathlib import Path

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587
SENDER = "info@oktd.ca"
PACING_SECONDS = 20  # pace sends so Gmail doesn't flag a brand-new sender


def load_env():
    env_path = Path(__file__).parent / ".env"
    if not env_path.exists():
        raise SystemExit(
            f"Missing {env_path}. Create it with: OKTD_GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx"
        )
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


load_env()
PASSWORD = os.environ.get("OKTD_GMAIL_APP_PASSWORD")
if not PASSWORD:
    raise SystemExit("OKTD_GMAIL_APP_PASSWORD not set in .env")


SUBJECT_TEMPLATE = "a free profitability calculator for {daycare}"

BODY_TEMPLATE = """Hi {greeting},

I build software for BC daycares (I've done web work for Swan Childcare and Maple Montessori), and we just released three free tools owners kept asking for — no signup, no catch:

• Daycare profitability calculator — margins, break-even, per-child profit:
  https://cubbycare.vercel.app/tools/daycare-profitability-calculator
• AI lesson plan generator — a play-based, multi-day plan in ~20 seconds:
  https://cubbycare.vercel.app/tools/ai-lesson-plan-generator
• BC staff ratio calculator:
  https://cubbycare.vercel.app/tools/daycare-staff-ratio-calculator-bc

They're part of Cubby, the daycare app I built after seeing what the big platforms charge: daily photo reports parents love, messaging, milestones, payroll prep from your staff's tracked hours, even AI that reads your paper intake forms and creates the family's account. Free up to 5 children, then $20/mo + $2 per child — Brightwheel-class platforms run $150+ and take a cut of tuition; we take 0%.

I'm signing my first 10 BC daycares as founding centres: pricing locked for life, plus my studio rebuilds your website free while you're with us.

Use the tools either way — they're yours. And if the app looks interesting: https://cubbycare.vercel.app or call/text me at 778-887-5216.

Ben
OKTD · Langley BC

—
83 - 7947 209 St, Langley BC V2Y 0Y6 · reply "unsubscribe" to opt out
"""


# (to_address, greeting_name, daycare_name)
# BATCH D — Variation D (value-led: free tools first), 10 freshly researched
# North Shore / Tri-Cities / New West / White Rock centres (2026-06-11).
# All emails are conspicuously published business addresses (CASL implied consent).
EMAILS = [
    ("bluebird_daycare@yahoo.ca", "team", "Bluebird Daycare"),                 # North Vancouver
    ("info@pvchildcare.com", "team", "Parkway Village Childcare"),            # North Vancouver
    ("info@rainforestlearningcentre.ca", "team", "Rainforest Learning Centre"), # Metro Van (indie multi-site)
    ("friendship.care@live.ca", "team", "Friendship Corner"),                 # Coquitlam (Montessori, non-profit)
    ("rockypointdaycare@gmail.com", "team", "Rocky Point Montessori"),        # Port Moody
    ("Mona-abass@hotmail.com", "Mona", "Sweet Smile Montessori"),             # Port Coquitlam (owner: Mona)
    ("admin@canyonspringsmontessori.com", "team", "Canyon Springs Montessori"), # Coquitlam
    ("info@lfpacademy.com", "team", "Little Footprints Academy"),             # White Rock / Delta / Surrey
    ("admin@wcass.com", "team", "WCASS"),                                     # New Westminster (after-school care)
    ("chairperson@coquitlammontessori.ca", "team", "Coquitlam Montessori"),   # Coquitlam (parent-board society)
]

# Sent so far:
#   Batch A (Var A "Quick idea for…"): ABC Childcare, The Open Door, Kamloops Kidz,
#     Okanagan Montessori, Junior Einstein's (Whalley).
#   Batch B (Var B "quick question…"): Bright Angels Surrey, Everyday Sunshine,
#     Sunshine Children's Centre, Bloom Childcare, New Leaf.
#   Batch C (Var C credibility story): JE Fleetwood + Gateway, Bright Angels Langley,
#     Bluebirds (Maple Ridge), ABM, Kidstown, Imagination Station, Promontory Hummingbird.
REMAINING = []


def main():
    context = ssl.create_default_context()
    print(f"Connecting to {SMTP_HOST}:{SMTP_PORT} as {SENDER}...")
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls(context=context)
        server.login(SENDER, PASSWORD)
        print(f"Logged in. Sending {len(EMAILS)} emails, ~{PACING_SECONDS}s between each.\n")

        for i, (to, greeting, daycare) in enumerate(EMAILS, 1):
            msg = EmailMessage()
            msg["From"] = SENDER
            msg["To"] = to
            msg["Subject"] = SUBJECT_TEMPLATE.format(daycare=daycare)
            msg.set_content(BODY_TEMPLATE.format(greeting=greeting))
            try:
                server.send_message(msg)
                print(f"[{i}/{len(EMAILS)}] sent → {to}")
            except Exception as e:
                print(f"[{i}/{len(EMAILS)}] FAILED → {to}: {e}")

            if i < len(EMAILS):
                time.sleep(PACING_SECONDS)

    print("\nDone.")


if __name__ == "__main__":
    main()
