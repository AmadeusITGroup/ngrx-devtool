---
sidebar_position: 2
title: Installation
---

# Installation

## Step 1: Install the package

```bash
npm install ngrx-devtool
```

:::note
If your project uses a private npm registry and you get an E401 error:

```bash
npm install ngrx-devtool --registry=https://registry.npmjs.org/
```
:::

## Development setup with npm link (contributors only)

For contributors or local development, use `npm link` instead:

```bash
git clone https://github.com/amadeusitgroup/ngrx-devtool
cd ngrx-devtool
npm install
npm run build

cd dist/ngrx-devtool
npm link

# In your Angular project directory
npm link ngrx-devtool
```

:::note
If you encounter module resolution issues with npm link, see [npm Link Issues](../troubleshooting/common-issues#npm-link-issues).
:::
