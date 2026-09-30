[root](../../../README.md) / [src](../../README.md) / [sidepanel](../README.md) / apps

# `src/sidepanel/apps`

Apps in the favorites search: one row per app, with its environments chosen on
the row rather than each taking a row of its own.

An app is a family of addresses for the same thing. Listing every environment
separately would bury the favorites and the other apps between them, so the
search shows the app once and the environment is picked three ways: **Enter**
takes the first, **Tab** steps to the next, and typing a second word names one.

| File | What it holds |
| --- | --- |
| [`appDns.ts`](./appDns.ts) | Working out an app's other addresses from the ones it already has. |
| [`appsQuery.ts`](./appsQuery.ts) | Reading `my-app test` into an app and an environment, and which environment a row points at after *n* presses of Tab. |
| [`appsFolder.ts`](./appsFolder.ts) | The bookmark layout, and adding an environment to it. |
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

## Derivation is a suggestion

Real deployments are inconsistent — `my-app` in one environment and `myapp` in
the next — so a stored address always beats a worked-out one, and typing the
name of an environment the app has never been given produces a row marked
*suggested*. Opening it stores it, which is how the folder fills up as you visit
things. When the guess was wrong, add it again from the address that worked, or
fix it in the bookmark manager: both write to the same bookmark, because
`addAppEnvironment` matches on the environment's name.
