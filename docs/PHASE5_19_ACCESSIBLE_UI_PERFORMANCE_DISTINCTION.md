# Phase 5.19 — Accessible UI Wayfinding + Performance View Distinction

This phase focuses on faster feature recognition, lower cognitive load, and clearer separation between the management interface and the live performance interface.

## What changed

### Visual wayfinding
- Primary navigation now uses grouped sections: Build, Live, Memory, and System.
- Each major tab has a consistent color, icon, label, and tooltip.
- The navigation remains horizontally scrollable on small screens.
- The design avoids relying on color alone by pairing color with icons, section labels, and text.

### Accessibility / clarity mode
- Settings now includes a Visual Clarity option.
- Clear Cues mode increases visual weight and spacing, strengthens outlines, and switches to dyslexia-friendly typography.
- Global focus rings are stronger for keyboard and pedal users.
- Reduced-motion preferences are respected.

### Stage Manager distinction
- Stage Manager is now styled more like a control console.
- The header clarifies that it is for set control, requests, readiness, timing, and editing.
- Live actions use more obvious color-coded function pills.

### Performance View distinction
- Performance Mode now has a darker dedicated live-view treatment.
- Current song, chords, timing, and live controls are visually separated from the administrative Stage Manager view.
- Sheet, Note, Skip/Undo, and Done actions use stronger color coding and larger touch targets.

## Testing checklist

1. Open every main navigation tab and confirm the icon/color/label pattern is clear.
2. Open Settings and toggle Visual Clarity mode.
3. Confirm Visual Clarity persists after refresh.
4. Open Stage Manager and confirm it feels different from Performance Mode.
5. Open Performance Mode and confirm it is simpler, darker, and easier to read at a glance.
6. Confirm keyboard focus rings are visible when tabbing through controls.
7. Test Stage and Performance Mode on phone/tablet widths.
