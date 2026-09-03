// Metro config tuned for this pnpm workspace.
//
// Two things break by default in a pnpm monorepo and are fixed here:
//   1. Metro only watches the app folder, so edits in lib/* never trigger a
//      reload and imports of @workspace/* fail to resolve.
//   2. pnpm's symlinked store means a package can be resolved from more than
//      one location, which yields duplicate copies of react at runtime.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..', '..');

const config = getDefaultConfig(projectRoot);

// 1. Watch the whole workspace so lib/api-client-react changes hot-reload.
config.watchFolders = [workspaceRoot];

// 2. Resolve modules from the app first, then the workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. pnpm uses symlinks heavily — let Metro follow them rather than
//    treating each realpath as a separate module.
config.resolver.unstable_enableSymlinks = true;

// 4. @workspace/api-client-react ships raw TypeScript via its "exports"
//    field, so package-exports resolution has to stay on.
config.resolver.unstable_enablePackageExports = true;

// 5. Force a single copy of react / react-native no matter where an
//    import originates. Without this you get the "Invalid hook call"
//    error as soon as a workspace lib renders a hook.
config.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, 'node_modules/react'),
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
};

module.exports = config;
