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


SUBJECT_TEMPLATE = "free tools for {daycare} — AI lesson plans, payroll & more"

BODY_TEMPLATE = """Hi {greeting},

I came across {daycare} {found}, and wanted to pass along some free tools we built for BC daycares. Use them, keep them — no signup for these three:

• Profitability calculator — margins & break-even in 30 seconds:
  https://cubbycare.vercel.app/tools/daycare-profitability-calculator
• AI lesson plan generator — a play-based, multi-day plan in ~20 seconds:
  https://cubbycare.vercel.app/tools/ai-lesson-plan-generator
• BC staff ratio calculator:
  https://cubbycare.vercel.app/tools/daycare-staff-ratio-calculator-bc

And when you have five minutes, Cubby itself is free to get started — no card, no sales call:

• Parent accounts your families join with one link — daily photos, reports & messaging
• AI-drafted daily notes and end-of-day recaps for your educators
• Payroll prep — tracked staff hours become gross pay and printable stubs
• AI intake — photograph a paper enrolment form and it sets up the child and the family's account

Everything's at https://cubbycare.vercel.app — built in Langley by my studio (we've done web work for Swan Childcare and Maple Montessori). If you try anything and have thoughts, I read every reply.

Ben
OKTD · Langley BC

—
83 - 7947 209 St, Langley BC V2Y 0Y6 · reply "unsubscribe" to opt out
"""


# (to_address, greeting_name, daycare_name, where_we_found_them)
# BATCH E — Variation E (everything-free framing + "found you" mention, NO pricing),
# 10 freshly researched Vancouver / Delta / Victoria centres (2026-06-11).
# All emails are conspicuously published business addresses (CASL implied consent).
EMAILS = [
    ("tiggywi@gmail.com", "team", "Tiggy Winkle Preschool", "while looking up Kitsilano preschools"),
    ("kitscottage@gmail.com", "team", "Kit's Cottage Daycare", "through your website while researching Vancouver daycares"),
    ("kitsarea@kaccs.ca", "team", "Kitsilano Area Child Care Society", "through your website while researching Kitsilano childcare"),
    ("inquiry@littlemunchkindaycare.ca", "team", "Little Munchkin Daycare", "through your website while researching Vancouver daycares"),
    ("info@reachforthestarsmontessori.com", "team", "Reach for the Stars Montessori", "through your website while researching Vancouver Montessori programs"),
    ("treeoflife_childcare@hotmail.com", "team", "Tree of Life Childcare", "on Delta's child care listings"),
    ("sunnytownlearnandplay@gmail.com", "Ray", "Sunny Town Learn & Play", "through your website while researching Tsawwassen childcare"),
    ("mkaston@svdpvictoria.com", "Meagan", "Mary's Place Childcare", "while researching Victoria childcare centres"),
    ("childcaremanager@victoriawest.ca", "Jack", "Victoria West Childcare", "through the Victoria West Community Association site"),
    ("info@littlefriendschildcare.ca", "team", "Little Friends Childcare", "through your website while researching Victoria childcare"),
]

# Sent so far:
#   Batch A (Var A "Quick idea for…"): ABC Childcare, The Open Door, Kamloops Kidz,
#     Okanagan Montessori, Junior Einstein's (Whalley).
#   Batch B (Var B "quick question…"): Bright Angels Surrey, Everyday Sunshine,
#     Sunshine Children's Centre, Bloom Childcare, New Leaf.
#   Batch C (Var C credibility story): JE Fleetwood + Gateway, Bright Angels Langley,
#     Bluebirds (Maple Ridge), ABM, Kidstown, Imagination Station, Promontory Hummingbird.
#   Batch D (Var D free-tools value lead): Bluebird North Van, Parkway Village,
#     Rainforest, Friendship Corner, Rocky Point, Sweet Smile (Mona), Canyon Springs,
#     Little Footprints, WCASS, Coquitlam Montessori Society.
REMAINING = []


def main():
    context = ssl.create_default_context()
    print(f"Connecting to {SMTP_HOST}:{SMTP_PORT} as {SENDER}...")
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls(context=context)
        server.login(SENDER, PASSWORD)
        print(f"Logged in. Sending {len(EMAILS)} emails, ~{PACING_SECONDS}s between each.\n")

        for i, (to, greeting, daycare, found) in enumerate(EMAILS, 1):
            msg = EmailMessage()
            msg["From"] = SENDER
            msg["To"] = to
            msg["Subject"] = SUBJECT_TEMPLATE.format(daycare=daycare)
            msg.set_content(BODY_TEMPLATE.format(greeting=greeting, daycare=daycare, found=found))
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
