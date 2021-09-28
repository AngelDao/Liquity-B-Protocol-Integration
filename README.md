# B-Protocol implementation for Liquty Protocol Frontend

This repo implments B-Protocol into the offical Liquity Protocol frontend.

## Changes

**_These are the changes needed to impement B-Protocol into the Liquity Frontend._**

- `packages/dev-frontend/src/LiquityFrontend.tsx`

  Add this `Route` as the last component within the `Switch` component

```
<Route path="/b-protocol">
    <iframe
    height="800px"
    width="100%"
    frameBorder="0"
    src={"/b-protocol?hideNav=true"}
    // style={{ frameBorder: 0 }}
    ></iframe>
</Route>

```

- `packages/dev-frontend/src/components/Nav.tsx`

  Add this `Link` as the last component within the last `Flex` component

```
<Link sx={{ fontSize: 1 }} to="/b-protocol">
    B-Protocol
</Link>

```

- `packages/dev-frontend/src/components/SideNav.tsx`

  Add this `Link` as the last component within the last `Flex` component

```
<Link to="/b-protocol">B-Protocol</Link>

```
