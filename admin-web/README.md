# Fashaun Admin Web

Internal web workspace for brand ingestion and catalog review.

## Why this exists

This app replaces the internal-only admin screens that previously lived inside the customer mobile app. It uses the same Supabase project, auth users, and tables as the mobile app, so there is no second Supabase setup to pay for or maintain.

## Environment

Copy `.env.example` to `.env` and provide:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ADMIN_EMAILS`

Use the same Supabase URL and anon key already used by the mobile app. Restrict admin access by listing approved emails in `VITE_ADMIN_EMAILS`.

## Commands

- `npm install`
- `npm run dev`
- `npm run build`

## Current scope

- admin sign-in
- admin email gate
- import brand into review queue
- retry ingestion
- review and edit brand metadata
- review and edit imported products
- approve, reject, publish, and mark brands live
