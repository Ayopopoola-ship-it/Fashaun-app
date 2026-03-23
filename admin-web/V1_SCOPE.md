# Fashaun Admin V1 Scope

## Purpose

`admin-web` is the internal control panel used to validate brands and products before they appear in the customer-facing Fashaun mobile app.

It is not a second customer product. It is an internal publishing and review surface that shares the same Supabase project as the mobile app.

## Primary user

- founder or internal operator
- trusted admin accounts only

## V1 goals

- import a brand into the system
- detect the likely source type for that brand
- run ingestion against Shopify-first and generic site sources
- review imported brand metadata
- review imported product drafts
- approve, reject, edit, and publish products
- mark verified brands live in the customer app

## Core workflow

1. Admin signs in with an approved email.
2. Admin enters a brand name plus optional website and Instagram.
3. Admin imports the brand into the review queue.
4. System classifies the source and attempts ingestion.
5. Admin reviews the brand record and imported products.
6. Admin edits any incorrect metadata.
7. Admin approves or rejects products.
8. Admin publishes products and marks the brand live.

## V1 screens

- sign-in screen
- review queue
- brand detail and ingestion actions
- product review and editing surface

## Permissions model

- use Supabase Auth with the same project as mobile
- allow access only for emails listed in `VITE_ADMIN_EMAILS`
- no second Supabase project is required for V1

## What V1 should not do

- customer browsing or shopping flows
- community or social features
- deep reporting dashboards
- complex role hierarchies
- a separate ingestion backend if the current direct workflow is sufficient

## Operational posture

- keep the customer app clean and customer-facing only
- keep internal ingestion and publishing in `admin-web`
- continue using the backend workspace for batch and operational scripts

## Suggested next improvements after V1

- move sensitive ingestion and publish actions behind server-side endpoints or edge functions
- add audit history for admin actions
- add brand and product filters
- add image review and raw-source inspection
- add stronger permissions than email allowlisting
