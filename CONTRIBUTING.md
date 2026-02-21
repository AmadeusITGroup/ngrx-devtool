# Contributing to NgRx DevTool

Thank you for your interest in contributing! This guide will help you get started.

---

## Getting Started

### Prerequisites

- Node.js 18.x or 20.x
- npm
- Angular CLI

### Development Setup

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/ngrx-devtool.git
   cd ngrx-devtool
   ```
3. **Install dependencies:**
   ```bash
   npm install
   ```

---

## Development Workflow

### Running the Demo App

```bash
ng serve ngrx-devtool-demo
```

### Building the Library

```bash
npm run build
```

### Testing Locally with an Angular App

To test your changes in a real Angular project, use `npm link`:

```bash
# Build the library
npm run build

# Link it globally
cd dist/ngrx-devtool
npm link

# In your Angular project directory
npm link ngrx-devtool
```

Then start the DevTool server:

```bash
# From the ngrx-devtool directory
node dist/index.js
```

> **Note:** If you get module resolution errors after linking, add `"preserveSymlinks": true` in both `tsconfig.json` (`compilerOptions`) and `angular.json` (build `options`) of your Angular project. After running `npm install`, you may need to re-run `npm link ngrx-devtool`.

### Running Tests

```bash
npm test              # Run tests once
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

### Linting

```bash
npm run lint          # Check for lint errors
npm run lint:fix      # Auto-fix lint errors
```

---

## Submitting Changes

### Branch Naming

Use descriptive branch names:
- `feat/description` — for new features
- `fix/description` — for bug fixes
- `docs/description` — for documentation changes
- `refactor/description` — for code refactoring
- `test/description` — for adding or updating tests

### Commit Messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/). Commit messages are validated by commitlint.

Format: `type(scope): description`

Examples:
```
feat(core): add selector tracking support
fix(effects): correct lifecycle event ordering
docs(readme): update installation instructions
test(store): add unit tests for meta reducer
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`

### Pull Request Process

1. Create a feature branch from `master`
2. Make your changes
3. Ensure all tests pass: `npm test`
4. Ensure linting passes: `npm run lint`
5. Push your branch and open a pull request against `master`
6. CI will automatically run lint and tests — both must pass before merging

### Code Quality Requirements

- All new code must include unit tests
- Existing tests must continue to pass
- Code must pass linting without errors
- Keep pull requests focused — one feature or fix per PR

---

## Project Structure

| Directory | Description |
|-----------|-------------|
| `projects/ngrx-devtool/` | Core library package |
| `projects/ngrx-devtool-ui/` | Standalone visualization UI |
| `projects/ngrx-devtool-demo/` | Example implementation |
| `projects/ngrx-devtool-docs/` | Documentation site |

---

## Reporting Issues

- Use the [bug report template](https://github.com/AmadeusITGroup/ngrx-devtool/issues/new?template=bug_report.yml) for bugs
- Use the [feature request template](https://github.com/AmadeusITGroup/ngrx-devtool/issues/new?template=feature_request.yml) for new ideas

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). Please be respectful and constructive in all interactions.

---

## Questions?

If you have questions about contributing, open an issue and we'll be happy to help.
