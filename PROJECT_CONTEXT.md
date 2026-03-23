# Fashaun V1 — Project Context

## Project Overview
Fashaun V1 is a fashion discovery mobile app where users follow brands, browse their catalogs, discover new drops, and open brand product pages inside the app to complete checkout on the original store.

The goal is to remove the need for users to visit multiple fashion websites individually.

Fashaun is a discovery and orchestration layer for fashion commerce, not a payment processor or marketplace in V1.

The customer-facing mobile app lives at the repo root. Internal brand ingestion and review now live in a separate `admin-web/` workspace that shares the same Supabase project.

---

## Founder
Ayo Popoola

---

## Core V1 Product Idea
Users should be able to:

- create an account
- follow their favorite fashion brands
- see products from followed brands in one feed
- open product details
- click through to the original brand site in an in-app browser
- receive alerts for new drops later in the build
- view lightweight purchase history later in the build

---

## Product Scope for V1
### In scope
- brand following
- Shopify-first catalog ingestion
- product catalog storage
- discovery feed from followed brands
- product details page
- in-app browser to open brand product pages
- lightweight interaction tracking
- basic alerts later
- lightweight purchase history later

### Out of scope
- native checkout inside Fashaun
- payment processing
- affiliate integrations
- AI stylist
- advanced recommendation engine
- full purchase confirmation from third-party stores
- non-Shopify ingestion at launch
- social/community features

---

## Tech Stack
### Mobile
- React Native
- Expo
- TypeScript

### Backend / Scripts
- Node.js
- TypeScript

### Database
- Supabase
- Postgres

### Catalog ingestion
- Shopify public product endpoints first
- possible web scraping later

### Notifications
- planned for later
- likely Firebase / Expo-compatible push setup

---

## Project Structure
```text
Fashaun V1/
  app/                Customer mobile app screens, navigation, and services
  admin-web/          Internal web app for brand ingestion and review
  backend/            Node.js TypeScript scripts workspace
