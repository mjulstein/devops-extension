[root](../../../README.md) / [src](../../README.md) / [sidepanel](../README.md) / apps

# `src/sidepanel/apps`

Apps in the favorites search: one row per app, with its environments chosen on
the row rather than each taking a row of its own.

An app is a family of addresses for the same thing. Listing every environment
separately would bury the favorites and the other apps between them, so the
plain search shows the app once and the environment is picked three ways:
**Enter** takes the first, **Tab** steps to the next, and typing a second word
names one.

That is the fast path, and it assumes you know what the environment is called.
The `-` prefix is the other one: on its own it lists the apps, naming one walks
into its folder and shows the bookmarks inside, and a further word filters
them. Same shape as the `.` prefix for bookmark folders, for the same reason —
when you cannot remember what an app's environments are called, being shown
them beats having to name one.

| File | What it holds |
| --- | --- |
| [`appDns.ts`](./appDns.ts) | Working out an app's other addresses from the ones it already has. |
| [`appsQuery.ts`](./appsQuery.ts) | Reading `my-app test` into an app and an environment, and which environment a row points at after *n* presses of Tab. |
| [`appsFolder.ts`](./appsFolder.ts) | The bookmark layout, and adding an environment to it. |
| [`envSwitch.ts`](./envSwitch.ts) | Switching environment without losing your place, and when a tab can be reused. |
| [`appMatch.ts`](./appMatch.ts) | Which app a page belongs to, once that app has a folder. |
| [`useApps.ts`](./useApps.ts) | The apps as the bookmarks currently hold them, kept current. |

## Where they live

```
<favorites folder>/
  Apps/
    my-app/
      live   -> https://my-app.orgname.com
      test   -> https://my-app-test.orgname.com
```

Real bookmarks, for the same reason the favorites and the quick tasks are: the
browser syncs them, so the apps reach a machine that has never had this
extension installed, and they can be rearranged in the bookmark manager like
anything else. The order inside an app's folder is the order the environments
are offered in, so dragging them there is how you say which one Enter should
take.

`Apps` is a folder of its own rather than part of the favorites because the two
are different kinds of thing, and a search that put twelve environments among
the favorites would bury them.

## Two shapes of address

```
my-app.orgname.com   ->  my-app-test.orgname.com   (suffixed on the app label)
my-app.com           ->  test.my-app.com           (prefixed as a label)
```

Which shape an app uses is never configured and never guessed from a list of
known environment names — there is no such list anywhere in here, deliberately.
It is read back out of the addresses already stored for the app. Two of them are
enough to see the pattern outright, including the case where every address
carries its own marker and none is the plain one.

With a single address, `parseAppUrl` reads the subdomain:

- **no hyphen in it** — it is the environment. `test.my-app.com` is the test
  environment of `my-app.com`, because an app whose name needs no hyphen is not
  usually what a subdomain there means.
- **`www`, or no subdomain at all** — the app is the main domain, with no
  environment named.
- **a hyphen in it** — it is the app, sitting under somebody else's domain:
  `my-app.orgname.com`.

Naming the environment removes the guesswork, which is what the commands do:
told that an address is `test`, the marker is found and taken off, so
`my-app-test.orgname.com` files under `my-app` rather than under something that
looks like a fourth app.

One consequence worth knowing: an app with no hyphen in its name, sitting on an
organization's domain — `myapp.orgname.com` — reads as the `myapp` environment
of `orgname.com`, because from the address alone there is nothing to tell the
two apart. Give it a name when registering it (`>add app myapp`) and add its
addresses explicitly.

## Adding what you are looking at

`>add app` takes the page you are on and files it. Which app it belongs to is
answered by the folders you already have: an address containing an app's name
goes in that app's folder, punctuation ignored, because `myapp-dev.orgname.com`
is the app you called `my-app` and refusing it over a hyphen would be correct
and useless. The longest matching name wins, so `my-app-admin` is not swallowed
by `my-app`. Only when no folder matches is a name read out of the address
instead.

The whole address is stored, path and query included. The bookmark is named
after whatever the address says the environment is, or after the host when it
says nothing — a placeholder, because there is no list of environment names here
and inventing one would be worse than a name you can see is provisional. Nothing
depends on it, so nothing waits for it to be right.

A host typed into a command is an address: `https://` goes in front unless a
scheme is already there. An explicit `http://` is kept, which is what it is for
— a local server on a port. A port is not a scheme, so `localhost:3000` is still
read as https; a local server has to be typed with its `http://`, since guessing
from the word localhost would break the ones that do use https.

## Switching environment keeps your place

Picking another environment of the app you are already looking at is almost
never a request for its front page: you are on a record, a report, a search, and
you want the same thing over there. So only the host changes and the path, query
and fragment come with you — `env1.my-app.com/some/path?x=1` becomes
`env2.my-app.com/some/path?x=1`.

It applies only between two environments of the *same* app, checked against the
app's own stored addresses rather than guessed from the names, because the
addresses are the only thing reliably true: deployments are inconsistent enough
that `myapp-dev` and `my-app-test` belong to one app. Standing anywhere else,
the environment's own address opens untouched, and standing on its front page
there is nothing worth carrying. The environment being switched *to* does not
have to be stored, so a suggested one carries your place as well.

A tab already showing exactly that address — query included, fragment ignored —
is raised rather than a second one opened beside it, or flipping between two
environments would leave a row of duplicates behind. Anything not already open
gets a new tab, so the page you came from is still there to go back to.

## Derivation is a suggestion

Real deployments are inconsistent — `my-app` in one environment and `myapp` in
the next — so a stored address always beats a worked-out one, and typing the
name of an environment the app has never been given produces a row marked
*suggested*. Opening it stores it, which is how the folder fills up as you visit
things. When the guess was wrong, add it again from the address that worked, or
fix it in the bookmark manager: both write to the same bookmark, because
`addAppEnvironment` matches on the environment's name.
