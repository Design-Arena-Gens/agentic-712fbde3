## Helios Calling Agent

Helios is a guided calling workspace that helps outbound agents drive consistent conversations. It combines live script coaching, conversation journaling, follow-up task tracking, and wrap-up automation in a single Next.js interface that can be deployed directly to Vercel.

### Features
- **Adaptive playbooks** – step-by-step scripts with instant logging, auto-advance, and voice cue playback for each prompt.
- **Live conversation journal** – append agent, lead, or system notes on the fly while reviewing the latest 14 interactions.
- **Call momentum dashboard** – track call state, elapsed time, scripted progress, and confidence signals.
- **Task + wrap-up workflows** – manage objectives and commitments, capture summaries, and mark leads complete.
- **Lead dossier** – enriched contact insights, recommended talking points, and editable notes per lead.

### Tech Stack
- Next.js App Router with TypeScript
- Tailwind CSS (v4) styling
- Speech Synthesis API for optional voice cues
- Lucide icons

### Local Development
```bash
npm install
npm run dev
```
Visit `http://localhost:3000` to explore the agent dashboard.

### Production Build
```bash
npm run lint
npm run build
```

### Deployment
Deployments are configured for Vercel using `vercel deploy --prod --yes --token $VERCEL_TOKEN --name agentic-712fbde3`.

### Project Structure
- `src/app/page.tsx` – main calling agent UI, state management, and interaction logic.
- `src/data/leads.ts` – mock lead data, objectives, and scripts.
- `src/app/globals.css` – Tailwind layer + global styling tokens.

### License
This project is provided as-is for demonstration and can be extended to integrate with telephony or CRM back ends.
