[root](../../README.md) / [src](../README.md) / windows

# Window deck

The open browser windows, as a column to switch between.

## Why it is not a tab in the panel

The Tabs tab answers *what have I got open*. This answers *where do I go now*,
and the two want different shapes. A deck is something you park down the side
of a screen and leave there, where the panel is docked to one browser window
and goes wherever that window goes.

So it is a window of its own: one instance, raised rather than reopened, with
its bounds remembered, and it closes only when somebody closes it. That is the
same `openSingletonWindow` the bookmark manager and the settings window use —
a second copy would be a second view of the same state, free to disagree with
the first on screen.

## What is in the list

Every ordinary browser window, named after whatever is in front of you in it,
because that is the one thing about a window you would recognise. A window
holding a single tab is in the list like any other: it is still a place you
were working, and leaving it out would make the deck a partial answer.

Popups are left out. A popup is something an extension or a page put on the
screen for a purpose, and the deck itself is one of them — a list offering to
switch to the window you are reading it in would be worse than useless.

## Organising it

The rows borrow the tabs list's shape so the gestures are not learned twice:
the name switches to the window, the **✕** closes it, and a right-click on the
icon gives **Move to top / up / down / to bottom**. A **📍** holds a window at
the top of the deck, which is most of what pinning is for in a list that
rearranges itself every time a window opens.

A window holding more than one tab also offers **⧉**, which takes the tab in
front out into a window of its own and leaves the rest where they are. It is
the deck's answer to a window that has grown into several things at once, and
it is absent on a single-tab window, where it would move the tab from one
window into an identical one.

Closing asks first when the window holds more than one tab. The tabs list
closes a tab without asking because one tab is one thing; a window is however
many of them you have not looked at lately.

## Nothing is stored

The order and the pins live as long as the page does. A window id does not
outlive its window, so an order kept across a restart would be an order about
windows that no longer exist — and the deck is a view of what is open right
now, which is exactly the thing that is worthless once it is stale.

## Files

- `openWindows.ts` — reading the browser's windows into rows, ordering them,
  and the words for what closing one would cost. Named for what it reads, not
  for the deck: `windowDeck.ts` beside `WindowDeck.tsx` differs only in case,
  and a case-insensitive filesystem resolves `./WindowDeck` to whichever it
  meets first — which broke the build on Windows and nowhere else
- `useWindowDeck.ts` — the live list, re-read on every window and tab event
- `WindowDeck.tsx` — the rows
- `WindowDeckApp.tsx` — the page, which owns the order and the pins
