# AmuseFlow — Frontend

![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)

React + TypeScript + Vite frontend for **AmuseFlow** — a theme park attraction reservation system. Three portals in one app, talking to [AmuseFlowWebAPI](../AmuseFlowWebAPI) over REST with JWT auth.

## Portals

- **Visitor** — browse attractions and attraction bundles, book schedules, track bookings, leave reviews, receive real-time notifications
- **Admin** — manage attractions, bundles, schedules, bookings, users, validation settings (including Kid/Teen/Adult rider category presets), generate ratings reports (PDF/Word export), and view system-wide activity logs and notifications
- **Ride Attendant** — view assigned schedules, verify visitors, collect payment, and check guests in (bookings auto-complete once a schedule's window closes)

## Tech stack

- **React 19** with hooks, no class components
- **TypeScript** throughout — `types.ts` mirrors the backend's DTO shapes
- **Vite** for dev server and build
- **Tailwind CSS** for styling, no component library
- **react-hot-toast** for notifications, **lucide-react** for icons
- **jspdf** + **html2canvas** and **docx** for exporting Admin reports as PDF/Word

## Getting started

```bash
npm install
npm run dev
```

Point the API base URL (see `src/services/api.ts`) at a running instance of [AmuseFlowWebAPI](../AmuseFlowWebAPI).

```bash
npm run build   # production build
npx tsc -b      # typecheck only
```

## Project structure

```
src/
  pages/
    admin/       # Admin portal pages
    visitor/     # Visitor portal (VisitorDashboard)
    attendant/   # Ride Attendant portal (AttendantDashboard)
  components/
    layout/      # AdminLayout, PortalLayouts (shared header/nav/notification bell)
  services/
    api.ts       # API client, one function group per backend controller
  types.ts       # TypeScript types mirroring backend DTOs
```

## Documentation

Project documentation lives under [`documentations/`](./documentations):

- [`documentations/adr/`](./documentations/adr) — Architecture Decision Records: written records of notable engineering/design decisions and the reasoning behind them, indexed there as they're added
- [`documentations/use_cases/`](./documentations/use_cases) — the formal project use case document (actors, use cases, detailed flows), shared with the [AmuseFlowWebAPI](../AmuseFlowWebAPI) backend

