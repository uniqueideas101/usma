# usma

Mobile-first React + TypeScript app scaffolded with Vite, React Router, and Tailwind CSS v4.

## Routes

- `/` role selection
- `/login` student sign-in
- `/home`, `/schemes`, `/eligibility/:schemeId`, `/tracker/:appId`, `/nudges` student experience
- `/officer`, `/officer/application/:appId` officer workflow
- `/admin` administration overview

The student routes use a centered layout capped at 480px with a persistent Home, Schemes, Tracker, and Nudges tab bar. Officer and admin routes do not show student navigation.

## Development

```sh
npm install
npm run dev
```

Run `npm run build` for a production build and `npm run lint` for lint checks. Scheme and application data is sample UI content; authentication and backend services are not connected.
